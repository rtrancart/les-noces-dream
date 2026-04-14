import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  User,
  FileText,
  Star,
  ImageIcon,
  Settings,
  LogOut,
  CreditCard,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Tableau de bord", url: "/espace-pro", icon: BarChart3 },
  { title: "Mon profil", url: "/espace-pro/profil", icon: User },
  { title: "Ma prestation", url: "/espace-pro/prestation", icon: ClipboardList },
  { title: "Ma galerie", url: "/espace-pro/galerie", icon: ImageIcon },
  { title: "Demandes de devis", url: "/espace-pro/demandes", icon: FileText },
  { title: "Avis clients", url: "/espace-pro/avis", icon: Star },
  { title: "Abonnement", url: "/espace-pro/abonnement", icon: CreditCard },
  { title: "Paramètres", url: "/espace-pro/parametres", icon: Settings },
];

export { mainItems };

interface PrestataireSidebarProps {
  onNavigate?: () => void;
}

export function PrestataireSidebar({ onNavigate }: PrestataireSidebarProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const { prestataire } = useSharedPrestataire();
  const currentPath = location.pathname;
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = (url: string) =>
    url === "/espace-pro" ? currentPath === "/espace-pro" : currentPath.startsWith(url);

  const fetchUnread = useCallback(async () => {
    if (!prestataire?.id) return;

    // Count demandes with statut "nouveau" OR with unread messages from visitors
    const { count: nouveauCount } = await supabase
      .from("demandes_devis")
      .select("id", { count: "exact", head: true })
      .eq("prestataire_id", prestataire.id)
      .eq("statut", "nouveau");

    // Also get demandes with unread messages
    const { data: demandes } = await supabase
      .from("demandes_devis")
      .select("id")
      .eq("prestataire_id", prestataire.id)
      .neq("statut", "nouveau");

    let unreadMsgCount = 0;
    if (demandes && demandes.length > 0) {
      const ids = demandes.map((d) => d.id);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("demande_id", ids)
        .eq("expediteur_type", "visiteur")
        .is("lu_le", null);
      unreadMsgCount = count ?? 0;
    }

    setUnreadCount((nouveauCount ?? 0) + (unreadMsgCount > 0 ? 1 : 0));
  }, [prestataire?.id]);

  useEffect(() => {
    fetchUnread();

    // Refresh on realtime message inserts
    if (!prestataire?.id) return;
    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUnread, prestataire?.id]);

  return (
    <nav className="bg-card rounded-lg shadow-sm p-3 lg:sticky lg:top-24 space-y-1">
      {mainItems.map((item) => {
        const active = isActive(item.url);
        const showBadge = item.url === "/espace-pro/demandes" && unreadCount > 0;
        return (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/espace-pro"}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-sm font-sans text-sm transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            activeClassName=""
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.title}</span>
            {showBadge && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </NavLink>
        );
      })}

      <div className="border-t border-border mt-2 pt-2">
        {profile && (
          <p className="px-4 mb-1 truncate font-sans text-xs text-muted-foreground">
            {profile.prenom} {profile.nom}
          </p>
        )}
        <button
          onClick={() => {
            signOut();
            onNavigate?.();
          }}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-sm font-sans text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </nav>
  );
}
