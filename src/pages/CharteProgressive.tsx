import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, Clock, FileText, Heart, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";
import { cn } from "@/lib/utils";

type EtapeKey = "reactivite" | "exactitude" | "qualite" | "sanctions";

interface Engagement {
  key: EtapeKey;
  icon: React.ElementType;
  titre: string;
  texte: string;
  bouton: string;
}

const ENGAGEMENTS: Engagement[] = [
  {
    key: "reactivite",
    icon: Clock,
    titre: "Réactivité",
    texte:
      "Vous vous engagez à répondre à toute demande reçue via LesNoces.net dans les 72 heures ouvrées. Un taux de réponse inférieur à 70 % sur 90 jours entraîne une revue automatique de votre compte.",
    bouton: "J'accepte cet engagement",
  },
  {
    key: "exactitude",
    icon: FileText,
    titre: "Exactitude des informations",
    texte:
      "Vos tarifs affichés, vos photos et votre description doivent être représentatifs de votre prestation réelle. Toute information trompeuse peut entraîner la suspension de votre fiche.",
    bouton: "J'accepte cet engagement",
  },
  {
    key: "qualite",
    icon: Heart,
    titre: "Qualité de service",
    texte:
      "Vous vous engagez à traiter les clients contactés via LesNoces.net avec le même niveau de professionnalisme que vos autres clients, et à coopérer en cas de litige signalé.",
    bouton: "J'accepte cet engagement",
  },
  {
    key: "sanctions",
    icon: AlertTriangle,
    titre: "Sanctions",
    texte:
      "En cas de manquements répétés à la Charte Qualité, votre fiche peut être suspendue temporairement ou retirée définitivement après avertissement. Vous disposez de 7 jours pour contester toute décision.",
    bouton: "J'ai compris et j'accepte",
  },
];

export default function CharteProgressive() {
  const navigate = useNavigate();
  const { user, profile, isPrestataire, isLoading } = useAuth();
  const [step, setStep] = useState(0); // 0..3 engagements, 4 récap
  const [etapesValidees, setEtapesValidees] = useState<Record<EtapeKey, string>>({} as Record<EtapeKey, string>);
  const [submitting, setSubmitting] = useState(false);
  const [chargingVersion, setChargingVersion] = useState(true);
  const [versionCharte, setVersionCharte] = useState<string>("v1.0");

  const total = ENGAGEMENTS.length;
  const isFinal = step === total;

  // Garde : prestataire connecté avec CGU non acceptées
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

  // Récupère la version active de la charte
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chartes_versions")
        .select("numero_version")
        .is("archivee_le", null)
        .maybeSingle();
      if (data?.numero_version) setVersionCharte(data.numero_version);
      setChargingVersion(false);
    })();
  }, []);

  const handleAccept = () => {
    const eng = ENGAGEMENTS[step];
    setEtapesValidees((prev) => ({ ...prev, [eng.key]: new Date().toISOString() }));
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const handleFinalSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Met à jour profiles
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          cgu_acceptees_le: new Date().toISOString(),
          cgu_version_acceptee: versionCharte,
        })
        .eq("id", user.id)
        .select();
      if (profileErr) throw profileErr;

      // 2. Si une fiche prestataire existe en pre_inscrit, on la bascule en brouillon
      const { data: presta } = await supabase
        .from("prestataires")
        .select("id, statut")
        .eq("user_id", user.id)
        .maybeSingle();

      if (presta && presta.statut === "pre_inscrit") {
        await supabase
          .from("prestataires")
          .update({ statut: "brouillon" })
          .eq("id", presta.id)
          .select();
      }

      toast.success("Charte validée. Bienvenue sur LesNoces.net.");
      navigate("/espace-pro?welcome=1", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la validation de la charte.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || chargingVersion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ProgressBar = () => (
    <div className="flex gap-1.5 w-full" aria-label={`Étape ${Math.min(step + 1, total)} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted"
          )}
        />
      ))}
    </div>
  );

  return (
    <>
      <SeoHead
        title="Charte Qualité prestataire | LesNoces.net"
        description="Validation progressive de la Charte Qualité LesNoces.net."
        noindex
        canonicalUrl="/pro/charte"
      />
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="text-center space-y-2">
            <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
              Charte Qualité — version {versionCharte}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl">
              {isFinal ? "Récapitulatif" : `Engagement ${step + 1} sur ${total}`}
            </h1>
            <ProgressBar />
          </header>

          {!isFinal && (() => {
            const eng = ENGAGEMENTS[step];
            const Icon = eng.icon;
            return (
              <Card className="p-8 md:p-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="font-serif text-2xl">{eng.titre}</h2>
                </div>
                <p className="font-sans text-[17px] leading-relaxed text-foreground">
                  {eng.texte}
                </p>
                <Button
                  onClick={handleAccept}
                  size="lg"
                  className="w-full font-sans font-semibold tracking-wide"
                >
                  {eng.bouton}
                </Button>
              </Card>
            );
          })()}

          {isFinal && (
            <Card className="p-8 md:p-10 space-y-6">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-serif text-2xl">Vous avez validé les {total} engagements</h2>
                <p className="font-sans text-sm text-muted-foreground">
                  de la Charte Qualité LesNoces.net version {versionCharte}.
                </p>
              </div>

              <ul className="space-y-2 bg-muted/30 rounded-lg p-5">
                {ENGAGEMENTS.map((e) => (
                  <li key={e.key} className="flex items-center gap-3 font-sans text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{e.titre}</span>
                  </li>
                ))}
              </ul>

              <p className="font-sans text-sm text-muted-foreground">
                En validant ci-dessous vous confirmez avoir lu et accepté l'intégralité de la Charte Qualité.
                Votre acceptation est horodatée et conservée comme preuve.
              </p>

              <Button
                onClick={handleFinalSubmit}
                disabled={submitting}
                size="lg"
                className="w-full font-sans font-semibold tracking-wide"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Valider et accéder à mon espace prestataire
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
