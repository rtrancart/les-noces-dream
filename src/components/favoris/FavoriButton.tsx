import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  prestataireId: string;
  size?: "sm" | "md";
  className?: string;
  /** Empêche la propagation du clic (utile dans les cartes Link) */
  stopPropagation?: boolean;
}

export default function FavoriButton({
  prestataireId,
  size = "md",
  className,
  stopPropagation = true,
}: Props) {
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setIsFav(false);
      return;
    }
    supabase
      .from("favoris")
      .select("id")
      .eq("user_id", user.id)
      .eq("prestataire_id", prestataireId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsFav(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, prestataireId]);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    if (loading) return;
    setLoading(true);

    if (isFav) {
      const { error } = await supabase
        .from("favoris")
        .delete()
        .eq("user_id", user.id)
        .eq("prestataire_id", prestataireId);
      if (error) {
        toast.error("Erreur lors du retrait des favoris");
      } else {
        setIsFav(false);
        toast.success("Retiré des favoris");
      }
    } else {
      const { error } = await supabase
        .from("favoris")
        .insert({ user_id: user.id, prestataire_id: prestataireId });
      if (error) {
        toast.error("Erreur lors de l'ajout aux favoris");
      } else {
        setIsFav(true);
        toast.success("Ajouté aux favoris ♥");
      }
    }
    setLoading(false);
  };

  const dimensions = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? 16 : 18;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-card/95 backdrop-blur shadow-soft hover:bg-card transition-all hover:scale-110",
          dimensions,
          className,
        )}
      >
        <Heart
          size={iconSize}
          className={cn(
            "transition-colors",
            isFav ? "fill-or-riche text-or-riche" : "text-foreground",
          )}
        />
      </button>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Connectez-vous pour sauvegarder vos favoris
            </DialogTitle>
            <DialogDescription className="font-sans text-sm pt-2">
              Créez un compte gratuit pour retrouver vos prestataires préférés à tout moment et organiser votre mariage en toute sérénité.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" asChild>
              <Link to="/connexion" onClick={() => setShowAuthDialog(false)}>
                Se connecter
              </Link>
            </Button>
            <Button asChild>
              <Link to="/inscription" onClick={() => setShowAuthDialog(false)}>
                Créer un compte
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
