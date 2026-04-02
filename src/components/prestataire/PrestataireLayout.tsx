import { Outlet } from "react-router-dom";
import { PrestataireSidebar } from "./PrestataireSidebar";
import { ProviderInfoBanner } from "./ProviderInfoBanner";
import Header from "@/components/layout/Header";
import { usePrestataire } from "@/hooks/usePrestataire";

export default function PrestataireLayout() {
  const { prestataire, loading } = usePrestataire();

  return (
    <>
      <Header />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Provider Info Banner */}
          {!loading && prestataire && (
            <div className="mb-6">
              <ProviderInfoBanner prestataire={prestataire} />
            </div>
          )}

          {/* Grid layout: sidebar card + content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="lg:col-span-1">
              <PrestataireSidebar />
            </div>
            <main className="lg:col-span-3 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
