import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Settings } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];
type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

const allRoles: AppRole[] = ["client", "prestataire", "admin", "super_admin"];

const roleColors: Record<string, string> = {
  client: "bg-champagne/30 text-foreground",
  prestataire: "bg-primary/15 text-primary",
  admin: "bg-accent/15 text-accent-foreground",
  super_admin: "bg-destructive/10 text-destructive",
};

export default function Utilisateurs() {
  const [data, setData] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
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

  const openRoles = (u: UserWithRoles) => {
    setSelectedUser(u);
    setEditRoles([...u.roles]);
  };

  const toggleRole = (role: AppRole) => {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const saveRoles = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const currentRoles = selectedUser.roles;
    const toAdd = editRoles.filter((r) => !currentRoles.includes(r));
    const toRemove = currentRoles.filter((r) => !editRoles.includes(r));

    const promises: Promise<any>[] = [];
    for (const role of toAdd) {
      promises.push(supabase.from("user_roles").insert({ user_id: selectedUser.id, role }));
    }
    for (const role of toRemove) {
      promises.push(supabase.from("user_roles").delete().eq("user_id", selectedUser.id).eq("role", role));
    }
    const results = await Promise.all(promises);
    const hasError = results.some((r) => r.error);
    if (hasError) toast.error("Erreur lors de la mise à jour des rôles");
    else { toast.success("Rôles mis à jour"); setSelectedUser(null); fetchData(); }
    setSaving(false);
  };

  const filtered = search
    ? data.filter((u) => `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
    : data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Utilisateurs</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">{data.length} utilisateur{data.length > 1 ? "s" : ""} inscrits</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Nom</TableHead>
                <TableHead className="font-sans text-xs">Email</TableHead>
                <TableHead className="font-sans text-xs">Rôles</TableHead>
                <TableHead className="font-sans text-xs">Inscription</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center font-sans text-sm text-muted-foreground py-8">Aucun utilisateur trouvé</TableCell></TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-sans text-sm font-medium">{u.prenom} {u.nom}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Badge key={r} className={`${roleColors[r] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[11px] font-normal capitalize`}>{r.replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openRoles(u)}>
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Management Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-serif text-lg">Gérer les rôles</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-2">
              <p className="font-sans text-sm text-muted-foreground">{selectedUser.prenom} {selectedUser.nom} — {selectedUser.email}</p>
              <div className="space-y-3">
                {allRoles.map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <Checkbox checked={editRoles.includes(role)} onCheckedChange={() => toggleRole(role)} id={`role-${role}`} />
                    <Label htmlFor={`role-${role}`} className="font-sans text-sm capitalize cursor-pointer">{role.replace(/_/g, " ")}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Annuler</Button>
            <Button onClick={saveRoles} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
