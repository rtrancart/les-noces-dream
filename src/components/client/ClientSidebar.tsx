import {
  BarChart3,
  MessageSquare,
  Heart,
  Clock,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Tableau de bord", url: "/mon-compte", icon: BarChart3 },
  { title: "Messagerie", url: "/mon-compte/messagerie", icon: MessageSquare },
  { title: "Favoris", url: "/mon-compte/favoris", icon: Heart },
  { title: "Historique", url: "/mon-compte/historique", icon: Clock },
  { title: "Paramètres", url: "/mon-compte/parametres", icon: Settings },
];

export { mainItems };

interface ClientSidebarProps {
  onNavigate?: () => void;
}

export function ClientSidebar({ onNavigate }: ClientSidebarProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (url: string) =>
    url === "/mon-compte" ? currentPath === "/mon-compte" : currentPath.startsWith(url);

  return (
    <nav className="bg-card rounded-lg shadow-sm p-3 lg:sticky lg:top-24 space-y-1">
      {mainItems.map((item) => {
        const active = isActive(item.url);
        return (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/mon-compte"}
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
            <span>{item.title}</span>
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
