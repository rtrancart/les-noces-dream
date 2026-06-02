import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  roles: AppRole[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isPrestataire: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["profiles"]["Row"] | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(false);

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    setIsRoleLoading(true);

    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (profileRes.error) {
        console.error("Erreur profil:", profileRes.error.message);
      }

      if (rolesRes.error) {
        console.error("Erreur rôles:", rolesRes.error.message);
      }

      setProfile(profileRes.data ?? null);
      setRoles((rolesRes.data ?? []).map((r) => r.role));
    } finally {
      setIsRoleLoading(false);
    }
  }, []);

  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;

      const prevUid = currentUidRef.current;
      const nextUid = nextSession?.user?.id ?? null;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextUid !== prevUid) {
        // Real identity change (login / logout / switch user) → reload profile + roles
        currentUidRef.current = nextUid;
        setIsRoleLoading(Boolean(nextUid));
        if (!nextSession) {
          setProfile(null);
          setRoles([]);
        }
      }
      // Otherwise (USER_UPDATED, TOKEN_REFRESHED, INITIAL_SESSION with same uid):
      // keep profile/roles intact, do NOT flip isRoleLoading back to true.
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
      setIsAuthLoading(false);
    });

    const initAuth = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      applySession(initialSession);
      setIsAuthLoading(false);
    };

    void initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchProfileAndRoles(user.id);
  }, [user?.id, fetchProfileAndRoles]);

  // À chaque session prestataire, on s'assure que premier_login_le est renseigné
  // et que pre_inscrit (magic link envoyé) bascule en a_completer.
  useEffect(() => {
    if (!user?.id) return;
    if (!roles.includes("prestataire")) return;
    void supabase.rpc("mark_prestataire_first_login").then(({ error }) => {
      if (error) console.warn("mark_prestataire_first_login:", error.message);
    });
  }, [user?.id, roles]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setIsRoleLoading(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isLoading = isAuthLoading || isRoleLoading;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        isLoading,
        signOut,
        hasRole,
        isAdmin: hasRole("admin") || hasRole("super_admin"),
        isPrestataire: hasRole("prestataire"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
