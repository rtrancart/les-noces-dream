import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SeoHead from "@/components/SeoHead";
import { CharteSignatureFlow } from "@/components/charte/CharteSignatureFlow";

/**
 * Tunnel d'inscription prestataire : signature obligatoire de la Charte Qualité
 * juste après création du compte. Même processus et même valeur probatoire que
 * /signer-la-charte (6 articles + sign-charte + PDF de preuve).
 */
export default function CharteProgressive() {
  const navigate = useNavigate();
  const { user, profile, isPrestataire, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/connexion?redirect=/pro/charte", { replace: true });
      return;
    }
    if (!isPrestataire) {
      navigate("/", { replace: true });
      return;
    }
    if (profile?.cgu_acceptees_le) {
      navigate("/espace-pro", { replace: true });
    }
  }, [user, isPrestataire, profile?.cgu_acceptees_le, isLoading, navigate]);

  const handleSigned = async () => {
    if (!user) return;
    try {
      // Récupère la version active (pour traçabilité interne uniquement)
      const { data: active } = await supabase
        .from("chartes_versions")
        .select("numero_version")
        .is("archivee_le", null)
        .maybeSingle();

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          cgu_acceptees_le: new Date().toISOString(),
          cgu_version_acceptee: active?.numero_version ?? null,
        })
        .eq("id", user.id)
        .select();

      if (updateError) throw updateError;
      if (!updatedProfile || updatedProfile.length === 0) throw new Error("Mise à jour du profil refusée");
    } catch {
      /* sign-charte a déjà acté la signature, on n'échoue pas pour cette mise à jour */
    } finally {
      window.location.replace("/espace-pro?welcome=1");
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title="Charte Qualité prestataire | LesNoces.net"
        description="Signature de la Charte Qualité LesNoces.net."
        noindex
        canonicalUrl="/pro/charte"
      />
      <CharteSignatureFlow mode="inscription" onSigned={handleSigned} />
    </>
  );
}
