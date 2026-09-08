import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, Loader2, ChevronDown, ChevronUp, FileText, AlertTriangle, Clock, ExternalLink, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import FacturesList from "@/components/facturation/FacturesList";
import {
  dateRetourTarifNormal,
  formatDateFr,
  formatEuros,
  type PromoEligibilite,
  usePromoLancement,
} from "@/hooks/usePromoLancement";

type Formule = "standard" | "premium";
type Periodicite = "mensuel" | "annuel";
type PlanKey = "standard_mensuel" | "standard_annuel" | "premium_mensuel" | "premium_annuel";

interface Abonnement {
  id: string;
  plan: string;
  formule: string | null;
  periodicite: string | null;
  statut: string;
  montant_cents: number | null;
  fin_essai_le: string | null;
  fin_periode_le: string | null;
  cancel_at_period_end: boolean;
  suspendu_pour_impaye_le: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  carte_brand: string | null;
  carte_last4: string | null;
  plan_pending: string | null;
  plan_pending_le: string | null;
  stripe_schedule_id: string | null;
  promo_active?: boolean | null;
  promo_fin_le?: string | null;
}

function formatCarte(brand: string | null, last4: string | null): string | null {
  if (!last4) return null;
  const label = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1)
    : "Carte";
  return `${label} •••• ${last4}`;
}

interface PlanInfo {
  key: PlanKey;
  formule: Formule;
  periodicite: Periodicite;
  label: string;
  prix: string;
  periode: string;
  equivalent?: string;
  economie?: string;
}

const PLANS: Record<PlanKey, PlanInfo> = {
  standard_mensuel: {
    key: "standard_mensuel", formule: "standard", periodicite: "mensuel",
    label: "Standard", prix: "89€", periode: "par mois",
  },
  standard_annuel: {
    key: "standard_annuel", formule: "standard", periodicite: "annuel",
    label: "Standard", prix: "948€", periode: "par an",
    equivalent: "soit 79€ / mois", economie: "2 mois offerts",
  },
  premium_mensuel: {
    key: "premium_mensuel", formule: "premium", periodicite: "mensuel",
    label: "Premium", prix: "149€", periode: "par mois",
  },
  premium_annuel: {
    key: "premium_annuel", formule: "premium", periodicite: "annuel",
    label: "Premium", prix: "1 590€", periode: "par an",
    equivalent: "soit 132,50€ / mois", economie: "2 mois offerts",
  },
};

function planKeyOf(formule: Formule, periodicite: Periodicite): PlanKey {
  return `${formule}_${periodicite}` as PlanKey;
}

/** Traduit le `plan` stocké en base (valeurs historiques comprises) vers une clé de plan. */
function planToKey(plan: string | null | undefined): PlanKey | null {
  if (!plan) return null;
  if (plan in PLANS) return plan as PlanKey;
  if (plan === "annuel") return "standard_annuel";
  if (plan === "mensuel" || plan === "essai") return "standard_mensuel";
  return null;
}

/** Clé de plan dérivée en priorité des colonnes formule + periodicite. */
function aboPlanKey(abo: Abonnement): PlanKey | null {
  if (abo.formule === "standard" || abo.formule === "premium") {
    const per: Periodicite = abo.periodicite === "annuel" ? "annuel" : "mensuel";
    return planKeyOf(abo.formule, per);
  }
  return planToKey(abo.plan);
}

function planLabelComplet(key: PlanKey): string {
  const p = PLANS[key];
  return `${p.label} ${p.periodicite === "annuel" ? "annuel" : "mensuel"}`;
}

