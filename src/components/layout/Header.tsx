import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoSrc from "@/assets/logo-lesnoces.png";

const NAV_LINKS = [
  { label: "Prestataires", href: "/prestataires" },
  { label: "Catégories", href: "/categories" },
  { label: "Régions", href: "/regions" },
  { label: "Blog", href: "/blog" },
  { label: "À propos", href: "/a-propos" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-[1099px] mx-auto px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img src={logoSrc} alt="LesNoces.net" className="h-10 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="text-sm font-sans text-foreground hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => navigate("/mon-compte")}>
              Mon compte
            </Button>
          ) : (
            <>
              <Link
                to="/connexion"
                className="text-sm font-sans text-foreground hover:text-primary transition-colors px-4 py-2"
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                className="text-sm font-sans text-primary-foreground bg-primary hover:bg-primary/90 transition-colors px-4 py-2 rounded-md"
              >
                Inscrire mon entreprise
              </Link>
            </>
          )}
        </div>

        {/* Mobile Burger */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-t border-border px-6 py-4 space-y-3">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="block text-sm font-sans text-foreground hover:text-primary py-2"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border space-y-2">
            {user ? (
              <Link to="/mon-compte" className="block text-sm text-primary font-medium" onClick={() => setMobileOpen(false)}>
                Mon compte
              </Link>
            ) : (
              <>
                <Link to="/connexion" className="block text-sm text-foreground" onClick={() => setMobileOpen(false)}>
                  Connexion
                </Link>
                <Link
                  to="/inscription"
                  className="block text-sm text-primary-foreground bg-primary text-center py-2 rounded-md"
                  onClick={() => setMobileOpen(false)}
                >
                  Inscrire mon entreprise
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
