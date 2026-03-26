import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const INFO_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "CGU", href: "/cgu" },
  { label: "Confidentialité", href: "/confidentialite" },
];

const REGIONS = [
  "Île-de-France",
  "Provence-Alpes-Côte d'Azur",
  "Auvergne-Rhône-Alpes",
  "Nouvelle-Aquitaine",
  "Occitanie",
];

export default function Footer() {
  const [categories, setCategories] = useState<{ nom: string; slug: string }[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("nom, slug")
      .is("parent_id", null)
      .eq("est_active", true)
      .order("ordre_affichage")
      .limit(5)
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  return (
    <footer className="bg-bleu-abysse text-card py-16 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-medium font-serif mb-4">
              LesNoces<span className="text-primary">.net</span>
            </h3>
            <p className="text-card/60 text-sm font-sans leading-relaxed">
              La plateforme de référence pour trouver les meilleurs prestataires
              de mariage haut de gamme.
            </p>
          </div>

          {/* Catégories */}
          <div>
            <h4 className="text-base font-medium font-serif mb-4 text-primary">
              Catégories
            </h4>
            <ul className="space-y-2 text-card/60 text-sm font-sans">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link to={`/categories/${c.slug}`} className="hover:text-card transition-colors">
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Régions */}
          <div>
            <h4 className="text-base font-medium font-serif mb-4 text-primary">
              Régions
            </h4>
            <ul className="space-y-2 text-card/60 text-sm font-sans">
              {REGIONS.map((r) => (
                <li key={r}>
                  <Link to={`/regions/${encodeURIComponent(r.toLowerCase())}`} className="hover:text-card transition-colors">
                    {r}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Informations */}
          <div>
            <h4 className="text-base font-medium font-serif mb-4 text-primary">
              Informations
            </h4>
            <ul className="space-y-2 text-card/60 text-sm font-sans">
              {INFO_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="hover:text-card transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-card/10 pt-8 flex items-center justify-between">
          <p className="text-card/40 text-sm font-sans">
            © {new Date().getFullYear()} LesNoces.net — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  );
}
