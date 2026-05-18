import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SeoHead from "@/components/SeoHead";
import { CharteSignatureFlow } from "@/components/charte/CharteSignatureFlow";

export default function SignerLaCharte() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate("/connexion?redirect=/signer-la-charte", { replace: true });
  }, [user, isLoading, navigate]);

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
        title="Signer la Charte Qualité | LesNoces.net"
        description="Signature électronique de la Charte Qualité prestataire LesNoces.net"
        noindex
        canonicalUrl="/signer-la-charte"
      />
      <CharteSignatureFlow
        mode="resignature"
        allowReportLater
        onSigned={() => {
          /* sign-charte gère tout côté serveur */
        }}
      />
    </>
  );
}
