import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ESPACE_MAX, FICHIER_MAX, analyserPhoto, envoyerFichier, formaterTaille, preparerImage, supprimerFichier, urlsSignees, ErreurStyle,
  type PhotoInspiration,
} from "@/lib/notreStyle";

export default function Inspirations({ photos, restants, onChange }: { photos: PhotoInspiration[]; restants: number | null; onChange: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const utilise = photos.reduce((s, p) => s + Number(p.taille_octets), 0);
  const inspi = photos.filter((p) => p.type === "inspiration");
  const choisie = inspi.find((p) => p.id === sel) ?? null;

  useEffect(() => { urlsSignees(photos.map((p) => p.storage_path)).then(setUrls); }, [photos]);

  const ajouter = async (fichiers: FileList) => {
    setEnvoi(true);
    for (const f of Array.from(fichiers)) {
      try {
        if (f.size > FICHIER_MAX * 3) throw new Error(`« ${f.name} » dépasse la taille autorisée.`);
        const svg = f.type === "image/svg+xml" || /\.svg$/i.test(f.name);
        if (svg) { if (f.size > FICHIER_MAX) throw new Error(`« ${f.name} » dépasse 10 Mo.`); await envoyerFichier(f, f.name, "inspiration"); }
        else {
          const p = await preparerImage(f);
          await envoyerFichier(p.blob, p.nom, "inspiration", { largeur: p.largeur, hauteur: p.hauteur, couleurs: p.couleurs });
        }
      } catch (e) { toast.error((e as Error).message); }
    }
    setEnvoi(false); onChange();
  };
  const supprimer = async (p: PhotoInspiration) => {
    try { await supprimerFichier(p); if (sel === p.id) setSel(null); toast.success("Fichier supprimé."); } catch (e) { toast.error((e as Error).message); }
    onChange();
  };
  const analyser = async () => {
    if (!choisie) return;
    setAnalyse(true);
    try { await analyserPhoto(choisie.id); onChange(); }
    catch (e) { toast.error(e instanceof ErreurStyle ? e.message : "L'analyse n'a pas pu aboutir."); }
    finally { setAnalyse(false); }
  };
  const analysable = choisie && choisie.format !== "image/svg+xml";

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between font-sans text-xs"><span className="font-semibold">Espace utilisé</span><span className="text-muted-foreground">{formaterTaille(utilise)} sur 50 Mo</span></div>
          <Progress value={(utilise / ESPACE_MAX) * 100} className="h-1.5" />
        </div>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/svg+xml,.heic,.heif" className="hidden"
          onChange={(e) => { const f = e.target.files; if (f?.length) ajouter(f); e.target.value = ""; }} />
        <Button onClick={() => input.current?.click()} disabled={envoi} className="rounded-full bg-atelier-or hover:bg-atelier-or/90 gap-1.5">
          {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Ajouter des photos
        </Button>
      </div>
      {inspi.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atelier-filet bg-card p-8 text-center font-sans text-sm text-muted-foreground">
          Ajoutez des photos qui vous inspirent (JPG, PNG, WEBP ou SVG, 10 Mo maximum). Elles restent privées.
        </div>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
          {inspi.map((p) => (
            <div key={p.id} className="relative group">
              <button type="button" onClick={() => setSel(sel === p.id ? null : p.id)} className={cn("block aspect-square w-full rounded-xl overflow-hidden border bg-atelier-lin", sel === p.id ? "border-atelier-or ring-2 ring-atelier-or/40" : "border-atelier-filet")}>
                {urls[p.storage_path] ? <img src={urls[p.storage_path]} alt={p.fichier_nom} className="h-full w-full object-cover" /> : null}
              </button>
              {p.couleurs_dominantes.length > 0 && <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">{p.couleurs_dominantes.slice(0, 5).map((c) => <span key={c} className="h-3 w-3 rounded-full border border-background" style={{ background: c }} />)}</div>}
              {p.analyse_ia && <span className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-atelier-or text-primary-foreground grid place-items-center" title="Analysée"><Sparkles className="h-3 w-3" /></span>}
              <button type="button" onClick={() => supprimer(p)} aria-label={`Supprimer ${p.fichier_nom}`} className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-background/90 grid place-items-center text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      <p className="flex items-start gap-1.5 font-sans text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />L'analyse propose des couleurs et des mots clés à ajouter à votre charte. Les pastilles de couleur sont calculées sur votre appareil.</p>
      {choisie?.analyse_ia && (
        <div className="rounded-2xl border border-atelier-filet bg-card p-4 space-y-2">
          <p className="font-serif text-lg">{choisie.analyse_ia.description}</p>
          {[...choisie.analyse_ia.ambiances, ...choisie.analyse_ia.matieres, ...choisie.analyse_ia.elements].length > 0 && (
            <div className="flex flex-wrap gap-1.5">{[...choisie.analyse_ia.ambiances, ...choisie.analyse_ia.matieres, ...choisie.analyse_ia.elements].map((m) => <span key={m} className="rounded-full bg-atelier-lin px-2.5 py-1 font-sans text-xs">{m}</span>)}</div>
          )}
        </div>
      )}
      {choisie && (
        <div className="sticky bottom-20 lg:bottom-4 rounded-2xl bg-foreground text-background p-3 flex items-center gap-3 shadow-lg">
          <div className="flex-1 min-w-0"><p className="font-sans text-sm font-semibold">1 photo sélectionnée</p>
            <p className="font-sans text-xs opacity-75">{analysable ? (restants !== null ? `${restants} analyse${restants > 1 ? "s" : ""} restante${restants > 1 ? "s" : ""}` : "Analyse IA") : "Les SVG ne sont pas analysés"}</p></div>
          {analysable && <Button size="sm" disabled={analyse || restants === 0} onClick={analyser} className="rounded-full bg-atelier-lin text-foreground hover:bg-atelier-lin/90 gap-1.5">
            {analyse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{choisie.analyse_ia ? "Analyser à nouveau" : "Analyser cette photo"}</Button>}
        </div>
      )}
    </div>
  );
}
