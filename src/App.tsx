import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ZonesProvider } from "@/contexts/ZonesContext";
import ScrollToTop from "@/components/ScrollToTop";
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
import FichePrestatairePreview from "./pages/FichePrestatairePreview";
import PrestatairesConsultes from "./pages/PrestatairesConsultes";
import Unsubscribe from "./pages/Unsubscribe";
import Blog from "./pages/Blog";
import BlogArticle from "./pages/BlogArticle";
import MariageRegion from "./pages/MariageRegion";
import PrestatairesListe from "./pages/PrestatairesListe";
import AccepterInvitation from "./pages/AccepterInvitation";
import SignerLaCharte from "./pages/SignerLaCharte";
import CharteQualite from "./pages/CharteQualite";
import Reactivation from "./pages/Reactivation";
import CharteProgressive from "./pages/CharteProgressive";
import PageContenu from "./pages/PageContenu";
import OAuthConsent from "./pages/OAuthConsent";
import Connect from "./pages/Connect";

// Client
import ClientLayout from "./components/client/ClientLayout";
import ClientDashboard from "./pages/client/Dashboard";
import ClientMessagerie from "./pages/client/Messagerie";
import ClientFavoris from "./pages/client/Favoris";
import ClientHistorique from "./pages/client/Historique";
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
import AdminEmails from "./pages/admin/Emails";
import AdminRegions from "./pages/admin/Regions";
import { Navigate } from "react-router-dom";
import ChartePendingGuard from "@/components/auth/ChartePendingGuard";
import AdminChartes from "./pages/admin/Chartes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ZonesProvider>
          <ChartePendingGuard>
          <Routes>
            {/* Public pages with Header + Footer */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/recherche" element={<Recherche />} />
              <Route path="/prestataire/:slug" element={<FichePrestataire />} />
              <Route path="/prestataires-consultes" element={<PrestatairesConsultes />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogArticle />} />
              <Route path="/mariage/:slug" element={<MariageRegion />} />
              <Route path="/prestataires/:slugMere" element={<PrestatairesListe />} />
              <Route path="/prestataires/:slugMere/:slug2" element={<PrestatairesListe />} />
              <Route path="/charte-qualite" element={<CharteQualite />} />
              <Route path="/cgu" element={<PageContenu />} />
              <Route path="/mentions-legales" element={<PageContenu />} />
              <Route path="/confidentialite" element={<PageContenu />} />
              <Route path="/page/:slug" element={<PageContenu />} />
              <Route path="/connect" element={<Connect />} />
            </Route>

            {/* Auth pages (no Header/Footer) */}
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/accept-invitation" element={<AccepterInvitation />} />
            <Route path="/signer-la-charte" element={<ProtectedRoute><SignerLaCharte /></ProtectedRoute>} />
            <Route path="/pro/charte" element={<ProtectedRoute><CharteProgressive /></ProtectedRoute>} />
            <Route path="/reactivation" element={<Reactivation />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

            {/* Prévisualisation de fiche — accès contrôlé côté serveur par la RPC
                get_prestataire_preview / _by_id (admin, super_admin, ou propriétaire). */}
            <Route path="/prestataire/:slug/preview" element={<ProtectedRoute><FichePrestatairePreview /></ProtectedRoute>} />
            <Route path="/prestataire/id/:id/preview" element={<ProtectedRoute><FichePrestatairePreview /></ProtectedRoute>} />

            {/* Espace client */}
            <Route
              path="/mon-compte"
              element={
                <ProtectedRoute>
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientDashboard />} />
              <Route path="messagerie" element={<ClientMessagerie />} />
              <Route path="favoris" element={<ClientFavoris />} />
              <Route path="historique" element={<ClientHistorique />} />
              <Route path="parametres" element={<ClientParametres />} />
            </Route>

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
              <Route path="emails" element={<AdminEmails />} />
              <Route path="regions" element={<AdminRegions />} />
              <Route path="prestataires-pre-inscrits" element={<Navigate to="/admin/prestataires" replace />} />
              <Route path="chartes" element={<AdminChartes />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ChartePendingGuard>
          </ZonesProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
