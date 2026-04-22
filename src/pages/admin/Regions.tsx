import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/regions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Pencil, ExternalLink, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { logAdmin } from "@/lib/logAdmin";

type Specificite = { titre: string; texte: string; couleur_accent: string };
type Conseil = { titre: string; texte: string };
type FaqItem = { question: string; reponse: string };

type RegionRow = {
  id: string;
  slug_region: string;
  nom_region: string;
  est_publiee: boolean;
  updated_at: string;
  intro_editoriale: string | null;
  specificites: Specificite[] | null;
  conseils: Conseil[] | null;
  faq: FaqItem[] | null;
  citation_llm: string | null;
  budget_moyen: number | null;
  budget_min: number | null;
  budget_max: number | null;
  meilleure_periode: string | null;
  delai_reservation: string | null;
  contenu_seo_bas: string | null;
  image_hero_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
};

const COULEURS = ["#A57D27", "#8E4A49", "#5F6F52", "#2D4356", "#C9AF78"];

const emptyForm = {
  intro_editoriale: "",
  image_hero_url: "",
  specificites: [] as Specificite[],
  conseils: [] as Conseil[],
  faq: [] as FaqItem[],
  citation_llm: "",
  budget_moyen: 0,
  budget_min: 0,
  budget_max: 0,
  meilleure_periode: "",
  delai_reservation: "",
  contenu_seo_bas: "",
  meta_title: "",
  meta_description: "",
  est_publiee: false,
};

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value?.length ?? 0;
  const ok = len <= max;
  return (
    <span className={cn("font-sans text-[10px] tabular-nums", ok ? "text-sauge" : "text-destructive")}>
      {len}/{max}
    </span>
  );
}

