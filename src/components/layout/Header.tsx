import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, Search, User } from "lucide-react";
import logoSrc from "@/assets/logo-lesnoces.png";

const NAV_LINKS = [
  { label: "Lieux de réception", href: "/categories/lieux-de-reception" },
  { label: "Devenir prestataires", href: "/inscription" },
  { label: "Inspirations & Conseils", href: "/blog" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-champagne shadow-sm">
      <div className="max-w-[1099px] mx-auto px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img src={logoSrc} alt="LesNoces.net" className="h-[60px] w-auto brightness-0 invert" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="text-sm font-sans text-white/90 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-5">
          <button
            onClick={() => navigate("/prestataires")}
            className="text-white/90 hover:text-white transition-colors"
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5" />
          </button>
            <Link
              to={user ? (isPrestataire ? "/espace-pro" : isAdmin ? "/admin" : "/mon-compte") : "/connexion"}
              className="flex items-center gap-2 text-sm font-sans text-white/90 hover:text-white transition-colors"
            >
              <User className="w-5 h-5" />
              <span>Mon compte</span>
            </Link>
        </div>

        {/* Mobile Burger */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-muted/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 space-y-3">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="block text-sm font-sans text-white/90 hover:text-white py-2"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <Link
              to={user ? "/mon-compte" : "/connexion"}
              className="flex items-center gap-2 text-sm text-white font-medium"
              onClick={() => setMobileOpen(false)}
            >
              <User className="w-4 h-4" />
              Mon compte
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}