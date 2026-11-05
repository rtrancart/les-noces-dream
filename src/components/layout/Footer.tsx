import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/regions";

const INFO_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Connecter un assistant IA", href: "/connect" },
  { label: "CGU / CGV", href: "/cgu" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
];

type Cat = { id: string; nom: string; slug: string; parent_id: string | null; ordre_affichage: number | null };
type Mere = Cat & { enfants: Cat[] };

export default function Footer() {
  const [meres, setMeres] = useState<Mere[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, nom, slug, parent_id, ordre_affichage")
      .eq("est_active", true)
      .order("ordre_affichage")
      .then(({ data }) => {
        if (!data) return;
        const all = data as Cat[];
        const roots = all.filter((c) => !c.parent_id);
        setMeres(roots.map((m) => ({ ...m, enfants: all.filter((c) => c.parent_id === m.id) })));
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
            <div className="mt-4 space-y-1 text-card/60 text-sm font-sans">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <a href="mailto:contact@lesnoces.net" className="hover:text-card transition-colors">
                  contact@lesnoces.net
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <span>02 96 01 00 17</span>
              </p>
              <p>Du lundi au jeudi de 9h à 13h</p>
              <p>Le reste du temps par mail</p>
            </div>
          </div>

          {/* Régions */}
          <div>
            <h4 className="text-base font-medium font-serif mb-4 text-primary">
              Mariage par région
            </h4>
            <ul className="space-y-2 text-card/60 text-sm font-sans">
              {REGIONS.map((r) => (
                <li key={r.slug}>
                  <Link to={`/mariage/${r.slug}`} className="hover:text-card transition-colors">
                    {r.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Informations */}
          <div className="lg:col-span-2">
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

        {/* Catégories */}
        {meres.length > 0 && (
          <div className="border-t border-card/10 pt-10 mb-12">
            <h4 className="text-base font-medium font-serif mb-6 text-primary">
              Catégories de prestataires
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-6 text-sm font-sans">
              {meres.map((m) => (
                <div key={m.id}>
                  <Link
                    to={`/prestataires/${m.slug}`}
                    className="text-card/85 font-medium hover:text-card transition-colors"
                  >
                    {m.nom}
                  </Link>
                  {m.enfants.length > 0 && (
                    <ul className="mt-1.5 space-y-1 text-card/55">
                      {m.enfants.map((e) => (
                        <li key={e.id}>
                          <Link
                            to={`/prestataires/${m.slug}/${e.slug}`}
                            className="hover:text-card transition-colors"
                          >
                            {e.nom}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
