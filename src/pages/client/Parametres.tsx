import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function ClientParametres() {
  const { profile, refreshProfile } = useAuth();
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(Boolean(profile?.consentement_marketing));
  const [savingConsent, setSavingConsent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setConsent(Boolean(profile?.consentement_marketing));
  }, [profile?.consentement_marketing]);

  const updateConsent = async (next: boolean) => {
    setConfirmOpen(false);
    setSavingConsent(true);
    const { error } = await supabase.rpc("definir_consentement_marketing", { p_consent: next });
    setSavingConsent(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setConsent(next);
    await refreshProfile();
    toast.success(
      next
        ? "Consentement enregistré, vous recevrez nos communications"
        : "Consentement retiré, vous ne recevrez plus d'emails marketing",
    );
  };


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
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);

    if (error) {
      toast.error("Erreur lors du changement de mot de passe");
    } else {
      toast.success("Mot de passe modifié avec succès");
      setNewPwd("");
      setConfirmPwd("");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-2xl text-foreground">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Mon compte</CardTitle>
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
          <Button onClick={handlePasswordChange} disabled={saving || !newPwd} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Communications marketing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="consentement-marketing" className="font-sans text-sm">
                Recevoir les actualités, conseils et offres de LesNoces
              </Label>
              <p className="font-sans text-xs text-muted-foreground">
                {consent
                  ? "Vous recevez nos emails marketing. Vous pouvez vous désinscrire à tout moment."
                  : "Vous ne recevez aucun email marketing de notre part."}
              </p>
            </div>
            <Switch
              id="consentement-marketing"
              checked={consent}
              disabled={savingConsent}
              onCheckedChange={(v) => {
                if (v) void updateConsent(true);
                else setConfirmOpen(true);
              }}
            />
          </div>
          {savingConsent && (
            <p className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Confirmer le retrait de votre consentement
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans">
              Ce retrait est définitif : votre adresse email sera enregistrée comme opposition
              marketing et ne pourra plus être réinscrite à nos communications, même depuis cet
              écran. Vos emails liés à votre compte et à vos demandes continueront d'être envoyés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans">Annuler</AlertDialogCancel>
            <AlertDialogAction className="font-sans" onClick={() => void updateConsent(false)}>
              Retirer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
