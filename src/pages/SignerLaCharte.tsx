import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, FileSignature, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";
import { cn } from "@/lib/utils";

interface ChartVersion {
  id: string;
  numero_version: string;
  titre: string;
  contenu_html: string;
  contenu_hash: string;
  entree_en_vigueur_le: string;
}

interface ArticleSection {
  num: number;
  title: string;
  titre: string;
  html: string;
}

/**
 * Parse the charter HTML into discrete article sections and engagement list (articles 1-6).
 */
function parseCharte(html: string): { articles: ArticleSection[]; engagementsTitles: string[] } {
  if (typeof window === "undefined") return { articles: [], engagementsTitles: [] };
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");

  const articles: ArticleSection[] = [];
  doc.querySelectorAll("section[data-article]").forEach((el) => {
    const num = parseInt(el.getAttribute("data-article") || "0", 10);
    if (!num) return;
    articles.push({
      num,
      title: el.getAttribute("data-title") || `Article ${num}`,
      titre: el.getAttribute("data-titre") || "",
      html: el.innerHTML,
    });
  });
  articles.sort((a, b) => a.num - b.num);

  const engagementsTitles = articles.filter((a) => a.num <= 6).map((a) => a.title);
  return { articles, engagementsTitles };
}

const COUNTDOWN_SECONDS = 3;

