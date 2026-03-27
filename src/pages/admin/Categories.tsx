import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, GripVertical, Upload, X, ImageIcon, ChevronDown, ChevronRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Database } from "@/integrations/supabase/types";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

/* ─── Image constraints ─── */
const PHOTO_MAX_KB = 500;
const PHOTO_MIN_W = 600;
const PHOTO_MIN_H = 600;
const PHOTO_MAX_W = 1600;
const PHOTO_MAX_H = 1600;
const PICTO_MAX_KB = 100;
const PICTO_MAX_W = 256;
const PICTO_MAX_H = 256;

function validateImage(file: File, kind: "photo" | "picto"): Promise<string | null> {
  return new Promise((resolve) => {
    const maxKb = kind === "photo" ? PHOTO_MAX_KB : PICTO_MAX_KB;
    if (file.size > maxKb * 1024) {
      resolve(`Le fichier dépasse ${maxKb} Ko (${Math.round(file.size / 1024)} Ko)`);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (kind === "photo") {
        if (img.width < PHOTO_MIN_W || img.height < PHOTO_MIN_H)
          resolve(`Dimensions min : ${PHOTO_MIN_W}×${PHOTO_MIN_H}px (reçu ${img.width}×${img.height})`);
        else if (img.width > PHOTO_MAX_W || img.height > PHOTO_MAX_H)
          resolve(`Dimensions max : ${PHOTO_MAX_W}×${PHOTO_MAX_H}px (reçu ${img.width}×${img.height})`);
        else resolve(null);
      } else {
        if (img.width > PICTO_MAX_W || img.height > PICTO_MAX_H)
          resolve(`Dimensions max : ${PICTO_MAX_W}×${PICTO_MAX_H}px (reçu ${img.width}×${img.height})`);
        else resolve(null);
      }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve("Fichier image invalide");
    img.src = URL.createObjectURL(file);
  });
}

async function uploadCategoryImage(file: File, categorySlug: string, kind: "photo" | "picto"): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${categorySlug}/${kind}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("categories-assets").upload(path, file, { upsert: true });
  if (error) { toast.error(`Erreur upload : ${error.message}`); return null; }
  const { data } = supabase.storage.from("categories-assets").getPublicUrl(path);
  return data.publicUrl;
}

