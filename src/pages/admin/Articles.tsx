import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2, Upload, X, CalendarIcon, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["articles_blog"]["Row"];
type FaqItem = { question: string; reponse: string };
type LinkedItem = { id: string; label: string };

const SECTION_TITLE = "font-sans text-[11px] uppercase tracking-[0.18em] text-foreground/70 font-semibold";
const SECTION_DIVIDER = "border-t border-[hsl(var(--champagne)/0.4)] pt-6 mt-6";

const emptyForm = {
  titre: "",
  slug: "",
  extrait: "",
  contenu: "",
  categorie_blog: "",
  image_couverture_url: "",
  tags: "",
  est_publie: false,
  meta_title: "",
  meta_description: "",
  auteur: "",
  publie_le: null as Date | null,
  temps_lecture: 0,
  legende_image: "",
  og_image_url: "",
  balise_canonique: "",
  faq: [] as FaqItem[],
  noindex: false,
  inclure_sitemap: true,
  prestataires_lies: [] as LinkedItem[],
  articles_lies: [] as LinkedItem[],
  categorie_liee_slug: "",
};

function estimateReadingTime(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value?.length ?? 0;
  const ok = len <= max;
  return (
    <span className={cn("font-sans text-[10px] tabular-nums", ok ? "text-sauge" : "text-destructive")}>
      {len}/{max}
    </span>
  );
}

