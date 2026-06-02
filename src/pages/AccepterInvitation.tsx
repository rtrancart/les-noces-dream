import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

type Step = "intro" | "verifying" | "form" | "error";
type ErrorKind = "missing" | "expired" | "consumed" | "invalid" | "unknown";

/**
 * /accept-invitation?token=<jwt>
 *
 * Custom invitation flow (replaces Supabase native magic link).
 *
 * Why a CTA-gated flow:
 *   Gmail / Outlook / corporate scanners issue a GET to every URL in an email
 *   before the user can click. A passive auto-consume would let the scanner
 *   burn the single-use jti. We therefore:
 *     1. Show a "Welcome, click to activate" screen on mount (no token POST).
 *     2. Only POST the token when the user clicks the activation button.
 *     3. The Edge Function verifies HMAC, marks jti consumed atomically,
 *        and returns access/refresh tokens we plug into supabase.auth.
 */
export default function AccepterInvitation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [step, setStep] = useState<Step>(() => (token ? "intro" : "error"));
  const [errorKind, setErrorKind] = useState<ErrorKind>(token ? "invalid" : "missing");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cgu, setCgu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!token) return;
    setStep("verifying");
    try {
      const { data, error } = await supabase.functions.invoke("auth-verify-email-token", {
        body: { token },
      });
      if (error) {
        // Edge fn returned non-2xx — try to parse body via the FunctionsHttpError
        const ctx: any = (error as any).context;
        let payload: any = null;
        try { payload = await ctx?.json?.(); } catch { /* noop */ }
        const kind = mapError(payload?.error);
        setErrorKind(kind);
        setErrorDetail(payload?.detail ?? null);
        setStep("error");
        return;
      }
      if (!data?.access_token || !data?.refresh_token) {
        setErrorKind("invalid");
        setStep("error");
        return;
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) {
        setErrorKind("invalid");
        setErrorDetail(sessErr.message);
        setStep("error");
        return;
      }
      setEmail(data.user?.email ?? null);
      setStep("form");
    } catch (e: any) {
      setErrorKind("unknown");
      setErrorDetail(String(e?.message ?? e));
      setStep("error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) return setFormError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setFormError("Les mots de passe ne correspondent pas.");
    if (!cgu) return setFormError("Vous devez accepter les CGU pour continuer.");

    setSubmitting(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            cgu_acceptees_le: new Date().toISOString(),
            cgu_version_acceptee: "v1.0",
          })
          .eq("id", user.id);

        await supabase
          .from("prestataires")
          .update({
            magic_link_ouvert: true,
            premier_login_le: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .is("premier_login_le", null);
      }

      toast.success("Compte activé. Place à la signature de la Charte.");
      navigate("/signer-la-charte", { replace: true });
    } catch (err: any) {
      setFormError(err?.message ?? "Erreur lors de l'activation du compte.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead
        title="Activer mon compte | LesNoces.net"
        description="Activation du compte prestataire LesNoces.net"
        noindex
        canonicalUrl="/accept-invitation"
      />
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md p-8 space-y-6">
          {step === "intro" && (
            <IntroScreen onActivate={handleActivate} />
          )}

          {step === "verifying" && (
            <div className="text-center space-y-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="font-sans text-sm text-muted-foreground">Activation en cours…</p>
            </div>
          )}

          {step === "form" && (
            <>
              <header className="space-y-2 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h1 className="font-serif text-2xl">Bienvenue sur LesNoces.net</h1>
                <p className="font-sans text-sm text-muted-foreground">
                  {email ? <>Vous êtes connecté en tant que <strong>{email}</strong>.</> : null} Choisissez
                  votre mot de passe pour activer votre compte.
                </p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8} required autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required autoComplete="new-password"
                  />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox" checked={cgu}
                    onChange={(e) => setCgu(e.target.checked)} className="mt-1"
                  />
                  <span className="text-muted-foreground">
                    J'accepte les{" "}
                    <a href="/cgu" target="_blank" rel="noopener" className="text-primary underline">
                      Conditions Générales d'Utilisation
                    </a>.
                  </span>
                </label>

                {formError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Activer mon compte et signer la Charte
                </Button>
              </form>
            </>
          )}

          {step === "error" && (
            <ErrorScreen kind={errorKind} detail={errorDetail} />
          )}
        </Card>
      </div>
    </>
  );
}

function IntroScreen({ onActivate }: { onActivate: () => void }) {
  return (
    <>
      <header className="space-y-2 text-center">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <h1 className="font-serif text-2xl">Bienvenue sur LesNoces.net</h1>
        <p className="font-sans text-sm text-muted-foreground">
          Votre invitation est valide. Cliquez ci-dessous pour activer votre espace
          prestataire et définir votre mot de passe.
        </p>
      </header>
      <Button className="w-full" onClick={onActivate}>
        Activer mon compte
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Ce lien est à usage unique et expire après 7 jours.
      </p>
    </>
  );
}

function ErrorScreen({ kind, detail }: { kind: ErrorKind; detail: string | null }) {
  const content = useMemo(() => {
    switch (kind) {
      case "missing":
        return { title: "Lien invalide", body: "Le lien d'invitation est incomplet. Vérifiez l'URL dans votre email." };
      case "expired":
        return { title: "Lien expiré", body: "Ce lien d'invitation a expiré. Demandez à votre interlocuteur LesNoces.net de vous en renvoyer un nouveau." };
      case "consumed":
        return { title: "Lien déjà utilisé", body: "Ce lien d'invitation a déjà servi. Connectez-vous normalement, ou contactez-nous si vous avez perdu vos identifiants." };
      case "invalid":
        return { title: "Lien invalide", body: "Ce lien d'invitation n'est pas reconnu. Demandez à votre interlocuteur de vous en renvoyer un nouveau." };
      case "unknown":
      default:
        return { title: "Une erreur est survenue", body: "Impossible d'activer votre compte pour le moment. Réessayez dans quelques minutes." };
    }
  }, [kind]);

  return (
    <div className="text-center space-y-4 py-4">
      <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
      <h1 className="font-serif text-2xl">{content.title}</h1>
      <p className="font-sans text-sm text-muted-foreground">{content.body}</p>
      {detail && (
        <p className="text-xs text-muted-foreground/70 bg-muted/30 p-2 rounded">{detail}</p>
      )}
      <div className="flex gap-2 justify-center pt-2">
        <Button variant="outline" asChild>
          <a href="/connexion">Se connecter</a>
        </Button>
        <Button asChild>
          <a href="/">Retour à l'accueil</a>
        </Button>
      </div>
    </div>
  );
}

function mapError(code: string | undefined): ErrorKind {
  switch (code) {
    case "token_expired": return "expired";
    case "token_consumed": return "consumed";
    case "missing_token":
    case "token_invalid":
    case "token_unknown":
    case "invalid_action":
    case "invalid_payload":
      return "invalid";
    default:
      return "unknown";
  }
}
