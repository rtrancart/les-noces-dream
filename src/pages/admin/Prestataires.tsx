import { useEffect, useState, useRef, useMemo, ReactNode } from "react";
import LocationPicker, { type CitySearchData } from "@/components/LocationPicker";
import { haversineDistanceKm } from "@/lib/haversine";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Eye, Plus, Pencil, Trash2, Loader2, CalendarIcon, X, ChevronDown, ChevronRight, EyeOff, ImageIcon } from "lucide-react";
import PrestatairePhotosTab from "@/components/admin/PrestatairePhotosTab";
import { EmailLogsDialog } from "@/components/admin/EmailLogsDialog";
import { Mail } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";
import { logAdmin } from "@/lib/logAdmin";
import { REGIONS, DOM, PAYS_LIMITROPHES, getZoneLabel, getDepartementsByRegion, regionFieldToZoneValue } from "@/lib/zonesIntervention";
import { REGIONS as REGIONS_FR } from "@/lib/regions";

type Prestataire = Database["public"]["Tables"]["prestataires"]["Row"];
type StatutPrestataire = Database["public"]["Enums"]["statut_prestataire"];
type Categorie = Database["public"]["Tables"]["categories"]["Row"];

const statutLabels: Record<StatutPrestataire, string> = {
  brouillon: "Brouillon",
  pre_inscrit: "Pré-inscrit",
  a_completer: "À compléter",
  en_attente: "En attente",
  a_corriger: "À corriger",
  validee: "Validée",
  actif: "Actif",
  suspendu: "Suspendu",
  archive: "Archivé",
};

const statutColors: Record<StatutPrestataire, string> = {
  brouillon: "bg-muted/40 text-muted-foreground",
  pre_inscrit: "bg-or/20 text-or",
  a_completer: "bg-terracotta/20 text-terracotta",
  en_attente: "bg-champagne/30 text-foreground",
  a_corriger: "bg-destructive/10 text-destructive",
  validee: "bg-champagne/40 text-foreground",
  actif: "bg-sauge/20 text-sauge",
  suspendu: "bg-destructive/10 text-destructive",
  archive: "bg-muted/40 text-muted-foreground",
};

// Statuts sélectionnables manuellement par l'admin.
// 'actif' est exclu : il ne peut être obtenu qu'en signant validee + charte (trigger DB).
const SELECTABLE_STATUTS: StatutPrestataire[] = [
  "brouillon",
  "pre_inscrit",
  "a_completer",
  "en_attente",
  "a_corriger",
  "validee",
  "suspendu",
  "archive",
];

