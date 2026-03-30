import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function PrestataireParametres() {
  const { profile } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-2xl text-foreground">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-sans text-sm text-muted-foreground">Email</p>
            <p className="font-sans text-sm text-foreground">{profile?.email ?? "–"}</p>
          </div>
          <div>
            <p className="font-sans text-sm text-muted-foreground">Nom</p>
            <p className="font-sans text-sm text-foreground">
              {profile?.prenom} {profile?.nom}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center py-8">
        <Settings className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-sans text-sm text-muted-foreground">
          D'autres paramètres seront disponibles prochainement (notifications, abonnement, etc.)
        </p>
      </div>
    </div>
  );
}
