import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, FileSignature } from "lucide-react";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

interface ChartVersion {
  id: string;
  numero_version: string;
  titre: string;
  contenu_html: string;
  contenu_hash: string;
  entree_en_vigueur_le: string;
}

/**
 * /signer-la-charte
 *
 * Écran de signature électronique de la Charte Qualité active.
 * - Affiche le contenu HTML de la version active (chartes_versions WHERE archivee_le IS NULL).
 * - Bouton "Je signe" → invoke('sign-charte') qui crée la signature et déclenche
 *   asynchrone la génération du PDF preuve (cf. pattern write-once du trigger).
 */
export default function SignerLaCharte() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [charte, setCharte] = useState<ChartVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/connexion?redirect=/signer-la-charte", { replace: true });
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("chartes_versions")
        .select("id, numero_version, titre, contenu_html, contenu_hash, entree_en_vigueur_le")
        .is("archivee_le", null)
        .maybeSingle();

      if (error || !data) {
        toast.error("Aucune version de Charte active.");
      } else {
        setCharte(data);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleSign = async () => {
    if (!accepted) {
      toast.error("Vous devez confirmer avoir lu la Charte.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-charte", { body: {} });
      if (error) throw error;
      if (data?.already_signed) {
        toast.info("Vous avez déjà signé cette version.");
      } else {
        toast.success("Charte signée. Votre certificat va vous parvenir par email.");
      }
      setSigned(true);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la signature.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (signed) {
    return (
      <>
        <SeoHead title="Charte signée | LesNoces.net" description="Confirmation de signature" noindex canonicalUrl="/signer-la-charte" />
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
          <Card className="w-full max-w-lg p-10 text-center space-y-5">
            <ShieldCheck className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-serif text-3xl">Merci, votre signature est enregistrée.</h1>
            <p className="font-sans text-muted-foreground">
              Votre certificat de signature est en cours de génération.
              Vous le recevrez par email dans quelques instants.
            </p>
            <Button onClick={() => navigate("/espace-pro")} className="mt-4">
              Accéder à mon espace prestataire
            </Button>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Signer la Charte Qualité | LesNoces.net" description="Signature électronique de la Charte Qualité prestataire LesNoces.net" noindex canonicalUrl="/signer-la-charte" />
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="text-center space-y-2">
            <FileSignature className="h-10 w-10 text-primary mx-auto" />
            <h1 className="font-serif text-3xl">{charte?.titre ?? "Charte Qualité"}</h1>
            <p className="font-sans text-sm text-muted-foreground">
              Version {charte?.numero_version} — en vigueur depuis le{" "}
              {charte && new Date(charte.entree_en_vigueur_le).toLocaleDateString("fr-FR")}
            </p>
          </header>

          <Card className="p-6 md:p-10">
            <article
              className="prose prose-sm md:prose-base max-w-none font-sans"
              dangerouslySetInnerHTML={{ __html: charte?.contenu_html ?? "" }}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="font-sans text-sm">
                Je déclare avoir lu l'intégralité de la Charte Qualité version{" "}
                <strong>{charte?.numero_version}</strong> et m'engage à en respecter toutes les
                clauses. Je comprends que ma signature électronique a la même valeur qu'une
                signature manuscrite (art. 1366 du Code civil).
              </span>
            </label>

            <Button
              onClick={handleSign}
              disabled={!accepted || submitting}
              className="w-full"
              size="lg"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Je signe la Charte
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Votre adresse IP, navigateur et horodatage seront enregistrés comme preuve.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