const emptyForm = {
  nom_commercial: "",
  slug: "",
  description_courte: "",
  description: "",
  ville: "",
  region: "",
  code_postal: "",
  adresse: "",
  telephone: "",
  email_contact: "",
  site_web: "",
  categorie_mere_id: "",
  categorie_fille_id: "",
  prix_depart: "",
  prix_max: "",
  statut: "brouillon" as StatutPrestataire,
  fin_premium: "",
  notes_admin: "",
  cree_par_admin: true,
  zones_intervention: [] as string[],
  create_password: "",
  prenom_contact: "",
  nom_contact: "",
  notes_pre_inscription: "",
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

function ZonesInterventionField({ selected, onChange, defaultRegion }: { selected: string[]; onChange: (v: string[]) => void; defaultRegion: string }) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [zonesPopoverOpen, setZonesPopoverOpen] = useState(false);
  const zonesListRef = useRef<HTMLDivElement | null>(null);

  // On first open, if nothing selected, pre-select the provider's region
  const [didDefault, setDidDefault] = useState(false);
  useEffect(() => {
    if (!didDefault && selected.length === 0 && defaultRegion) {
      const zoneVal = regionFieldToZoneValue(defaultRegion);
      if (zoneVal) {
        const deps = getDepartementsByRegion(zoneVal);
        onChange([zoneVal, ...deps]);
      }
      setDidDefault(true);
    }
  }, [defaultRegion, didDefault, selected.length]);

  useEffect(() => {
    if (!zonesPopoverOpen) return;
    requestAnimationFrame(() => zonesListRef.current?.focus());
  }, [zonesPopoverOpen]);

  const toggleExpand = (regionValue: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionValue)) next.delete(regionValue);
      else next.add(regionValue);
      return next;
    });
  };

  const toggleRegion = (regionValue: string) => {
    const deps = getDepartementsByRegion(regionValue);
    const allSelected = [regionValue, ...deps].every((v) => selected.includes(v));
    if (allSelected) {
      onChange(selected.filter((v) => v !== regionValue && !deps.includes(v)));
    } else {
      const toAdd = [regionValue, ...deps].filter((v) => !selected.includes(v));
      onChange([...selected, ...toAdd]);
    }
  };

  const toggleDept = (deptValue: string, regionValue: string) => {
    const deps = getDepartementsByRegion(regionValue);
    let next: string[];
    if (selected.includes(deptValue)) {
      next = selected.filter((v) => v !== deptValue);
      // If we uncheck a dept, also uncheck the region
      next = next.filter((v) => v !== regionValue);
    } else {
      next = [...selected, deptValue];
      // If all deps now selected, also select the region
      if (deps.every((d) => d === deptValue || next.includes(d))) {
        if (!next.includes(regionValue)) next.push(regionValue);
      }
    }
    onChange(next);
  };

  const toggleSimple = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  // Build display summary
  const displayZones = selected.filter((z) => {
    // If region is selected, don't show its individual depts
    const region = REGIONS.find((r) => r.departements.some((d) => d.value === z));
    if (region && selected.includes(region.value)) return false;
    return true;
  });

  return (
    <Field label="Zones d'intervention">
      <Popover open={zonesPopoverOpen} onOpenChange={setZonesPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-between text-left font-normal font-sans text-sm min-h-[40px] h-auto", displayZones.length === 0 && "text-muted-foreground")}>
            <span className="flex flex-wrap gap-1 flex-1">
              {displayZones.length === 0 ? "Sélectionner les zones…" : displayZones.slice(0, 8).map((z) => (
                <Badge key={z} variant="secondary" className="font-sans text-xs font-normal gap-1">
                  {getZoneLabel(z)}
                  <X className="h-3 w-3 cursor-pointer" onClick={(e) => {
                    e.stopPropagation();
                    // If it's a region, remove region + all its deps
                    const region = REGIONS.find((r) => r.value === z);
                    if (region) {
                      const deps = region.departements.map((d) => d.value);
                      onChange(selected.filter((v) => v !== z && !deps.includes(v)));
                    } else {
                      const parentRegion = REGIONS.find((r) => r.departements.some((d) => d.value === z));
                      let next = selected.filter((v) => v !== z);
                      if (parentRegion) next = next.filter((v) => v !== parentRegion.value);
                      onChange(next);
                    }
                  }} />
                </Badge>
              ))}
              {displayZones.length > 8 && <Badge variant="secondary" className="font-sans text-xs font-normal">+{displayZones.length - 8}</Badge>}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start" side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div
            ref={zonesListRef}
            tabIndex={0}
            className="h-[420px] max-h-[70vh] overflow-y-scroll overscroll-contain touch-pan-y p-2 space-y-0.5 focus:outline-none"
            onWheelCapture={(e) => e.stopPropagation()}
            onTouchMoveCapture={(e) => e.stopPropagation()}
          >
            {/* France entière */}
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm font-sans font-medium">
              <Checkbox checked={selected.includes("france_entiere")} onCheckedChange={() => toggleSimple("france_entiere")} />
              France entière
            </label>

            <div className="my-1.5 h-px bg-border" />

            {/* Régions with collapsible départements */}
            {REGIONS.map((region) => {
              const expanded = expandedRegions.has(region.value);
              const deptValues = region.departements.map((d) => d.value);
              const allDepsSelected = deptValues.every((d) => selected.includes(d));
              const someDepsSelected = deptValues.some((d) => selected.includes(d)) && !allDepsSelected;

              return (
                <div key={region.value}>
                  <div className="flex items-center gap-1 px-1 py-1 rounded-sm hover:bg-accent">
                    <button type="button" className="p-0.5 rounded hover:bg-muted" onClick={() => toggleExpand(region.value)}>
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                    </button>
                    <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm font-sans font-medium">
                      <Checkbox
                        checked={allDepsSelected}
                        className={someDepsSelected ? "data-[state=unchecked]:bg-primary/30 data-[state=unchecked]:border-primary" : ""}
                        onCheckedChange={() => toggleRegion(region.value)}
                      />
                      {region.label}
                    </label>
                    {someDepsSelected && <span className="text-[10px] text-muted-foreground mr-1">{deptValues.filter((d) => selected.includes(d)).length}/{deptValues.length}</span>}
                  </div>
                  {expanded && (
                    <div className="ml-6 space-y-0.5">
                      {region.departements.map((dept) => (
                        <label key={dept.value} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent cursor-pointer text-sm font-sans text-muted-foreground">
                          <Checkbox checked={selected.includes(dept.value)} onCheckedChange={() => toggleDept(dept.value, region.value)} />
                          <span className="text-foreground/70">{dept.value}</span> — {dept.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="my-1.5 h-px bg-border" />

            {/* DOM */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">DOM</div>
            {DOM.map((d) => (
              <label key={d.value} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm font-sans">
                <Checkbox checked={selected.includes(d.value)} onCheckedChange={() => toggleSimple(d.value)} />
                {d.label}
              </label>
            ))}

            <div className="my-1.5 h-px bg-border" />

            {/* Pays limitrophes */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pays limitrophes</div>
            {PAYS_LIMITROPHES.map((p) => (
              <label key={p.value} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm font-sans">
                <Checkbox checked={selected.includes(p.value)} onCheckedChange={() => toggleSimple(p.value)} />
                {p.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-1 text-xs text-muted-foreground" onClick={() => onChange([])}>
          Tout désélectionner ({selected.length})
        </Button>
      )}
    </Field>
  );
}

export default function Prestataires() {
  const [data, setData] = useState<Prestataire[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("tous");
  const [filterCategorie, setFilterCategorie] = useState<string>("toutes");
  const [filterSousSeuil, setFilterSousSeuil] = useState<boolean>(false);
  const [locationZones, setLocationZones] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState<CitySearchData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Prestataire | null>(null);
  const [logsFor, setLogsFor] = useState<Prestataire | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!editItem?.user_id) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await supabase.functions.invoke("admin-update-password", {
        body: { target_user_id: editItem.user_id, new_password: newPassword },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Mot de passe mis à jour");
      await logAdmin("update_password", "prestataires", editItem.id, { nom: editItem.nom_commercial });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du changement de mot de passe");
    } finally {
      setSavingPassword(false);
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  const handleNomChange = (nom: string) => {
    const newSlug = generateSlug(nom);
    setForm((prev) => ({ ...prev, nom_commercial: nom, slug: newSlug }));
    setSlugError(null);
  };

  const checkSlugUniqueness = async (): Promise<boolean> => {
    if (!form.slug) return false;
    setCheckingSlug(true);
    let query = supabase.from("prestataires").select("id").eq("slug", form.slug).limit(1);
    if (editItem) query = query.neq("id", editItem.id);
    const { data: existing } = await query;
    setCheckingSlug(false);
    if (existing && existing.length > 0) {
      setSlugError("Ce slug est déjà utilisé par un autre prestataire");
      return false;
    }
    setSlugError(null);
    return true;
  };

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("prestataires")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut as StatutPrestataire);
    if (filterCategorie !== "toutes") query = query.eq("categorie_mere_id", filterCategorie);
    if (search) query = query.ilike("nom_commercial", `%${search}%`);

    const [{ data: result, error }, { data: cats }] = await Promise.all([
      query,
      supabase.from("categories").select("*").order("ordre_affichage"),
    ]);
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatut, filterCategorie, search]);

  // Compteurs globaux par statut (indépendants des filtres)
  const [globalCounts, setGlobalCounts] = useState<Record<string, number>>({});
  const fetchGlobalCounts = async () => {
    const statuts = Object.keys(statutLabels) as StatutPrestataire[];
    const [totalRes, ...perStatut] = await Promise.all([
      supabase.from("prestataires").select("id", { count: "exact", head: true }),
      ...statuts.map((s) =>
        supabase.from("prestataires").select("id", { count: "exact", head: true }).eq("statut", s)
      ),
    ]);
    const counts: Record<string, number> = { tous: totalRes.count ?? 0 };
    statuts.forEach((s, i) => { counts[s] = perStatut[i].count ?? 0; });
    setGlobalCounts(counts);
  };
  useEffect(() => { fetchGlobalCounts(); }, []);

  const updateStatut = async (id: string, statut: StatutPrestataire) => {
    const { data: updated, error } = await supabase
      .from("prestataires")
      .update({ statut })
      .eq("id", id)
      .select("id, nom_commercial, slug, statut, user_id, email_contact")
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    logAdmin("update_statut_prestataire", "prestataires", id, { statut });

    // Trigger publication email when the prestataire becomes actif
    // (statut validee + charte signée auto-flip to actif via DB trigger).
    if (updated && updated.statut === "actif") {
      let recipient = updated.email_contact;
      let prenom = "";
      if (updated.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email, prenom")
          .eq("id", updated.user_id)
          .maybeSingle();
        if (prof?.email) recipient = prof.email;
        prenom = prof?.prenom ?? "";
      }
      if (recipient) {
        const siteUrl = window.location.origin;
        const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "validation_publication_fiche",
            recipientEmail: recipient,
            idempotencyKey: `publication-${id}`,
            templateData: {
              prenom,
              nom_commercial: updated.nom_commercial,
              lien_fiche_publique: `${siteUrl}/prestataire/${updated.slug}`,
              lien_dashboard: `${siteUrl}/espace-pro`,
            },
          },
        });
        if (mailErr) toast.error("Email de publication non envoyé : " + mailErr.message);
        else toast.success("Email de publication envoyé au prestataire");
      }
    }

    fetchData(); fetchGlobalCounts();
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = async (p: Prestataire) => {
    setEditItem(p);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    // Fetch profile prenom/nom from linked user_id if any
    let prenom = "";
    let nom = "";
    if (p.user_id) {
      const { data: prof } = await supabase.from("profiles").select("prenom, nom").eq("id", p.user_id).maybeSingle();
      prenom = prof?.prenom ?? "";
      nom = prof?.nom ?? "";
    }
    setForm({
      nom_commercial: p.nom_commercial,
      slug: p.slug,
      description_courte: p.description_courte ?? "",
      description: p.description ?? "",
      ville: p.ville,
      region: p.region,
      code_postal: p.code_postal ?? "",
      adresse: p.adresse ?? "",
      telephone: p.telephone ?? "",
      email_contact: p.email_contact ?? "",
      site_web: p.site_web ?? "",
      categorie_mere_id: p.categorie_mere_id,
      categorie_fille_id: p.categorie_fille_id ?? "",
      prix_depart: p.prix_depart?.toString() ?? "",
      prix_max: p.prix_max?.toString() ?? "",
      statut: p.statut,
      fin_premium: (p as any).fin_premium ? (p as any).fin_premium.slice(0, 10) : "",
      notes_admin: p.notes_admin ?? "",
      cree_par_admin: p.cree_par_admin ?? false,
      zones_intervention: (p as any).zones_intervention ?? [],
      create_password: "",
      prenom_contact: prenom,
      nom_contact: nom,
      notes_pre_inscription: (p as any).notes_pre_inscription ?? "",
    });
    setDialogOpen(true);
  };

  const triggerGeocode = async (prestataireId: string) => {
    try {
      const { error } = await supabase.functions.invoke("geocode-prestataire", {
        body: { prestataire_id: prestataireId },
      });
      if (error) console.error("Geocoding error:", error);
      else toast.success("Coordonnées GPS mises à jour automatiquement");
    } catch (e) {
      console.error("Geocoding failed:", e);
    }
  };

  const handleSave = async () => {
    // Brouillon save : minimum nom_commercial + categorie_mere + ville + region
    if (!form.nom_commercial || !form.slug || !form.ville || !form.region || !form.categorie_mere_id) {
      toast.error("Renseignez au minimum : nom commercial, catégorie, ville et région.");
      return;
    }
    setSaving(true);
    const isUnique = await checkSlugUniqueness();
    if (!isUnique) { setSaving(false); return; }

    const payload = {
      nom_commercial: form.nom_commercial,
      slug: form.slug,
      description_courte: form.description_courte || null,
      description: form.description || null,
      ville: form.ville,
      region: form.region,
      code_postal: form.code_postal || null,
      adresse: form.adresse || null,
      telephone: form.telephone || null,
      email_contact: form.email_contact || null,
      site_web: form.site_web || null,
      categorie_mere_id: form.categorie_mere_id,
      categorie_fille_id: form.categorie_fille_id || null,
      prix_depart: form.prix_depart ? parseInt(form.prix_depart) : null,
      prix_max: form.prix_max ? parseInt(form.prix_max) : null,
      statut: form.statut,
      fin_premium: form.fin_premium ? `${form.fin_premium}T23:59:59` : null,
      notes_admin: form.notes_admin || null,
      notes_pre_inscription: form.notes_pre_inscription || null,
      cree_par_admin: form.cree_par_admin,
      zones_intervention: form.zones_intervention,
    };

    if (editItem) {
      const { data: updated, error } = await supabase.from("prestataires").update(payload).eq("id", editItem.id).select();
      if (error) toast.error(error.message);
      else if (!updated || updated.length === 0) toast.error("Mise à jour refusée (permissions insuffisantes)");
      else {
        toast.success(form.statut === "brouillon" ? "Brouillon sauvegardé" : "Prestataire mis à jour");
        logAdmin("update_prestataire", "prestataires", editItem.id, { nom: form.nom_commercial });
        const addressChanged = editItem.ville !== form.ville || editItem.code_postal !== (form.code_postal || null) || editItem.adresse !== (form.adresse || null);
        if (addressChanged) triggerGeocode(editItem.id);
        setDialogOpen(false); fetchData(); fetchGlobalCounts();
      }
    } else {
      // New prestataire as brouillon → no user account, no email
      const { data: created, error } = await supabase.from("prestataires").insert({
        ...payload,
        statut: "brouillon",
        user_id: null,
      }).select();
      if (error) toast.error(error.message);
      else if (!created || created.length === 0) toast.error("Création refusée (permissions insuffisantes)");
      else {
        toast.success("Brouillon sauvegardé");
        logAdmin("create_prestataire_brouillon", "prestataires", created[0].id, { nom: form.nom_commercial });
        triggerGeocode(created[0].id);
        setDialogOpen(false); fetchData(); fetchGlobalCounts();
      }
    }
    setSaving(false);
  };

  const handleSendInvitation = async () => {
    if (!form.email_contact) {
      toast.error("L'email du prestataire est obligatoire pour envoyer l'invitation.");
      return;
    }
    if (!form.nom_commercial || !form.categorie_mere_id || !form.ville || !form.region || !form.telephone) {
      toast.error("Champs obligatoires manquants (nom, catégorie, ville, région, téléphone).");
      return;
    }
    if (!form.prenom_contact || !form.nom_contact) {
      toast.error("Prénom et nom du contact sont obligatoires pour l'invitation.");
      return;
    }
    if (!window.confirm(`Envoyer l'invitation à ${form.email_contact} ? Le prestataire recevra un email pour activer son espace et signer la Charte Qualité.`)) {
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-prestataire", {
        body: {
          prestataire_id: editItem?.id,
          email: form.email_contact,
          prenom: form.prenom_contact,
          nom: form.nom_contact,
          nom_commercial: form.nom_commercial,
          telephone: form.telephone,
          categorie_mere_id: form.categorie_mere_id,
          categorie_fille_id: form.categorie_fille_id || null,
          ville: form.ville,
          region: form.region,
          code_postal: form.code_postal || null,
          description: form.description || null,
          description_courte: form.description_courte || null,
          notes_pre_inscription: form.notes_pre_inscription || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invitation envoyée à ${form.email_contact}`);
      setDialogOpen(false);
      fetchData(); fetchGlobalCounts();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'envoi de l'invitation.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    // Detect "dirty" state when creating
    if (!editItem && (form.nom_commercial || form.email_contact || form.ville)) {
      if (!window.confirm("Annuler la création ? Les informations saisies seront perdues.")) return;
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string, userId: string | null) => {
    try {
      if (userId) {
        // Passe par l'edge function qui bypass le trigger d'immutabilité des signatures
        const { data, error } = await supabase.functions.invoke("admin-delete-user", {
          body: { target_user_id: userId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { error } = await supabase.from("prestataires").delete().eq("id", id);
        if (error) throw error;
      }
      toast.success("Prestataire supprimé");
      logAdmin("delete_prestataire", "prestataires", id);
      fetchData();
      fetchGlobalCounts();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la suppression");
    }
  };


  const parentCategories = categories.filter((c) => !c.parent_id);
  const childCategories = categories.filter((c) => c.parent_id === form.categorie_mere_id);
  const getCatName = (id: string | null) => categories.find((c) => c.id === id)?.nom ?? "—";

  const filteredData = useMemo(() => {
    return data.filter((p: any) => {
      if (filterSousSeuil) {
        if (p.taux_reponse == null || Number(p.taux_reponse) >= 70) return false;
      }
      // City search → haversine
      if (citySearch) {
        if (p.latitude == null || p.longitude == null) return false;
        return haversineDistanceKm(citySearch.lat, citySearch.lng, p.latitude, p.longitude) <= citySearch.radius;
      }
      // Zones
      if (locationZones.length === 0) return true;
      if (locationZones.includes("france_entiere")) return true;
      const regionMatch = REGIONS.find((r) => r.label === p.region);
      if (regionMatch) {
        const deptValues = regionMatch.departements.map((d) => d.value);
        if (deptValues.some((d) => locationZones.includes(d))) return true;
        if (locationZones.includes(regionMatch.value)) return true;
      }
      const zones: string[] = p.zones_intervention ?? [];
      return zones.some((z) => locationZones.includes(z));
    });
  }, [data, locationZones, citySearch, filterSousSeuil]);




  // KPI counts (par statut) — toujours globaux, indépendants des filtres
  const kpis = useMemo(() => {
    const counts: Record<string, number> = { tous: globalCounts.tous ?? 0 };
    for (const k of Object.keys(statutLabels)) counts[k] = globalCounts[k] ?? 0;
    return counts;
  }, [globalCounts]);

  const kpiCards: { key: string; label: string; tone: string }[] = [
    { key: "tous", label: "Tous", tone: "bg-muted/40 text-foreground" },
    { key: "brouillon", label: "Brouillons", tone: statutColors.brouillon },
    { key: "pre_inscrit", label: "Pré-inscrits", tone: statutColors.pre_inscrit },
    { key: "a_completer", label: "À compléter", tone: statutColors.a_completer },
    { key: "en_attente", label: "À valider", tone: statutColors.en_attente },
    { key: "a_corriger", label: "À corriger", tone: statutColors.a_corriger },
    { key: "actif", label: "Actifs", tone: statutColors.actif },
    { key: "suspendu", label: "Suspendus", tone: statutColors.suspendu },
    { key: "archive", label: "Archivés", tone: statutColors.archive },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Prestataires</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Gérez les fiches prestataires de la plateforme</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm">
          <Plus className="h-4 w-4" /> Créer un prestataire
        </Button>
      </div>

      {/* KPI cards cliquables */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {kpiCards.map((c) => {
          const active = filterStatut === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFilterStatut(c.key)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors hover:bg-accent",
                active ? "border-primary bg-primary/5" : "border-border bg-background"
              )}
            >
              <div className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-sans uppercase tracking-wider", c.tone)}>
                {c.label}
              </div>
              <div className="mt-1.5 font-serif text-xl text-foreground">{kpis[c.key] ?? 0}</div>
            </button>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher un prestataire…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
            </div>
            <Select value={filterCategorie} onValueChange={setFilterCategorie}>
              <SelectTrigger className="w-[200px] font-sans text-sm"><SelectValue placeholder="Filtrer par catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les catégories</SelectItem>
                {categories.filter((c) => !c.parent_id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer par statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                {Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2">
              <LocationPicker
                value={locationZones}
                onChange={setLocationZones}
                citySearch={citySearch}
                onCitySearchChange={setCitySearch}
                placeholder="Filtrer par région, département ou ville…"
              />
            </div>
            <label className="flex items-center gap-2 font-sans text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={filterSousSeuil}
                onChange={(e) => setFilterSousSeuil(e.target.checked)}
                className="h-4 w-4"
              />
              Taux de réponse &lt; 70% (Charte)
            </label>
          </div>
          <p className="mt-3 font-sans text-xs text-muted-foreground">
            {loading ? "Chargement…" : `${filteredData.length} résultat${filteredData.length > 1 ? "s" : ""}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Nom commercial</TableHead>
                <TableHead className="font-sans text-xs">Email</TableHead>
                <TableHead className="font-sans text-xs">Téléphone</TableHead>
                <TableHead className="font-sans text-xs">Catégorie</TableHead>
                <TableHead className="font-sans text-xs">Ville</TableHead>
                <TableHead className="font-sans text-xs">Inscrit le</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Note</TableHead>
                <TableHead className="font-sans text-xs">Taux réponse</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                   <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center font-sans text-sm text-muted-foreground py-8">Aucun prestataire trouvé</TableCell></TableRow>
              ) : (
                filteredData.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-sans text-sm font-medium">{p.nom_commercial}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{p.email_contact || "—"}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{p.telephone || "—"}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{getCatName(p.categorie_mere_id)}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{p.ville}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Select value={p.statut} onValueChange={(val) => updateStatut(p.id, val as StatutPrestataire)}>
                        <SelectTrigger className="h-7 w-[130px] border-0 p-0">
                          <Badge className={`${statutColors[p.statut]} font-sans text-[11px] font-normal`}>{statutLabels[p.statut]}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {p.statut === "actif" && (
                            <SelectItem value="actif" disabled>{statutLabels.actif}</SelectItem>
                          )}
                          {SELECTABLE_STATUTS.map((k) => (<SelectItem key={k} value={k}>{statutLabels[k]}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-sans text-sm">{p.note_moyenne ? `${p.note_moyenne.toFixed(1)}/5` : "—"}</TableCell>
                    <TableCell className="font-sans text-sm">
                      {p.taux_reponse != null ? (
                        <Badge
                          className={`font-sans text-[11px] font-normal ${
                            Number(p.taux_reponse) < 70
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : Number(p.taux_reponse) < 80
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                          title={`${p.taux_reponse_nb_demandes_90j ?? 0} demande(s) sur 90 j`}
                        >
                          {Number(p.taux_reponse).toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Voir les emails envoyés" onClick={() => setLogsFor(p)}>
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce prestataire ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible. Le prestataire « {p.nom_commercial} » sera définitivement supprimé.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p.id, p.user_id ?? null)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { handleCloseDialog(); } else { setDialogOpen(true); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{editItem ? `Modifier — ${editItem.nom_commercial}` : "Créer un prestataire"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general" className="mt-2">
            <TabsList className={`grid w-full h-auto gap-1 bg-muted/30 p-1.5 ${editItem ? "grid-cols-5" : "grid-cols-3"}`}>
              <TabsTrigger value="general" className="font-sans text-sm font-medium py-2 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold">Général</TabsTrigger>
              <TabsTrigger value="coordonnees" className="font-sans text-sm font-medium py-2 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold">Coordonnées</TabsTrigger>
              {editItem && (
                <TabsTrigger value="photos" className="font-sans text-sm font-medium py-2 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold">Photos</TabsTrigger>
              )}
              <TabsTrigger value="admin" className="font-sans text-sm font-medium py-2 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold">Admin</TabsTrigger>
              {editItem && (
                <TabsTrigger value="password" className="font-sans text-sm font-medium py-2 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold">Mot de passe</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nom commercial *">
                  <Input value={form.nom_commercial} onChange={(e) => handleNomChange(e.target.value)} />
                </Field>
                <Field label="Slug *">
                  <div className="space-y-1">
                    <div className="relative">
                      <Input value={form.slug} onChange={(e) => { setForm({ ...form, slug: e.target.value }); setSlugError(null); }} className={`font-mono text-sm ${slugError ? "border-destructive" : ""}`} placeholder="mon-prestataire" />
                      {checkingSlug && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                  </div>
                </Field>
              </div>
              <Field label="Description courte">
                <Input value={form.description_courte} onChange={(e) => setForm({ ...form, description_courte: e.target.value })} />
              </Field>
              <Field label="Description complète">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Catégorie mère *">
                  <Select value={form.categorie_mere_id} onValueChange={(v) => setForm({ ...form, categorie_mere_id: v, categorie_fille_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>{parentCategories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
                <Field label="Sous-catégorie">
                  <Select value={form.categorie_fille_id} onValueChange={(v) => setForm({ ...form, categorie_fille_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>{childCategories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prix de départ (€)">
                  <Input type="number" value={form.prix_depart} onChange={(e) => setForm({ ...form, prix_depart: e.target.value })} />
                </Field>
                <Field label="Prix max (€)">
                  <Input type="number" value={form.prix_max} onChange={(e) => setForm({ ...form, prix_max: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prénom contact *">
                  <Input value={form.prenom_contact} onChange={(e) => setForm({ ...form, prenom_contact: e.target.value })} />
                </Field>
                <Field label="Nom contact *">
                  <Input value={form.nom_contact} onChange={(e) => setForm({ ...form, nom_contact: e.target.value })} />
                </Field>
              </div>
              <Field label="Notes internes (pré-inscription)">
                <Textarea value={form.notes_pre_inscription} onChange={(e) => setForm({ ...form, notes_pre_inscription: e.target.value })} rows={3} placeholder="Notes visibles uniquement par les admins" />
              </Field>
            </TabsContent>

            <TabsContent value="coordonnees" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ville *">
                  <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                </Field>
                <Field label="Région *">
                  <Select value={form.region || undefined} onValueChange={(v) => setForm({ ...form, region: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une région" /></SelectTrigger>
                    <SelectContent>
                      {REGIONS_FR.map((r) => (
                        <SelectItem key={r.slug} value={r.nom}>{r.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Code postal">
                  <Input value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} />
                </Field>
                <Field label="Adresse">
                  <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Téléphone">
                  <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </Field>
                <Field label="Email de contact">
                  <Input type="email" value={form.email_contact} onChange={(e) => setForm({ ...form, email_contact: e.target.value })} />
                </Field>
              </div>
              <Field label="Site web">
                <Input value={form.site_web} onChange={(e) => setForm({ ...form, site_web: e.target.value })} placeholder="https://…" />
              </Field>
              <ZonesInterventionField
                selected={form.zones_intervention}
                onChange={(zones) => setForm({ ...form, zones_intervention: zones })}
                defaultRegion={form.region}
              />
            </TabsContent>

            {editItem && (
              <TabsContent value="photos">
                <PrestatairePhotosTab
                  prestataireId={editItem.id}
                  photoUrl={editItem.photo_principale_url}
                  galerieUrls={(editItem.urls_galerie as string[]) ?? []}
                  onUpdate={() => { fetchData(); fetchGlobalCounts(); supabase.from("prestataires").select("*").eq("id", editItem.id).single().then(({ data }) => { if (data) setEditItem(data); }); }}
                />
              </TabsContent>
            )}

            <TabsContent value="admin" className="space-y-4 pt-4">
              <Field label="Statut">
                <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as StatutPrestataire })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.statut === "actif" && (
                      <SelectItem value="actif" disabled>{statutLabels.actif}</SelectItem>
                    )}
                    {SELECTABLE_STATUTS.map((k) => (<SelectItem key={k} value={k}>{statutLabels[k]}</SelectItem>))}
                  </SelectContent>
                </Select>
                {form.statut === "actif" && (
                  <p className="font-sans text-xs text-muted-foreground mt-1.5">
                    Sélectionnez un nouveau statut pour suspendre, archiver ou repasser la fiche en correction. Le statut <em>actif</em> est attribué automatiquement (validée + charte signée) et ne peut pas être ré-appliqué manuellement.
                  </p>
                )}
              </Field>
              <Field label="Fin Premium (laisser vide = non premium)">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal font-sans text-sm", !form.fin_premium && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.fin_premium ? new Date(form.fin_premium).toLocaleDateString("fr-FR") : "Aucune date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.fin_premium ? new Date(form.fin_premium + "T12:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, "0");
                          const dd2 = String(d.getDate()).padStart(2, "0");
                          setForm({ ...form, fin_premium: `${yyyy}-${mm}-${dd2}` });
                        } else {
                          setForm({ ...form, fin_premium: "" });
                        }
                      }}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {form.fin_premium && (
                  <Button variant="ghost" size="sm" className="mt-1 text-xs text-muted-foreground" onClick={() => setForm({ ...form, fin_premium: "" })}>
                    Retirer le premium
                  </Button>
                )}
              </Field>
              <Field label="Notes admin (interne)">
                <Textarea value={form.notes_admin} onChange={(e) => setForm({ ...form, notes_admin: e.target.value })} rows={3} />
              </Field>
            </TabsContent>

            {editItem && (
              <TabsContent value="password" className="space-y-4 pt-4">
                {editItem.user_id ? (
                  <>
                    <p className="font-sans text-sm text-muted-foreground">
                      Définir un nouveau mot de passe pour <span className="font-medium text-foreground">{editItem.nom_commercial}</span>
                    </p>
                    <Field label="Nouveau mot de passe">
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 caractères"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </Field>
                    <Field label="Confirmer le mot de passe">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Retapez le mot de passe"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                      )}
                    </Field>
                    <Button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                      className="font-sans text-sm w-full"
                    >
                      {savingPassword ? "Modification…" : "Changer le mot de passe"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-sans text-sm text-muted-foreground">
                      Ce prestataire n'a pas encore de compte utilisateur lié. Créez-en un pour lui permettre de se connecter.
                    </p>
                    <Field label="Mot de passe du nouveau compte">
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 caractères"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Le compte sera créé avec l'email : <span className="font-medium text-foreground">{editItem.email_contact || "aucun email"}</span>
                    </p>
                    <Button
                      onClick={async () => {
                        if (!editItem.email_contact) {
                          toast.error("Veuillez d'abord renseigner un email de contact");
                          return;
                        }
                        if (!newPassword || newPassword.length < 6) {
                          toast.error("Le mot de passe doit contenir au moins 6 caractères");
                          return;
                        }
                        setSavingPassword(true);
                        try {
                          const res = await supabase.functions.invoke("admin-create-user", {
                            body: {
                              email: editItem.email_contact.trim(),
                              password: newPassword,
                              role: "prestataire",
                              prestataire_id: editItem.id,
                            },
                          });
                          if (res.error) throw new Error(res.error.message);
                          if (res.data?.error) throw new Error(res.data.error);
                          toast.success("Compte utilisateur créé et rattaché");
                          await logAdmin("create_user_for_prestataire", "prestataires", editItem.id, { email: editItem.email_contact });
                          setNewPassword("");
                          setDialogOpen(false);
                          fetchData(); fetchGlobalCounts();
                        } catch (e: any) {
                          toast.error(e.message || "Erreur lors de la création du compte");
                        } finally {
                          setSavingPassword(false);
                        }
                      }}
                      disabled={savingPassword || !newPassword || newPassword.length < 6 || !editItem.email_contact}
                      className="font-sans text-sm w-full"
                    >
                      {savingPassword ? "Création…" : "Créer le compte utilisateur"}
                    </Button>
                  </>
                )}
              </TabsContent>
            )}
          </Tabs>
          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            {editItem ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="font-sans text-sm">
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving} className="font-sans text-sm">
                  {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving} className="font-sans text-sm">
                  {saving ? "Enregistrement…" : "Sauvegarder et continuer plus tard"}
                </Button>
                <Button onClick={handleSendInvitation} disabled={saving} className="font-sans text-sm">
                  {saving ? "Envoi…" : "Sauvegarder et envoyer l'invitation"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EmailLogsDialog
        open={!!logsFor}
        onOpenChange={(o) => !o && setLogsFor(null)}
        recipientEmail={logsFor?.email_contact ?? null}
        nomCommercial={logsFor?.nom_commercial ?? ""}
      />
    </div>
  );
}
