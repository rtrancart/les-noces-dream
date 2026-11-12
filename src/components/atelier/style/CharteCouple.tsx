import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Image as ImageIcon, Info, Loader2, Pencil, RefreshCw, Search, Upload, Check, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  chargerPolice, contraste, extraireCouleurs, hexValide, versPalette, urlsSignees,
  type CharteMariage, type CouleurCharte, type PhotoInspiration, type Police,
} from "@/lib/notreStyle";

const NOMS_ROLE: Record<string, string> = { principale: "Principale", secondaire: "Secondaire", accent: "Accent", fond: "Fond", texte: "Texte" };

/** Assombrit/éclaircit le texte jusqu'au contraste 4,5 (même règle que la passerelle). */
function ajuster(texte: string, fond: string) {
  const fondClair = contraste(fond, "#000000") > contraste(fond, "#FFFFFF");
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(texte.slice(i, i + 2), 16));
  for (let k = 0; k < 60 && contraste(`#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`, fond) < 4.5; k++) {
    [r, g, b] = [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(fondClair ? x * 0.94 : x + (255 - x) * 0.08))));
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export default function CharteCouple({ charte, historique, polices, photos, prenom, dateLieu, restants, generation, onGenerer, onChange }: {
  charte: CharteMariage | null; historique: CharteMariage[]; polices: Police[]; photos: PhotoInspiration[];
  prenom: string; dateLieu: string | null; restants: number | null; generation: boolean;
  onGenerer: () => void; onChange: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [edition, setEdition] = useState<CouleurCharte["role"] | null>(null);
  const [hex, setHex] = useState("");
  const [nomCouleur, setNomCouleur] = useState("");
  const [renommer, setRenommer] = useState(false);
  const [nomStyle, setNomStyle] = useState("");
  const [choixPolice, setChoixPolice] = useState<"titre" | "texte" | null>(null);
  const [importer, setImporter] = useState(false);
  const [codes, setCodes] = useState<string[]>(["", "", "", "", ""]);
  const [extraire, setExtraire] = useState(false);
  const [vignettes, setVignettes] = useState<Record<string, string>>({});
  const [voirHistorique, setVoirHistorique] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => { if (charte) { chargerPolice(charte.police_titre); chargerPolice(charte.police_texte); } }, [charte]);
  useEffect(() => { if (choixPolice) polices.forEach((p) => chargerPolice(p.nom)); }, [choixPolice, polices]);
  const raster = useMemo(() => photos.filter((p) => p.type === "inspiration" && p.format !== "image/svg+xml"), [photos]);
  useEffect(() => { if (extraire) urlsSignees(raster.map((p) => p.storage_path)).then(setVignettes); }, [extraire, raster]);

  const maj = async (patch: Partial<CharteMariage>) => {
    const { data, error } = await supabase.from("chartes_mariage").update(patch).eq("id", charte!.id).select("id");
    if (error || !data?.length) toast.error("La modification n'a pas pu être enregistrée.");
    onChange();
  };
  /** Nouvelle charte (couleurs importées ou extraites) : l'ancienne reste dans l'historique. */
  const nouvelle = async (palette: CouleurCharte[], source: "manuel" | "photo") => {
    const base = charte ?? { nom_style: "Notre style", mots_cles: [], police_titre: "Cormorant Garamond", police_texte: "Jost", explication: null, idees: [], monogramme: null, logo_perso_url: null };
    const fond = palette.find((c) => c.role === "fond")!, texte = palette.find((c) => c.role === "texte")!;
    texte.hex = ajuster(texte.hex, fond.hex);
    if (charte) await supabase.from("chartes_mariage").update({ active: false }).eq("id", charte.id);
    const { error } = await supabase.from("chartes_mariage").insert({
      user_id: user!.id, nom_style: base.nom_style, mots_cles: base.mots_cles, palette, police_titre: base.police_titre, police_texte: base.police_texte,
      explication: base.explication, idees: base.idees, monogramme: base.monogramme, logo_perso_url: base.logo_perso_url, active: true, source,
    }).select("id");
    if (error) { toast.error("La charte n'a pas pu être enregistrée."); if (charte) await supabase.from("chartes_mariage").update({ active: true }).eq("id", charte.id); }
    else toast.success("Nouvelles couleurs appliquées. L'ancienne charte reste dans l'historique.");
    onChange();
  };
  const reactiver = async (c: CharteMariage) => {
    if (charte) await supabase.from("chartes_mariage").update({ active: false }).eq("id", charte.id);
    const { error } = await supabase.from("chartes_mariage").update({ active: true }).eq("id", c.id).select("id");
    if (error) toast.error("Impossible de réactiver cette charte.");
    setVoirHistorique(false); onChange();
  };

  if (!charte) {
    return (
      <div className="rounded-2xl border border-atelier-filet bg-card p-6 space-y-4">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">Votre charte</p>
        <h2 className="font-serif text-2xl text-foreground">Créons votre charte</h2>
        <p className="font-sans text-sm text-muted-foreground leading-relaxed">L'Atelier propose 5 couleurs et 2 polices à partir de vos réponses et de vos photos d'inspiration. Tout reste modifiable.</p>
        <Button onClick={onGenerer} disabled={generation} className="rounded-full bg-atelier-or hover:bg-atelier-or/90 gap-2">
          {generation ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{generation ? "Création en cours…" : "Créer notre charte"}
        </Button>
        {restants !== null && <p className="font-sans text-xs text-muted-foreground">{restants} proposition{restants > 1 ? "s" : ""} restante{restants > 1 ? "s" : ""}</p>}
        <button type="button" onClick={() => setImporter(true)} className="block font-sans text-sm font-semibold text-atelier-or hover:underline">Ou importer mes propres couleurs</button>
        {dialogueImport()}
      </div>
    );
  }

  const fond = charte.palette.find((c) => c.role === "fond")?.hex ?? "#FFFFFF";
  const texte = charte.palette.find((c) => c.role === "texte")?.hex ?? "#000000";
  const principale = charte.palette.find((c) => c.role === "principale")?.hex ?? texte;
  const ratio = contraste(texte, fond);
  const enEdition = edition ? charte.palette.find((c) => c.role === edition) : null;

  const message = `Nous cherchons des prestataires dans notre style « ${charte.nom_style} »${charte.mots_cles.length ? ` (${charte.mots_cles.join(", ")})` : ""}. Que nous conseillez-vous ?`;

  function dialogueImport() {
    return (
      <Dialog open={importer} onOpenChange={setImporter}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Importer mes couleurs</DialogTitle></DialogHeader>
          <p className="font-sans text-sm text-muted-foreground">Saisissez 5 codes couleur (#RRGGBB). La plus claire devient le fond, la plus foncée le texte.</p>
          <div className="grid grid-cols-5 gap-2">
            {codes.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <span className="block h-10 rounded-lg border border-atelier-filet" style={{ background: hexValide(c) ? c : "transparent" }} />
                <Input value={c} maxLength={7} placeholder="#" aria-label={`Couleur ${i + 1}`} className="px-1.5 text-xs font-mono"
                  onChange={(e) => setCodes((l) => l.map((x, j) => j === i ? (e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`).toUpperCase() : x))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button disabled={!codes.every(hexValide)} className="rounded-full bg-atelier-or hover:bg-atelier-or/90"
              onClick={async () => { setImporter(false); await nouvelle(versPalette(codes), "manuel"); }}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const depuisImage = async (src: string | File) => {
    try {
      const img = typeof src === "string" ? await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = src; })
        : await createImageBitmap(src);
      const w = "naturalWidth" in img ? img.naturalWidth : img.width, h = "naturalHeight" in img ? img.naturalHeight : img.height;
      const c = extraireCouleurs(img, w, h, 5);
      if (c.length < 3) throw new Error();
      setExtraire(false);
      await nouvelle(versPalette(c), "photo");
    } catch { toast.error("Les couleurs de cette image n'ont pas pu être lues (les photos HEIC ne sont pas lisibles ici)."); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-atelier-filet bg-card overflow-hidden">
        <div className="flex h-2.5">{charte.palette.map((c) => <span key={c.role} className="flex-1" style={{ background: c.hex }} />)}</div>
        <div className="p-5 space-y-3">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">Votre style</p>
          {renommer ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = nomStyle.trim().slice(0, 60); setRenommer(false); if (n) maj({ nom_style: n }); }}>
              <Input autoFocus value={nomStyle} maxLength={60} onChange={(e) => setNomStyle(e.target.value)} className="font-serif text-xl h-11" />
              <Button type="submit" size="icon" className="bg-atelier-or hover:bg-atelier-or/90 shrink-0" aria-label="Valider"><Check className="h-4 w-4" /></Button>
            </form>
          ) : (
            <h2 className="font-serif text-3xl text-foreground flex items-center gap-2">{charte.nom_style}
              <button type="button" onClick={() => { setNomStyle(charte.nom_style); setRenommer(true); }} aria-label="Renommer le style" className="text-muted-foreground hover:text-atelier-or"><Pencil className="h-4 w-4" /></button>
            </h2>
          )}
          {charte.mots_cles.length > 0 && <div className="flex flex-wrap gap-2">{charte.mots_cles.map((m) => <span key={m} className="rounded-full bg-atelier-lin px-3 py-1 font-sans text-xs font-medium">{m}</span>)}</div>}
          {charte.explication && <p className="font-sans text-sm text-muted-foreground leading-relaxed">{charte.explication}</p>}
          <p className="flex items-start gap-1.5 font-sans text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {charte.source === "ia" ? "Proposition de l'Atelier, d'après vos réponses. Tout est modifiable." : charte.source === "photo" ? "Couleurs extraites de votre photo. Tout est modifiable." : "Vos couleurs. Tout est modifiable."}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-atelier-filet bg-card p-5 space-y-4">
        <h3 className="font-serif text-xl text-foreground">Palette</h3>
        <div className="grid grid-cols-5 gap-2">
          {charte.palette.map((c) => (
            <button key={c.role} type="button" onClick={() => { setEdition(c.role); setHex(c.hex); setNomCouleur(c.nom); }} className="flex flex-col items-center gap-1 min-w-0">
              <span className={cn("h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-atelier-filet", edition === c.role && "ring-2 ring-offset-2 ring-atelier-or")} style={{ background: c.hex }} />
              <span className="font-sans text-[11px] font-semibold text-foreground text-center leading-tight truncate w-full">{c.nom}</span>
              <span className="font-sans text-[10px] text-muted-foreground">{NOMS_ROLE[c.role]}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.hex}</span>
            </button>
          ))}
        </div>
        {enEdition && (
          <form className="rounded-xl bg-atelier-lin/60 p-3 space-y-2" onSubmit={(e) => {
            e.preventDefault();
            if (!hexValide(hex)) return toast.error("Code couleur attendu : #RRGGBB");
            setEdition(null);
            maj({ palette: charte.palette.map((c) => c.role === enEdition.role ? { ...c, hex: hex.toUpperCase(), nom: nomCouleur.trim().slice(0, 40) || c.nom } : c) });
          }}>
            <p className="font-sans text-sm font-semibold">Modifier « {enEdition.nom} »</p>
            <div className="flex gap-2 items-center">
              <input type="color" value={hexValide(hex) ? hex : "#000000"} onChange={(e) => setHex(e.target.value.toUpperCase())} className="h-10 w-12 rounded border border-atelier-filet bg-card" aria-label="Sélecteur de couleur" />
              <Input value={hex} maxLength={7} onChange={(e) => setHex(e.target.value.toUpperCase())} className="font-mono w-28 bg-card" aria-label="Code couleur" />
              <Input value={nomCouleur} maxLength={40} onChange={(e) => setNomCouleur(e.target.value)} className="bg-card" aria-label="Nom de la couleur" />
            </div>
            <div className="flex gap-2"><Button type="submit" size="sm" className="rounded-full bg-atelier-or hover:bg-atelier-or/90">Enregistrer</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEdition(null)}>Annuler</Button></div>
          </form>
        )}
        {ratio < 4.5 && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="font-sans text-sm space-y-2">
              <p>Le texte manque de contraste avec le fond ({ratio.toFixed(1).replace(".", ",")} : 1, minimum 4,5).</p>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => maj({ palette: charte.palette.map((c) => c.role === "texte" ? { ...c, hex: ajuster(c.hex, fond) } : c) })}>Ajuster le texte</Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-atelier-filet bg-card p-5 space-y-3">
        <h3 className="font-serif text-xl text-foreground">Polices</h3>
        {(["titre", "texte"] as const).map((r) => {
          const nom = r === "titre" ? charte.police_titre : charte.police_texte;
          return (
            <div key={r} className="flex items-center gap-3 border-b border-atelier-filet/60 pb-3 last:border-0 last:pb-0">
              <span className="h-11 w-11 rounded-lg bg-atelier-lin grid place-items-center text-lg" style={{ fontFamily: `'${nom}'` }}>Aa</span>
              <div className="flex-1 min-w-0"><p className="font-sans text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{r === "titre" ? "Titres" : "Texte"}</p>
                <p className="text-lg truncate" style={{ fontFamily: `'${nom}'` }}>{nom}</p></div>
              <button type="button" onClick={() => setChoixPolice(r)} className="font-sans text-sm font-semibold text-atelier-or">Changer</button>
            </div>
          );
        })}
        <div className="rounded-xl p-5 text-center" style={{ background: fond }}>
          <p className="text-4xl" style={{ fontFamily: `'${charte.police_titre}'`, color: principale }}>{prenom}</p>
          <p className="mt-2 text-xs tracking-[0.25em] uppercase" style={{ fontFamily: `'${charte.police_texte}'`, color: texte }}>{dateLieu ?? "Notre mariage"}</p>
          <p className="mt-3 text-sm" style={{ fontFamily: `'${charte.police_texte}'`, color: texte }}>Nous serions heureux de vous compter parmi nous.</p>
        </div>
      </div>

      {charte.idees.length > 0 && (
        <div className="rounded-2xl border border-atelier-filet bg-card p-5 space-y-2">
          <h3 className="font-serif text-xl text-foreground">Idées pour votre mariage</h3>
          <ul className="list-disc pl-5 font-sans text-sm text-muted-foreground space-y-1">{charte.idees.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}

      <div className="space-y-2.5">
        <Button onClick={onGenerer} disabled={generation || restants === 0} className="w-full h-12 rounded-full bg-atelier-or hover:bg-atelier-or/90 gap-2">
          {generation ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{generation ? "Création en cours…" : "Proposer une autre charte"}
        </Button>
        {restants !== null && <p className="text-center font-sans text-xs text-muted-foreground">{restants} proposition{restants > 1 ? "s" : ""} restante{restants > 1 ? "s" : ""}</p>}
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Button variant="outline" className="rounded-full h-11 gap-2" onClick={() => { setCodes(charte.palette.map((c) => c.hex)); setImporter(true); }}><Upload className="h-4 w-4" />Importer mes couleurs</Button>
          <Button variant="outline" className="rounded-full h-11 gap-2" onClick={() => setExtraire(true)}><ImageIcon className="h-4 w-4" />Extraire les couleurs d'une photo</Button>
        </div>
        <Button variant="outline" className="w-full rounded-full h-11 gap-2 border-atelier-or text-atelier-or" onClick={() => navigate("/atelier/assistant", { state: { message } })}>
          <Search className="h-4 w-4" />Trouver des prestataires dans ce style
        </Button>
        {historique.length > 1 && <button type="button" onClick={() => setVoirHistorique(true)} className="w-full inline-flex justify-center items-center gap-1.5 font-sans text-sm text-muted-foreground hover:text-atelier-or"><History className="h-4 w-4" />Propositions précédentes ({historique.length - 1})</button>}
      </div>

      {dialogueImport()}

      <Dialog open={extraire} onOpenChange={setExtraire}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Extraire les couleurs d'une photo</DialogTitle></DialogHeader>
          <p className="font-sans text-sm text-muted-foreground">Le calcul se fait sur votre appareil, sans IA. La photo n'est pas envoyée.</p>
          <input ref={fichier} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) depuisImage(f); }} />
          <Button variant="outline" className="rounded-full" onClick={() => fichier.current?.click()}>Choisir une photo sur mon appareil</Button>
          {raster.length > 0 && <>
            <p className="font-sans text-sm font-semibold">Ou une de mes inspirations</p>
            <div className="grid grid-cols-4 gap-2">{raster.map((p) => vignettes[p.storage_path] && (
              <button key={p.id} type="button" onClick={() => depuisImage(vignettes[p.storage_path])} className="aspect-square rounded-lg overflow-hidden border border-atelier-filet">
                <img src={vignettes[p.storage_path]} alt={p.fichier_nom} className="h-full w-full object-cover" crossOrigin="anonymous" />
              </button>))}</div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!choixPolice} onOpenChange={(o) => !o && setChoixPolice(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Police des {choixPolice === "titre" ? "titres" : "textes"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            {polices.filter((p) => choixPolice === "titre" || p.usage !== "titre").map((p) => {
              const actuelle = (choixPolice === "titre" ? charte.police_titre : charte.police_texte) === p.nom;
              return (
                <button key={p.nom} type="button" onClick={() => { const r = choixPolice; setChoixPolice(null); maj(r === "titre" ? { police_titre: p.nom } : { police_texte: p.nom }); }}
                  className={cn("w-full text-left rounded-xl border px-4 py-2.5", actuelle ? "border-atelier-or bg-atelier-lin" : "border-atelier-filet hover:border-atelier-or/50")}>
                  <span className="block text-2xl" style={{ fontFamily: `'${p.nom}'` }}>{choixPolice === "titre" ? prenom : "Nous serions heureux"}</span>
                  <span className="font-sans text-xs text-muted-foreground">{p.nom}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={voirHistorique} onOpenChange={setVoirHistorique}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Propositions précédentes</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {historique.filter((h) => !h.active).map((h) => (
              <div key={h.id} className="rounded-xl border border-atelier-filet p-3 flex items-center gap-3">
                <div className="flex h-8 w-24 rounded overflow-hidden shrink-0">{h.palette.map((c) => <span key={c.role} className="flex-1" style={{ background: c.hex }} />)}</div>
                <div className="flex-1 min-w-0"><p className="font-serif text-lg truncate">{h.nom_style}</p>
                  <p className="font-sans text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString("fr-FR")}</p></div>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => reactiver(h)}>Réactiver</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
