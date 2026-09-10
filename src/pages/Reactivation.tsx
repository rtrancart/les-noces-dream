import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Mail, ShieldAlert } from "lucide-react";
import SeoHead from "@/components/SeoHead";

export default function Reactivation() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [prestataireId, setPrestataireId] = useState<string | null>(null);

  const pidFromUrl = params.get("pid");

  // Récupère prestataire_id : URL prioritaire, sinon via user connecté
  useEffect(() => {
    if (pidFromUrl) {
      setPrestataireId(pidFromUrl);
      return;
    }
    if (user) {
      (async () => {
        const { data } = await supabase
          .from("prestataires")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) setPrestataireId(data.id);
      })();
    }
  }, [pidFromUrl, user]);

  return (
    <>
      <SeoHead
        title="Réactivation de votre profil | LesNoces.net"
        description="Demande de réactivation d'un profil prestataire archivé."
        noindex
        canonicalUrl="/reactivation"
      />
      <div className="min-h-screen flex items-center justify-center bg-[#FBF6EB] px-4 py-12">
        <Card className="w-full max-w-2xl p-8 md:p-12 space-y-6 bg-white">
          <div className="flex justify-center">
            <ShieldAlert className="h-12 w-12 text-primary" />
          </div>

          <h1 className="font-serif text-3xl md:text-4xl text-center text-[#2C3E50]">
            Votre profil a été archivé
          </h1>

          <p className="font-sans text-[15px] md:text-base leading-relaxed text-[#4A4A4A] text-center">
            Votre profil n'est actuellement pas visible sur LesNoces.net.
            Pour le réactiver, contactez directement notre équipe par email.
            Nous étudierons votre demande et vous recontacterons dans les plus brefs délais.
          </p>

          <div className="pt-2">
            <a
              href={`mailto:contact@lesnoces.net${prestataireId ? `?subject=Demande de réactivation du profil ${prestataireId}` : ""}`}
              className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium px-4 py-3 transition hover:opacity-90"
              style={{ background: "#A57D27", color: "white" }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Envoyer un email à contact@lesnoces.net
            </a>
          </div>
        </Card>
      </div>
    </>
  );
}
