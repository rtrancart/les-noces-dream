import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppRole, UserWithRoles } from "@/hooks/useUsersData";
import { allRoles, roleLabels } from "@/hooks/useUsersData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const emptyProfileForm = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  date_naissance: "",
  avatar_url: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles | null;
  onSaved: () => void;
  availableRoles?: AppRole[];
  canChangePassword?: boolean;
}

export default function EditUserDialog({ open, onOpenChange, user, onSaved, availableRoles, canChangePassword = false }: Props) {
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const rolesToShow = availableRoles ?? allRoles;
  const tabCount = canChangePassword ? 3 : 2;

  // Sync state when user changes
  const initForm = (u: UserWithRoles) => {
    setEditRoles([...u.roles]);
    setProfileForm({
      prenom: u.prenom ?? "",
      nom: u.nom ?? "",
      email: u.email,
      telephone: u.telephone ?? "",
      date_naissance: u.date_naissance ?? "",
      avatar_url: u.avatar_url ?? "",
    });
    setNewPassword("");
    setConfirmPassword("");
  };

  // Called when dialog opens
  if (user && profileForm.email !== user.email) {
    initForm(user);
  }

  const toggleRole = (role: AppRole) => {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        prenom: profileForm.prenom || null,
        nom: profileForm.nom || null,
        telephone: profileForm.telephone || null,
        date_naissance: profileForm.date_naissance || null,
        avatar_url: profileForm.avatar_url || null,
      })
      .eq("id", user.id);

    if (profileError) {
      toast.error("Erreur profil : " + profileError.message);
      setSaving(false);
      return;
    }

    const currentRoles = user.roles;
    const toAdd = editRoles.filter((r) => !currentRoles.includes(r));
    const toRemove = currentRoles.filter((r) => !editRoles.includes(r));

    const ops = [
      ...toAdd.map((role) => supabase.from("user_roles").insert({ user_id: user.id, role })),
      ...toRemove.map((role) => supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role)),
    ];

    if (ops.length > 0) {
      const results = await Promise.all(ops);
      if (results.some((r) => r.error)) {
        toast.error("Erreur lors de la mise à jour des rôles");
        setSaving(false);
        return;
      }
    }

    toast.success("Utilisateur mis à jour");
    onOpenChange(false);
    setSaving(false);
    onSaved();
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await supabase.functions.invoke("admin-update-password", {
        body: { target_user_id: user.id, new_password: newPassword },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Mot de passe mis à jour");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du changement de mot de passe");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setProfileForm(emptyProfileForm); setNewPassword(""); setConfirmPassword(""); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Modifier l'utilisateur</DialogTitle>
        </DialogHeader>
        {user && (
          <Tabs defaultValue="profil" className="mt-2">
            <TabsList className={`grid w-full grid-cols-${tabCount}`}>
              <TabsTrigger value="profil" className="font-sans text-xs">Profil</TabsTrigger>
              <TabsTrigger value="roles" className="font-sans text-xs">Rôles</TabsTrigger>
              {canChangePassword && (
                <TabsTrigger value="password" className="font-sans text-xs">Mot de passe</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="profil" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prénom">
                  <Input value={profileForm.prenom} onChange={(e) => setProfileForm({ ...profileForm, prenom: e.target.value })} />
                </Field>
                <Field label="Nom">
                  <Input value={profileForm.nom} onChange={(e) => setProfileForm({ ...profileForm, nom: e.target.value })} />
                </Field>
              </div>
              <Field label="Email">
                <Input value={profileForm.email} disabled className="bg-muted/30 cursor-not-allowed" />
                <p className="text-[11px] text-muted-foreground">L'email ne peut pas être modifié ici</p>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Téléphone">
                  <Input value={profileForm.telephone} onChange={(e) => setProfileForm({ ...profileForm, telephone: e.target.value })} />
                </Field>
                <Field label="Date de naissance">
                  <Input type="date" value={profileForm.date_naissance} onChange={(e) => setProfileForm({ ...profileForm, date_naissance: e.target.value })} />
                </Field>
              </div>
              <Field label="URL avatar">
                <Input value={profileForm.avatar_url} onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} placeholder="https://…" />
              </Field>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4 pt-4">
              <p className="font-sans text-sm text-muted-foreground">
                Cochez les rôles à attribuer à <span className="font-medium text-foreground">{user.email}</span>
              </p>
              <div className="space-y-3">
                {rolesToShow.map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <Checkbox checked={editRoles.includes(role)} onCheckedChange={() => toggleRole(role)} id={`role-${role}`} />
                    <Label htmlFor={`role-${role}`} className="font-sans text-sm cursor-pointer">
                      <span className="font-medium">{roleLabels[role]}</span>
                      {role === "super_admin" && <span className="ml-2 text-xs text-destructive">(accès complet)</span>}
                      {role === "admin" && <span className="ml-2 text-xs text-muted-foreground">(gestion back-office)</span>}
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>

            {canChangePassword && (
              <TabsContent value="password" className="space-y-4 pt-4">
                <p className="font-sans text-sm text-muted-foreground">
                  Définir un nouveau mot de passe pour <span className="font-medium text-foreground">{user.email}</span>
                </p>
                <Field label="Nouveau mot de passe">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                </Field>
                <Field label="Confirmer le mot de passe">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                  )}
                </Field>
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="font-sans text-sm w-full"
                >
                  {savingPassword ? "Modification…" : "Changer le mot de passe"}
                </Button>
              </TabsContent>
            )}
          </Tabs>
        )}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-sans text-sm">Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="font-sans text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
