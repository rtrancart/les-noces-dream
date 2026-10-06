import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Capturé au chargement du module, avant tout nettoyage ou redirection.
const initialHash = typeof window !== "undefined" ? window.location.hash : "";
const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
const params = new URLSearchParams(initialHash.replace(/^#/, ""));

const accessToken = params.get("access_token");
const refreshToken = params.get("refresh_token");
const isSignupConfirm = params.get("type") === "signup" && !!accessToken && !!refreshToken;
// Les erreurs de lien sont gérées ici uniquement sur l'accueil : les pages
// d'invitation et de nouveau mot de passe gèrent leurs propres erreurs.
const linkError = initialPath === "/" ? params.get("error_code") || params.get("error") : null;

const clearHash = () => {
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
};

// Le client d'authentification fonctionne en mode « code » et ne lit pas les
// jetons placés dans l'adresse par le lien de confirmation : on ouvre la
// session nous-mêmes, une seule fois.
const sessionPromise: Promise<boolean> | null = isSignupConfirm
  ? supabase.auth
      .setSession({ access_token: accessToken!, refresh_token: refreshToken! })
      .then(({ error }) => {
        if (error) console.warn("Confirmation email :", error.message);
        return !error;
      })
      .finally(clearHash)
  : null;

/** Message et redirection après un clic sur le lien de confirmation d'email. */
const AuthHashHandler = () => {
  const { user, roles, isLoading } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);
  const [sessionOk, setSessionOk] = useState<boolean | null>(sessionPromise ? null : false);

  useEffect(() => {
    sessionPromise?.then(setSessionOk);
  }, []);

  useEffect(() => {
    if (done.current || isLoading) return;
    if (!isSignupConfirm && !linkError) return;

    if (isSignupConfirm) {
      if (sessionOk === null) return; // ouverture de session en cours
      if (sessionOk && !user) return; // profil en cours de chargement
      done.current = true;
      if (!sessionOk) {
        toast.error("Ce lien a déjà été utilisé ou a expiré.", {
          description: "Connectez-vous avec votre email et votre mot de passe.",
          duration: 12000,
        });
        navigate("/connexion", { replace: true });
        return;
      }
      toast.success("Votre email est confirmé, bienvenue !");
      const isPro = roles.includes("prestataire");
      const target = isPro ? (initialPath === "/" ? "/espace-pro" : initialPath) : "/mon-compte";
      if (window.location.pathname !== target) navigate(target, { replace: true });
      return;
    }

    done.current = true;
    clearHash();
    if (user) {
      toast.success("Votre email est déjà confirmé.");
      if (!roles.includes("prestataire")) navigate("/mon-compte", { replace: true });
    } else {
      toast.error("Ce lien a déjà été utilisé ou a expiré.", {
        description: "Si vous avez déjà confirmé votre email, connectez-vous. Sinon, inscrivez-vous à nouveau.",
        duration: 12000,
        action: { label: "Se connecter", onClick: () => navigate("/connexion") },
      });
    }
  }, [user, roles, isLoading, sessionOk, navigate]);

  return null;
};

export default AuthHashHandler;
