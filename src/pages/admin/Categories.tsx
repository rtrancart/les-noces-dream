import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, GripVertical } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

export default function Categories() {
  const [data, setData] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Categorie | null>(null);
  const [form, setForm] = useState({ nom: "", slug: "", description_seo: "", est_active: true, parent_id: "" });

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase
      .from("categories")
      .select("*")
      .order("ordre_affichage", { ascending: true });
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ nom: "", slug: "", description_seo: "", est_active: true, parent_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (cat: Categorie) => {
    setEditItem(cat);
    setForm({
      nom: cat.nom,
      slug: cat.slug,
      description_seo: cat.description_seo ?? "",
      est_active: cat.est_active ?? true,
      parent_id: cat.parent_id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nom || !form.slug) {
      toast.error("Le nom et le slug sont requis");
      return;
    }

    const payload = {
      nom: form.nom,
      slug: form.slug,
      description_seo: form.description_seo || null,
      est_active: form.est_active,
      parent_id: form.parent_id || null,
    };

    if (editItem) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editItem.id);
      if (error) toast.error(error.message);
      else { toast.success("Catégorie modifiée"); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Catégorie créée"); setDialogOpen(false); fetchData(); }
    }
  };

  const parentCategories = data.filter((c) => !c.parent_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Catégories</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Organisez l'arborescence des services</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm">
          <Plus className="h-4 w-4" /> Nouvelle catégorie
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs w-10" />
                <TableHead className="font-sans text-xs">Nom</TableHead>
                <TableHead className="font-sans text-xs">Slug</TableHead>
                <TableHead className="font-sans text-xs">Parent</TableHead>
                <TableHead className="font-sans text-xs">Active</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-16 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucune catégorie
                  </TableCell>
                </TableRow>
              ) : (
                data.map((cat) => {
                  const parent = data.find((c) => c.id === cat.parent_id);
                  return (
                    <TableRow key={cat.id} className={cat.parent_id ? "bg-muted/10" : ""}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      </TableCell>
                      <TableCell className="font-sans text-sm font-medium">
                        {cat.parent_id && <span className="mr-2 text-muted-foreground">↳</span>}
                        {cat.nom}
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground font-mono">{cat.slug}</TableCell>
                      <TableCell className="font-sans text-sm text-muted-foreground">{parent?.nom ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={cat.est_active ? "bg-sauge/20 text-sauge" : "bg-muted text-muted-foreground"}>
                          {cat.est_active ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editItem ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Nom</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="font-sans" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="font-sans font-mono text-sm"
                placeholder="ex: photographes"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Catégorie parente</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              >
                <option value="">Aucune (catégorie mère)</option>
                {parentCategories
                  .filter((c) => c.id !== editItem?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Description SEO</Label>
              <Input value={form.description_seo} onChange={(e) => setForm({ ...form, description_seo: e.target.value })} className="font-sans" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.est_active} onCheckedChange={(val) => setForm({ ...form, est_active: val })} />
              <Label className="font-sans text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-sans text-sm">Annuler</Button>
            <Button onClick={handleSave} className="font-sans text-sm">
              {editItem ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
