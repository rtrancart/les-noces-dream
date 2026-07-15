import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

// Typage local du namespace beta supabase.auth.oauth
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function isSafeRelativePath(p: string | null): p is string {
  return !!p && p.startsWith("/") && !p.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requête d'autorisation invalide (authorization_id manquant).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/connexion?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("Le serveur d'autorisation n'a pas renvoyé d'URL de redirection.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Erreur inconnue.");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 space-y-4">
          <h1 className="font-serif text-2xl text-foreground">Autorisation impossible</h1>
          <p className="font-sans text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-sans text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "cette application";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 space-y-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-xl text-foreground">Connecter {clientName} à LesNoces</h1>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">Autorisation OAuth</p>
          </div>
        </div>

        <p className="font-sans text-sm text-foreground/90">
          {clientName} pourra utiliser LesNoces en votre nom : appeler les outils exposés et
          accéder aux données auxquelles votre compte a droit.
        </p>

        <ul className="font-sans text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Lire votre profil et vos rôles</li>
          <li>Rechercher et consulter les fiches prestataires publiques</li>
          <li>Consulter vos demandes de devis (selon vos droits)</li>
        </ul>

        <p className="font-sans text-xs text-muted-foreground">
          Cela ne contourne pas les politiques d'accès de LesNoces (RLS).
        </p>

        <div className="flex gap-3">
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 font-sans font-semibold"
          >
            {busy ? "…" : "Autoriser"}
          </Button>
          <Button
            onClick={() => decide(false)}
            disabled={busy}
            variant="outline"
            className="flex-1 font-sans"
          >
            Refuser
          </Button>
        </div>
      </div>
    </main>
  );
}
