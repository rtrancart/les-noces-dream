import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ONGLETS } from "./AtelierLayout";
import { useInfosCouple } from "@/components/atelier/useInfosCouple";
import { useTaches } from "@/components/atelier/planning/useTaches";
import LigneTache from "@/components/atelier/planning/LigneTache";
import { BarreProgression } from "./AtelierPlanning";
import { aFaireCeMois, construireSections } from "@/lib/planning";

export default function AtelierAccueil() {
  const infos = useInfosCouple();
  const { data: planning, modifier } = useTaches();
  const ref = planning?.ref ?? null;
  const sections = planning && ref ? construireSections(planning.taches, ref) : null;
  const aFaire = planning && ref ? aFaireCeMois(planning.taches, ref) : [];
  const nbMois = sections ? (sections.mois.find((g) => g.courant)?.taches.filter((t) => !t.faite).length ?? 0) + sections.rattraper.length : 0;
  const MODULES = [
    { ...ONGLETS[1], etat: "Trouvez vos prestataires" },
    { ...ONGLETS[2], etat: "Votre charte et votre monogramme" },
    { ...ONGLETS[3], etat: !ref ? "Indiquez votre date pour obtenir vos tâches" : nbMois ? `${nbMois} tâche${nbMois > 1 ? "s" : ""} ce mois-ci` : "Vos tâches mois par mois" },
    { ...ONGLETS[4], etat: "Préparez votre livret de cérémonie · bientôt" },
  ];
  return (
    <div className="px-4 py-6 lg:px-12 lg:py-12 space-y-6 lg:space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">L'Atelier</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-foreground mt-1 break-words">{infos.nom}</h1>
          <p className="font-sans text-sm text-muted-foreground mt-2">
            {infos.dateTexte ?? (
              <>Date du mariage à définir · <Link to="/atelier/style" className="text-atelier-or font-medium hover:underline">l'ajouter</Link></>
            )}
          </p>
        </div>
        {infos.jours !== null && (
          <div className="shrink-0 h-24 w-24 rounded-full border-2 border-atelier-or/70 bg-card flex flex-col items-center justify-center">
            <span className="font-serif text-3xl leading-none text-foreground">{infos.jours}</span>
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-atelier-or mt-1">{infos.jours > 1 ? "jours" : "jour"}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to}
            className="group rounded-2xl border border-atelier-filet bg-card p-4 lg:p-6 flex flex-col gap-3 hover:shadow-[var(--shadow-soft)] transition-shadow">
            <span className="h-10 w-10 rounded-full bg-atelier-lin text-atelier-or grid place-items-center"><m.icon className="h-5 w-5" /></span>
            <span className="font-serif text-xl text-foreground">{m.label}</span>
            <span className="font-sans text-sm text-muted-foreground leading-snug">{m.etat}</span>
            <span className="hidden lg:inline-flex mt-auto items-center gap-2 font-sans text-sm font-semibold text-atelier-or">
              Ouvrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {sections && (
        <div className="rounded-2xl border border-atelier-filet bg-card p-5 lg:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-foreground">À faire ce mois-ci</h2>
            <Link to="/atelier/planning" className="shrink-0 font-sans text-sm font-semibold text-atelier-or hover:underline">Voir tout le planning ›</Link>
          </div>
          <p className="font-sans text-xs text-muted-foreground mt-1">{sections.faites} tâche{sections.faites > 1 ? "s" : ""} faite{sections.faites > 1 ? "s" : ""} sur {sections.actives}</p>
          <BarreProgression faites={sections.faites} actives={sections.actives} className="mt-2" />
          {aFaire.length ? (
            <div className="mt-2 divide-y divide-atelier-filet">
              {aFaire.map((t) => <LigneTache key={t.id} compacte tache={t} lien={t.modele_id ? planning!.liens.get(t.modele_id) : undefined} onCocher={(x) => modifier(x, { faite: !x.faite })} />)}
            </div>
          ) : <p className="font-sans text-sm text-muted-foreground mt-3">Rien d'urgent ce mois-ci. Profitez-en !</p>}
        </div>
      )}

      <div className="rounded-2xl border border-atelier-filet bg-card p-5 lg:p-7">
        <h2 className="font-serif text-2xl text-foreground">Commencez par l'assistant</h2>
        <p className="font-sans text-sm text-muted-foreground mt-2 leading-relaxed">
          Décrivez votre projet avec vos mots : lieu, style, nombre d'invités, budget. L'assistant vous propose des prestataires
          de LesNoces.net qui y correspondent. Dans « Notre style », créez votre charte et votre monogramme ; le planning vous guide mois par mois et le livret arrive bientôt.
        </p>
        <Link to="/atelier/assistant"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-atelier-or px-6 py-3 font-sans text-sm font-semibold text-primary-foreground hover:bg-atelier-or/90">
          Ouvrir l'assistant <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
