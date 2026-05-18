import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";

/**
 * Bandeau or doux affiché tant que le prestataire n'a pas signé la version
 * active de la Charte Qualité (première signature ou nouvelle version).
 */
export function ChartePendingBanner() {
  const { prestataire } = useSharedPrestataire();
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [isFirstSignature, setIsFirstSignature] = useState(false);

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

      if (cancelled || sig) return;

      const { count } = await supabase
        .from("signatures_charte")
        .select("id", { count: "exact", head: true })
        .eq("prestataire_id", prestataire.id);

      setIsFirstSignature((count ?? 0) === 0);
      setPendingVersion(active.numero_version);
    })();

    return () => {
      cancelled = true;
    };
  }, [prestataire?.id]);

  if (!pendingVersion) return null;

  return (
    <div
      className="rounded-md border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      style={{ background: "#F4E8D0", borderColor: "#E0CDA0" }}
    >
      <div className="flex items-start gap-3">
        <FileSignature className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#A57D27" }} />
        <div className="space-y-0.5">
          <p className="font-sans font-medium text-sm text-foreground">
            {isFirstSignature
              ? "Votre fiche n'est pas encore publiée."
              : `Nouvelle version de la Charte Qualité disponible (${pendingVersion}).`}
          </p>
          <p className="font-sans text-xs text-foreground/70">
            {isFirstSignature
              ? "Signez la Charte Qualité rendre votre profil visible sur LesNoces.net"
              : "Vous devez la signer pour conserver votre statut de prestataire actif."}
          </p>
        </div>
      </div>
      <Link
        to="/signer-la-charte"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 transition shrink-0 hover:opacity-90"
        style={{ background: "#A57D27", color: "white" }}
      >
        Signer maintenant
      </Link>
    </div>
  );
}
