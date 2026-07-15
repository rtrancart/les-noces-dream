import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, X, Loader2, ChevronDown, ChevronUp, FileText, AlertTriangle } from "lucide-react";
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
  stripe_payment_method_id: string | null;
  carte_brand: string | null;
  carte_last4: string | null;
}

function formatCarte(brand: string | null, last4: string | null): string | null {
  if (!last4) return null;
  const label = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1)
    : "Carte";
  return `${label} •••• ${last4}`;
}

const FORMULES: Record<Formule, { label: string; prix: string; periode: string; premium?: boolean }> = {
  standard: { label: "Standard", prix: "89€", periode: "par mois" },
  premium: { label: "Premium", prix: "149€", periode: "par mois", premium: true },
  annuel: { label: "Annuel", prix: "948€", periode: "par an (soit 79€/mois)" },
};

/** Traduit le `plan` stocké en base (ex: "standard_mensuel") vers la clé UI (ex: "standard"). */
const PLAN_TO_FORMULE: Record<string, Formule> = {
  standard_mensuel: "standard",
  premium_mensuel: "premium",
  annuel: "annuel",
};
function planToFormule(plan: string | null | undefined): Formule | null {
  if (!plan) return null;
  if (plan in PLAN_TO_FORMULE) return PLAN_TO_FORMULE[plan];
  if (plan in FORMULES) return plan as Formule;
  return null;
}



function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatMontant(cents: number | null, plan: string): string {
  if (cents != null) {
    const eur = cents / 100;
    return eur % 1 === 0 ? `${eur}€` : `${eur.toFixed(2)}€`;
  }
  const key = planToFormule(plan);
  return key ? FORMULES[key].prix : "";
}


/** Dérive l'état visuel du bloc abonnement */
function deriveEtat(abo: Abonnement): {
  key: "actif" | "essai" | "echec" | "resilie" | "pause" | "termine";
  libelle: string;
  detail: string;
  dot: string;
  wrap: string;
  ring: string;
} {
  const now = Date.now();
  const finEssai = abo.fin_essai_le ? new Date(abo.fin_essai_le).getTime() : 0;
  const enEssai = abo.statut === "actif" && finEssai > now;

  if (abo.statut === "en_retard") {
    return {
      key: "echec",
      libelle: "Paiement en échec",
      detail: "Mettez à jour votre moyen de paiement pour éviter la suspension de votre fiche.",
      dot: "bg-terracotta",
      wrap: "bg-terracotta/5 border-terracotta/40",
      ring: "ring-terracotta/30",
    };
  }
  if (abo.statut === "en_pause") {
    return {
      key: "pause",
      libelle: "Abonnement en pause",
      detail: "Votre abonnement est actuellement suspendu.",
      dot: "bg-muted-foreground",
      wrap: "bg-muted border-border",
      ring: "ring-border",
    };
  }
  if (abo.statut === "resilie" || (abo.statut === "actif" && abo.cancel_at_period_end)) {
    return {
      key: "resilie",
      libelle: "Abonnement résilié",
      detail: abo.fin_periode_le
        ? `Votre fiche reste visible jusqu'au ${formatDate(abo.fin_periode_le)}.`
        : "Votre fiche reste visible jusqu'à la fin de la période en cours.",
      dot: "bg-muted-foreground",
      wrap: "bg-muted border-border",
      ring: "ring-border",
    };
  }
  if (abo.statut === "annule" || abo.statut === "expire") {
    return {
      key: "termine",
      libelle: "Abonnement terminé",
      detail: "Souscrivez à nouveau pour redevenir visible sur LesNoces.net.",
      dot: "bg-destructive",
      wrap: "bg-destructive/5 border-destructive/40",
      ring: "ring-destructive/30",
    };
  }
  if (enEssai) {
    return {
      key: "essai",
      libelle: "Abonnement souscrit — période d'essai",
      detail: `Premier prélèvement le ${formatDate(abo.fin_essai_le)}.`,
      dot: "bg-primary",
      wrap: "bg-primary/5 border-primary/30",
      ring: "ring-primary/20",
    };
  }
  return {
    key: "actif",
    libelle: "Abonnement actif",
    detail: abo.fin_periode_le
      ? `Prochain prélèvement le ${formatDate(abo.fin_periode_le)}.`
      : "Prochain prélèvement à venir.",
    dot: "bg-sauge",
    wrap: "bg-sauge/5 border-sauge/40",
    ring: "ring-sauge/20",
  };
}

