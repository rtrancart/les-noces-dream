import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, GripVertical, Trash2, Pencil, Check, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Famille {
  id: string;
  cle: string;
  libelle: string;
  ordre_affichage: number;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SortableRow({
  f,
  count,
  onEdit,
  onDelete,
}: {
  f: Famille;
  count: number;
  onEdit: (f: Famille, libelle: string) => Promise<void>;
  onDelete: (f: Famille) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(f.libelle);

  const save = async () => {
    if (!val.trim() || val === f.libelle) {
      setEditing(false);
      setVal(f.libelle);
      return;
    }
    await onEdit(f, val.trim());
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background"
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none">
        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
      </button>
      <div className="flex-1 flex items-center gap-2">
        {editing ? (
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setEditing(false);
                setVal(f.libelle);
              }
            }}
            className="h-8 font-sans text-sm"
            autoFocus
          />
        ) : (
          <>
            <span className="font-sans text-sm font-medium">{f.libelle}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{f.cle}</span>
          </>
        )}
      </div>
      <span className="text-xs text-muted-foreground font-sans shrink-0">
        {count} cat.
      </span>
      {editing ? (
        <>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={save}>
            <Check className="w-4 h-4 text-sauge" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => {
              setEditing(false);
              setVal(f.libelle);
            }}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDelete(f)}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function FamillesPanel() {
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [toDelete, setToDelete] = useState<Famille | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [f, c] = await Promise.all([
      supabase
        .from("categories_familles")
        .select("id, cle, libelle, ordre_affichage")
        .order("ordre_affichage", { ascending: true }),
      supabase.from("categories").select("famille_id").not("famille_id", "is", null),
    ]);
    if (f.error) toast.error(f.error.message);
    else setFamilles(f.data ?? []);
    if (!c.error) {
      const m: Record<string, number> = {};
      (c.data ?? []).forEach((r: any) => {
        if (r.famille_id) m[r.famille_id] = (m[r.famille_id] ?? 0) + 1;
      });
      setCounts(m);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = familles.findIndex((f) => f.id === active.id);
    const newIdx = familles.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(familles, oldIdx, newIdx).map((f, i) => ({
      ...f,
      ordre_affichage: i + 1,
    }));
    setFamilles(reordered);
    const results = await Promise.all(
      reordered.map((f) =>
        supabase
          .from("categories_familles")
          .update({ ordre_affichage: f.ordre_affichage })
          .eq("id", f.id),
      ),
    );
    const err = results.find((r) => r.error);
    if (err?.error) toast.error(err.error.message);
  };

  const createFamille = async () => {
    if (!newLabel.trim()) return;
    const cle = slugify(newLabel);
    const ordre = (familles.at(-1)?.ordre_affichage ?? 0) + 1;
    const { error } = await supabase
      .from("categories_familles")
      .insert({ libelle: newLabel.trim(), cle, ordre_affichage: ordre });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Famille créée");
    setNewLabel("");
    setCreating(false);
    fetchAll();
  };

  const editFamille = async (f: Famille, libelle: string) => {
    const { error } = await supabase
      .from("categories_familles")
      .update({ libelle })
      .eq("id", f.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Famille modifiée");
      fetchAll();
    }
  };

  const deleteFamille = async () => {
    if (!toDelete) return;
    const { error } = await supabase
      .from("categories_familles")
      .delete()
      .eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Famille supprimée — catégories basculées dans « Autres »");
      setToDelete(null);
      fetchAll();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-muted-foreground">
          L'ordre défini ici pilote l'ordre des familles dans le header du site.
        </p>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="gap-2 font-sans text-sm">
            <Plus className="w-4 h-4" /> Nouvelle famille
          </Button>
        )}
      </div>

      {creating && (
        <Card className="shadow-card">
          <CardContent className="p-4 flex items-center gap-2">
            <Input
              placeholder="Libellé (ex. Cérémonie & Officiants)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFamille()}
              autoFocus
              className="font-sans"
            />
            <Button onClick={createFamille} className="font-sans text-sm">
              Créer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setNewLabel("");
              }}
              className="font-sans text-sm"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-sans">
              Chargement…
            </div>
          ) : familles.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-sans">
              Aucune famille.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={familles.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {familles.map((f) => (
                  <SortableRow
                    key={f.id}
                    f={f}
                    count={counts[f.id] ?? 0}
                    onEdit={editFamille}
                    onDelete={(x) => setToDelete(x)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Supprimer cette famille&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription className="font-sans">
              La famille « {toDelete?.libelle} » sera supprimée. Les{" "}
              {counts[toDelete?.id ?? ""] ?? 0} catégorie(s) rattachée(s) ne seront pas supprimées :
              elles basculeront dans le groupe « Autres » jusqu'à ce que vous les rattachiez à une
              autre famille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFamille} className="font-sans">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
