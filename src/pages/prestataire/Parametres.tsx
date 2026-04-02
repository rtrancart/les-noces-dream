import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function PrestataireParametres() {
  const { profile } = useAuth();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async () => {
    if (!newPwd || newPwd.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setSaving(true);

    // Re-authenticate with current password first
    const email = profile?.email;
    if (!email) {
      toast.error("Impossible de vérifier votre identité");
      setSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPwd,
    });

    if (signInError) {
      toast.error("Mot de passe actuel incorrect");
      setSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);

    if (error) {
      toast.error("Erreur lors du changement de mot de passe");
      console.error(error);
    } else {
      toast.success("Mot de passe modifié avec succès");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    }
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Modifier le mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-sans text-sm">Mot de passe actuel</Label>
            <Input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-sans text-sm">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="font-sans text-xs text-muted-foreground">Minimum 8 caractères</p>
          </div>
          <div className="space-y-2">
            <Label className="font-sans text-sm">Confirmer le nouveau mot de passe</Label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handlePasswordChange} disabled={saving || !currentPwd || !newPwd} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
