import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanKeyPromo =
  | "standard_mensuel"
  | "standard_annuel"
  | "premium_mensuel"
  | "premium_annuel";

export interface PromoEligibilite {
  eligible: boolean;
  raison_non_eligible: string | null;
  date_limite: string | null;
  jours_restants: number | null;
  prix_promo: Record<PlanKeyPromo, number>;
  prix_normaux: Record<PlanKeyPromo, number>;
}

/**
 * Offre de lancement (P7) : l'éligibilité est calculée côté serveur à chaque
 * affichage. Le front n'en fait qu'un usage cosmétique — le checkout revalide.
 */
export function usePromoLancement(prestataireId: string | null | undefined) {
  const [promo, setPromo] = useState<PromoEligibilite | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!prestataireId) {
      setPromo(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_promo_eligibility", {
      p_prestataire_id: prestataireId,
    });
    if (error) {
      console.warn("get_promo_eligibility failed", error);
      setPromo(null);
    } else {
      setPromo(data as unknown as PromoEligibilite);
    }
    setLoading(false);
  }, [prestataireId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { promo, loading, refetch: load };
}

export function formatEuros(montant: number): string {
  return `${montant.toLocaleString("fr-FR")}€`;
}

/** Date de retour au tarif normal : date de souscription + 12 mois. */
export function dateRetourTarifNormal(depuis: Date = new Date()): Date {
  const d = new Date(depuis.getTime());
  d.setMonth(d.getMonth() + 12);
  return d;
}

export function formatDateFr(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
