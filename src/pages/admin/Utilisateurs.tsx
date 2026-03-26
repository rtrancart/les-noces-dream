import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Pencil, ExternalLink, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { logAdmin } from "@/lib/logAdmin";
import { useUsersData, roleLabels, roleColors } from "@/hooks/useUsersData";
import type { AppRole, UserWithRoles } from "@/hooks/useUsersData";
import EditUserDialog from "@/components/admin/EditUserDialog";
import DeleteUserDialog from "@/components/admin/DeleteUserDialog";
import CreateUserDialog from "@/components/admin/CreateUserDialog";

export default function Utilisateurs() {
  const { data, loading, refetch } = useUsersData();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [editContext, setEditContext] = useState<"client" | "admin">("client");

  const clients = data.filter((u) => u.roles.includes("client") && !u.roles.includes("prestataire"));
  const admins = data.filter((u) => u.roles.includes("admin") || u.roles.includes("super_admin"));

  const filterBySearch = (list: UserWithRoles[]) =>
    list.filter((u) => !search || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const openEdit = (u: UserWithRoles, ctx: "client" | "admin") => {
    setSelectedUser(u);
    setEditContext(ctx);
    setEditDialogOpen(true);
  };

  const openDelete = (u: UserWithRoles) => {
    setSelectedUser(u);
    setDeleteDialogOpen(true);
  };

  const handleImpersonate = async (u: UserWithRoles) => {
    setImpersonating(u.id);
    try {
      const res = await supabase.functions.invoke("admin-impersonate", {
        body: { target_user_id: u.id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      const actionLink = res.data.action_link;
      if (!actionLink) throw new Error("Lien d'accès non généré");

      window.open(actionLink, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur d'impersonation");
    } finally {
      setImpersonating(null);
    }
  };

  const SkeletonRows = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 5 }).map((_, j) => (
            <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );

  const EmptyRow = ({ colSpan }: { colSpan: number }) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center font-sans text-sm text-muted-foreground py-8">
        Aucun utilisateur trouvé
      </TableCell>
    </TableRow>
  );

  const filteredClients = filterBySearch(clients);
  const filteredAdmins = filterBySearch(admins);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Utilisateurs</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">{data.length} utilisateur{data.length > 1 ? "s" : ""} inscrits</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="font-sans text-sm gap-2">
          <Plus className="h-4 w-4" />
          Créer un utilisateur
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher par nom ou email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients" className="font-sans text-sm">
            Clients ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="admins" className="font-sans text-sm">
            Administrateurs ({admins.length})
          </TabsTrigger>
        </TabsList>

        {/* === CLIENTS TAB === */}
        <TabsContent value="clients">
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
                  {loading ? <SkeletonRows /> : filteredClients.length === 0 ? <EmptyRow colSpan={5} /> : (
                    filteredClients.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-sans text-sm font-medium">{u.prenom ?? ""} {u.nom ?? ""}</TableCell>
                        <TableCell className="font-sans text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map((r) => (
                              <Badge key={r} className={`${roleColors[r] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[11px] font-normal`}>{roleLabels[r]}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Voir l'espace client"
                              disabled={impersonating === u.id}
                              onClick={() => handleImpersonate(u)}
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Modifier" onClick={() => openEdit(u, "client")}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Supprimer" onClick={() => openDelete(u)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ADMINS TAB === */}
        <TabsContent value="admins">
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
                  {loading ? <SkeletonRows /> : filteredAdmins.length === 0 ? <EmptyRow colSpan={5} /> : (
                    filteredAdmins.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-sans text-sm font-medium">{u.prenom ?? ""} {u.nom ?? ""}</TableCell>
                        <TableCell className="font-sans text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map((r) => (
                              <Badge key={r} className={`${roleColors[r] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[11px] font-normal`}>{roleLabels[r]}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Modifier" onClick={() => openEdit(u, "admin")}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {isSuperAdmin && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Supprimer" onClick={() => openDelete(u)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSaved={refetch}
        canChangePassword={editContext === "client" ? true : isSuperAdmin}
      />
      <DeleteUserDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} user={selectedUser} onDeleted={refetch} />
      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreated={refetch} />
    </div>
  );
}