export default function PrestataireAbonnement() {
  const { prestataire } = useSharedPrestataire();
  const [abo, setAbo] = useState<Abonnement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Formule | null>(null);
  const [manualRedirect, setManualRedirect] = useState<{ url: string; formule: Formule } | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let hasChanged = false;
    const statut = searchParams.get("statut");
    if (statut === "succes") {
      toast({
        title: "Abonnement enregistré",
        description: "Votre carte a été enregistrée. La facturation démarrera à la fin de votre période d'essai.",
      });
      nextParams.delete("statut");
      hasChanged = true;
    } else if (statut === "annule") {
      toast({ title: "Souscription annulée", description: "Aucun paiement n'a été enregistré.", variant: "destructive" });
      nextParams.delete("statut");
      hasChanged = true;
    }
    if (hasChanged) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!prestataire?.id) return;
    (async () => {
      const { data } = await supabase
        .from("abonnements")
        .select("id, plan, statut, montant_cents, fin_essai_le, fin_periode_le, cancel_at_period_end, suspendu_pour_impaye_le, stripe_subscription_id, stripe_payment_method_id, carte_brand, carte_last4")
        .eq("prestataire_id", prestataire.id)
        .maybeSingle();
      setAbo(data as Abonnement | null);
      setLoading(false);
    })();
  }, [prestataire?.id]);

  async function subscribe(formule: Formule) {
    setSubmitting(formule);
    setManualRedirect(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", { body: { formule } });
      if (error) throw error;
      const stripeUrl = data?.url as string | undefined;
      if (!stripeUrl) throw new Error("URL de paiement introuvable");

      // Toujours afficher le filet de sécurité (lien target="_top") avec l'URL Stripe réelle.
      setManualRedirect({ url: stripeUrl, formule });

      // Tenter la navigation programmatique : top window si accessible, sinon l'iframe elle-même.
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = stripeUrl;
        } else {
          window.location.href = stripeUrl;
        }
      } catch {
        // Bloqué par la politique d'iframe : le lien "Continuer vers Stripe" prend le relais.
        try {
          window.location.href = stripeUrl;
        } catch {
          /* on garde manualRedirect visible */
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la création du paiement";
      toast({ title: "Erreur", description: message, variant: "destructive" });
      setManualRedirect(null);
    } finally {
      setSubmitting(null);
    }
  }


  function portailStripeBientot() {
    toast({
      title: "Bientôt disponible",
      description: "Le portail de gestion Stripe sera branché prochainement.",
    });
  }

  // Un abonnement existe et est géré par Stripe (souscription active côté Stripe)
  const hasSubscription = !!(abo && abo.stripe_subscription_id);

  if (loading) {
    return <div className="bg-muted rounded-lg p-5 h-40 animate-pulse" />;
  }

  if (hasSubscription && abo) {
    return (
      <>
        {manualRedirect && <StripeRedirectNotice url={manualRedirect.url} formule={manualRedirect.formule} />}
        <GestionAbonnement
          abo={abo}
          showChange={showChange}
          setShowChange={setShowChange}
          subscribe={subscribe}
          submitting={submitting}
          portailStripeBientot={portailStripeBientot}
        />
      </>
    );
  }

  return (
    <>
      {manualRedirect && <StripeRedirectNotice url={manualRedirect.url} formule={manualRedirect.formule} />}
      <VenteAbonnement abo={abo} subscribe={subscribe} submitting={submitting} />
    </>
  );
}

