import {
  LayoutDashboard,
  Store,
  FolderTree,
  FileText,
  Star,
  Users,
  ScrollText,
  ClipboardList,
  LogOut,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Tableau de bord", url: "/admin", icon: LayoutDashboard },
  { title: "Prestataires", url: "/admin/prestataires", icon: Store },
  { title: "Catégories", url: "/admin/categories", icon: FolderTree },
  { title: "Demandes de devis", url: "/admin/demandes", icon: FileText },
  { title: "Avis", url: "/admin/avis", icon: Star },
  { title: "Utilisateurs", url: "/admin/utilisateurs", icon: Users },
  { title: "Journal d'activité", url: "/admin/logs", icon: ClipboardList },
];

const contentItems = [
  { title: "Articles blog", url: "/admin/articles", icon: ScrollText },
  { title: "Pages contenu", url: "/admin/pages", icon: FileText },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (url: string) =>
    url === "/admin" ? currentPath === "/admin" : currentPath.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          {!collapsed && (
            <span className="font-serif text-lg tracking-wide text-sidebar-primary">
              LesNoces
              <span className="text-sidebar-foreground opacity-50">.admin</span>
            </span>
          )}
          {collapsed && (
            <span className="font-serif text-lg text-sidebar-primary">L</span>
          )}
        </div>

        {/* Main Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/40 font-sans">
            Gestion
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="!bg-sidebar-accent !text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="font-sans text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Content Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/40 font-sans">
            Contenu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="!bg-sidebar-accent !text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="font-sans text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <p className="mb-2 truncate font-sans text-xs text-sidebar-foreground/50">
            {profile.prenom} {profile.nom}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent font-sans text-xs"
            onClick={() => signOut()}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && "Déconnexion"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
