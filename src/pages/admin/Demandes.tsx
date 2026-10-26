import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye, Search, ShieldAlert, Check, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { formaterDateEvenement } from "@/lib/dateDemande";

type Demande = Database["public"]["Tables"]["demandes_devis"]["Row"];
type StatutDemande = Database["public"]["Enums"]["statut_demande"];
type Moderation = "a_verifier" | "valide" | "rejete";

const statutLabels: Record<StatutDemande, string> = {
  nouveau: "Nouveau", lu: "Lu", en_discussion: "En discussion", devis_envoye: "Devis envoyé", accepte: "Accepté", refuse: "Refusé", archive: "Archivé",
};

const statutColors: Record<StatutDemande, string> = {
  nouveau: "bg-primary/15 text-primary", lu: "bg-accent/15 text-accent-foreground", en_discussion: "bg-champagne/30 text-foreground",
  devis_envoye: "bg-bleu-petrole/15 text-bleu-petrole", accepte: "bg-sauge/20 text-sauge", refuse: "bg-destructive/10 text-destructive", archive: "bg-muted/40 text-muted-foreground",
};

const moderationLabels: Record<Moderation, string> = { a_verifier: "À vérifier", valide: "Transmise", rejete: "Rejetée" };
const moderationColors: Record<Moderation, string> = {
  a_verifier: "bg-champagne/40 text-foreground border border-primary/40",
  valide: "bg-sauge/20 text-sauge",
  rejete: "bg-destructive/10 text-destructive",
};

interface DemandeWithPrestataire extends Demande {
  prestataire_nom?: string;
}

