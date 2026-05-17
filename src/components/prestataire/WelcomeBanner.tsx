import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";

/**
 * Bandeau d'accueil affiché aux prestataires qui ont signé la charte
 * mais dont la fiche est encore en statut pre_inscrit (en attente
 * de complétion + soumission pour validation).
 */
export function WelcomeBanner() {
  const { profile } = useAuth();
  const { prestataire } = useSharedPrestataire();

  if (!prestataire) return null;
  if (prestataire.statut !== "pre_inscrit") return null;
  if (!prestataire.charte_signee_le) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-champagne/10 p-6">
      <div className="flex items-start gap-4">
        <Sparkles className="h-6 w-6 text-primary shrink-0 mt-1" />
        <div className="flex-1 space-y-3">
          <h3 className="font-serif text-xl md:text-2xl">
            Bienvenue {profile?.prenom ?? prestataire.nom_commercial}. Plus qu'une étape avant que les couples vous découvrent.
          </h3>
          <p className="font-sans text-sm text-muted-foreground">
            Complétez les dernières informations de votre fiche pour la soumettre à validation. Notre équipe éditoriale vous répond sous 48h.
          </p>
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
