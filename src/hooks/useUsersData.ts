import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export const allRoles: AppRole[] = ["client", "prestataire", "admin", "super_admin"];

export const roleLabels: Record<AppRole, string> = {
  client: "Client",
  prestataire: "Prestataire",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const roleColors: Record<string, string> = {
  client: "bg-champagne/30 text-foreground",
  prestataire: "bg-primary/15 text-primary",
  admin: "bg-accent/15 text-accent-foreground",
  super_admin: "bg-destructive/10 text-destructive",
};

export function useUsersData() {
  const [data, setData] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, adminRolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
    ]);
    if (profilesRes.error) { toast.error(profilesRes.error.message); setLoading(false); return; }
    // Admins chargés directement : ne dépend pas de la limite de 1 000 lignes.
    const loadedIds = new Set((profilesRes.data ?? []).map((p) => p.id));
    const missingAdminIds = [...new Set((adminRolesRes.data ?? []).map((r) => r.user_id))].filter((id) => !loadedIds.has(id));
    const [extraProfiles, extraRoles] = missingAdminIds.length
      ? await Promise.all([
          supabase.from("profiles").select("*").in("id", missingAdminIds),
          supabase.from("user_roles").select("*").in("user_id", missingAdminIds),
        ])
      : [{ data: [] as Profile[] }, { data: [] as { user_id: string; role: AppRole }[] }];
    const roles = [...(rolesRes.data ?? []), ...(extraRoles.data ?? [])];
    const users: UserWithRoles[] = [...(profilesRes.data ?? []), ...(extraProfiles.data ?? [])].map((p) => ({
      ...p,
      roles: [...new Set(roles.filter((r) => r.user_id === p.id).map((r) => r.role))],
    }));
    setData(users);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return { data, loading, refetch: fetchData };
}