export default function Articles() {
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Article | null>(null);
  const [form, setForm] = useState(typeof structuredClone === "function" ? structuredClone(emptyForm) : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoriesMarketplace, setCategoriesMarketplace] = useState<{ id: string; nom: string; slug: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase
      .from("articles_blog")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  const fetchCategoriesMarketplace = async () => {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, nom, slug")
      .is("parent_id", null)
      .eq("est_active", true)
      .order("nom");
    setCategoriesMarketplace(cats ?? []);
  };

  useEffect(() => {
    fetchData();
    fetchCategoriesMarketplace();
  }, []);

  const resetForm = () => setForm(typeof structuredClone === "function" ? structuredClone(emptyForm) : { ...emptyForm });

  const openCreate = () => {
    setEditItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (a: Article) => {
    setEditItem(a);

    // Hydrater libellés des entités liées
    const presIds = (a as any).prestataires_lies ?? [];
    const artIds = (a as any).articles_lies ?? [];

    const [presRes, artRes] = await Promise.all([
      presIds.length
        ? supabase.from("prestataires").select("id, nom_commercial").in("id", presIds)
        : Promise.resolve({ data: [] as any[] }),
      artIds.length
        ? supabase.from("articles_blog").select("id, titre").in("id", artIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    setForm({
      titre: a.titre,
      slug: a.slug,
      extrait: a.extrait ?? "",
      contenu: (a as any).contenu ?? "",
      categorie_blog: a.categorie_blog ?? "",
      image_couverture_url: a.image_couverture_url ?? "",
      tags: (a.tags ?? []).join(", "),
      est_publie: a.est_publie ?? false,
      meta_title: (a as any).meta_title ?? "",
      meta_description: (a as any).meta_description ?? "",
      auteur: (a as any).auteur ?? "",
      publie_le: (a as any).publie_le ? new Date((a as any).publie_le) : null,
      temps_lecture: (a as any).temps_lecture ?? 0,
      legende_image: (a as any).legende_image ?? "",
      og_image_url: (a as any).og_image_url ?? "",
      balise_canonique: (a as any).balise_canonique ?? "",
      faq: ((a as any).faq ?? []) as FaqItem[],
      noindex: (a as any).noindex ?? false,
      inclure_sitemap: (a as any).inclure_sitemap ?? true,
      prestataires_lies: ((presRes.data ?? []) as any[]).map((p) => ({ id: p.id, label: p.nom_commercial })),
      articles_lies: ((artRes.data ?? []) as any[]).map((x) => ({ id: x.id, label: x.titre })),
      categorie_liee_slug: (a as any).categorie_liee_slug ?? "",
    });
    setDialogOpen(true);
  };

  // Upload image couverture
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("articles-blog").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("articles-blog").getPublicUrl(path);
    setForm((f) => ({ ...f, image_couverture_url: pub.publicUrl }));
    setUploading(false);
    toast.success("Image téléversée");
  };

  // Auto-calcul du temps de lecture quand le contenu change (seulement si l'utilisateur n'a pas surchargé)
  const lastAutoTimeRef = useRef<number>(0);
  useEffect(() => {
    const auto = estimateReadingTime(form.contenu);
    // Ne réécrit que si la valeur courante correspond à l'ancien auto-calcul (=> pas d'override manuel)
    if (form.temps_lecture === lastAutoTimeRef.current || form.temps_lecture === 0) {
      lastAutoTimeRef.current = auto;
      setForm((f) => ({ ...f, temps_lecture: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.contenu]);

  const handleSave = async () => {
    if (!form.titre || !form.slug) {
      toast.error("Titre et slug requis");
      return;
    }
    setSaving(true);
    const payload: any = {
      titre: form.titre,
      slug: form.slug,
      extrait: form.extrait || null,
      contenu: form.contenu || null,
      categorie_blog: form.categorie_blog || null,
      image_couverture_url: form.image_couverture_url || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      est_publie: form.est_publie,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      auteur: form.auteur || null,
      publie_le: form.publie_le ? form.publie_le.toISOString() : null,
      temps_lecture: form.temps_lecture || null,
      legende_image: form.legende_image || null,
      og_image_url: form.og_image_url || null,
      balise_canonique: form.balise_canonique || null,
      faq: form.faq.filter((f) => f.question.trim() && f.reponse.trim()),
      noindex: form.noindex,
      inclure_sitemap: form.inclure_sitemap,
      prestataires_lies: form.prestataires_lies.map((p) => p.id),
      articles_lies: form.articles_lies.map((a) => a.id),
      categorie_liee_slug: form.categorie_liee_slug || null,
    };
    if (editItem) {
      const { error } = await supabase.from("articles_blog").update(payload).eq("id", editItem.id).select();
      if (error) toast.error(error.message);
      else {
        toast.success("Article enregistré");
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("articles_blog").insert(payload).select();
      if (error) toast.error(error.message);
      else {
        toast.success("Article créé");
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("articles_blog").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Article supprimé");
      fetchData();
    }
  };

  // FAQ helpers
  const addFaq = () => setForm((f) => ({ ...f, faq: [...f.faq, { question: "", reponse: "" }] }));
  const updateFaq = (idx: number, key: keyof FaqItem, value: string) =>
    setForm((f) => ({ ...f, faq: f.faq.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));
  const removeFaq = (idx: number) => setForm((f) => ({ ...f, faq: f.faq.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Articles de blog</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Gérez le contenu éditorial</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm">
          <Plus className="h-4 w-4" /> Nouvel article
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Catégorie</TableHead>
                <TableHead className="font-sans text-xs">Publié</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun article
                  </TableCell>
                </TableRow>
              ) : (
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-sans text-sm font-medium">{a.titre}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{a.categorie_blog ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={a.est_publie ? "bg-sauge/20 text-sauge" : "bg-muted/40 text-muted-foreground"}>
                        {a.est_publie ? "Oui" : "Non"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
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
                              <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                L'article « {a.titre} » sera supprimé définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(a.id)} className="bg-destructive text-destructive-foreground">
                                Supprimer
                              </AlertDialogAction>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{editItem ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
          </DialogHeader>

          {/* SECTION : IDENTITÉ */}
          <section className="space-y-4 pt-2">
            <h3 className={SECTION_TITLE}>Identité</h3>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
              <Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Auteur</Label>
                <Input value={form.auteur} onChange={(e) => setForm({ ...form, auteur: e.target.value })} placeholder="Ex : La rédaction LesNoces" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Date de publication</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.publie_le && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.publie_le ? format(form.publie_le, "PPP", { locale: fr }) : "Choisir une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.publie_le ?? undefined} onSelect={(d) => setForm({ ...form, publie_le: d ?? null })} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Catégorie blog</Label>
                <Input value={form.categorie_blog} onChange={(e) => setForm({ ...form, categorie_blog: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Temps de lecture (min)</Label>
                <Input type="number" min={0} value={form.temps_lecture} onChange={(e) => setForm({ ...form, temps_lecture: parseInt(e.target.value || "0", 10) })} />
                <p className="font-sans text-[10px] text-muted-foreground">Auto-calculé (~200 mots/min), éditable.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Tags (séparés par virgule)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="mariage, décoration, tendances" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.est_publie} onCheckedChange={(v) => setForm({ ...form, est_publie: v })} />
              <Label className="font-sans text-sm">Publier</Label>
            </div>
          </section>

          {/* SECTION : CONTENU */}
          <section className={cn("space-y-4", SECTION_DIVIDER)}>
            <h3 className={SECTION_TITLE}>Contenu</h3>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Extrait</Label>
              <Textarea value={form.extrait} onChange={(e) => setForm({ ...form, extrait: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Contenu (Markdown)</Label>
              <Textarea
                value={form.contenu}
                onChange={(e) => setForm({ ...form, contenu: e.target.value })}
                rows={16}
                className="font-mono text-xs"
                placeholder="## Titre de section&#10;&#10;Paragraphe avec **gras** et *italique*.&#10;&#10;> Citation à mettre en avant&#10;&#10;- Élément de liste&#10;- Autre élément"
              />
            </div>
          </section>

          {/* SECTION : IMAGE */}
          <section className={cn("space-y-4", SECTION_DIVIDER)}>
            <h3 className={SECTION_TITLE}>Image</h3>
            <div className="space-y-2">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Image de couverture</Label>
              {form.image_couverture_url ? (
                <div className="relative overflow-hidden rounded-md border border-[hsl(var(--champagne)/0.4)]">
                  <img src={form.image_couverture_url} alt={form.legende_image || "Aperçu"} className="h-48 w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute right-2 top-2 h-7 gap-1"
                    onClick={() => setForm({ ...form, image_couverture_url: "" })}
                  >
                    <X className="h-3 w-3" /> Retirer
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[hsl(var(--champagne)/0.6)] bg-muted/10 text-muted-foreground transition hover:bg-muted/20"
                >
                  <Upload className="h-5 w-5" />
                  <span className="font-sans text-xs">{uploading ? "Téléversement…" : "Cliquer pour téléverser une image (max 5 Mo)"}</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = "";
                }}
              />
              <Input
                placeholder="Ou coller une URL d'image…"
                value={form.image_couverture_url}
                onChange={(e) => setForm({ ...form, image_couverture_url: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Légende image (alt + figcaption)</Label>
              <Input value={form.legende_image} onChange={(e) => setForm({ ...form, legende_image: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">OG Image URL (optionnel, 1200×630)</Label>
              <Input value={form.og_image_url} onChange={(e) => setForm({ ...form, og_image_url: e.target.value })} placeholder="https://…" />
            </div>
          </section>

          {/* SECTION : SEO */}
          <section className={cn("space-y-4", SECTION_DIVIDER)}>
            <h3 className={SECTION_TITLE}>SEO</h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta title</Label>
                <CharCounter value={form.meta_title} max={60} />
              </div>
              <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Titre pour les moteurs de recherche" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta description</Label>
                <CharCounter value={form.meta_description} max={155} />
              </div>
              <Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} placeholder="Description pour les moteurs de recherche (max 155 car.)" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Balise canonique (republication)</Label>
              <Input value={form.balise_canonique} onChange={(e) => setForm({ ...form, balise_canonique: e.target.value })} placeholder="https://source-originale.com/article" />
            </div>

            {/* FAQ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">FAQ Schema.org</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFaq} className="h-7 gap-1">
                  <Plus className="h-3 w-3" /> Ajouter une question
                </Button>
              </div>
              {form.faq.length === 0 && (
                <p className="font-sans text-[11px] text-muted-foreground italic">Aucune entrée. Les questions/réponses ajoutées génèrent un FAQPage JSON-LD.</p>
              )}
              {form.faq.map((it, idx) => (
                <div key={idx} className="space-y-2 rounded-md border border-[hsl(var(--champagne)/0.4)] bg-muted/10 p-3">
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder={`Question ${idx + 1}`}
                      value={it.question}
                      onChange={(e) => updateFaq(idx, "question", e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => removeFaq(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea placeholder="Réponse" value={it.reponse} onChange={(e) => updateFaq(idx, "reponse", e.target.value)} rows={2} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={form.noindex} onCheckedChange={(v) => setForm({ ...form, noindex: v })} />
                <Label className="font-sans text-sm">Noindex</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.inclure_sitemap} onCheckedChange={(v) => setForm({ ...form, inclure_sitemap: v })} />
                <Label className="font-sans text-sm">Inclure dans le sitemap</Label>
              </div>
            </div>
          </section>

          {/* SECTION : LIENS INTERNES */}
          <section className={cn("space-y-4", SECTION_DIVIDER)}>
            <h3 className={SECTION_TITLE}>Liens internes</h3>

            <PrestatairesAutocomplete
              selected={form.prestataires_lies}
              onChange={(items) => setForm({ ...form, prestataires_lies: items })}
            />

            <ArticlesAutocomplete
              selected={form.articles_lies}
              excludeId={editItem?.id}
              onChange={(items) => setForm({ ...form, articles_lies: items })}
            />

            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Catégorie marketplace liée (CTA sidebar)</Label>
              <Select
                value={form.categorie_liee_slug || "__none__"}
                onValueChange={(v) => setForm({ ...form, categorie_liee_slug: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {categoriesMarketplace.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <DialogFooter className="pt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            {form.slug && (
              <Button
                variant="outline"
                onClick={() => window.open(`/blog/${form.slug}`, "_blank")}
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Aperçu
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "…" : editItem ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- Autocomplete Prestataires ----------------- */
function PrestatairesAutocomplete({ selected, onChange }: { selected: LinkedItem[]; onChange: (items: LinkedItem[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LinkedItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("prestataires")
        .select("id, nom_commercial")
        .eq("statut", "actif")
        .ilike("nom_commercial", `%${q}%`)
        .limit(8);
      if (!cancel) setResults((data ?? []).map((p: any) => ({ id: p.id, label: p.nom_commercial })));
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q]);

  const add = (item: LinkedItem) => {
    if (!selected.find((s) => s.id === item.id)) onChange([...selected, item]);
    setQ("");
    setOpen(false);
  };
  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

  return (
    <div className="space-y-1.5">
      <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Prestataires liés</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un prestataire actif…"
          className="pl-8"
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => add(r)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.label}
              <button type="button" onClick={() => remove(s.id)} className="rounded-full p-0.5 hover:bg-destructive/20"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------- Autocomplete Articles ----------------- */
function ArticlesAutocomplete({ selected, excludeId, onChange }: { selected: LinkedItem[]; excludeId?: string; onChange: (items: LinkedItem[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LinkedItem[]>([]);
  const [open, setOpen] = useState(false);
  const max = 3;

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    const t = setTimeout(async () => {
      let query = supabase.from("articles_blog").select("id, titre").ilike("titre", `%${q}%`).limit(8);
      if (excludeId) query = query.neq("id", excludeId);
      const { data } = await query;
      if (!cancel) setResults((data ?? []).map((a: any) => ({ id: a.id, label: a.titre })));
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, excludeId]);

  const add = (item: LinkedItem) => {
    if (selected.length >= max) {
      toast.error(`Maximum ${max} articles liés`);
      return;
    }
    if (!selected.find((s) => s.id === item.id)) onChange([...selected, item]);
    setQ("");
    setOpen(false);
  };
  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

  return (
    <div className="space-y-1.5">
      <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Articles liés (max {max}) — section "À lire ensuite"</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un article…"
          className="pl-8"
          disabled={selected.length >= max}
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => add(r)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.label}
              <button type="button" onClick={() => remove(s.id)} className="rounded-full p-0.5 hover:bg-destructive/20"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
