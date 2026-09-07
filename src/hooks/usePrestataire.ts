import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Prestataire = Tables<"prestataires">;

export type AbonnementResume = {
  formule: string | null;
  periodicite: string | null;
  statut: string | null;
  plan_pending: string | null;
  plan_pending_le: string | null;
};

const STATUTS_ACTIFS = ["actif", "trialing", "en_retard", "en_pause"] as const;

export function usePrestataire() {
  const { user } = useAuth();
  const [prestataire, setPrestataire] = useState<Prestataire | null>(null);
  const [abonnement, setAbonnement] = useState<AbonnementResume | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("prestataires")
      .select("*")
      .eq("user_id", userId)
      .single();

    setPrestataire(data ?? null);

    if (data?.id) {
      const { data: abo } = await supabase
        .from("abonnements")
        .select("formule, periodicite, statut, plan_pending, plan_pending_le")
        .eq("prestataire_id", data.id)
        .in("statut", STATUTS_ACTIFS)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAbonnement(abo ?? null);
    } else {
      setAbonnement(null);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await load(user.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    await load(user.id);
  }, [user?.id, load]);

  // Source de vérité pour l'affichage public : colonne dérivée par le trigger.
  // Fallback sur l'abonnement pour les cas de latence webhook.
  const estPremium =
    prestataire?.est_premium === true ||
    (abonnement?.formule === "premium" &&
      (abonnement?.statut === "actif" || abonnement?.statut === "trialing"));

  return { prestataire, abonnement, estPremium, loading, refetch };
}