function StripeRedirectNotice({ url, formule }: { url: string; formule: Formule }) {
  return (
    <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-sans text-sm font-semibold text-foreground">Redirection Stripe prête</p>
          <p className="font-sans text-xs text-muted-foreground">
            Continuez vers Stripe pour passer à la formule {FORMULES[formule].label}.
          </p>
        </div>
        <a
          href={url}
          target="_top"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Continuer vers Stripe
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   MODE GESTION — un abonnement existe
   ============================================================ */
function GestionAbonnement({
  abo, showChange, setShowChange, subscribe, submitting, portailStripeBientot,
}: {
  abo: Abonnement;
  showChange: boolean;
  setShowChange: (v: boolean) => void;
  subscribe: (f: Formule) => void;
  submitting: Formule | null;
  portailStripeBientot: () => void;
}) {
  const etat = deriveEtat(abo);
  const formuleKey = planToFormule(abo.plan);
  const formule = formuleKey ? FORMULES[formuleKey] : null;
  const isPremium = formuleKey === "premium";
  const isEchec = etat.key === "echec";


  return (
    <div className="space-y-6 md:space-y-8">
      {/* BLOC PRINCIPAL — Votre abonnement */}
      <section
        aria-label="Votre abonnement"
        className={cn(
          "rounded-2xl border p-6 md:p-8 ring-1 shadow-sm",
          etat.wrap,
          etat.ring,
        )}
      >
        <div className="flex flex-col gap-6">
          {/* En-tête : titre + badge formule */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
                Votre abonnement
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight">
                {formule?.label ?? abo.plan}
              </h2>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-xs font-semibold uppercase tracking-wider",
                isPremium
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-foreground border border-border",
              )}
            >
              {isPremium && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
              Formule {formule?.label ?? abo.plan}
            </span>
          </div>

          {/* Prix */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl md:text-5xl text-foreground">
              {formatMontant(abo.montant_cents, abo.plan)}
            </span>
            <span className="font-sans text-sm text-muted-foreground">
              {formule?.periode}
            </span>
            <span className="font-sans text-xs text-muted-foreground ml-1">TTC</span>
          </div>

          {/* État */}
          <div className={cn(
            "flex items-start gap-3 rounded-lg p-4 bg-background/70 border",
            isEchec ? "border-terracotta/40" : "border-border/60",
          )}>
            <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0", etat.dot)} aria-hidden />
            <div className="flex-1">
              <p className="font-sans font-semibold text-sm text-foreground mb-0.5">
                {etat.libelle}
              </p>
              <p className="font-sans text-sm text-muted-foreground">{etat.detail}</p>
            </div>
            {isEchec && <AlertTriangle className="text-terracotta shrink-0" size={20} />}
          </div>

          {/* Grille infos : échéance + moyen de paiement (masqué tant que la carte n'est pas hydratée) */}
          {(() => {
            const carte = formatCarte(abo.carte_brand, abo.carte_last4);
            const showCarte = carte !== null;
            return (
              <div className={cn("grid gap-3", showCarte ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                <InfoTile
                  label="Prochaine échéance"
                  value={abo.fin_periode_le ? formatDate(abo.fin_periode_le) : "—"}
                />
                {showCarte && (
                  <InfoTile
                    label="Moyen de paiement"
                    value={carte!}
                    icon={<CreditCard size={16} className="text-muted-foreground" />}
                  />
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ACTIONS DE GESTION */}
      <section aria-label="Gestion de l'abonnement" className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionButton
            onClick={portailStripeBientot}
            icon={<CreditCard size={18} />}
            label="Modifier mon moyen de paiement"
            highlight={isEchec}
          />
          <ActionButton
            onClick={portailStripeBientot}
            icon={<FileText size={18} />}
            label="Consulter mes factures"
          />
        </div>

        {/* Résiliation — traitée avec retenue */}
        <div className="pt-2">
          <button
            onClick={portailStripeBientot}
            className="w-full sm:w-auto font-sans text-xs text-muted-foreground hover:text-destructive underline underline-offset-4 decoration-dotted transition-colors py-2"
          >
            {abo.cancel_at_period_end ? "Réactiver mon abonnement" : "Résilier mon abonnement"}
          </button>
        </div>
      </section>

      {/* CHANGER DE FORMULE — replié par défaut */}
      <section aria-label="Changer de formule" className="border-t border-border pt-6">
        <button
          onClick={() => setShowChange(!showChange)}
          className="w-full flex items-center justify-between gap-3 py-3 text-left group"
          aria-expanded={showChange}
        >
          <div>
            <h3 className="font-serif text-lg text-foreground">Changer de formule</h3>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Comparer les autres formules et faire évoluer votre abonnement.
            </p>
          </div>
          {showChange
            ? <ChevronUp className="text-muted-foreground group-hover:text-foreground shrink-0" size={20} />
            : <ChevronDown className="text-muted-foreground group-hover:text-foreground shrink-0" size={20} />}
        </button>

        {showChange && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {(Object.keys(FORMULES) as Formule[]).map((f) => (
              <MiniPlanCard
                key={f}
                formule={f}
                isCurrent={formuleKey === f}
                loading={submitting === f}
                disabled={submitting !== null}
                onClick={() => subscribe(f)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-background/70 border border-border/60 p-4">
      <p className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-sans text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, highlight }: { onClick: () => void; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-all font-sans text-sm font-medium",
        highlight
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm"
          : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5",
      )}
    >
      <span className={cn(highlight ? "text-primary-foreground" : "text-primary")}>{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function MiniPlanCard({ formule, isCurrent, loading, disabled, onClick }: {
  formule: Formule; isCurrent: boolean; loading: boolean; disabled: boolean; onClick: () => void;
}) {
  const f = FORMULES[formule];
  const isPremium = formule === "premium";
  return (
    <div className={cn(
      "rounded-xl border p-5 flex flex-col",
      isCurrent ? "border-primary bg-primary/5" : "border-border bg-card",
      isPremium && !isCurrent && "border-primary/30",
    )}>
      <div className="flex items-start justify-between mb-3">
        <h4 className={cn(
          "font-serif text-xl",
          isPremium && !isCurrent && "text-primary",
        )}>{f.label}</h4>
        {isCurrent && (
          <span className="font-sans text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Actuelle
          </span>
        )}
      </div>
      <div className="mb-4">
        <span className="font-serif text-2xl text-foreground">{f.prix}</span>
        <span className="font-sans text-xs text-muted-foreground ml-1">{f.periode}</span>
      </div>
      <button
        onClick={onClick}
        disabled={disabled || isCurrent}
        className={cn(
          "mt-auto w-full py-2 rounded-lg font-sans text-xs font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
          isCurrent
            ? "bg-muted text-muted-foreground"
            : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        {isCurrent ? "Formule actuelle" : "Passer à cette formule"}
      </button>
    </div>
  );
}

/* ============================================================
   MODE VENTE — aucun abonnement Stripe (comportement existant)
   ============================================================ */
function VenteAbonnement({ abo, subscribe, submitting }: {
  abo: Abonnement | null;
  subscribe: (f: Formule) => void;
  submitting: Formule | null;
}) {
  return (
    <div className="space-y-8">
      <StatusBanner abo={abo} />
      <div>
        <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-1 text-center">
          Choisissez votre formule
        </h2>
        <p className="font-sans text-sm text-muted-foreground mb-8 text-center">
          Tarifs TTC. La carte est enregistrée dès maintenant, le premier prélèvement a lieu à la fin de votre période d'essai.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PlanCard
            titre="Standard" prix="89€" periode="par mois"
            features={[
              { included: true, text: "Profil professionnel complet" },
              { included: true, text: "Galerie photo" },
              { included: true, text: "Réception de demandes de devis" },
              { included: true, text: "Statistiques basiques" },
              { included: false, text: "Badge premium" },
            ]}
            cta="Choisir Standard"
            onClick={() => subscribe("standard")}
            loading={submitting === "standard"} disabled={submitting !== null}
          />
          <PlanCard
            titre="Premium" prix="149€" periode="par mois" highlighted
            features={[
              { included: true, text: "Tout de l'offre Standard" },
              { included: true, text: "Galerie photo illimitée" },
              { included: true, text: "Badge Premium visible" },
              { included: true, text: "Statistiques avancées" },
              { included: true, text: "Support prioritaire" },
            ]}
            cta="Choisir Premium"
            onClick={() => subscribe("premium")}
            loading={submitting === "premium"} disabled={submitting !== null}
          />
          <PlanCard
            titre="Annuel" prix="948€" periode="par an (soit 79€/mois)"
            features={[
              { included: true, text: "Toutes les fonctionnalités Premium" },
              { included: true, text: "2 mois offerts" },
              { included: true, text: "Facturation annuelle unique" },
              { included: true, text: "Engagement 12 mois" },
            ]}
            cta="Choisir Annuel"
            onClick={() => subscribe("annuel")}
            loading={submitting === "annuel"} disabled={submitting !== null}
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

function StatusBanner({ abo }: { abo: Abonnement | null }) {
  const now = Date.now();
  let color: "green" | "blue" | "orange" | "gray" | "red" = "red";
  let titre = "Aucun abonnement actif";
  let sous = "Souscrivez à une formule pour être visible sur LesNoces.net.";

  if (abo) {
    const finEssai = abo.fin_essai_le ? new Date(abo.fin_essai_le).getTime() : 0;
    const enEssai = !abo.stripe_subscription_id && finEssai > now;
    if (enEssai) {
      color = "blue";
      titre = "Période d'essai en cours";
      sous = `Fin de l'essai le ${formatDate(abo.fin_essai_le)}. Souscrivez dès maintenant pour éviter toute interruption.`;
    }
  }

  const dot = { green: "bg-sauge", blue: "bg-primary", orange: "bg-terracotta", gray: "bg-muted-foreground", red: "bg-destructive" }[color];
  const wrap = { green: "bg-sauge/10 border-sauge", blue: "bg-primary/10 border-primary", orange: "bg-terracotta/10 border-terracotta", gray: "bg-muted border-border", red: "bg-destructive/10 border-destructive" }[color];

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

interface PlanCardProps {
  titre: string; prix: string; periode: string;
  features: { included: boolean; text: string }[];
  cta: string; highlighted?: boolean;
  loading: boolean; disabled: boolean; onClick: () => void;
}

function PlanCard({ titre, prix, periode, features, cta, highlighted, loading, disabled, onClick }: PlanCardProps) {
  return (
    <div className={cn(
      "rounded-xl p-6 transition-all",
      highlighted
        ? "bg-gradient-to-br from-primary to-muted text-primary-foreground shadow-xl md:scale-105 relative"
        : "bg-card border-2 border-border hover:shadow-md",
    )}>
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
            {f.included
              ? <Check size={18} className={cn("flex-shrink-0 mt-0.5", !highlighted && "text-sauge")} />
              : <X size={18} className="text-border flex-shrink-0 mt-0.5" />}
            <span className={cn("font-sans text-sm", highlighted ? "" : f.included ? "text-foreground" : "text-muted-foreground line-through")}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick} disabled={disabled}
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
