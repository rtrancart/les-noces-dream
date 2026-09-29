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
    // Filtrage côté serveur : seuls les comptes ayant un rôle client, admin ou
    // super_admin sont chargés (les prestataires sont gérés dans leur propre onglet).
    const ids: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["client", "admin", "super_admin"])
        .order("id")
        .range(from, from + 999);
      if (error) { toast.error(error.message); setLoading(false); return; }
      ids.push(...(page ?? []).map((r) => r.user_id));
      if (!page || page.length < 1000) break;
    }
    const uniqueIds = [...new Set(ids)];
    const profiles: Profile[] = [];
    const roles: { user_id: string; role: AppRole }[] = [];
    for (let i = 0; i < uniqueIds.length; i += 200) {
      const chunk = uniqueIds.slice(i, i + 200);
      const [pRes, rRes] = await Promise.all([
        supabase.from("profiles").select("*").in("id", chunk),
        supabase.from("user_roles").select("user_id, role").in("user_id", chunk),
      ]);
      if (pRes.error) { toast.error(pRes.error.message); setLoading(false); return; }
      profiles.push(...(pRes.data ?? []));
      roles.push(...(rRes.data ?? []));
    }
    const users: UserWithRoles[] = profiles
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .map((p) => ({
        ...p,
        roles: [...new Set(roles.filter((r) => r.user_id === p.id).map((r) => r.role))],
      }));
    setData(users);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return { data, loading, refetch: fetchData };
}