/* ─── Upload Field ─── */
function ImageUploadField({ label, hint, currentUrl, onUrlChange, kind, categorySlug }: {
  label: string; hint: string; currentUrl: string; onUrlChange: (url: string) => void;
  kind: "photo" | "picto"; categorySlug: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = await validateImage(file, kind);
    if (err) { toast.error(err); if (inputRef.current) inputRef.current.value = ""; return; }
    setUploading(true);
    const url = await uploadCategoryImage(file, categorySlug || "temp", kind);
    if (url) onUrlChange(url);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className="text-xs text-muted-foreground/70 font-sans">{hint}</p>
      {currentUrl ? (
        <div className="relative inline-block">
          <img src={currentUrl} alt="" className={`rounded border border-border object-cover ${kind === "picto" ? "h-16 w-16" : "h-24 w-36"}`} />
          <button type="button" onClick={() => onUrlChange("")} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/20 transition-colors font-sans">
          {uploading ? <span className="animate-pulse">Upload en cours…</span> : <><Upload className="h-4 w-4" />Choisir un fichier</>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ─── Sortable Row ─── */
function SortableCategoryRow({ cat, isChild, onEdit }: { cat: Categorie; isChild?: boolean; onEdit: (c: Categorie) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 ${isChild ? "pl-12 bg-muted/10" : "bg-background"} ${isDragging ? "shadow-lg rounded-md" : ""}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>

      {/* Photo */}
      <div className="shrink-0">
        {cat.photo_url ? (
          <img src={cat.photo_url} alt="" className="h-9 w-13 rounded object-cover" />
        ) : (
          <div className="h-9 w-13 rounded bg-muted/20 flex items-center justify-center">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Picto */}
      <div className="shrink-0">
        {cat.icone_url ? (
          <img src={cat.icone_url} alt="" className="h-7 w-7 object-contain" />
        ) : (
          <div className="h-7 w-7 rounded bg-muted/20 flex items-center justify-center">
            <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="font-sans text-sm font-medium truncate block">
          {isChild && <span className="mr-1.5 text-muted-foreground">↳</span>}
          {cat.nom}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground truncate block">{cat.slug}</span>
      </div>

      {/* Active badge */}
      <Badge className={`shrink-0 ${cat.est_active ? "bg-sauge/20 text-sauge" : "bg-muted text-muted-foreground"}`}>
        {cat.est_active ? "Active" : "Inactive"}
      </Badge>

      {/* Edit */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onEdit(cat)}>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

/* ─── Parent group with collapsible children ─── */
function ParentCategoryGroup({ parent, children, onEdit, onReorderChildren }: {
  parent: Categorie;
  children: Categorie[];
  onEdit: (c: Categorie) => void;
  onReorderChildren: (parentId: string, oldIndex: number, newIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = children.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleChildDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = children.findIndex((c) => c.id === active.id);
    const newIndex = children.findIndex((c) => c.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderChildren(parent.id, oldIndex, newIndex);
    }
  };

  return (
    <div>
      {/* Parent row */}
      <div className="flex items-center">
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 ml-1 hover:bg-muted/30 rounded transition-colors">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}
        {!hasChildren && <div className="w-[34px]" />}
        <div className="flex-1">
          <SortableCategoryRow cat={parent} onEdit={onEdit} />
        </div>
      </div>

      {/* Children (collapsible) */}
      {hasChildren && expanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {children.map((child) => (
              <SortableCategoryRow key={child.id} cat={child} isChild onEdit={onEdit} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function Categories() {
  const [data, setData] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Categorie | null>(null);
  const [form, setForm] = useState({
    nom: "", slug: "", description_seo: "", est_active: true, parent_id: "", photo_url: "", icone_url: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase.from("categories").select("*").order("ordre_affichage", { ascending: true });
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const parents = useMemo(() => data.filter((c) => !c.parent_id).sort((a, b) => (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0)), [data]);
  const childrenMap = useMemo(() => {
    const map: Record<string, Categorie[]> = {};
    data.filter((c) => c.parent_id).forEach((c) => {
      if (!map[c.parent_id!]) map[c.parent_id!] = [];
      map[c.parent_id!].push(c);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0)));
    return map;
  }, [data]);

  const parentCategories = data.filter((c) => !c.parent_id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = async (items: { id: string; ordre: number }[]) => {
    const promises = items.map(({ id, ordre }) =>
      supabase.from("categories").update({ ordre_affichage: ordre }).eq("id", id)
    );
    const results = await Promise.all(promises);
    const err = results.find((r) => r.error);
    if (err?.error) toast.error(err.error.message);
  };

  const handleParentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = parents.findIndex((c) => c.id === active.id);
    const newIndex = parents.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(parents, oldIndex, newIndex);
    const updates = reordered.map((c, i) => ({ ...c, ordre_affichage: i + 1 }));
    setData((prev) => {
      const children = prev.filter((c) => c.parent_id);
      return [...updates, ...children];
    });
    persistOrder(updates.map((c, i) => ({ id: c.id, ordre: i + 1 })));
  };

  const handleReorderChildren = (parentId: string, oldIndex: number, newIndex: number) => {
    const kids = [...(childrenMap[parentId] || [])];
    const reordered = arrayMove(kids, oldIndex, newIndex);
    setData((prev) => {
      const others = prev.filter((c) => c.parent_id !== parentId);
      return [...others, ...reordered.map((c, i) => ({ ...c, ordre_affichage: i + 1 }))];
    });
    persistOrder(reordered.map((c, i) => ({ id: c.id, ordre: i + 1 })));
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ nom: "", slug: "", description_seo: "", est_active: true, parent_id: "", photo_url: "", icone_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (cat: Categorie) => {
    setEditItem(cat);
    setForm({
      nom: cat.nom, slug: cat.slug, description_seo: cat.description_seo ?? "",
      est_active: cat.est_active ?? true, parent_id: cat.parent_id ?? "",
      photo_url: cat.photo_url ?? "", icone_url: cat.icone_url ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nom || !form.slug) { toast.error("Le nom et le slug sont requis"); return; }
    const payload: any = {
      nom: form.nom, slug: form.slug, description_seo: form.description_seo || null,
      est_active: form.est_active, parent_id: form.parent_id || null,
      photo_url: form.photo_url || null, icone_url: form.icone_url || null,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Catégories</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Organisez l'arborescence des services — glissez-déposez pour réordonner
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-sans text-sm">
          <Plus className="h-4 w-4" /> Nouvelle catégorie
        </Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 text-xs font-sans uppercase tracking-wider text-muted-foreground">
            <div className="w-[34px]" />
            <div className="w-4" />
            <div className="w-13 shrink-0">Photo</div>
            <div className="w-7 shrink-0">Picto</div>
            <div className="flex-1">Nom / Slug</div>
            <div className="w-16">Statut</div>
            <div className="w-7" />
          </div>

          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                <div className="h-4 w-full max-w-[200px] animate-pulse rounded bg-muted/30" />
              </div>
            ))
          ) : parents.length === 0 ? (
            <div className="text-center font-sans text-sm text-muted-foreground py-12">Aucune catégorie</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleParentDragEnd}>
              <SortableContext items={parents.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {parents.map((parent) => (
                  <ParentCategoryGroup
                    key={parent.id}
                    parent={parent}
                    children={childrenMap[parent.id] || []}
                    onEdit={openEdit}
                    onReorderChildren={handleReorderChildren}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{editItem ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Nom</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="font-sans" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="font-sans font-mono text-sm" placeholder="ex: photographes" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Catégorie parente</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                <option value="">Aucune (catégorie mère)</option>
                {parentCategories.filter((c) => c.id !== editItem?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Description SEO</Label>
              <Input value={form.description_seo} onChange={(e) => setForm({ ...form, description_seo: e.target.value })} className="font-sans" />
            </div>
            <ImageUploadField label="Photo de fond" hint={`JPG/PNG/WebP — min ${PHOTO_MIN_W}×${PHOTO_MIN_H}px, max ${PHOTO_MAX_W}×${PHOTO_MAX_H}px, ${PHOTO_MAX_KB} Ko max`}
              currentUrl={form.photo_url} onUrlChange={(url) => setForm({ ...form, photo_url: url })} kind="photo" categorySlug={form.slug || "new"} />
            <ImageUploadField label="Pictogramme" hint={`PNG/SVG transparent — max ${PICTO_MAX_W}×${PICTO_MAX_H}px, ${PICTO_MAX_KB} Ko max`}
              currentUrl={form.icone_url} onUrlChange={(url) => setForm({ ...form, icone_url: url })} kind="picto" categorySlug={form.slug || "new"} />
            <div className="flex items-center gap-3">
              <Switch checked={form.est_active} onCheckedChange={(val) => setForm({ ...form, est_active: val })} />
              <Label className="font-sans text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-sans text-sm">Annuler</Button>
            <Button onClick={handleSave} className="font-sans text-sm">{editItem ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
