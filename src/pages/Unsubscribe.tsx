import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import SeoHead from "@/components/SeoHead";

/**
 * Page conservée pour les anciens liens de désinscription.
 * La désinscription est désormais gérée directement depuis le lien présent
 * en pied de chaque email : aucune action n'est nécessaire ici.
 */
export default function Unsubscribe() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <SeoHead
        title="Désinscription | LesNoces.net"
        description="Gestion de votre désinscription LesNoces.net."
        canonicalUrl="/unsubscribe"
        noindex
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">Désinscription</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-foreground">
            Pour ne plus recevoir nos emails, utilisez le lien de désinscription
            situé en bas de l'email que vous avez reçu.
          </p>
          <p className="text-xs text-muted-foreground">
            Votre demande est prise en compte immédiatement, sans autre étape.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
