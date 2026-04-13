import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PublicLayout from "@/components/layout/PublicLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Connexion from "./pages/Connexion";
import Inscription from "./pages/Inscription";
import MotDePasseOublie from "./pages/MotDePasseOublie";
import ResetPassword from "./pages/ResetPassword";
import Recherche from "./pages/Recherche";
import FichePrestataire from "./pages/FichePrestataire";

// Client
import ClientLayout from "./components/client/ClientLayout";
import ClientDashboard from "./pages/client/Dashboard";
import ClientMessagerie from "./pages/client/Messagerie";
import ClientFavoris from "./pages/client/Favoris";
import ClientParametres from "./pages/client/Parametres";

// Prestataire
import PrestataireLayout from "./components/prestataire/PrestataireLayout";
import PrestataireDashboard from "./pages/prestataire/Dashboard";
import PrestataireProfil from "./pages/prestataire/Profil";
import PrestataireGalerie from "./pages/prestataire/Galerie";
import PrestataireDemandes from "./pages/prestataire/Demandes";
import PrestataireAvis from "./pages/prestataire/Avis";
import PrestataireStatistiques from "./pages/prestataire/Statistiques";
import PrestataireParametres from "./pages/prestataire/Parametres";
import PrestataireAbonnement from "./pages/prestataire/Abonnement";
import PrestatairePrestation from "./pages/prestataire/Prestation";

// Admin
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminPrestataires from "./pages/admin/Prestataires";
import AdminCategories from "./pages/admin/Categories";
import AdminDemandes from "./pages/admin/Demandes";
import AdminAvis from "./pages/admin/Avis";
import AdminUtilisateurs from "./pages/admin/Utilisateurs";
import AdminArticles from "./pages/admin/Articles";
import AdminPages from "./pages/admin/Pages";
import AdminLogs from "./pages/admin/Logs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public pages with Header + Footer */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/recherche" element={<Recherche />} />
              <Route path="/prestataire/:slug" element={<FichePrestataire />} />
            </Route>

            {/* Auth pages (no Header/Footer) */}
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Espace prestataire */}
            <Route
              path="/espace-pro"
              element={
                <ProtectedRoute requiredRole="prestataire">
                  <PrestataireLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PrestataireDashboard />} />
              <Route path="profil" element={<PrestataireProfil />} />
              <Route path="prestation" element={<PrestatairePrestation />} />
              <Route path="galerie" element={<PrestataireGalerie />} />
              <Route path="demandes" element={<PrestataireDemandes />} />
              <Route path="avis" element={<PrestataireAvis />} />
              <Route path="statistiques" element={<PrestataireStatistiques />} />
              <Route path="abonnement" element={<PrestataireAbonnement />} />
              <Route path="parametres" element={<PrestataireParametres />} />
            </Route>

            {/* Admin back-office */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="prestataires" element={<AdminPrestataires />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="demandes" element={<AdminDemandes />} />
              <Route path="avis" element={<AdminAvis />} />
              <Route path="utilisateurs" element={<AdminUtilisateurs />} />
              <Route path="articles" element={<AdminArticles />} />
              <Route path="pages" element={<AdminPages />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
