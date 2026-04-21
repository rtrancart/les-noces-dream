import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["articles_blog"]["Row"];

const emptyForm = { titre: "", slug: "", extrait: "", contenu: "", categorie_blog: "", image_couverture_url: "", tags: "", est_publie: false, meta_title: "", meta_description: "" };

export default function Articles() {
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Article | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase.from("articles_blog").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (a: Article) => {
    setEditItem(a);
    setForm({
      titre: a.titre, slug: a.slug, extrait: a.extrait ?? "", contenu: (a as any).contenu ?? "", categorie_blog: a.categorie_blog ?? "",
      image_couverture_url: a.image_couverture_url ?? "", tags: (a.tags ?? []).join(", "), est_publie: a.est_publie ?? false,
      meta_title: (a as any).meta_title ?? "", meta_description: (a as any).meta_description ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titre || !form.slug) { toast.error("Titre et slug requis"); return; }
    setSaving(true);
    const payload = {
      titre: form.titre, slug: form.slug, extrait: form.extrait || null,
      contenu: form.contenu || null,
      categorie_blog: form.categorie_blog || null, image_couverture_url: form.image_couverture_url || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      est_publie: form.est_publie,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
    };
    if (editItem) {
      const { error } = await supabase.from("articles_blog").update(payload).eq("id", editItem.id);
      if (error) toast.error(error.message);
      else { toast.success("Article modifié"); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("articles_blog").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Article créé"); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("articles_blog").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Article supprimé"); fetchData(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Articles de blog</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Gérez le contenu éditorial</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm"><Plus className="h-4 w-4" /> Nouvel article</Button>
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
                Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center font-sans text-sm text-muted-foreground py-8">Aucun article</TableCell></TableRow>
              ) : (
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-sans text-sm font-medium">{a.titre}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{a.categorie_blog ?? "—"}</TableCell>
                    <TableCell><Badge className={a.est_publie ? "bg-sauge/20 text-sauge" : "bg-muted/40 text-muted-foreground"}>{a.est_publie ? "Oui" : "Non"}</Badge></TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle><AlertDialogDescription>L'article « {a.titre} » sera supprimé définitivement.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(a.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction></AlertDialogFooter>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-lg">{editItem ? "Modifier l'article" : "Nouvel article"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="font-mono text-sm" /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Extrait</Label><Textarea value={form.extrait} onChange={(e) => setForm({ ...form, extrait: e.target.value })} rows={3} /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Contenu (Markdown)</Label><Textarea value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} rows={14} className="font-mono text-xs" placeholder="## Titre de section&#10;&#10;Paragraphe avec **gras** et *italique*.&#10;&#10;> Citation à mettre en avant&#10;&#10;- Élément de liste&#10;- Autre élément" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Catégorie</Label><Input value={form.categorie_blog} onChange={(e) => setForm({ ...form, categorie_blog: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Image couverture URL</Label><Input value={form.image_couverture_url} onChange={(e) => setForm({ ...form, image_couverture_url: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Tags (séparés par virgule)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="mariage, décoration, tendances" /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta title (SEO)</Label><Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Titre pour les moteurs de recherche" /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta description (SEO)</Label><Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} placeholder="Description pour les moteurs de recherche (max 160 car.)" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.est_publie} onCheckedChange={(v) => setForm({ ...form, est_publie: v })} /><Label className="font-sans text-sm">Publier</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "…" : editItem ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