export default function SignerLaCharte() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [charte, setCharte] = useState<ChartVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [accepted, setAccepted] = useState(false);
  // step: -1 = intro, 0..articles.length-1 = articles, articles.length = final
  const [step, setStep] = useState(-1);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { articles, engagementsTitles } = useMemo(
    () => parseCharte(charte?.contenu_html || ""),
    [charte?.contenu_html]
  );

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

  // Article countdown reset on step change
  const isArticleStep = step >= 0 && step < articles.length;
  useEffect(() => {
    if (!isArticleStep) return;
    setCountdown(COUNTDOWN_SECONDS);
    const interval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    return () => clearInterval(interval);
  }, [step, isArticleStep]);

  const handleSign = async () => {
    if (!accepted) {
      toast.error("Vous devez confirmer avoir lu la Charte.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-charte", { body: {} });
      if (error) {
        // Détection 423 archive_locked → redirection vers /reactivation
        const ctx: any = (error as any).context;
        try {
          const text = ctx ? await ctx.text() : null;
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.code === "archive_locked") {
            navigate(`/reactivation?pid=${parsed.prestataire_id}`, { replace: true });
            return;
          }
        } catch {
          /* ignore */
        }
        throw error;
      }
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

  const handleReportLater = () => {
    toast.info("Vous pouvez signer la Charte à tout moment depuis votre espace.");
    navigate("/espace-pro");
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

  if (!charte || articles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="p-8 text-center max-w-md">
          <p className="font-sans text-muted-foreground">
            La Charte n'est pas disponible pour le moment. Veuillez réessayer plus tard.
          </p>
        </Card>
      </div>
    );
  }

  const totalSteps = articles.length;
  const isIntro = step === -1;
  const isFinal = step === articles.length;

  // Progress segments: champagne (done), gold (current), gray (upcoming)
  const ProgressBar = () => (
    <div className="flex gap-1 w-full" aria-label={`Progression : article ${step + 1} sur ${totalSteps}`}>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const state = i < step ? "done" : i === step ? "current" : "upcoming";
        return (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              state === "current" && "bg-primary",
              state === "done" && "bg-[#E8D9B8]",
              state === "upcoming" && "bg-muted"
            )}
          />
        );
      })}
    </div>
  );

  return (
    <>
      <SeoHead
        title="Signer la Charte Qualité | LesNoces.net"
        description="Signature électronique de la Charte Qualité prestataire LesNoces.net"
        noindex
        canonicalUrl="/signer-la-charte"
      />
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-3xl mx-auto">

          {/* INTRO */}
          {isIntro && (
            <Card className="p-8 md:p-12 space-y-6">
              <header className="text-center space-y-3">
                <FileSignature className="h-10 w-10 text-primary mx-auto" />
                <h1 className="font-serif text-3xl md:text-4xl">{charte.titre}</h1>
                <p className="font-sans text-sm text-muted-foreground">
                  Version {charte.numero_version} — en vigueur depuis le{" "}
                  {new Date(charte.entree_en_vigueur_le).toLocaleDateString("fr-FR")}
                </p>
              </header>

              <div className="bg-[#FBF6EB] border border-[#E8D9B8] rounded-lg p-6 space-y-3">
                <h2 className="font-serif text-xl">Les 6 engagements en bref</h2>
                <ol className="font-sans text-[15px] leading-relaxed space-y-2 list-decimal list-inside">
                  {engagementsTitles.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>

              <p className="font-sans text-sm text-muted-foreground">
                La Charte se compose de <strong>{totalSteps} articles</strong> organisés en trois titres.
                Vous allez les parcourir un par un. Prenez le temps de tout lire :
                votre signature engage votre responsabilité contractuelle.
              </p>

              <div className="flex flex-col gap-3 pt-2">
                <Button onClick={() => setStep(0)} size="lg" className="w-full">
                  Commencer la lecture
                </Button>
                <button
                  onClick={handleReportLater}
                  className="font-sans text-sm text-[#1F4E5F] hover:underline self-center"
                >
                  J'accède tout de suite à mon espace, je signerai la Charte Qualité plus tard
                </button>
              </div>
            </Card>
          )}

          {/* ARTICLE STEPS */}
          {isArticleStep && (
            <Card className="p-6 md:p-10 space-y-6">
              <div className="space-y-2">
                <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
                  {articles[step].titre}
                </p>
                <h2 className="font-serif text-2xl md:text-3xl">
                  Article {articles[step].num} — {articles[step].title}
                </h2>
                <ProgressBar />
                <p className="font-sans text-xs text-muted-foreground text-right">
                  {step + 1} / {totalSteps}
                </p>
              </div>

              <div
                ref={scrollRef}
                className="prose prose-base md:prose-lg max-w-none font-sans text-[18px] leading-relaxed"
                style={{ lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{
                  __html: articles[step].html
                    // Strip the duplicate H3 already rendered above
                    .replace(/^\s*<h3[^>]*>[\s\S]*?<\/h3>/i, ""),
                }}
              />

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(-1, s - 1))}
                  className="font-sans"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {step === 0 ? "Introduction" : "Article précédent"}
                </Button>

                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={countdown > 0}
                  size="lg"
                >
                  {countdown > 0 ? (
                    <>Patientez ({countdown})</>
                  ) : (
                    <>
                      {step === totalSteps - 1 ? "Signer la Charte Qualité" : "Article suivant"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* FINAL */}
          {isFinal && (
            <Card className="p-8 md:p-12 space-y-6">
              <header className="text-center space-y-3">
                <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
                <h1 className="font-serif text-3xl">Signer la Charte Qualité de LesNoces.net</h1>
                <p className="font-sans text-sm text-muted-foreground">
                  Vous avez parcouru les <strong>{totalSteps} articles</strong> de la Charte Qualité.
                </p>
              </header>

              <div className="bg-[#FBF6EB] border border-[#E8D9B8] rounded-lg p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="font-sans text-sm">
                    J'ai lu intégralement la Charte Qualité et j'en accepte sans réserve
                    l'ensemble des stipulations. Je comprends que ma signature électronique
                    a la même valeur qu'une signature manuscrite (art. 1366 du Code civil).
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSign}
                  disabled={!accepted || submitting}
                  size="lg"
                  className="w-full"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Je signe la Charte Qualité de LesNoces.net
                </Button>
                <button
                  onClick={handleReportLater}
                  className="font-sans text-sm text-[#1F4E5F] hover:underline self-center"
                >
                  J'accède tout de suite à mon espace, je signerai la Charte Qualité plus tard
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Votre adresse IP, navigateur et horodatage seront enregistrés comme preuve.
              </p>

              <div className="text-center pt-2">
                <button
                  onClick={() => setStep(totalSteps - 1)}
                  className="font-sans text-xs text-muted-foreground hover:text-foreground inline-flex items-center"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Revenir au dernier article
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
