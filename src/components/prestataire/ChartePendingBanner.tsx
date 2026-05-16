import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";

/**
 * Bannière affichée dans l'espace prestataire lorsqu'une nouvelle version
 * de la Charte Qualité est en vigueur et n'a pas encore été signée par le
 * prestataire. Comparaison : charte_version_id actif vs dernière signature du presta.
 */
export function ChartePendingBanner() {
  const { prestataire } = useSharedPrestataire();
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!prestataire?.id) return;
    let cancelled = false;

    (async () => {
      const { data: active } = await supabase
        .from("chartes_versions")
        .select("id, numero_version")
        .is("archivee_le", null)
        .maybeSingle();

      if (!active) return;

      const { data: sig } = await supabase
        .from("signatures_charte")
        .select("charte_version_id")
        .eq("prestataire_id", prestataire.id)
        .eq("charte_version_id", active.id)
        .maybeSingle();

      if (!cancelled && !sig) {
        setPendingVersion(active.numero_version);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prestataire?.id]);

  if (!pendingVersion) return null;

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-sans font-medium text-sm">
            Nouvelle version de la Charte Qualité disponible (v{pendingVersion})
          </p>
          <p className="font-sans text-xs text-muted-foreground">
            Vous devez la signer pour conserver votre statut de prestataire actif.
          </p>
        </div>
      </div>
      <Link
        to="/signer-la-charte"
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/90 transition shrink-0"
      >
        Signer la Charte
      </Link>
    </div>
  );
}
