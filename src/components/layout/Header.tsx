import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, Search, User, ChevronDown } from "lucide-react";
import logoSrc from "@/assets/logo-lesnoces.png";
import HeaderHistoriqueButton from "@/components/HeaderHistoriqueButton";
import HeaderSearchPanel from "./HeaderSearchPanel";
import HeaderMegaMenuPrestataires from "./HeaderMegaMenuPrestataires";
import HeaderMegaMenuRegions from "./HeaderMegaMenuRegions";
import HeaderMobileMenu from "./HeaderMobileMenu";

type Mega = "prestataires" | "regions" | null;

export default function Header() {
  const { user, isPrestataire, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mega, setMega] = useState<Mega>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const accountLink = user
    ? isPrestataire
      ? "/espace-pro"
      : isAdmin
      ? "/admin"
      : "/mon-compte"
    : "/connexion";

  // Close megas / search / mobile on route change
  useEffect(() => {
    setMega(null);
    setSearchOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const openMega = (m: Mega) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMega(m);
    setSearchOpen(false);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setMega(null), 150);
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        onMouseLeave={scheduleClose}
      >
        <div className="bg-gradient-to-b from-[hsl(var(--header-or-from))] to-[hsl(var(--header-or-to))] shadow-[0_8px_24px_-12px_hsl(var(--header-or-fonce)/0.4)]">
          <div className="max-w-[1320px] mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center gap-3 md:gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center shrink-0">
              <img
                src={logoSrc}
                alt="LesNoces.net"
                className="h-10 md:h-[52px] w-auto brightness-0 invert"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex flex-1 items-center justify-center gap-8">
              <button
                onMouseEnter={() => openMega("prestataires")}
                onClick={() => openMega(mega === "prestataires" ? null : "prestataires")}
                className={`flex items-center gap-1.5 font-sans text-[15px] text-white/95 hover:text-white tracking-wide transition-colors ${
                  mega === "prestataires" ? "text-white" : ""
                }`}
              >
                Prestataires
                <ChevronDown
                  className={`w-3 h-3 opacity-80 transition-transform ${
                    mega === "prestataires" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <button
                onMouseEnter={() => openMega("regions")}
                onClick={() => openMega(mega === "regions" ? null : "regions")}
                className={`flex items-center gap-1.5 font-sans text-[15px] text-white/95 hover:text-white tracking-wide transition-colors ${
                  mega === "regions" ? "text-white" : ""
                }`}
              >
                Mariage par région
                <ChevronDown
                  className={`w-3 h-3 opacity-80 transition-transform ${
                    mega === "regions" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <Link
                to="/blog"
                className="font-sans text-[15px] text-white/95 hover:text-white tracking-wide transition-colors"
              >
                Inspirations & Conseils
              </Link>
            </nav>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-5 shrink-0">
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setMega(null);
                }}
                className="text-white/95 hover:text-white"
                aria-label="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>
              <HeaderHistoriqueButton />
              <Link
                to={accountLink}
                className="flex items-center gap-2 font-sans text-[13.5px] text-white/95 hover:text-white"
              >
                <User className="w-5 h-5" />
                <span>Mon compte</span>
              </Link>
              <Link
                to="/inscription"
                className="px-4 py-2 rounded-full border border-white/55 font-sans text-[12.5px] text-white tracking-wide hover:bg-white hover:text-[hsl(var(--header-or-fonce))] transition-colors whitespace-nowrap"
              >
                Vous êtes prestataire&nbsp;?
              </Link>
            </div>

            {/* Mobile actions */}
            <div className="md:hidden flex items-center gap-3 ml-auto">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="text-white/95 p-1"
                aria-label="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>
              <HeaderHistoriqueButton />
              <button
                onClick={() => setMobileOpen(true)}
                className="text-white p-1"
                aria-label="Menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Search panel (desktop + mobile slide-down) */}
          {searchOpen && (
            <HeaderSearchPanel
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              variant="desktop"
            />
          )}

          {/* Mega menus */}
          {mega === "prestataires" && (
            <div onMouseEnter={() => openMega("prestataires")}>
              <HeaderMegaMenuPrestataires onNavigate={() => setMega(null)} />
            </div>
          )}
          {mega === "regions" && (
            <div onMouseEnter={() => openMega("regions")}>
              <HeaderMegaMenuRegions onNavigate={() => setMega(null)} />
            </div>
          )}
        </div>
      </header>

      <HeaderMobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        accountLink={accountLink}
      />
    </>
  );
}
