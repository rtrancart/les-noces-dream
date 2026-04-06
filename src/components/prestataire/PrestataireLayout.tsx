import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { PrestataireSidebar, mainItems } from "./PrestataireSidebar";
import { ProviderInfoBanner } from "./ProviderInfoBanner";
import Header from "@/components/layout/Header";
import { usePrestataire } from "@/hooks/usePrestataire";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function PrestataireLayout() {
  const { prestataire, loading } = usePrestataire();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  const currentItem = mainItems.find((item) =>
    item.url === "/espace-pro"
      ? location.pathname === "/espace-pro"
      : location.pathname.startsWith(item.url)
  );
  const pageTitle = currentItem?.title ?? "Espace pro";

  return (
    <>
      <Header />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Provider Info Banner */}
          {!loading && prestataire && (
            <div className="mb-4 md:mb-6">
              <ProviderInfoBanner prestataire={prestataire} />
            </div>
          )}

          {/* Mobile: sticky burger bar */}
          {isMobile && (
            <div className="sticky top-20 z-30 bg-background border-b border-border -mx-4 px-4 py-2 mb-4 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSheetOpen(true)}
                className="shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="font-sans font-medium text-sm text-foreground">
                {pageTitle}
              </span>
            </div>
          )}

          {/* Mobile Sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="mb-4">
                <SheetTitle className="font-serif text-lg">Navigation</SheetTitle>
              </SheetHeader>
              <PrestataireSidebar onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Desktop: grid layout */}
          {!isMobile ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
              <div className="lg:col-span-1">
                <PrestataireSidebar />
              </div>
              <main className="lg:col-span-3 min-w-0">
                <Outlet />
              </main>
            </div>
          ) : (
            <main className="min-w-0">
              <Outlet />
            </main>
          )}
        </div>
      </div>
    </>
  );
}