function wordCount(s: string) {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function completion(r: RegionRow): number {
  const checks = [
    !!r.intro_editoriale,
    !!r.image_hero_url,
    (r.specificites?.length ?? 0) >= 1,
    (r.conseils?.length ?? 0) >= 1,
    (r.faq?.length ?? 0) >= 1,
    !!r.citation_llm,
    !!r.budget_moyen,
    !!r.meilleure_periode,
    !!r.delai_reservation,
    !!r.meta_title,
    !!r.meta_description,
    !!r.contenu_seo_bas,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function Regions() {
  const [rows, setRows] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RegionRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pages_regions_mariage")
      .select("*")
      .order("nom_region");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as RegionRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (r: RegionRow) => {
    setEditItem(r);
    setForm({
      intro_editoriale: r.intro_editoriale ?? "",
      image_hero_url: r.image_hero_url ?? "",
      specificites: (r.specificites as Specificite[] | null) ?? [],
      conseils: (r.conseils as Conseil[] | null) ?? [],
      faq: (r.faq as FaqItem[] | null) ?? [],
      citation_llm: r.citation_llm ?? "",
      budget_moyen: r.budget_moyen ?? 0,
      budget_min: r.budget_min ?? 0,
      budget_max: r.budget_max ?? 0,
      meilleure_periode: r.meilleure_periode ?? "",
      delai_reservation: r.delai_reservation ?? "",
      contenu_seo_bas: r.contenu_seo_bas ?? "",
      meta_title: r.meta_title ?? "",
      meta_description: r.meta_description ?? "",
      est_publiee: r.est_publiee,
    });
    setDialogOpen(true);
  };

  const handleHeroUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Image trop lourde (max 8 Mo)"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `regions/${editItem?.slug_region ?? "tmp"}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("articles-blog").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("articles-blog").getPublicUrl(path);
    setForm((f) => ({ ...f, image_hero_url: pub.publicUrl }));
    setUploading(false);
    toast.success("Image téléversée");
  };

  const handleSave = async (publishOverride?: boolean) => {
    if (!editItem) return;
    setSaving(true);
    const payload: any = {
      intro_editoriale: form.intro_editoriale || null,
      image_hero_url: form.image_hero_url || null,
      specificites: form.specificites,
      conseils: form.conseils,
      faq: form.faq.filter((f) => f.question.trim() && f.reponse.trim()),
      citation_llm: form.citation_llm || null,
      budget_moyen: form.budget_moyen || null,
      budget_min: form.budget_min || null,
      budget_max: form.budget_max || null,
      meilleure_periode: form.meilleure_periode || null,
      delai_reservation: form.delai_reservation || null,
      contenu_seo_bas: form.contenu_seo_bas || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      est_publiee: publishOverride !== undefined ? publishOverride : form.est_publiee,
    };
    const { error } = await supabase
      .from("pages_regions_mariage")
      .update(payload)
      .eq("id", editItem.id)
      .select();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Page enregistrée");
      logAdmin("page_region_modifiee", "pages_regions_mariage", editItem.id, { slug: editItem.slug_region });
      setDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const togglePublish = async (r: RegionRow) => {
    const { error } = await supabase
      .from("pages_regions_mariage")
      .update({ est_publiee: !r.est_publiee })
      .eq("id", r.id)
      .select();
    if (error) toast.error(error.message);
    else {
      toast.success(r.est_publiee ? "Dépubliée" : "Publiée");
      logAdmin(r.est_publiee ? "page_region_depubliee" : "page_region_publiee", "pages_regions_mariage", r.id, { slug: r.slug_region });
      fetchData();
    }
  };

  // Specificites helpers
  const addSpec = () => setForm((f) => ({ ...f, specificites: [...f.specificites, { titre: "", texte: "", couleur_accent: COULEURS[f.specificites.length % COULEURS.length] }] }));
  const updateSpec = (i: number, k: keyof Specificite, v: string) => setForm((f) => ({ ...f, specificites: f.specificites.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const removeSpec = (i: number) => setForm((f) => ({ ...f, specificites: f.specificites.filter((_, idx) => idx !== i) }));

  // Conseils
  const addConseil = () => setForm((f) => ({ ...f, conseils: [...f.conseils, { titre: "", texte: "" }] }));
  const updateConseil = (i: number, k: keyof Conseil, v: string) => setForm((f) => ({ ...f, conseils: f.conseils.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const removeConseil = (i: number) => setForm((f) => ({ ...f, conseils: f.conseils.filter((_, idx) => idx !== i) }));

  // FAQ
  const addFaq = () => setForm((f) => ({ ...f, faq: [...f.faq, { question: "", reponse: "" }] }));
  const updateFaq = (i: number, k: keyof FaqItem, v: string) => setForm((f) => ({ ...f, faq: f.faq.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const removeFaq = (i: number) => setForm((f) => ({ ...f, faq: f.faq.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Pages Région</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Contenu éditorial des 13 régions françaises</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Région</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Complétion</TableHead>
                <TableHead className="font-sans text-xs">Modifiée</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-sans text-sm">Aucune page région</TableCell></TableRow>
              ) : (
                rows.map((r) => {
                  const pct = completion(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-sans text-sm font-medium">{r.nom_region}</TableCell>
                      <TableCell>
                        <Badge className={r.est_publiee ? "bg-sauge/20 text-sauge" : "bg-muted/40 text-muted-foreground"}>
                          {r.est_publiee ? "Publiée" : "Brouillon"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full transition-all", pct >= 80 ? "bg-sauge" : pct >= 40 ? "bg-or-riche" : "bg-destructive/60")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-sans text-xs tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {format(new Date(r.updated_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Éditer" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Aperçu" onClick={() => window.open(`/mariage/${r.slug_region}`, "_blank")}>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 font-sans text-xs" onClick={() => togglePublish(r)}>
                            {r.est_publiee ? "Dépublier" : "Publier"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editItem?.nom_region}
            </DialogTitle>
          </DialogHeader>

          <Accordion type="multiple" defaultValue={["hero", "resume"]} className="w-full">
            {/* HERO */}
            <AccordionItem value="hero">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">Hero & introduction</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Intro éditoriale</Label>
                  <Textarea rows={3} value={form.intro_editoriale} onChange={(e) => setForm({ ...form, intro_editoriale: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Image hero</Label>
                  {form.image_hero_url ? (
                    <div className="relative overflow-hidden rounded-md border border-[hsl(var(--champagne)/0.4)]">
                      <img src={form.image_hero_url} alt="hero" className="h-48 w-full object-cover" />
                      <Button type="button" variant="secondary" size="sm" className="absolute right-2 top-2 h-7 gap-1" onClick={() => setForm({ ...form, image_hero_url: "" })}>
                        <X className="h-3 w-3" /> Retirer
                      </Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[hsl(var(--champagne)/0.6)] bg-muted/10 text-muted-foreground transition hover:bg-muted/20">
                      <Upload className="h-5 w-5" />
                      <span className="font-sans text-xs">{uploading ? "Téléversement…" : "Téléverser une image (max 8 Mo)"}</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f); e.target.value = ""; }} />
                  <Input placeholder="Ou coller une URL d'image…" value={form.image_hero_url} onChange={(e) => setForm({ ...form, image_hero_url: e.target.value })} className="text-xs" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* RÉSUMÉ */}
            <AccordionItem value="resume">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">En résumé (LLM)</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Budget moyen (€)</Label>
                    <Input type="number" value={form.budget_moyen} onChange={(e) => setForm({ ...form, budget_moyen: parseInt(e.target.value || "0", 10) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Budget min (€)</Label>
                    <Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: parseInt(e.target.value || "0", 10) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Budget max (€)</Label>
                    <Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: parseInt(e.target.value || "0", 10) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meilleure période</Label>
                    <Input value={form.meilleure_periode} onChange={(e) => setForm({ ...form, meilleure_periode: e.target.value })} placeholder="mai à octobre" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Délai de réservation</Label>
                    <Input value={form.delai_reservation} onChange={(e) => setForm({ ...form, delai_reservation: e.target.value })} placeholder="12 à 18 mois" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SPÉCIFICITÉS */}
            <AccordionItem value="spec">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">Spécificités (4 max)</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {form.specificites.map((s, i) => (
                  <div key={i} className="rounded-md border border-[hsl(var(--champagne)/0.4)] bg-muted/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Input placeholder={`Titre #${i + 1}`} value={s.titre} onChange={(e) => updateSpec(i, "titre", e.target.value)} />
                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => removeSpec(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea rows={2} placeholder="Texte" value={s.texte} onChange={(e) => updateSpec(i, "texte", e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Label className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">Couleur</Label>
                      {COULEURS.map((c) => (
                        <button key={c} type="button" onClick={() => updateSpec(i, "couleur_accent", c)}
                          className={cn("h-5 w-5 rounded-full border-2", s.couleur_accent === c ? "border-foreground" : "border-transparent")}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSpec} disabled={form.specificites.length >= 4} className="gap-1">
                  <Plus className="h-3 w-3" /> Ajouter une spécificité
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* CONSEILS */}
            <AccordionItem value="conseils">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">Conseils éditoriaux (3 max)</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {form.conseils.map((c, i) => (
                  <div key={i} className="rounded-md border border-[hsl(var(--champagne)/0.4)] bg-muted/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Input placeholder={`Titre #${i + 1}`} value={c.titre} onChange={(e) => updateConseil(i, "titre", e.target.value)} />
                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => removeConseil(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea rows={3} placeholder="Texte" value={c.texte} onChange={(e) => updateConseil(i, "texte", e.target.value)} />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addConseil} disabled={form.conseils.length >= 3} className="gap-1">
                  <Plus className="h-3 w-3" /> Ajouter un conseil
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* FAQ */}
            <AccordionItem value="faq">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">FAQ Schema.org</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {form.faq.map((q, i) => {
                  const wc = wordCount(q.reponse);
                  return (
                    <div key={i} className="rounded-md border border-[hsl(var(--champagne)/0.4)] bg-muted/10 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Input placeholder={`Question ${i + 1}`} value={q.question} onChange={(e) => updateFaq(i, "question", e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => removeFaq(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Textarea rows={3} placeholder="Réponse — utiliser **gras** pour les chiffres clés" value={q.reponse} onChange={(e) => updateFaq(i, "reponse", e.target.value)} />
                      <p className={cn("font-sans text-[10px] tabular-nums", wc <= 80 ? "text-sauge" : "text-destructive")}>
                        {wc} mots (cible : &lt; 80)
                      </p>
                    </div>
                  );
                })}
                <Button type="button" variant="outline" size="sm" onClick={addFaq} className="gap-1">
                  <Plus className="h-3 w-3" /> Ajouter une question
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* CITATION LLM */}
            <AccordionItem value="citation">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">Citation LLM</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                <Textarea rows={6} placeholder="Texte source citable par les IA — utiliser **gras** pour les chiffres" value={form.citation_llm} onChange={(e) => setForm({ ...form, citation_llm: e.target.value })} />
                <p className={cn("font-sans text-[10px] tabular-nums", (() => { const w = wordCount(form.citation_llm); return w >= 100 && w <= 150 ? "text-sauge" : "text-muted-foreground"; })())}>
                  {wordCount(form.citation_llm)} mots (cible : 100-150)
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* SEO */}
            <AccordionItem value="seo">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">SEO</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta title</Label>
                    <CharCounter value={form.meta_title} max={60} />
                  </div>
                  <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta description</Label>
                    <CharCounter value={form.meta_description} max={155} />
                  </div>
                  <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* CONTENU LONG */}
            <AccordionItem value="seo-bas">
              <AccordionTrigger className="font-sans text-sm uppercase tracking-wider">Contenu SEO bas de page</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                <Textarea rows={12} className="font-mono text-xs" placeholder="Texte long éditorial (HTML autorisé)" value={form.contenu_seo_bas} onChange={(e) => setForm({ ...form, contenu_seo_bas: e.target.value })} />
                <p className={cn("font-sans text-[10px] tabular-nums", (() => { const w = wordCount(form.contenu_seo_bas); return w >= 800 && w <= 1200 ? "text-sauge" : "text-muted-foreground"; })())}>
                  {wordCount(form.contenu_seo_bas)} mots (cible : 800-1200)
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center gap-2 pt-3">
            <Switch checked={form.est_publiee} onCheckedChange={(v) => setForm({ ...form, est_publiee: v })} />
            <Label className="font-sans text-sm">Publiée</Label>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            {editItem && (
              <Button variant="outline" className="gap-1" onClick={() => window.open(`/mariage/${editItem.slug_region}`, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Aperçu
              </Button>
            )}
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
