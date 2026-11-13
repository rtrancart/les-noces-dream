import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logAdmin } from "@/lib/logAdmin";
import { CATEGORIES_TACHE } from "@/lib/planning";
import { cn } from "@/lib/utils";

type Modele = {
  id: string; titre: string; description: string | null; categorie: string; mois_avant: number; priorite: number;
  types_ceremonie: string[]; categorie_prestataire: string | null; message_assistant: string | null; lien_module: string | null; actif: boolean; ordre: number;
};
const VIDE: Omit<Modele, "id"> = { titre: "", description: "", categorie: "Organisation", mois_avant: 6, priorite: 2, types_ceremonie: [], categorie_prestataire: null, message_assistant: null, lien_module: null, actif: true, ordre: 0 };
const CER = [{ id: "civile", l: "Civile" }, { id: "religieuse", l: "Religieuse" }, { id: "laique", l: "Laïque" }];
const PRIO = ["", "Haute", "Normale", "Facultative"];

export function libelleDelai(m: number) {
  if (m < 0) return m === -1 ? "1 mois après" : `${Math.round(-m * 30)} j après`;
  if (m >= 1 && Number.isInteger(m)) return `${m} mois avant`;
  return `${Math.round(m * 30)} j avant`;
}

export default function AdminModelesPlanning() {
  const qc = useQueryClient();
  const [edite, setEdite] = useState<(Omit<Modele, "id"> & { id?: string }) | null>(null);
  const [enreg, setEnreg] = useState(false);
  const { data: modeles, isLoading } = useQuery({
    queryKey: ["admin-modeles-planning"],
    queryFn: async () => ((await supabase.from("modeles_retroplanning").select("*").order("ordre")).data ?? []) as unknown as Modele[],
  });
  const { data: categories } = useQuery({
    queryKey: ["admin-categories-noms"],
    queryFn: async () => ((await supabase.from("categories").select("nom").order("nom")).data ?? []).map((c) => c.nom as string),
  });
  const recharger = () => qc.invalidateQueries({ queryKey: ["admin-modeles-planning"] });

  const enregistrer = async (m: Omit<Modele, "id"> & { id?: string }) => {
    const { id, ...champs } = m;
    const ligne = { ...champs, description: champs.description || null, categorie_prestataire: champs.categorie_prestataire || null,
      message_assistant: champs.categorie_prestataire ? (champs.message_assistant || null) : null, lien_module: champs.lien_module || null };
    const r = id
      ? await supabase.from("modeles_retroplanning").update(ligne).eq("id", id).select("id")
      : await supabase.from("modeles_retroplanning").insert({ ...ligne, ordre: Math.max(0, ...(modeles ?? []).map((x) => x.ordre)) + 1 }).select("id");
    if (r.error || !r.data?.length) { toast.error("Enregistrement refusé."); return false; }
    await logAdmin(id ? "modele_planning_modifie" : "modele_planning_cree", "modeles_retroplanning", r.data[0].id, { titre: m.titre, actif: m.actif });
    recharger(); return true;
  };
  const deplacer = async (i: number, sens: -1 | 1) => {
    const a = modeles![i], b = modeles![i + sens];
    if (!b) return;
    await supabase.from("modeles_retroplanning").update({ ordre: b.ordre }).eq("id", a.id);
    await supabase.from("modeles_retroplanning").update({ ordre: a.ordre }).eq("id", b.id);
    recharger();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Modèles de planning</h1>
          <p className="text-sm text-muted-foreground mt-1">Tâches proposées aux couples dans le Planning de l'Atelier. Un ajout ou une modification s'applique aux couples dont le mariage est à venir ; une tâche désactivée est masquée chez eux (sauf si déjà cochée).</p>
        </div>
        <Button onClick={() => setEdite({ ...VIDE })} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Ajouter</Button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b"><tr>
              <th className="p-2 w-16">Ordre</th><th className="p-2">Tâche</th><th className="p-2">Échéance</th><th className="p-2">Priorité</th><th className="p-2">Cérémonie</th><th className="p-2">Bouton</th><th className="p-2">Active</th><th className="p-2" />
            </tr></thead>
            <tbody>
              {modeles!.map((m, i) => (
                <tr key={m.id} className={cn("border-b last:border-0", !m.actif && "opacity-50")}>
                  <td className="p-2 whitespace-nowrap">
                    <button aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)} className="p-1 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button aria-label="Descendre" disabled={i === modeles!.length - 1} onClick={() => deplacer(i, 1)} className="p-1 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </td>
                  <td className="p-2"><div className="font-medium">{m.titre}</div><div className="text-xs text-muted-foreground">{m.categorie}</div></td>
                  <td className="p-2 whitespace-nowrap">{libelleDelai(Number(m.mois_avant))}</td>
                  <td className="p-2">{PRIO[m.priorite]}</td>
                  <td className="p-2">{m.types_ceremonie.length ? m.types_ceremonie.join(", ") : "Toutes"}</td>
                  <td className="p-2 text-xs">{m.categorie_prestataire ? `Prestataire : ${m.categorie_prestataire}` : m.lien_module ? `Module : ${m.lien_module}` : "—"}</td>
                  <td className="p-2"><Switch checked={m.actif} onCheckedChange={(v) => enregistrer({ ...m, actif: v })} aria-label="Active" /></td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => setEdite({ ...m })} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!edite} onOpenChange={(o) => !o && setEdite(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edite?.id ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle></DialogHeader>
          {edite && (
            <div className="space-y-3 text-sm">
              <label className="block">Titre<Input className="mt-1" value={edite.titre} maxLength={200} onChange={(e) => setEdite({ ...edite, titre: e.target.value })} /></label>
              <label className="block">Description (une phrase)<Input className="mt-1" value={edite.description ?? ""} onChange={(e) => setEdite({ ...edite, description: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">Catégorie
                  <select className="mt-1 w-full rounded-md border bg-background px-2 py-2" value={edite.categorie} onChange={(e) => setEdite({ ...edite, categorie: e.target.value })}>
                    {[...new Set([...CATEGORIES_TACHE, edite.categorie])].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">Mois avant le mariage
                  <Input className="mt-1" type="number" step="0.25" value={edite.mois_avant} onChange={(e) => setEdite({ ...edite, mois_avant: Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">{libelleDelai(Number(edite.mois_avant))} · 0,25 = 1 semaine, -1 = 1 mois après</span>
                </label>
              </div>
              <label className="block">Priorité
                <select className="mt-1 w-full rounded-md border bg-background px-2 py-2" value={edite.priorite} onChange={(e) => setEdite({ ...edite, priorite: Number(e.target.value) })}>
                  <option value={1}>Haute</option><option value={2}>Normale</option><option value={3}>Facultative</option>
                </select>
              </label>
              <fieldset><legend>Cérémonies (aucune cochée = toutes)</legend>
                <div className="flex gap-4 mt-1">{CER.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5"><input type="checkbox" checked={edite.types_ceremonie.includes(c.id)}
                    onChange={(e) => setEdite({ ...edite, types_ceremonie: e.target.checked ? [...edite.types_ceremonie, c.id] : edite.types_ceremonie.filter((x) => x !== c.id) })} />{c.l}</label>
                ))}</div>
                <p className="text-xs text-muted-foreground mt-1">« Civile » s'affiche pour tous les couples.</p>
              </fieldset>
              <label className="block">Catégorie prestataire (bouton « Trouver un prestataire »)
                <select className="mt-1 w-full rounded-md border bg-background px-2 py-2" value={edite.categorie_prestataire ?? ""} onChange={(e) => setEdite({ ...edite, categorie_prestataire: e.target.value || null })}>
                  <option value="">Aucune</option>{(categories ?? []).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              {edite.categorie_prestataire && (
                <label className="block">Message envoyé à l'assistant
                  <Input className="mt-1" maxLength={300} value={edite.message_assistant ?? ""} placeholder="Nous cherchons … pour notre mariage." onChange={(e) => setEdite({ ...edite, message_assistant: e.target.value })} />
                </label>
              )}
              <label className="block">Module lié (bouton « Ouvrir »)
                <select className="mt-1 w-full rounded-md border bg-background px-2 py-2" value={edite.lien_module ?? ""} onChange={(e) => setEdite({ ...edite, lien_module: e.target.value || null })}>
                  <option value="">Aucun</option><option value="style">Notre style</option><option value="livret">Livret</option>
                </select>
              </label>
              <label className="flex items-center gap-2"><Switch checked={edite.actif} onCheckedChange={(v) => setEdite({ ...edite, actif: v })} />Active</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdite(null)}>Annuler</Button>
            <Button disabled={!edite?.titre.trim() || enreg} onClick={async () => { setEnreg(true); const ok = await enregistrer(edite!); setEnreg(false); if (ok) setEdite(null); }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
