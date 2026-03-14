import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];

interface UserWithRoles extends Profile {
  roles: string[];
}

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

  const filtered = search
    ? data.filter((u) =>
        `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Utilisateurs</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {data.length} utilisateur{data.length > 1 ? "s" : ""} inscrits
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-sans text-sm"
          />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-sans text-sm font-medium">
                      {u.prenom} {u.nom}
                    </TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Badge key={r} className={`${roleColors[r] ?? "bg-muted text-muted-foreground"} font-sans text-[11px] font-normal capitalize`}>
                            {r.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
