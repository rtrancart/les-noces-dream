import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, MessageCircle, Palette, CalendarCheck, BookOpen, ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/layout/Header";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useInfosCouple } from "@/components/atelier/useInfosCouple";
import { cn } from "@/lib/utils";

export const ONGLETS = [
  { to: "/atelier", label: "Accueil", icon: Home, end: true },
  { to: "/atelier/assistant", label: "Assistant", icon: MessageCircle },
  { to: "/atelier/style", label: "Notre style", icon: Palette },
  { to: "/atelier/planning", label: "Planning", icon: CalendarCheck },
  { to: "/atelier/livret", label: "Livret", icon: BookOpen },
];

function PageAcces({ connecte }: { connecte: boolean }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-atelier-fond">
      <Header />
      <div className="pt-28 pb-16 px-5 max-w-xl mx-auto text-center space-y-5">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">L'Atelier</p>
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">Préparez votre mariage avec l'Atelier</h1>
        <p className="font-sans text-muted-foreground leading-relaxed">
          Un assistant pour trouver vos prestataires, votre charte, votre planning et votre livret de cérémonie :
          l'Atelier est réservé aux futurs mariés inscrits sur LesNoces.net.
        </p>
        {connecte ? (
          <p className="font-sans text-sm text-muted-foreground">
            Votre compte n'est pas un compte de futurs mariés. Créez un compte mariés pour accéder à l'Atelier.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-atelier-or hover:bg-atelier-or/90 rounded-full px-8">
              <Link to="/connexion" state={{ from: location }}>Se connecter</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-8">
              <Link to="/inscription">Créer un compte</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AtelierLayout() {
  const { user, isLoading, hasRole, isAdmin } = useAuth();
  const location = useLocation();
  const infos = useInfosCouple();
  const plein = location.pathname.startsWith("/atelier/assistant");

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-atelier-fond"><Loader2 className="h-6 w-6 animate-spin text-atelier-or" /></div>;
  }
  const autorise = !!user && ((hasRole("client") && !hasRole("prestataire")) || isAdmin);
  if (!autorise) return <PageAcces connecte={!!user} />;

  return (
    <div className="min-h-screen bg-atelier-fond">
      <SeoHead title="L'Atelier | LesNoces.net" description="L'Atelier des futurs mariés LesNoces.net." canonicalUrl="/atelier" noindex />
      {/* Ordinateur : en-tête du site + colonne d'onglets */}
      <div className="hidden lg:block"><Header /></div>
      <div className="lg:pt-20 lg:flex">
        <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-atelier-filet bg-atelier-lin/60 sticky top-20 h-[calc(100vh-5rem)] p-5">
          <div className="flex items-center gap-3 px-2 mb-6">
            <span className="h-6 w-6 rounded-sm bg-atelier-or" aria-hidden />
            <span className="font-serif text-2xl italic text-foreground">L'Atelier</span>
          </div>
          <nav className="space-y-1">
            {ONGLETS.map((o) => (
              <NavLink key={o.to} to={o.to} end={o.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 font-sans text-sm transition-colors",
                  isActive ? "bg-card text-atelier-or font-semibold border-l-[3px] border-atelier-or shadow-[var(--shadow-card)]" : "text-foreground hover:bg-card/60",
                )}>
                <o.icon className="h-4 w-4" />{o.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-atelier-filet bg-card p-4">
            <p className="font-serif text-lg text-foreground">{infos.nom}</p>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              {infos.dateTexte ? `${infos.dateTexte}${infos.jours !== null ? ` · J-${infos.jours}` : ""}` : "Date du mariage à définir"}
            </p>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile : en-tête de 56 px */}
          <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-atelier-fond/95 backdrop-blur border-b border-atelier-filet">
            <Link to="/" aria-label="Retour au site" className="p-1 -ml-1 text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <span className="font-serif text-xl italic text-foreground">L'Atelier</span>
          </header>
          <main className={cn(!plein && "pb-24 lg:pb-10")}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile : barre d'onglets */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-atelier-filet pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {ONGLETS.map((o) => (
            <NavLink key={o.to} to={o.to} end={o.end}
              className={({ isActive }) => cn(
                "relative flex flex-col items-center gap-1 py-2.5 font-sans text-[11px]",
                isActive ? "text-atelier-or font-semibold before:absolute before:top-0 before:h-0.5 before:w-8 before:bg-atelier-or" : "text-muted-foreground",
              )}>
              <o.icon className="h-5 w-5" />{o.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
