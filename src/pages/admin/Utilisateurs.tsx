import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Pencil } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

const allRoles: AppRole[] = ["client", "prestataire", "admin", "super_admin"];

const roleLabels: Record<AppRole, string> = {
  client: "Client",
  prestataire: "Prestataire",
  admin: "Admin",
  super_admin: "Super Admin",
};

const roleColors: Record<string, string> = {
  client: "bg-champagne/30 text-foreground",
  prestataire: "bg-primary/15 text-primary",
  admin: "bg-accent/15 text-accent-foreground",
  super_admin: "bg-destructive/10 text-destructive",
};

const emptyProfileForm = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  date_naissance: "",
  avatar_url: "",
};

export default function Utilisateurs() {
  const [data, setData] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("tous");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    if (profilesRes.error) { toast.error(profilesRes.error.message); setLoading(false); return; }
    const roles = rolesRes.data ?? [];
    const users: UserWithRoles[] = (profilesRes.data ?? []).map((p) => ({
      ...p,
      roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
    setData(users);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (u: UserWithRoles) => {
    setSelectedUser(u);
    setEditRoles([...u.roles]);
    setProfileForm({
      prenom: u.prenom ?? "",
      nom: u.nom ?? "",
      email: u.email,
      telephone: u.telephone ?? "",
      date_naissance: u.date_naissance ?? "",
      avatar_url: u.avatar_url ?? "",
    });
    setDialogOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        prenom: profileForm.prenom || null,
        nom: profileForm.nom || null,
        telephone: profileForm.telephone || null,
        date_naissance: profileForm.date_naissance || null,
        avatar_url: profileForm.avatar_url || null,
      })
      .eq("id", selectedUser.id);

    if (profileError) {
      toast.error("Erreur profil : " + profileError.message);
      setSaving(false);
      return;
    }

    // Update roles
    const currentRoles = selectedUser.roles;
    const toAdd = editRoles.filter((r) => !currentRoles.includes(r));
    const toRemove = currentRoles.filter((r) => !editRoles.includes(r));

    const ops = [
      ...toAdd.map((role) => supabase.from("user_roles").insert({ user_id: selectedUser.id, role })),
      ...toRemove.map((role) => supabase.from("user_roles").delete().eq("user_id", selectedUser.id).eq("role", role)),
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
    setDialogOpen(false);
    setSaving(false);
    fetchData();
  };

  const filtered = data.filter((u) => {
    const matchSearch = !search || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "tous" || u.roles.includes(filterRole as AppRole);
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Utilisateurs</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">{data.length} utilisateur{data.length > 1 ? "s" : ""} inscrits</p>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer par rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les rôles</SelectItem>
                {allRoles.map((r) => (<SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Nom</TableHead>
                <TableHead className="font-sans text-xs">Email</TableHead>
                <TableHead className="font-sans text-xs">Téléphone</TableHead>
                <TableHead className="font-sans text-xs">Rôles</TableHead>
                <TableHead className="font-sans text-xs">Inscription</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">Aucun utilisateur trouvé</TableCell></TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-sans text-sm font-medium">{u.prenom ?? ""} {u.nom ?? ""}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{u.telephone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Badge key={r} className={`${roleColors[r] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[11px] font-normal`}>{roleLabels[r]}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <Tabs defaultValue="profil" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profil" className="font-sans text-xs">Profil</TabsTrigger>
                <TabsTrigger value="roles" className="font-sans text-xs">Rôles</TabsTrigger>
              </TabsList>

              <TabsContent value="profil" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Prénom</Label>
                    <Input value={profileForm.prenom} onChange={(e) => setProfileForm({ ...profileForm, prenom: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Nom</Label>
                    <Input value={profileForm.nom} onChange={(e) => setProfileForm({ ...profileForm, nom: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input value={profileForm.email} disabled className="bg-muted/30 cursor-not-allowed" />
                  <p className="text-[11px] text-muted-foreground">L'email ne peut pas être modifié ici</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                    <Input value={profileForm.telephone} onChange={(e) => setProfileForm({ ...profileForm, telephone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Date de naissance</Label>
                    <Input type="date" value={profileForm.date_naissance} onChange={(e) => setProfileForm({ ...profileForm, date_naissance: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">URL avatar</Label>
                  <Input value={profileForm.avatar_url} onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} placeholder="https://…" />
                </div>
              </TabsContent>

              <TabsContent value="roles" className="space-y-4 pt-4">
                <p className="font-sans text-sm text-muted-foreground">
                  Cochez les rôles à attribuer à <span className="font-medium text-foreground">{selectedUser.email}</span>
                </p>
                <div className="space-y-3">
                  {allRoles.map((role) => (
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
            </Tabs>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-sans text-sm">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="font-sans text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
