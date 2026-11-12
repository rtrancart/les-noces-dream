import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { envoyerFichier, urlsSignees, type CharteMariage, type Police } from "@/lib/notreStyle";
import { DISPOSITIONS, cleProposition, proposer, rendreSvg, svgVersPng, type Ornement, type Proposition, type Rendu } from "@/lib/monogramme";

function telecharger(b: Blob, nom: string) {
  const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}

export default function Monogrammes({ charte, polices, ornements, ambiances, initialesDefaut, dateCourte, onChange }: {
  charte: CharteMariage; polices: Police[]; ornements: Ornement[]; ambiances: string[];
  initialesDefaut: [string, string]; dateCourte: string | null; onChange: () => void;
}) {
  const [ini, setIni] = useState<[string, string]>(charte.monogramme?.initiales ?? initialesDefaut);
  const [graine, setGraine] = useState(1);
  const vues = useRef(new Set<string>());
  const [props, setProps] = useState<Proposition[]>([]);
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [choix, setChoix] = useState<Proposition | null>(charte.monogramme ? { disposition: charte.monogramme.disposition as Proposition["disposition"], ornement: charte.monogramme.ornement, police: charte.monogramme.police } : null);
  const [export_, setExport] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const couleurs = useMemo(() => {
    const g = (r: string) => charte.palette.find((c) => c.role === r)?.hex ?? "#000000";
    return { lettres: g("texte"), ornement: g("principale"), fond: g("fond") };
  }, [charte.palette]);
  const rendu = (p: Proposition): Rendu => ({ ...p, police: polices.find((x) => x.nom === p.police)!, initiales: ini, date: dateCourte, couleurLettres: couleurs.lettres, couleurOrnement: couleurs.ornement });

  useEffect(() => {
    if (!polices.length || !ornements.length) return;
    const l = proposer(polices, ornements, ambiances, graine, vues.current);
    l.forEach((p) => vues.current.add(cleProposition(p)));
    setProps(l);
  }, [graine, polices, ornements, ambiances]);

  useEffect(() => {
    let annule = false;
    const liste = choix && !props.some((p) => cleProposition(p) === cleProposition(choix)) ? [...props, choix] : props;
    Promise.all(liste.map(async (p) => [cleProposition(p), await rendreSvg(rendu(p), polices).catch(() => "")] as const))
      .then((r) => { if (!annule) setSvgs(Object.fromEntries(r)); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, ini, couleurs, choix, dateCourte]);

  useEffect(() => { if (charte.logo_perso_url) urlsSignees([charte.logo_perso_url]).then((u) => setLogo(u[charte.logo_perso_url!] ?? null)); else setLogo(null); }, [charte.logo_perso_url]);

  const enregistrer = async (p: Proposition) => {
    setChoix(p);
    const { error } = await supabase.from("chartes_mariage").update({ monogramme: { ...p, initiales: ini } }).eq("id", charte.id).select("id");
    if (error) toast.error("Le choix n'a pas pu être enregistré.");
    onChange();
  };
  const exporter = async (format: "svg" | "png") => {
    if (!choix) return;
    setExport(true);
    try {
      const svg = await rendreSvg(rendu(choix), polices);
      const nom = `monogramme-${ini.join("")}`;
      if (format === "svg") telecharger(new Blob([svg], { type: "image/svg+xml" }), `${nom}.svg`);
      else telecharger(await svgVersPng(svg, 2000), `${nom}.png`);
    } catch { toast.error("L'export a échoué, réessayez."); } finally { setExport(false); }
  };
  const importerLogo = async (f: File) => {
    try {
      const r = await envoyerFichier(f, f.name, "logo");
      const { error } = await supabase.from("chartes_mariage").update({ logo_perso_url: r.fichier.storage_path }).eq("id", charte.id).select("id");
      if (error) throw new Error("Le logo n'a pas pu être associé à votre charte.");
      toast.success("Votre logo remplace le monogramme dans la charte."); onChange();
    } catch (e) { toast.error((e as Error).message); }
  };
  const retirerLogo = async () => {
    await supabase.from("chartes_mariage").update({ logo_perso_url: null }).eq("id", charte.id).select("id");
    onChange();
  };

  return (
    <div className="space-y-4 pb-24">
      {logo && (
        <div className="rounded-2xl border border-atelier-filet bg-card p-4 flex items-center gap-4">
          <img src={logo} alt="Votre logo" className="h-20 w-20 object-contain rounded-lg" style={{ background: couleurs.fond }} />
          <div className="flex-1"><p className="font-serif text-lg">Votre logo est utilisé dans la charte</p><p className="font-sans text-xs text-muted-foreground">Il remplace le monogramme.</p></div>
          <Button size="sm" variant="ghost" onClick={retirerLogo} className="gap-1"><X className="h-4 w-4" />Retirer</Button>
        </div>
      )}
      <div className="flex items-end gap-3">
        {[0, 1].map((i) => (
          <label key={i} className="space-y-1"><span className="font-sans text-xs text-muted-foreground">Initiale {i + 1}</span>
            <Input value={ini[i]} maxLength={1} className="w-14 h-12 text-center font-serif text-xl bg-card"
              onChange={(e) => setIni((x) => (i === 0 ? [e.target.value.toUpperCase(), x[1]] : [x[0], e.target.value.toUpperCase()]))} /></label>
        ))}
        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full ml-auto" aria-label="Nouvelles propositions" onClick={() => setGraine((g) => g + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
        {props.map((p, i) => {
          const k = cleProposition(p), sel = choix && cleProposition(choix) === k;
          return (
            <button key={k} type="button" onClick={() => enregistrer(p)} aria-label={`Proposition ${i + 1} : ${DISPOSITIONS.find((d) => d.id === p.disposition)?.nom}, ${p.police}`}
              className={cn("relative aspect-square rounded-xl border p-1.5", sel ? "border-atelier-or ring-2 ring-atelier-or/40" : "border-atelier-filet")} style={{ background: couleurs.fond }}>
              {svgs[k] ? <span className="block h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svgs[k] }} /> : <Loader2 className="h-4 w-4 animate-spin m-auto text-atelier-or" />}
              {sel && <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-atelier-or text-primary-foreground grid place-items-center"><Check className="h-3 w-3" /></span>}
            </button>
          );
        })}
      </div>
      <Button variant="outline" className="w-full rounded-full h-11 gap-2" onClick={() => setGraine((g) => g + 1)}><RefreshCw className="h-4 w-4" />Nouvelles propositions</Button>
      <input ref={fichier} type="file" accept=".svg,image/svg+xml,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importerLogo(f); }} />
      <button type="button" onClick={() => fichier.current?.click()} className="w-full inline-flex justify-center items-center gap-2 font-sans text-sm font-semibold text-atelier-or"><Upload className="h-4 w-4" />Importer mon propre logo (SVG ou PNG transparent)</button>

      {choix && (
        <div className="sticky bottom-20 lg:bottom-4 rounded-2xl bg-foreground text-background p-3 flex items-center gap-3 shadow-lg">
          <div className="flex-1 min-w-0"><p className="font-sans text-sm font-semibold">Monogramme choisi</p>
            <p className="font-sans text-xs opacity-75 truncate">{DISPOSITIONS.find((d) => d.id === choix.disposition)?.nom} · {choix.police}</p></div>
          <Button size="sm" disabled={export_} onClick={() => exporter("svg")} className="rounded-full bg-atelier-lin text-foreground hover:bg-atelier-lin/90 gap-1"><Download className="h-4 w-4" />SVG</Button>
          <Button size="sm" disabled={export_} onClick={() => exporter("png")} className="rounded-full bg-atelier-lin text-foreground hover:bg-atelier-lin/90 gap-1"><Download className="h-4 w-4" />PNG</Button>
        </div>
      )}
    </div>
  );
}
