import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Garde globale prestataire :
 * Tout prestataire connecté qui n'a pas encore validé la Charte Qualité
 * (profile.cgu_acceptees_le IS NULL) est automatiquement redirigé vers
 * /pro/charte, où qu'il aille, tant qu'il n'a pas terminé la séquence.
 *
 * Cela couvre le cas d'un prestataire qui ferme le navigateur après l'inscription
 * mais avant la fin de la charte : à sa prochaine connexion, il atterrit
 * directement sur /pro/charte.
 */

// Routes exemptées de la redirection forcée vers /pro/charte
const ALLOW_LIST = [
  "/pro/charte",
  "/connexion",
  "/inscription",
  "/accept-invitation",
  "/reset-password",
  "/mot-de-passe-oublie",
  "/charte-qualite",
  "/unsubscribe",
  "/signer-la-charte",
  "/reactivation",
];

export default function ChartePendingGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isPrestataire, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setChecked(false);
      return;
    }

    if (!user || !isPrestataire) {
      setChecked(true);
      return;
    }

    // Si la charte est déjà acceptée, rien à faire
    if (profile?.cgu_acceptees_le) {
      setChecked(true);
      return;
    }

    // Si la route est dans l'allow-list, on laisse passer
    if (ALLOW_LIST.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
      setChecked(true);
      return;
    }

    // Sinon redirection forcée
    navigate("/pro/charte", { replace: true });
  }, [user?.id, isPrestataire, profile?.cgu_acceptees_le, isLoading, location.pathname, navigate]);

  if (!checked && user && isPrestataire) return null;
  return <>{children}</>;
}