/* ---------- Tableau comparatif ---------- */
type Cell = boolean | string;
const COMPARATIF: { titre: string; lignes: { label: string; standard: Cell; premium: Cell }[] }[] = [
  {
    titre: "Votre visibilité",
    lignes: [
      { label: "Fiche prestataire complète", standard: true, premium: true },
      { label: "Présence dans la recherche et les pages régions", standard: true, premium: true },
      { label: "Badge Premium sur votre fiche et vos résultats", standard: false, premium: true },
      { label: "Mise en avant dans les coups de cœur régionaux", standard: false, premium: true },
    ],
  },
  {
    titre: "Votre vitrine",
    lignes: [
      { label: "Galerie photos", standard: true, premium: true },
      { label: "Description détaillée et services", standard: true, premium: true },
      { label: "Zones d'intervention multiples", standard: true, premium: true },
    ],
  },
  {
    titre: "Vos contacts",
    lignes: [
      { label: "Demandes de devis illimitées", standard: true, premium: true },
      { label: "Messagerie intégrée", standard: true, premium: true },
      { label: "Avis clients vérifiés", standard: true, premium: true },
    ],
  },
  {
    titre: "Suivi et accompagnement",
    lignes: [
      { label: "Statistiques de consultation", standard: "Basiques", premium: "Avancées" },
      { label: "Support", standard: "Standard", premium: "Prioritaire" },
    ],
  },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatMontant(cents: number | null, key: PlanKey | null): string {
  if (cents != null) {
    const eur = cents / 100;
    return eur % 1 === 0 ? `${eur}€` : `${eur.toFixed(2)}€`;
  }
  return key ? PLANS[key].prix : "";
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

/** Champs qui bougent après un changement d'abonnement (webhook Stripe). */
function signature(a: Abonnement | null): string {
  if (!a) return "none";
  return [
    a.plan, a.formule, a.periodicite, a.statut, a.montant_cents,
    a.plan_pending, a.plan_pending_le, a.stripe_schedule_id,
    a.cancel_at_period_end, a.fin_periode_le, a.carte_last4, a.stripe_payment_method_id,
  ].join("|");
}

export default function PrestataireAbonnement() {
  const { prestataire, refetch: refetchPrestataire } = useSharedPrestataire();
  const [abo, setAbo] = useState<Abonnement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<PlanKey | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [manualRedirect, setManualRedirect] = useState<{ url: string; mode: "checkout" | "portal"; planKey?: PlanKey } | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { promo } = usePromoLancement(prestataire?.id);
  const promoEligible = promo?.eligible === true;

  const fetchAbo = useCallback(async () => {
    if (!prestataire?.id) return null;
    const { data } = await supabase
      .from("abonnements")
      .select("id, plan, formule, periodicite, statut, montant_cents, fin_essai_le, fin_periode_le, cancel_at_period_end, suspendu_pour_impaye_le, stripe_subscription_id, stripe_customer_id, stripe_payment_method_id, carte_brand, carte_last4, plan_pending, plan_pending_le, stripe_schedule_id, promo_active, promo_fin_le")
      .eq("prestataire_id", prestataire.id)
      .maybeSingle();
    const next = (data as Abonnement | null) ?? null;
    setAbo(next);
    return next;
  }, [prestataire?.id]);

  /**
   * Recharge l'abonnement jusqu'à ce que le webhook Stripe ait écrit les
   * nouvelles valeurs (jusqu'à ~20s), puis rafraîchit la fiche prestataire
   * (badge Premium dérivé en base).
   */
  const refreshAfterChange = useCallback(async (before: Abonnement | null) => {
    const ref = signature(before);
    setSyncing(true);
    const delays = [0, 1500, 3000, 5000, 10000];
    try {
      for (const d of delays) {
        if (d) await new Promise((r) => setTimeout(r, d));
        const next = await fetchAbo();
        if (signature(next) !== ref) break;
      }
      await refetchPrestataire();
    } finally {
      setSyncing(false);
    }
  }, [fetchAbo, refetchPrestataire]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let hasChanged = false;
    const statut = searchParams.get("statut");
    if (statut === "succes") {
      toast({
        title: "Abonnement activé",
        description: "Votre abonnement démarre dès aujourd'hui.",
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

  // Au retour de Stripe Checkout, on attend l'écriture du webhook.
  const retourCheckout = searchParams.get("statut") === "succes";
  const retourTraiteRef = useRef(false);
  useEffect(() => {
    if (!retourCheckout || retourTraiteRef.current || !prestataire?.id) return;
    retourTraiteRef.current = true;
    refreshAfterChange(null);
  }, [retourCheckout, prestataire?.id, refreshAfterChange]);

  useEffect(() => {
    if (!prestataire?.id) return;
    (async () => {
      await fetchAbo();
      setLoading(false);
    })();
  }, [prestataire?.id, fetchAbo]);

  async function subscribe(key: PlanKey) {
    const plan = PLANS[key];

    // Blocage impayé côté UI (le back renforce)
    if (abo?.statut === "en_retard") {
      toast({
        title: "Régularisez d'abord votre paiement",
        description: "Utilisez « Modifier mon moyen de paiement » pour rétablir la facturation avant de changer de formule.",
        variant: "destructive",
      });
      return;
    }

    const before = abo;
    setSubmitting(key);
    setManualRedirect(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { formule: plan.formule, periodicite: plan.periodicite, use_promo: promoEligible },
      });
      if (error) throw error;

      if (data?.error === "promo_non_eligible") {
        toast({
          title: "Offre de lancement expirée",
          description: data?.message ?? "Vous n'êtes plus éligible à l'offre de lancement.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error === "unpaid_subscription") {
        toast({
          title: "Paiement en attente",
          description: data?.message ?? "Régularisez votre paiement avant de changer de formule.",
          variant: "destructive",
        });
        return;
      }

      if (data?.changed === true) {
        const mode = data.mode as string | undefined;
        if (mode === "downgrade_scheduled" || mode === "periodicite_scheduled" || mode === "downgrade") {
          const dateStr = data.plan_pending_le
            ? new Date(data.plan_pending_le).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
            : "la fin de la période en cours";
          toast({
            title: "Changement programmé",
            description: `La bascule vers ${planLabelComplet(key)} s'effectuera le ${dateStr}, sans avoir.`,
          });
        } else if (mode === "schedule_cancelled") {
          toast({ title: "Changement annulé", description: "Le changement de formule programmé a été annulé." });
        } else {
          toast({ title: "Formule mise à jour", description: "Votre abonnement a été modifié avec proration immédiate." });
        }
        setSubmitting(null);
        await refreshAfterChange(before);
        return;
      }
      if (data?.changed === false) {
        toast({ title: "Aucun changement", description: data?.message ?? "Vous êtes déjà sur cette formule." });
        return;
      }

      // Cas 2 : nouvelle souscription → redirection vers Checkout Stripe.
      const stripeUrl = data?.url as string | undefined;
      if (!stripeUrl) throw new Error("URL de paiement introuvable");

      setManualRedirect({ url: stripeUrl, mode: "checkout", planKey: key });

      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = stripeUrl;
        } else {
          window.location.href = stripeUrl;
        }
      } catch {
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

  const [openingPortal, setOpeningPortal] = useState(false);
  const portalWatchRef = useRef<{ cleanup: () => void } | null>(null);

  // Rafraîchit l'abo au retour d'onglet, en 3 tentatives échelonnées, jusqu'à
  // détecter un changement sur les champs qui bougent après une action portail.
  const armPortalWatch = useCallback(() => {
    if (!abo) return;
    portalWatchRef.current?.cleanup();

    const ref = signature(abo);
    let attempts = 0;
    let disposed = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;

    const disarm = () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (scheduled) clearTimeout(scheduled);
      portalWatchRef.current = null;
    };

    const tick = async () => {
      const next = await fetchAbo();
      if (signature(next) !== ref) {
        toast({ title: "Abonnement mis à jour", description: "Vos changements Stripe sont pris en compte." });
        await refetchPrestataire();
        disarm();
        return;
      }
      attempts++;
      if (attempts >= 3) {
        disarm();
        return;
      }
      const delay = attempts === 1 ? 4000 : 10000;
      scheduled = setTimeout(tick, delay);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" && !document.hasFocus()) return;
      if (attempts > 0) return;
      tick();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    portalWatchRef.current = { cleanup: disarm };

    setTimeout(() => disarm(), 60000);
  }, [abo, fetchAbo, refetchPrestataire]);

  useEffect(() => () => portalWatchRef.current?.cleanup(), []);

  async function openStripePortal() {
    if (openingPortal) return;
    setOpeningPortal(true);
    setManualRedirect(null);

    const newTab = window.open("about:blank", "_blank");

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-portal-session");
      if (error) throw error;
      const portalUrl = data?.url as string | undefined;
      if (!portalUrl) throw new Error("URL du portail introuvable");

      if (newTab && !newTab.closed) {
        try { newTab.opener = null; } catch { /* noop */ }
        newTab.location.href = portalUrl;
        toast({
          title: "Portail Stripe ouvert",
          description: "Terminez vos modifications dans le nouvel onglet. Cette page se mettra à jour automatiquement à votre retour.",
        });
        armPortalWatch();
      } else {
        setManualRedirect({ url: portalUrl, mode: "portal" });
      }
    } catch (e) {
      if (newTab && !newTab.closed) {
        try { newTab.close(); } catch { /* noop */ }
      }
      const message = e instanceof Error ? e.message : "Impossible d'ouvrir le portail de gestion";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setOpeningPortal(false);
    }
  }

  async function cancelScheduledChange() {
    if (cancellingSchedule) return;
    const before = abo;
    setCancellingSchedule(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-cancel-scheduled-change");
      if (error) throw error;
      toast({ title: "Changement annulé", description: "Votre formule actuelle est conservée." });
      await refreshAfterChange(before);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Impossible d'annuler le changement programmé";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setCancellingSchedule(false);
    }
  }

  const hasSubscription = !!(abo && abo.stripe_subscription_id);
  const portalDisabled = !abo?.stripe_customer_id;

  if (loading) {
    return <div className="bg-muted rounded-lg p-5 h-40 animate-pulse" />;
  }

  return (
    <>
      {manualRedirect && <StripeRedirectNotice url={manualRedirect.url} mode={manualRedirect.mode} planKey={manualRedirect.planKey} />}
      {syncing && <SyncingNotice />}
      {abo?.promo_active && abo?.promo_fin_le && (
        <PromoActiveBanner finLe={abo.promo_fin_le} />
      )}
      {hasSubscription && abo ? (
        <GestionAbonnement
          abo={abo}
          showChange={showChange}
          setShowChange={setShowChange}
          subscribe={subscribe}
          submitting={submitting}
          openStripePortal={openStripePortal}
          portalDisabled={portalDisabled}
          openingPortal={openingPortal}
          cancelScheduledChange={cancelScheduledChange}
          cancellingSchedule={cancellingSchedule}
          busy={syncing}
        />
      ) : (
        <VenteAbonnement abo={abo} subscribe={subscribe} submitting={submitting} busy={syncing} promo={promo} />
      )}
    </>
  );
}

function SyncingNotice() {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <p className="font-sans text-sm text-foreground">
        Mise à jour de votre abonnement en cours…
      </p>
    </div>
  );
}

function StripeRedirectNotice({ url, mode, planKey }: { url: string; mode: "checkout" | "portal"; planKey?: PlanKey }) {
  const isPortal = mode === "portal";
  const title = isPortal ? "Portail Stripe prêt" : "Redirection Stripe prête";
  const desc = isPortal
    ? "Votre navigateur a bloqué l'ouverture automatique. Cliquez ci-contre pour ouvrir le portail."
    : `Continuez vers Stripe pour passer à la formule ${planKey ? planLabelComplet(planKey) : ""}.`;
  return (
    <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-sans text-sm font-semibold text-foreground">{title}</p>
          <p className="font-sans text-xs text-muted-foreground">{desc}</p>
        </div>
        <a
          href={url}
          target={isPortal ? "_blank" : "_top"}
          rel={isPortal ? "noopener noreferrer" : undefined}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isPortal ? "Ouvrir le portail" : "Continuer vers Stripe"}
          {isPortal && <ExternalLink size={14} />}
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   SÉLECTEUR MENSUEL / ANNUEL
   ============================================================ */
function PeriodiciteToggle({ value, onChange }: { value: Periodicite; onChange: (p: Periodicite) => void }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
        {(["mensuel", "annuel"] as Periodicite[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-pressed={value === p}
            className={cn(
              "rounded-full px-4 py-1.5 font-sans text-xs font-semibold transition-colors",
              value === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "mensuel" ? "Mensuel" : "Annuel"}
            {p === "annuel" && (
              <span className={cn("ml-1.5 text-[10px] uppercase tracking-wider", value === p ? "text-primary-foreground/80" : "text-primary")}>
                −2 mois
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   TABLEAU COMPARATIF
   ============================================================ */
function CellValue({ value, accent }: { value: Cell; accent?: boolean }) {
  if (value === true) return <Check size={18} className={cn("mx-auto", accent ? "text-primary" : "text-sauge")} aria-label="Inclus" />;
  if (value === false) return <Minus size={16} className="mx-auto text-border" aria-label="Non inclus" />;
  return <span className="font-sans text-xs text-foreground">{value}</span>;
}

function ComparatifFormules() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">Comparaison des formules Standard et Premium</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="px-4 py-3 text-left font-sans text-xs uppercase tracking-wider text-muted-foreground">
              Ce qui est inclus
            </th>
            <th scope="col" className="w-24 px-2 py-3 text-center font-serif text-base text-foreground sm:w-32">Standard</th>
            <th scope="col" className="w-24 px-2 py-3 text-center font-serif text-base text-primary sm:w-32">Premium</th>
          </tr>
        </thead>
        <tbody>
          {COMPARATIF.map((groupe) => (
            <Fragment key={groupe.titre}>
              <tr className="bg-muted/20">
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="px-4 py-2 text-left font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {groupe.titre}
                </th>
              </tr>
              {groupe.lignes.map((l) => (
                <tr key={l.label} className="border-t border-border/60">
                  <th scope="row" className="px-4 py-3 text-left font-sans text-sm font-normal text-foreground">
                    {l.label}
                  </th>
                  <td className="px-2 py-3 text-center">
                    <CellValue value={l.standard} />
                  </td>
                  <td className="bg-primary/5 px-2 py-3 text-center">
                    <CellValue value={l.premium} accent />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   GRILLE 2 FORMULES + SÉLECTEUR
   ============================================================ */
function GrilleFormules({
  periodicite, setPeriodicite, currentKey, pendingKey, submitting, disabled, subscribe, compact, promo,
}: {
  periodicite: Periodicite;
  setPeriodicite: (p: Periodicite) => void;
  currentKey: PlanKey | null;
  pendingKey: PlanKey | null;
  submitting: PlanKey | null;
  disabled: boolean;
  subscribe: (k: PlanKey) => void;
  compact?: boolean;
  promo?: PromoEligibilite | null;
}) {
  const keys: PlanKey[] = [planKeyOf("standard", periodicite), planKeyOf("premium", periodicite)];
  return (
    <div className="space-y-5">
      <PeriodiciteToggle value={periodicite} onChange={setPeriodicite} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {keys.map((k) => (
          <PlanCard
            key={k}
            plan={PLANS[k]}
            isCurrent={currentKey === k}
            isPending={pendingKey === k}
            loading={submitting === k}
            disabled={disabled}
            onClick={() => subscribe(k)}
            compact={compact}
            prixPromo={promo?.eligible ? promo.prix_promo?.[k] : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Bandeaux de l'offre de lancement ---------- */
function PromoOffreBanner({ promo }: { promo: PromoEligibilite }) {
  const jours = promo.jours_restants ?? 0;
  return (
    <div className="rounded-lg border-l-4 border-primary bg-primary/10 p-5">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 shrink-0 text-primary" size={20} />
        <div>
          <h3 className="mb-1 font-serif text-lg text-foreground">
            Offre de lancement — jusqu'à -45 % pendant 1 an
          </h3>
          <p className="font-sans text-sm text-muted-foreground">
            {jours > 0
              ? `Il vous reste ${jours} jour${jours > 1 ? "s" : ""} pour en profiter (jusqu'au ${formatDateFr(promo.date_limite)}).`
              : `Dernier jour pour en profiter (jusqu'au ${formatDateFr(promo.date_limite)}).`}
            {" "}Le tarif remisé s'applique pendant 12 mois, puis votre abonnement revient automatiquement au tarif normal.
          </p>
        </div>
      </div>
    </div>
  );
}

function PromoActiveBanner({ finLe }: { finLe: string }) {
  return (
    <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="font-sans text-sm text-foreground">
        Vous bénéficiez de l'offre de lancement jusqu'au {formatDateFr(finLe)}.
        Au-delà, votre abonnement passe automatiquement au tarif normal.
      </p>
    </div>
  );
}

function PlanCard({ plan, isCurrent, isPending, loading, disabled, onClick, compact, prixPromo }: {
  plan: PlanInfo;
  isCurrent: boolean;
  isPending: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
  prixPromo?: number;
}) {
  const isPremium = plan.formule === "premium";
  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border p-5 transition-all",
      compact ? "p-5" : "p-6",
      isCurrent ? "border-primary bg-primary/5" : isPremium ? "border-primary/40 bg-card shadow-sm" : "border-border bg-card",
      isPending && !isCurrent && "border-primary/60 bg-primary/5",
    )}>
      {isPremium && !isCurrent && !isPending && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Recommandé
        </span>
      )}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className={cn("font-serif text-xl", isPremium && "text-primary")}>{plan.label}</h3>
        {isCurrent && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-primary">
            Actuelle
          </span>
        )}
        {isPending && !isCurrent && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-primary">
            Programmée
          </span>
        )}
      </div>

      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="font-serif text-3xl text-foreground">{plan.prix}</span>
        <span className="font-sans text-xs text-muted-foreground">{plan.periode}</span>
      </div>
      <p className="mb-4 font-sans text-xs text-muted-foreground">
        {plan.equivalent ? `${plan.equivalent} · ${plan.economie}` : "TTC, sans engagement"}
      </p>

      <ul className="mb-5 space-y-2">
        {(isPremium
          ? ["Tout ce que contient Standard", "Badge Premium et position prioritaire", "Mise en avant régionale", "Statistiques avancées", "Support prioritaire"]
          : ["Fiche complète et galerie photos", "Demandes de devis illimitées", "Messagerie et avis clients", "Statistiques de consultation"]
        ).map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check size={16} className={cn("mt-0.5 flex-shrink-0", isPremium ? "text-primary" : "text-sauge")} />
            <span className="font-sans text-sm text-foreground">{t}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={disabled || isCurrent || isPending || loading}
        className={cn(
          "mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-sans text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60",
          isCurrent || isPending
            ? "bg-muted text-muted-foreground"
            : isPremium
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isCurrent ? "Formule actuelle" : isPending ? "Programmée" : `Choisir ${plan.label}`}
      </button>
    </div>
  );
}

/* ============================================================
   MODE GESTION — un abonnement existe
   ============================================================ */
function GestionAbonnement({
  abo, showChange, setShowChange, subscribe, submitting, openStripePortal,
  portalDisabled, openingPortal, cancelScheduledChange, cancellingSchedule, busy,
}: {
  abo: Abonnement;
  showChange: boolean;
  setShowChange: (v: boolean) => void;
  subscribe: (k: PlanKey) => void;
  submitting: PlanKey | null;
  openStripePortal: () => void;
  portalDisabled: boolean;
  openingPortal: boolean;
  cancelScheduledChange: () => void;
  cancellingSchedule: boolean;
  busy: boolean;
}) {
  const { prestataire } = useSharedPrestataire();
  const etat = deriveEtat(abo);
  const currentKey = aboPlanKey(abo);
  const plan = currentKey ? PLANS[currentKey] : null;
  const isEchec = etat.key === "echec";

  const pendingKey = planToKey(abo.plan_pending);
  const hasPendingChange = !!pendingKey && !!abo.plan_pending_le;

  const changeBlocked = abo.statut === "en_retard";
  const [periodicite, setPeriodicite] = useState<Periodicite>(
    currentKey ? PLANS[currentKey].periodicite : "mensuel",
  );

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
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
              Votre abonnement
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight">
              {currentKey ? planLabelComplet(currentKey) : abo.plan}
            </h2>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl md:text-5xl text-foreground">
              {formatMontant(abo.montant_cents, currentKey)}
            </span>
            <span className="font-sans text-sm text-muted-foreground">
              {plan?.periode}
            </span>
            <span className="font-sans text-xs text-muted-foreground ml-1">TTC</span>
          </div>

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

          {hasPendingChange && (
            <div className="flex items-start gap-3 rounded-lg p-4 bg-background/70 border border-primary/40">
              <Clock className="text-primary shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="font-sans font-semibold text-sm text-foreground mb-0.5">
                  Changement de formule programmé
                </p>
                <p className="font-sans text-sm text-muted-foreground">
                  Passage à la formule <strong>{planLabelComplet(pendingKey!)}</strong> le {formatDate(abo.plan_pending_le)}.
                </p>
                <button
                  onClick={cancelScheduledChange}
                  disabled={cancellingSchedule}
                  className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-muted-foreground hover:text-destructive underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-50"
                >
                  {cancellingSchedule && <Loader2 className="h-3 w-3 animate-spin" />}
                  Annuler ce changement
                </button>
              </div>
            </div>
          )}

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
            onClick={openStripePortal}
            icon={<CreditCard size={18} />}
            label="Modifier mon moyen de paiement"
            highlight={isEchec}
            disabled={portalDisabled || openingPortal}
            loading={openingPortal}
          />
          <ActionButton
            onClick={openStripePortal}
            icon={<FileText size={18} />}
            label="Consulter mes factures"
            disabled={portalDisabled || openingPortal}
            loading={openingPortal}
          />
        </div>

        <div className="pt-2">
          <button
            onClick={openStripePortal}
            disabled={portalDisabled || openingPortal}
            className="w-full sm:w-auto font-sans text-xs text-muted-foreground hover:text-destructive underline underline-offset-4 decoration-dotted transition-colors py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              Comparer Standard et Premium, et choisir un paiement mensuel ou annuel.
            </p>
          </div>
          {showChange
            ? <ChevronUp className="text-muted-foreground group-hover:text-foreground shrink-0" size={20} />
            : <ChevronDown className="text-muted-foreground group-hover:text-foreground shrink-0" size={20} />}
        </button>

        {showChange && (
          <div className="mt-5 space-y-6">
            {changeBlocked && (
              <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-4">
                <p className="font-sans text-sm font-semibold text-foreground mb-1">
                  Régularisez votre paiement avant de changer de formule
                </p>
                <p className="font-sans text-xs text-muted-foreground">
                  Utilisez « Modifier mon moyen de paiement » pour rétablir la facturation. Le changement de formule sera de nouveau disponible ensuite.
                </p>
              </div>
            )}
            <GrilleFormules
              periodicite={periodicite}
              setPeriodicite={setPeriodicite}
              currentKey={currentKey}
              pendingKey={pendingKey}
              submitting={submitting}
              disabled={submitting !== null || changeBlocked || busy}
              subscribe={subscribe}
              compact
            />
            <p className="font-sans text-xs text-muted-foreground">
              Passage à Premium ou à l'annuel : effectif immédiatement, avec ajustement au prorata.
              Retour à Standard ou au mensuel : effectif à la fin de la période déjà payée.
            </p>
            <ComparatifFormules />
          </div>
        )}
      </section>

      <FacturesList prestataireId={prestataire?.id} />
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

function ActionButton({ onClick, icon, label, highlight, disabled, loading }: { onClick: () => void; icon: React.ReactNode; label: string; highlight?: boolean; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-all font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed",
        highlight
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm"
          : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5",
      )}
    >
      <span className={cn(highlight ? "text-primary-foreground" : "text-primary")}>
        {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

/* ============================================================
   MODE VENTE — aucun abonnement Stripe
   ============================================================ */
function VenteAbonnement({ abo, subscribe, submitting, busy, promo }: {
  abo: Abonnement | null;
  subscribe: (k: PlanKey) => void;
  submitting: PlanKey | null;
  busy: boolean;
  promo?: PromoEligibilite | null;
}) {
  const [periodicite, setPeriodicite] = useState<Periodicite>("mensuel");
  const promoActive = promo?.eligible === true ? promo : null;
  return (
    <div className="space-y-8">
      <StatusBanner abo={abo} />
      {promoActive && <PromoOffreBanner promo={promoActive} />}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-1">
            Choisissez votre formule
          </h2>
          <p className="font-sans text-sm text-muted-foreground">
            Tarifs TTC. Votre période d'essai prend fin dès la souscription : la facturation démarre aujourd'hui.
          </p>

        </div>

        <GrilleFormules
          periodicite={periodicite}
          setPeriodicite={setPeriodicite}
          currentKey={null}
          pendingKey={null}
          submitting={submitting}
          disabled={submitting !== null || busy}
          subscribe={subscribe}
          promo={promoActive}
        />

        <ComparatifFormules />
      </div>

      <div className="bg-background rounded-lg p-5 border border-border">
        <div className="flex items-start gap-3">
          <CreditCard className="text-primary flex-shrink-0" size={22} />
          <div>
            <h4 className="font-sans font-semibold text-foreground text-sm mb-1">
              Paiement sécurisé par Stripe
            </h4>
            <p className="font-sans text-xs text-muted-foreground">
              Vos informations de paiement sont protégées et cryptées. Le premier prélèvement a lieu à la souscription.
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
      sous = `Fin de l'essai le ${formatDate(abo.fin_essai_le)}. En souscrivant maintenant, votre essai prend fin immédiatement et la facturation démarre aujourd'hui.`;
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
