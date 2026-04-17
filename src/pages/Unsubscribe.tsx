import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

type Status = "validating" | "valid" | "already" | "invalid" | "confirming" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("validating");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setErrorMsg("Lien invalide : aucun jeton fourni.");
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: supabaseAnonKey } }
        );
        const data = await res.json();

        if (!res.ok) {
          setStatus("invalid");
          setErrorMsg(data.error ?? "Lien invalide ou expiré.");
          return;
        }

        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
          return;
        }

        setStatus("valid");
      } catch {
        setStatus("invalid");
        setErrorMsg("Impossible de vérifier le lien.");
      }
    };

    void validate();
  }, [token, supabaseUrl, supabaseAnonKey]);

  const confirm = async () => {
    if (!token) return;
    setStatus("confirming");
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (data.success || data.reason === "already_unsubscribed") {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Une erreur est survenue.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Impossible de finaliser la désinscription.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">Désinscription</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "validating" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Vérification du lien…</p>
            </div>
          )}

          {status === "valid" && (
            <>
              <p className="text-sm text-foreground">
                Confirmez-vous votre désinscription des emails de LesNoces.net ?
              </p>
              <p className="text-xs text-muted-foreground">
                Vous ne recevrez plus aucune notification automatique de notre part.
              </p>
              <Button onClick={confirm} className="w-full" size="lg">
                Confirmer ma désinscription
              </Button>
            </>
          )}

          {status === "confirming" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Désinscription en cours…</p>
            </div>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">Désinscription confirmée</p>
              <p className="text-xs text-muted-foreground">
                Vous ne recevrez plus d'emails automatiques de LesNoces.net.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-foreground">Vous êtes déjà désinscrit.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </>
          )}

          {(status === "invalid" || status === "error") && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-sm text-foreground">{errorMsg || "Lien invalide ou expiré."}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
