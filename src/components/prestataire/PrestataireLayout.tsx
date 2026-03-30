import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PrestataireSidebar } from "./PrestataireSidebar";
import { Separator } from "@/components/ui/separator";

export default function PrestataireLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PrestataireSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <Separator orientation="vertical" className="h-5" />
            <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
              Espace prestataire
            </span>
          </header>
          <main className="flex-1 overflow-auto bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