export default function Demandes() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<DemandeWithPrestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<Moderation | "toutes">("a_verifier");
  const [nbAVerifier, setNbAVerifier] = useState(0);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DemandeWithPrestataire | null>(null);
  const [busy, setBusy] = useState(false);

  const mapRow = (d: any): DemandeWithPrestataire => ({ ...d, prestataire_nom: d.prestataires?.nom_commercial ?? "—" });

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("demandes_devis")
      .select("*, prestataires!demandes_devis_prestataire_id_fkey(nom_commercial)")
      .order("created_at", { ascending: false }).limit(200);
    if (onglet !== "toutes") query = query.eq("moderation", onglet);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut as StatutDemande);
    const [{ data: result, error }, { count }] = await Promise.all([
      query,
      supabase.from("demandes_devis").select("id", { count: "exact", head: true }).eq("moderation", "a_verifier"),
    ]);
    if (error) toast.error(error.message);
    else setData((result ?? []).map(mapRow));
    setNbAVerifier(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [onglet, filterStatut]);

  // Lien depuis l'email d'alerte : /admin/demandes?demande=<id>
  useEffect(() => {
    const id = params.get("demande");
    if (!id) return;
    supabase.from("demandes_devis")
      .select("*, prestataires!demandes_devis_prestataire_id_fkey(nom_commercial)")
      .eq("id", id).maybeSingle()
      .then(({ data: d }) => { if (d) setSelected(mapRow(d)); });
  }, [params]);

  const fermer = () => {
    setSelected(null);
    if (params.get("demande")) { params.delete("demande"); setParams(params, { replace: true }); }
  };

  const updateStatut = async (id: string, statut: StatutDemande) => {
    const { error } = await supabase.from("demandes_devis").update({ statut }).eq("id", id).select("id");
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      fetchData();
      if (selected?.id === id) setSelected({ ...selected, statut });
    }
  };

  const moderer = async (id: string, moderation: "valide" | "rejete") => {
    setBusy(true);
    const { data: rows, error } = await supabase
      .from("demandes_devis")
      .update({ moderation, moderee_le: new Date().toISOString(), moderee_par: user?.id ?? null })
      .eq("id", id).eq("moderation", "a_verifier")
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!rows || rows.length === 0) return toast.error("Demande déjà modérée ou introuvable");
    await supabase.from("logs_admin").insert({
      admin_id: user?.id ?? null, action: moderation === "valide" ? "demande_validee" : "demande_rejetee",
      entite: "demandes_devis", entite_id: id, details: {},
    });
    toast.success(moderation === "valide" ? "Demande transmise au prestataire (email envoyé)" : "Demande rejetée");
    fermer();
    fetchData();
  };

  const filtered = search
    ? data.filter((d) =>
      `${d.nom_contact} ${d.email_contact} ${d.prestataire_nom ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )
    : data;

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex justify-between py-2">
      <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-sans text-sm text-foreground text-right max-w-[60%]">{value || "—"}</span>
    </div>
  );

  const mod = (d: Demande) => d.moderation as Moderation;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Demandes de devis</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {nbAVerifier} demande{nbAVerifier > 1 ? "s" : ""} à vérifier · non transmise{nbAVerifier > 1 ? "s" : ""} aux prestataires
        </p>
      </div>

      <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Moderation | "toutes")}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="a_verifier" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> À vérifier
            {nbAVerifier > 0 && <Badge className="bg-primary text-primary-foreground h-5 px-1.5 text-[11px]">{nbAVerifier}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="valide">Transmises</TabsTrigger>
          <TabsTrigger value="rejete">Rejetées</TabsTrigger>
          <TabsTrigger value="toutes">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                {Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Contact</TableHead>
                <TableHead className="font-sans text-xs">Prestataire</TableHead>
                <TableHead className="font-sans text-xs">Modération</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow key={d.id} className={mod(d) === "a_verifier" ? "bg-champagne/15" : mod(d) === "rejete" ? "opacity-60" : ""}>
                    <TableCell>
                      <p className="font-sans text-sm font-medium">{d.nom_contact}</p>
                      <p className="font-sans text-xs text-muted-foreground">{d.email_contact}</p>
                    </TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{d.prestataire_nom}</TableCell>
                    <TableCell>
                      <Badge className={`${moderationColors[mod(d)]} font-sans text-[11px] font-normal`}>{moderationLabels[mod(d)]}</Badge>
                      {d.score_suspicion > 0 && <p className="mt-1 font-sans text-[11px] text-muted-foreground">Score {d.score_suspicion}{d.ip_pays ? ` · ${d.ip_pays}` : ""}</p>}
                    </TableCell>
                    <TableCell>
                      {mod(d) === "valide" ? (
                        <Select value={d.statut} onValueChange={(v) => updateStatut(d.id, v as StatutDemande)}>
                          <SelectTrigger className="h-7 w-[130px] border-0 p-0">
                            <Badge className={`${statutColors[d.statut]} font-sans text-[11px] font-normal`}>{statutLabels[d.statut]}</Badge>
                          </SelectTrigger>
                          <SelectContent>{Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                        </Select>
                      ) : <span className="font-sans text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {mod(d) === "a_verifier" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Valider et transmettre" disabled={busy} onClick={() => moderer(d.id, "valide")}>
                            <Check className="h-4 w-4 text-sauge" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Rejeter" disabled={busy} onClick={() => moderer(d.id, "rejete")}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Voir" onClick={() => setSelected(d)}>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && fermer()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-lg">Détail de la demande</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-1">
              <div className="flex items-center justify-between py-2">
                <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Modération</span>
                <Badge className={`${moderationColors[mod(selected)]} font-sans text-[11px] font-normal`}>{moderationLabels[mod(selected)]}</Badge>
              </div>
              {(selected.score_suspicion > 0 || selected.raisons_suspicion?.length > 0) && (
                <div className="rounded-md bg-champagne/20 p-3 font-sans text-sm">
                  <p className="font-medium">Score de suspicion : {selected.score_suspicion}</p>
                  {selected.raisons_suspicion?.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                      {selected.raisons_suspicion.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {selected.moderee_le && <InfoRow label="Modérée le" value={format(new Date(selected.moderee_le), "dd MMM yyyy HH:mm", { locale: fr })} />}
              <Separator />
              <InfoRow label="Contact" value={selected.nom_contact} />
              <Separator />
              <InfoRow label="Email" value={selected.email_contact} />
              <Separator />
              <InfoRow label="Téléphone" value={selected.telephone_contact} />
              <Separator />
              <InfoRow label="Pays (IP)" value={selected.ip_pays} />
              <Separator />
              <InfoRow label="Prestataire" value={selected.prestataire_nom} />
              <Separator />
              <InfoRow label="Objet" value={selected.objet.replace(/_/g, " ")} />
              <Separator />
              <InfoRow label="Date de l'événement" value={formaterDateEvenement(selected.date_evenement, selected.date_precision)} />
              <Separator />
              <InfoRow label="Lieu" value={selected.lieu_evenement} />
              <Separator />
              <InfoRow label="Invités" value={selected.nombre_invites_rang} />
              <Separator />
              <InfoRow label="Budget indicatif" value={selected.budget_indicatif ? `${selected.budget_indicatif} €` : null} />
              <Separator />
              <div className="pt-3">
                <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Message</span>
                <p className="mt-1 font-sans text-sm text-foreground whitespace-pre-wrap bg-muted/10 rounded-md p-3">{selected.message}</p>
              </div>
              <Separator />
              {mod(selected) === "a_verifier" ? (
                <div className="flex flex-col gap-2 pt-3 sm:flex-row">
                  <Button className="flex-1" disabled={busy} onClick={() => moderer(selected.id, "valide")}>
                    <Check className="h-4 w-4 mr-2" /> Valider et transmettre
                  </Button>
                  <Button variant="outline" className="flex-1 text-destructive" disabled={busy} onClick={() => moderer(selected.id, "rejete")}>
                    <X className="h-4 w-4 mr-2" /> Rejeter
                  </Button>
                </div>
              ) : mod(selected) === "valide" ? (
                <div className="flex items-center justify-between pt-3">
                  <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Statut</span>
                  <Select value={selected.statut} onValueChange={(v) => updateStatut(selected.id, v as StatutDemande)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="pt-3 font-sans text-xs text-muted-foreground">Demande rejetée : jamais transmise au prestataire.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
