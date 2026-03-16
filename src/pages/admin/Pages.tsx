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
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PageContenu = Database["public"]["Tables"]["pages_contenu"]["Row"];

const emptyForm = { titre: "", slug: "", meta_title: "", meta_description: "", est_publiee: false };

export default function Pages() {
  const [data, setData] = useState<PageContenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PageContenu | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase.from("pages_contenu").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: PageContenu) => {
    setEditItem(p);
    setForm({ titre: p.titre, slug: p.slug, meta_title: p.meta_title ?? "", meta_description: p.meta_description ?? "", est_publiee: p.est_publiee ?? false });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titre || !form.slug) { toast.error("Titre et slug requis"); return; }
    setSaving(true);
    const payload = { titre: form.titre, slug: form.slug, meta_title: form.meta_title || null, meta_description: form.meta_description || null, est_publiee: form.est_publiee };
    if (editItem) {
      const { error } = await supabase.from("pages_contenu").update(payload).eq("id", editItem.id);
      if (error) toast.error(error.message);
      else { toast.success("Page modifiée"); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("pages_contenu").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Page créée"); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("pages_contenu").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Page supprimée"); fetchData(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Pages de contenu</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Pages statiques de la plateforme</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm"><Plus className="h-4 w-4" /> Nouvelle page</Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Slug</TableHead>
                <TableHead className="font-sans text-xs">Publiée</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center font-sans text-sm text-muted-foreground py-8">Aucune page</TableCell></TableRow>
              ) : (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-sans text-sm font-medium">{p.titre}</TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground font-mono">/{p.slug}</TableCell>
                    <TableCell><Badge className={p.est_publiee ? "bg-sauge/20 text-sauge" : "bg-muted/40 text-muted-foreground"}>{p.est_publiee ? "Oui" : "Non"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Supprimer cette page ?</AlertDialogTitle><AlertDialogDescription>La page « {p.titre} » sera supprimée définitivement.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction></AlertDialogFooter>
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
          <DialogHeader><DialogTitle className="font-serif text-lg">{editItem ? "Modifier la page" : "Nouvelle page"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="font-mono text-sm" /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta Title</Label><Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Meta Description</Label><Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.est_publiee} onCheckedChange={(v) => setForm({ ...form, est_publiee: v })} /><Label className="font-sans text-sm">Publier</Label></div>
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
