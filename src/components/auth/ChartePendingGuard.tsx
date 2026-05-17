import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Garde globale : tout prestataire connecté qui n'a pas signé la version
 * active de la Charte Qualité est redirigé vers /signer-la-charte.
 * Sauf sur certaines routes blanchies (signature, CGU, déconnexion, accept-invitation).
 */
const WHITELIST = [
  "/signer-la-charte",
  "/accept-invitation",
  "/cgu",
  "/charte-qualite",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reset-password",
  "/unsubscribe",
];

export default function ChartePendingGuard({ children }: { children: React.ReactNode }) {
  const { user, isPrestataire, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !isPrestataire) {
      setChecked(true);
      return;
    }
    if (WHITELIST.some((p) => location.pathname.startsWith(p))) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: active } = await supabase
        .from("chartes_versions")
        .select("id")
        .is("archivee_le", null)
        .maybeSingle();

      if (!active) {
        if (!cancelled) setChecked(true);
        return;
      }

      const { data: sig } = await supabase
        .from("signatures_charte")
        .select("id")
        .eq("charte_version_id", active.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!sig) {
        navigate("/signer-la-charte", { replace: true });
      } else {
        // Check this specific user has signed
        const { data: presta } = await supabase
          .from("prestataires")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (presta) {
          const { data: ownSig } = await supabase
            .from("signatures_charte")
            .select("id")
            .eq("prestataire_id", presta.id)
            .eq("charte_version_id", active.id)
            .maybeSingle();
          if (!ownSig) {
            navigate("/signer-la-charte", { replace: true });
            return;
          }
        }
      }
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isPrestataire, isLoading, location.pathname, navigate]);

  if (!checked && user && isPrestataire) return null;
  return <>{children}</>;
}
