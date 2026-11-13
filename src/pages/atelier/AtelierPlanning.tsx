import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import LigneTache from "@/components/atelier/planning/LigneTache";
import { useTaches } from "@/components/atelier/planning/useTaches";
import { aujourdhui, CATEGORIES_TACHE, construireSections, type GroupeMois, type Tache } from "@/lib/planning";

export function BarreProgression({ faites, actives, className }: { faites: number; actives: number; className?: string }) {
  const pct = actives ? Math.round((faites / actives) * 100) : 0;
  return (
    <div className={cn("h-1.5 rounded-full bg-atelier-lin overflow-hidden", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${faites} tâches faites sur ${actives}`}>
      <div className="h-full rounded-full bg-atelier-or transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Carte({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-atelier-filet bg-card px-4 divide-y divide-atelier-filet">{children}</div>;
}

export default function AtelierPlanning() {
  const { data, isLoading, modifier, recharger, userId } = useTaches();
  const [voirTout, setVoirTout] = useState(false);
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [facultatives, setFacultatives] = useState(false);
  const [voirMasquees, setVoirMasquees] = useState(false);
  const [ajout, setAjout] = useState(false);
  const jour = aujourdhui();
  const s = useMemo(() => (data?.ref ? construireSections(data.taches, data.ref, jour) : null), [data, jour]);

  if (isLoading || !data) return <div className="p-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-atelier-or" /></div>;

  if (!data.ref || !s) {
    return (
      <div className="px-4 py-10 lg:px-12 max-w-xl">
        <h1 className="font-serif text-3xl text-foreground">Planning</h1>
        <div className="mt-6 rounded-2xl border border-atelier-filet bg-card p-6">
          <p className="font-serif text-xl text-foreground">Indiquez la date de votre mariage pour obtenir votre planning</p>
          <p className="font-sans text-sm text-muted-foreground mt-2">Une date précise ou seulement le mois suffit : vos tâches seront calculées mois par mois jusqu'au jour J.</p>
          <Button asChild className="mt-4 rounded-full bg-atelier-or hover:bg-atelier-or/90"><Link to="/atelier/style" state={{ questionnaireEtape: 0 }}>Indiquer la date</Link></Button>
        </div>
      </div>
    );
  }

  const ligne = (t: Tache) => (
    <LigneTache key={t.id} tache={t} lien={t.modele_id ? data.liens.get(t.modele_id) : undefined}
      onCocher={(x) => modifier(x, { faite: !x.faite })}
      onEcheance={(x, d) => modifier(x, { date_echeance: d })}
      onMasquer={(x) => { modifier(x, { masquee: true }); toast("Tâche masquée", { action: { label: "Annuler", onClick: () => modifier(x, { masquee: false }) } }); }}
      onSupprimer={async (x) => { await supabase.from("taches_couple").delete().eq("id", x.id); recharger(); }} />
  );
  const jours = Math.round((Date.parse(data.ref) - Date.parse(jour)) / 86400000);
  const jourMariage = Number(data.ref.slice(8, 10));
  const montrerAvant = !s.mariagePasse || voirTout;

  const premierVisible = s.mois.findIndex((g) => !(g.passe && g.taches.length > 0 && g.taches.every((t) => t.faite)));
  const moisFaits = premierVisible < 0 ? s.mois : s.mois.slice(0, premierVisible);
  const moisAffiches = premierVisible < 0 ? [] : s.mois.slice(premierVisible);
  const nbFaitsPrec = moisFaits.reduce((n, g) => n + g.taches.length, 0);
  const precOuvert = ouverts["__prec"] ?? false;

  const groupe = (g: GroupeMois) => {
    const restantes = g.taches.filter((t) => !t.faite);
    const ouvert = ouverts[g.cle] ?? g.courant;
    const resume = g.taches.length === 0 ? null
      : `${g.taches.length} tâche${g.taches.length > 1 ? "s" : ""}${restantes.length < g.taches.length ? ` · ${g.taches.length - restantes.length} faite${g.taches.length - restantes.length > 1 ? "s" : ""}` : ""} · ${[...new Set(g.taches.map((t) => t.categorie.toLowerCase()))].slice(0, 3).join(", ")}`;
    return (
      <li key={g.cle} className="relative pl-8 pb-6">
        <span className={cn("absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-atelier-or", g.courant || g.mariage ? "bg-atelier-or" : "bg-atelier-fond", g.mariage && "rounded-sm")} />
        <h2 className="font-serif text-xl text-foreground">
          {g.libelle}
          {g.courant && <span className="ml-2 font-sans text-xs font-semibold text-atelier-or">Ce mois-ci</span>}
          {g.mariage && <span className="ml-2 font-sans text-xs font-semibold text-atelier-or">Le {jourMariage === 1 ? "1er" : jourMariage}, votre mariage</span>}
        </h2>
        {resume && (ouvert ? (
          <div className="mt-2"><Carte>{g.taches.map(ligne)}</Carte>
            {!g.courant && <button type="button" onClick={() => setOuverts({ ...ouverts, [g.cle]: false })} className="mt-1 font-sans text-xs text-muted-foreground hover:text-atelier-or">Replier</button>}
          </div>
        ) : (
          <button type="button" onClick={() => setOuverts({ ...ouverts, [g.cle]: true })}
            className="mt-2 w-full flex items-center justify-between gap-2 rounded-xl border border-atelier-filet bg-card px-4 py-3 text-left font-sans text-sm text-muted-foreground hover:border-atelier-or/60">
            <span className="truncate">{resume}</span><ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        ))}
      </li>
    );
  };

  return (
    <div className="px-4 py-6 lg:px-12 lg:py-10 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl text-foreground">Planning</h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            {jours > 0 ? `J-${jours} · ` : jours === 0 ? "C'est le grand jour · " : ""}{s.faites} tâche{s.faites > 1 ? "s" : ""} sur {s.actives}
          </p>
        </div>
        <Button variant="outline" className="rounded-full gap-2 shrink-0" onClick={() => setAjout(true)} aria-label="Ajouter une tâche">
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Ajouter une tâche</span>
        </Button>
      </div>
      <BarreProgression faites={s.faites} actives={s.actives} className="mt-4" />

      {s.mariagePasse && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-atelier-lin px-4 py-3">
          <p className="font-sans text-sm text-foreground">Félicitations pour votre mariage !</p>
          <button type="button" onClick={() => setVoirTout(!voirTout)} className="font-sans text-sm font-semibold text-atelier-or hover:underline shrink-0">
            {voirTout ? "Masquer le reste" : "Voir tout le planning"}
          </button>
        </div>
      )}

      {montrerAvant && !s.mariagePasse && (s.rattraper.length > 0 || s.rattraperFacultatives.length > 0) && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl text-foreground">À rattraper</h2>
          <p className="font-sans text-sm text-muted-foreground mt-1">Ces étapes auraient idéalement dû être faites : commencez par les plus importantes.</p>
          <div className="mt-3 space-y-2">
            {s.rattraper.length > 0 && <Carte>{s.rattraper.map(ligne)}</Carte>}
            {s.rattraperFacultatives.length > 0 && (facultatives
              ? <Carte>{s.rattraperFacultatives.map(ligne)}</Carte>
              : <button type="button" onClick={() => setFacultatives(true)} className="w-full flex items-center justify-between rounded-xl border border-dashed border-atelier-filet px-4 py-3 font-sans text-sm text-muted-foreground hover:border-atelier-or/60">
                  {s.rattraperFacultatives.length} tâche{s.rattraperFacultatives.length > 1 ? "s" : ""} facultative{s.rattraperFacultatives.length > 1 ? "s" : ""}<ChevronDown className="h-4 w-4" />
                </button>)}
          </div>
        </section>
      )}

      {montrerAvant && <ol className="mt-8 relative before:absolute before:left-[7px] before:top-3 before:bottom-8 before:w-0.5 before:bg-atelier-or/40">
        {moisFaits.length > 0 && (
          <li className="relative pl-8 pb-6">
            <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-atelier-or bg-atelier-fond" />
            <button type="button" onClick={() => setOuverts({ ...ouverts, __prec: !precOuvert })}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-atelier-filet bg-card px-4 py-3 text-left font-sans text-sm text-muted-foreground hover:border-atelier-or/60">
              <span>Mois précédents ({nbFaitsPrec} tâche{nbFaitsPrec > 1 ? "s" : ""} faite{nbFaitsPrec > 1 ? "s" : ""})</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", precOuvert && "rotate-180")} />
            </button>
            {precOuvert && <ol className="mt-4">{moisFaits.map(groupe)}</ol>}
          </li>
        )}
        {moisAffiches.map(groupe)}</ol>}

      {s.apres.length > 0 && (
        <section className="mt-4">
          <h2 className="font-serif text-2xl text-foreground">Après le mariage</h2>
          <div className="mt-3"><Carte>{s.apres.map(ligne)}</Carte></div>
        </section>
      )}

      {s.masquees.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setVoirMasquees(!voirMasquees)} className="font-sans text-sm text-muted-foreground hover:text-atelier-or">
            Tâches masquées ({s.masquees.length})
          </button>
          {voirMasquees && (
            <ul className="mt-2 space-y-1">
              {s.masquees.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 font-sans text-sm text-muted-foreground">
                  <span className="truncate">{t.titre}</span>
                  <button type="button" onClick={() => modifier(t, { masquee: false })} className="shrink-0 font-semibold text-atelier-or hover:underline">Réafficher</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AjoutTache ouvert={ajout} onFermer={() => setAjout(false)} userId={userId} dateDefaut={jour} onAjout={recharger} />
    </div>
  );
}

function AjoutTache({ ouvert, onFermer, userId, dateDefaut, onAjout }: { ouvert: boolean; onFermer: () => void; userId?: string; dateDefaut: string; onAjout: () => void }) {
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState("");
  const [categorie, setCategorie] = useState("Organisation");
  const [envoi, setEnvoi] = useState(false);
  const valider = async () => {
    const d = date || dateDefaut;
    if (!userId || !titre.trim() || !d) return;
    setEnvoi(true);
    const { data, error } = await supabase.from("taches_couple").insert({ user_id: userId, titre: titre.trim().slice(0, 200), date_echeance: d, categorie, perso: true, priorite: 2 }).select("id");
    setEnvoi(false);
    if (error || !data?.length) { toast.error("La tâche n'a pas pu être ajoutée."); return; }
    setTitre(""); setDate(""); onAjout(); onFermer();
  };
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-serif text-2xl">Ajouter une tâche</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <label className="block font-sans text-sm font-medium">Titre
            <Input className="mt-1" value={titre} maxLength={200} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Choisir les dragées" />
          </label>
          <label className="block font-sans text-sm font-medium">À faire avant le
            <Input className="mt-1" type="date" value={date || dateDefaut} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block font-sans text-sm font-medium">Catégorie
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {CATEGORIES_TACHE.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onFermer}>Annuler</Button>
          <Button className="rounded-full bg-atelier-or hover:bg-atelier-or/90" disabled={!titre.trim() || envoi} onClick={() => void valider()}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
