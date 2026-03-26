import { ReactNode, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/hooks/useUsersData";
import { roleLabels } from "@/hooks/useUsersData";
import { logAdmin } from "@/lib/logAdmin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const initialForm = {
  email: "",
  password: "",
  prenom: "",
  nom: "",
  telephone: "",
  date_naissance: "",
  role: "client" as AppRole,
};

export default function CreateUserDialog({ open, onOpenChange, onCreated }: Props) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const availableRoles: AppRole[] = isSuperAdmin
    ? ["client", "admin", "super_admin"]
    : ["client"];

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.role) {
      toast.error("Email, mot de passe et rôle sont requis");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setSaving(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: form.email.trim(),
          password: form.password,
          prenom: form.prenom.trim() || null,
          nom: form.nom.trim() || null,
          telephone: form.telephone.trim() || null,
          date_naissance: form.date_naissance || null,
          role: form.role,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`Utilisateur ${form.email} créé avec succès`);
      setForm(initialForm);
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm(initialForm); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Créer un utilisateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom">
              <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Jean" />
            </Field>
            <Field label="Nom">
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Dupont" />
            </Field>
          </div>

          <Field label="Email *">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr" />
          </Field>

          <Field label="Mot de passe *">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 caractères" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Téléphone">
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="06 12 34 56 78" />
            </Field>
            <Field label="Date de naissance">
              <Input type="date" value={form.date_naissance} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })} />
            </Field>
          </div>

          <Field label="Rôle *">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger className="font-sans text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-sans text-sm">Annuler</Button>
          <Button onClick={handleCreate} disabled={saving} className="font-sans text-sm">
            {saving ? "Création…" : "Créer l'utilisateur"}
          </Button>
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
