import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import SeoHead from "@/components/SeoHead";

type Status = "idle" | "loading" | "success" | "error" | "duplicate";

export default function Reactivation() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
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

  const handleSubmit = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "request-reactivation-archive",
        { body: prestataireId ? { prestataire_id: prestataireId } : {} }
      );

      // L'erreur Supabase contient le status HTTP via FunctionsHttpError
      if (error) {
        // Tente d'extraire le code depuis la réponse
        const ctx: any = (error as any).context;
        let status = 0;
        let parsed: any = null;
        try {
          status = ctx?.status ?? 0;
          const text = ctx ? await ctx.text() : null;
          parsed = text ? JSON.parse(text) : null;
        } catch {
          // ignore
        }
        if (status === 409) {
          setStatus("duplicate");
          return;
        }
        setErrorMsg(parsed?.error ?? error.message ?? "");
        setStatus("error");
        return;
      }

      if (data?.success) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "");
      setStatus("error");
    }
  };

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
            Le délai de 60 jours pour signer la Charte Qualité LesNoces.net est écoulé.
            Votre profil a été archivé et n'a pas été publié. La réactivation et la
            publication de votre profil seront soumises à la validation de l'équipe
            LesNoces.net.
          </p>

          <div className="pt-2">
            {status === "success" && (
              <div className="bg-[#FBF6EB] border border-[#E8D9B8] rounded-lg p-6 flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-[#A57D27]" />
                <p className="font-sans text-[15px] text-[#2C3E50]">
                  Votre demande a bien été transmise.
                  <br />
                  Notre équipe vous recontacte sous <strong>48 heures ouvrées</strong>.
                </p>
              </div>
            )}

            {status === "duplicate" && (
              <div className="bg-[#FBF6EB] border border-[#E8D9B8] rounded-lg p-6 text-center">
                <p className="font-sans text-[15px] text-[#2C3E50]">
                  Une demande de réactivation a déjà été enregistrée aujourd'hui.
                  Notre équipe vous recontacte sous 48 heures ouvrées.
                </p>
              </div>
            )}

            {(status === "idle" || status === "loading") && (
              <Button
                onClick={handleSubmit}
                disabled={status === "loading"}
                size="lg"
                className="w-full bg-[#A57D27] hover:bg-[#8C6A1F] text-white font-sans tracking-wide"
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Demander la réactivation de mon profil
              </Button>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center">
                  <p className="font-sans text-sm text-red-800">
                    Une erreur est survenue. Contactez-nous à{" "}
                    <a
                      href="mailto:contact@lesnoces.net"
                      className="underline font-medium"
                    >
                      contact@lesnoces.net
                    </a>
                  </p>
                  {errorMsg && (
                    <p className="font-sans text-xs text-red-600 mt-2 italic">{errorMsg}</p>
                  )}
                </div>
                <Button
                  onClick={handleSubmit}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Réessayer
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
