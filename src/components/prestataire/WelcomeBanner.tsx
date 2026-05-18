import { Link, useSearchParams } from "react-router-dom";
import { Sparkles, Check, Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";

/**
 * Bandeau d'accueil affiché aux prestataires :
 *  - juste après la validation de la Charte (?welcome=1)
 *  - tant que la fiche est en brouillon ou pre_inscrit (complétion en cours)
 *
 * Inclut une mini-checklist de complétion du profil pour guider le prestataire.
 */
export function WelcomeBanner() {
  const { profile } = useAuth();
  const { prestataire } = useSharedPrestataire();
  const [searchParams] = useSearchParams();

  const welcomeParam = searchParams.get("welcome") === "1";
  const cguOk = !!profile?.cgu_acceptees_le;

  // On affiche le bandeau si :
  //  - la charte vient d'être acceptée (paramètre URL) OU
  //  - le prestataire n'a pas encore soumis sa fiche (brouillon/pre_inscrit)
  const fichePending =
    !prestataire ||
    prestataire.statut === "brouillon" ||
    prestataire.statut === "pre_inscrit";

  if (!cguOk) return null;
  if (!welcomeParam && !fichePending) return null;

  const prenom = profile?.prenom ?? "";

  const checklist = [
    { label: "Charte Qualité validée", done: cguOk },
    { label: "Informations de base (nom, prénom, email)", done: !!profile?.nom && !!profile?.prenom && !!profile?.email },
    { label: "Description et coordonnées", done: !!prestataire?.description && !!prestataire?.telephone_contact },
    { label: "Détail de votre prestation", done: !!prestataire?.prix_depart },
    { label: "Photos de la galerie", done: !!prestataire?.urls_galerie && prestataire.urls_galerie.length > 0 },
  ];

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-champagne/10 p-6">
      <div className="flex items-start gap-4">
        <Sparkles className="h-6 w-6 text-primary shrink-0 mt-1" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-serif text-xl md:text-2xl">
              {welcomeParam
                ? `Bienvenue ${prenom}. Votre Charte est validée.`
                : `${prenom ? prenom + ", vous êtes" : "Vous êtes"} proche du but.`}
            </h3>
            <p className="font-sans text-sm text-muted-foreground mt-1">
              Complétez votre fiche pour la soumettre à notre équipe éditoriale.
            </p>
          </div>

          <ul className="space-y-1.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2 font-sans text-sm">
                {item.done ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <Link
            to="/espace-pro/profil"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/90 transition"
          >
            Compléter ma fiche
          </Link>
        </div>
      </div>
    </div>
  );
}
