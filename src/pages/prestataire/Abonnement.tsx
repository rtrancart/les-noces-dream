import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Formule = "standard" | "premium" | "annuel";

interface Abonnement {
  id: string;
  plan: string;
  statut: string;
  montant_cents: number | null;
  fin_essai_le: string | null;
  fin_periode_le: string | null;
  cancel_at_period_end: boolean;
  suspendu_pour_impaye_le: string | null;
  stripe_subscription_id: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatusBanner({ abo }: { abo: Abonnement | null }) {
  const now = Date.now();

  let color: "green" | "blue" | "orange" | "gray" | "red" = "gray";
  let titre = "Aucun abonnement actif";
  let sous = "Souscrivez à une formule pour être visible sur LesNoces.net.";

  if (!abo) {
    color = "red";
  } else {
    const finEssai = abo.fin_essai_le ? new Date(abo.fin_essai_le).getTime() : 0;
    const enEssai = !abo.stripe_subscription_id && finEssai > now;

    if (enEssai) {
      color = "blue";
      titre = "Période d'essai en cours";
      sous = `Fin de l'essai le ${formatDate(abo.fin_essai_le)}. Souscrivez dès maintenant pour éviter toute interruption.`;
    } else if (abo.statut === "actif" && abo.cancel_at_period_end) {
      color = "gray";
      titre = "Abonnement résilié";
      sous = `Votre fiche reste visible jusqu'au ${formatDate(abo.fin_periode_le)}.`;
    } else if (abo.statut === "resilie") {
      color = "gray";
      titre = "Abonnement résilié";
      sous = `Visible jusqu'au ${formatDate(abo.fin_periode_le)}.`;
    } else if (abo.statut === "actif") {
      color = "green";
      const isTrial = finEssai > now;
      titre = isTrial ? "Abonnement souscrit — période d'essai" : "Abonnement actif";
      sous = isTrial
        ? `Premier prélèvement le ${formatDate(abo.fin_essai_le)}.`
        : `Prochaine échéance le ${formatDate(abo.fin_periode_le)}.`;
    } else if (abo.statut === "en_retard") {
      color = "orange";
      titre = "Paiement en échec";
      sous = "Stripe relance automatiquement la carte. Aucune action n'est requise pour l'instant.";
    } else if (abo.statut === "en_pause") {
      color = "gray";
      titre = "Abonnement en pause";
      sous = "";
    } else if (abo.statut === "annule" || abo.statut === "expire") {
      color = "red";
      titre = "Abonnement terminé";
      sous = abo.suspendu_pour_impaye_le
        ? "Votre fiche a été suspendue pour impayé. Souscrivez à nouveau pour la réactiver."
        : "Souscrivez à nouveau pour redevenir visible sur LesNoces.net.";
    }
  }

  const dot = {
    green: "bg-sauge",
    blue: "bg-primary",
    orange: "bg-terracotta",
    gray: "bg-muted-foreground",
    red: "bg-destructive",
  }[color];

  const wrap = {
    green: "bg-sauge/10 border-sauge",
    blue: "bg-primary/10 border-primary",
    orange: "bg-terracotta/10 border-terracotta",
    gray: "bg-muted border-border",
    red: "bg-destructive/10 border-destructive",
  }[color];

  return (
    <div className={cn("border-l-4 rounded-lg p-5", wrap)}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-2 h-2.5 w-2.5 rounded-full shrink-0", dot)} aria-hidden />
        <div>
          <h3 className="font-serif text-lg text-foreground mb-1">{titre}</h3>
          {sous && <p className="font-sans text-sm text-muted-foreground">{sous}</p>}
        </div>
      </div>
    </div>
  );
}

export default function PrestataireAbonnement() {
  const { prestataire } = useSharedPrestataire();
  const [abo, setAbo] = useState<Abonnement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Formule | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Toast de retour Checkout
  useEffect(() => {
    const statut = searchParams.get("statut");
    if (statut === "succes") {
      toast({
        title: "Abonnement enregistré",
        description: "Votre carte a été enregistrée. La facturation démarrera à la fin de votre période d'essai.",
      });
      searchParams.delete("statut");
      setSearchParams(searchParams, { replace: true });
    } else if (statut === "annule") {
      toast({
        title: "Souscription annulée",
        description: "Aucun paiement n'a été enregistré.",
        variant: "destructive",
      });
      searchParams.delete("statut");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!prestataire?.id) return;
    (async () => {
      const { data } = await supabase
        .from("abonnements")
        .select("id, plan, statut, montant_cents, fin_essai_le, fin_periode_le, cancel_at_period_end, suspendu_pour_impaye_le, stripe_subscription_id")
        .eq("prestataire_id", prestataire.id)
        .maybeSingle();
      setAbo(data as Abonnement | null);
      setLoading(false);
    })();
  }, [prestataire?.id]);

  async function subscribe(formule: Formule) {
    setSubmitting(formule);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { formule },
      });
      if (error) throw error;
      if (data?.url) {
        const url = data.url as string;
        // Ouvrir au top-level : Stripe Checkout refuse d'être affiché dans un iframe
        // (le preview Lovable est un iframe), ce qui donne une page blanche.
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          try {
            (window.top ?? window).location.href = url;
          } catch {
            window.location.href = url;
          }
        }
      } else {
        throw new Error("URL de paiement introuvable");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la création du paiement";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="bg-muted rounded-lg p-5 h-20 animate-pulse" />
      ) : (
        <StatusBanner abo={abo} />
      )}

      <div>
        <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-1 text-center">
          Choisissez votre formule
        </h2>
        <p className="font-sans text-sm text-muted-foreground mb-8 text-center">
          Tarifs TTC. La carte est enregistrée dès maintenant, le premier prélèvement a lieu à la fin de votre période d'essai.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Standard */}
          <PlanCard
            titre="Standard"
            prix="89€"
            periode="par mois"
            features={[
              { included: true, text: "Profil professionnel complet" },
              { included: true, text: "Galerie photo" },
              { included: true, text: "Réception de demandes de devis" },
              { included: true, text: "Statistiques basiques" },
              { included: false, text: "Badge premium" },
            ]}
            cta="Choisir Standard"
            onClick={() => subscribe("standard")}
            loading={submitting === "standard"}
            disabled={submitting !== null}
          />

          {/* Premium — Featured */}
          <PlanCard
            titre="Premium"
            prix="149€"
            periode="par mois"
            highlighted
            features={[
              { included: true, text: "Tout de l'offre Standard" },
              { included: true, text: "Galerie photo illimitée" },
              { included: true, text: "Badge Premium visible" },
              { included: true, text: "Statistiques avancées" },
              { included: true, text: "Support prioritaire" },
            ]}
            cta="Choisir Premium"
            onClick={() => subscribe("premium")}
            loading={submitting === "premium"}
            disabled={submitting !== null}
          />

          {/* Annuel */}
          <PlanCard
            titre="Annuel"
            prix="948€"
            periode="par an (soit 79€/mois)"
            features={[
              { included: true, text: "Toutes les fonctionnalités Premium" },
              { included: true, text: "2 mois offerts" },
              { included: true, text: "Facturation annuelle unique" },
              { included: true, text: "Engagement 12 mois" },
            ]}
            cta="Choisir Annuel"
            onClick={() => subscribe("annuel")}
            loading={submitting === "annuel"}
            disabled={submitting !== null}
          />
        </div>
      </div>

      <div className="bg-background rounded-lg p-5 border border-border">
        <div className="flex items-start gap-3">
          <CreditCard className="text-primary flex-shrink-0" size={22} />
          <div>
            <h4 className="font-sans font-semibold text-foreground text-sm mb-1">
              Paiement sécurisé par Stripe
            </h4>
            <p className="font-sans text-xs text-muted-foreground">
              Vos informations de paiement sont protégées et cryptées. Aucun débit pendant la période d'essai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlanCardProps {
  titre: string;
  prix: string;
  periode: string;
  features: { included: boolean; text: string }[];
  cta: string;
  highlighted?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function PlanCard({ titre, prix, periode, features, cta, highlighted, loading, disabled, onClick }: PlanCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-6 transition-all",
        highlighted
          ? "bg-gradient-to-br from-primary to-muted text-primary-foreground shadow-xl md:scale-105 relative"
          : "bg-card border-2 border-border hover:shadow-md",
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sauge text-white px-4 py-1 rounded-full">
          <span className="font-sans text-xs font-bold uppercase tracking-wider">Recommandé</span>
        </div>
      )}
      <div className="text-center mb-5 mt-3">
        <h3 className={cn("font-serif text-xl mb-1", !highlighted && "text-foreground")}>{titre}</h3>
        <div className={cn("font-serif", highlighted ? "text-4xl" : "text-3xl text-foreground")}>{prix}</div>
        <p className={cn("font-sans text-xs", highlighted ? "text-primary-foreground/80" : "text-muted-foreground")}>{periode}</p>
      </div>
      <ul className="space-y-2.5 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {f.included ? (
              <Check size={18} className={cn("flex-shrink-0 mt-0.5", !highlighted && "text-sauge")} />
            ) : (
              <X size={18} className="text-border flex-shrink-0 mt-0.5" />
            )}
            <span
              className={cn(
                "font-sans text-sm",
                highlighted ? "" : f.included ? "text-foreground" : "text-muted-foreground line-through",
              )}
            >
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full py-2.5 rounded-lg font-sans font-semibold text-sm transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed",
          highlighted
            ? "bg-card text-primary hover:bg-foreground hover:text-background"
            : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {cta}
      </button>
    </div>
  );
}
