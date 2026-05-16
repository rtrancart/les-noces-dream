import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

/**
 * /accept-invitation
 *
 * Le prestataire arrive via le magic link envoyé par l'admin (cf. invite-prestataire).
 * Supabase Auth gère nativement le token via le hash URL (#access_token=...).
 * Une fois la session établie via onAuthStateChange, on demande au prestataire :
 *   1. de définir son mot de passe (updateUser)
 *   2. d'accepter les CGU
 * Puis redirection vers /signer-la-charte.
 */
export default function AccepterInvitation() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cgu, setCgu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionReady(true);
        setEmail(session.user.email ?? null);
        // Mark premier_login_le + magic_link_ouvert on prestataire row
        supabase.functions.invoke("invite-prestataire", { body: { ping: "first_login" } }).catch(() => {});
        supabase
          .from("prestataires")
          .update({ magic_link_ouvert: true, premier_login_le: new Date().toISOString() })
          .eq("user_id", session.user.id)
          .is("premier_login_le", null)
          .then(() => {});
      }
    });

    // Also try existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSessionReady(true);
        setEmail(data.session.user.email ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!cgu) {
      setError("Vous devez accepter les CGU pour continuer.");
      return;
    }

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
      }

      toast.success("Compte activé. Place à la signature de la Charte.");
      navigate("/signer-la-charte", { replace: true });
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'activation du compte.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="font-sans text-sm text-muted-foreground">
            Vérification de votre lien d'invitation…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Activer mon compte | LesNoces.net" noindex canonicalUrl="/accept-invitation" />
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md p-8 space-y-6">
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
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimum 8 caractères.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={cgu}
                onChange={(e) => setCgu(e.target.checked)}
                className="mt-1"
              />
              <span className="text-muted-foreground">
                J'accepte les{" "}
                <a href="/cgu" target="_blank" rel="noopener" className="text-primary underline">
                  Conditions Générales d'Utilisation
                </a>
                .
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activer mon compte et signer la Charte
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
