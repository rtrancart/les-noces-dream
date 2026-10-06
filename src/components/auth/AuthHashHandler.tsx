import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

// Capturé au chargement du module, avant que le client d'authentification
// ne nettoie le fragment de l'URL (traitement asynchrone).
const initialHash = typeof window !== "undefined" ? window.location.hash : "";
const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
const params = new URLSearchParams(initialHash.replace(/^#/, ""));

const isSignupConfirm = params.get("type") === "signup" && params.has("access_token");
// Les erreurs de lien sont gérées ici uniquement sur l'accueil : les pages
// d'invitation et de nouveau mot de passe gèrent leurs propres erreurs.
const linkError = initialPath === "/" ? params.get("error_code") || params.get("error") : null;

const clearHash = () => {
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
};

/** Message et redirection après un clic sur le lien de confirmation d'email. */
const AuthHashHandler = () => {
  const { user, roles, isLoading } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || isLoading) return;
    if (!isSignupConfirm && !linkError) return;

    if (isSignupConfirm) {
      if (!user) return; // session en cours d'établissement
      done.current = true;
      clearHash();
      toast.success("Votre email est confirmé, bienvenue !");
      const isPro = roles.includes("prestataire");
      if (!isPro && window.location.pathname === "/") navigate("/mon-compte", { replace: true });
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
  }, [user, roles, isLoading, navigate]);

  return null;
};

export default AuthHashHandler;
