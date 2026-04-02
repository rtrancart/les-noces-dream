import {
  BarChart3,
  User,
  FileText,
  Star,
  ImageIcon,
  Settings,
  LogOut,
  CreditCard,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Tableau de bord", url: "/espace-pro", icon: BarChart3 },
  { title: "Mon profil", url: "/espace-pro/profil", icon: User },
  { title: "Ma galerie", url: "/espace-pro/galerie", icon: ImageIcon },
  { title: "Demandes de devis", url: "/espace-pro/demandes", icon: FileText },
  { title: "Avis clients", url: "/espace-pro/avis", icon: Star },
  { title: "Abonnement", url: "/espace-pro/abonnement", icon: CreditCard },
  { title: "Paramètres", url: "/espace-pro/parametres", icon: Settings },
];

export function PrestataireSidebar() {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (url: string) =>
    url === "/espace-pro" ? currentPath === "/espace-pro" : currentPath.startsWith(url);

  return (
    <nav className="bg-card rounded-lg shadow-sm p-3 sticky top-24 space-y-1">
      {mainItems.map((item) => {
        const active = isActive(item.url);
        return (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/espace-pro"}
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
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-sm font-sans text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </nav>
  );
}
