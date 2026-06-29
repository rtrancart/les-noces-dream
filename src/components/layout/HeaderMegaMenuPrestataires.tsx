import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useHeaderCategories } from "@/hooks/useHeaderCategories";
import CategoryMedallion from "./CategoryMedallion";

interface Props {
  onNavigate: () => void;
}

export default function HeaderMegaMenuPrestataires({ onNavigate }: Props) {
  const { data: familles, isLoading } = useHeaderCategories();

  return (
    <div
      className="absolute left-0 right-0 top-full bg-[hsl(var(--header-ivoire))] shadow-[var(--shadow-header-mega)] border-t border-[hsl(var(--header-or-fonce)/0.15)] z-40 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="max-w-[1320px] mx-auto px-8 py-8">
        {isLoading || !familles ? (
          <div className="grid grid-cols-3 gap-x-10 gap-y-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-3 w-32 bg-[hsl(var(--header-or-fonce)/0.15)] rounded animate-pulse" />
                <div className="h-9 bg-[hsl(var(--header-or-fonce)/0.08)] rounded animate-pulse" />
                <div className="h-9 bg-[hsl(var(--header-or-fonce)/0.08)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
              {familles.map((f) => (
                <div key={f.cle}>
                  <h4 className="flex items-center gap-3 text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[hsl(var(--header-or-fonce))] mb-4">
                    <span>{f.libelle}</span>
                    <span className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--header-or-fonce)/0.3)] to-transparent" />
                  </h4>
                  <ul className="space-y-2.5">
                    {f.meres.map((m) => (
                      <li key={m.id}>
                        <Link
                          to={`/recherche?categorie=${m.slug}&lieu=france_entiere`}
                          onClick={onNavigate}
                          className="group flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--header-or-fonce)/0.06)] transition-colors"
                        >
                          <CategoryMedallion iconUrl={m.icone_url} alt={m.nom} />
                          <span className="font-sans text-sm text-foreground/85 group-hover:text-[hsl(var(--header-or-fonce))] leading-tight">
                            {m.nom}
                          </span>
                        </Link>
                        {m.enfants.length > 0 && (
                          <ul className="ml-[54px] mt-1 mb-1 space-y-0.5">
                            {m.enfants.map((s) => (
                              <li key={s.id}>
                                <Link
                                  to={`/recherche?categorie=${s.slug}&lieu=france_entiere`}
                                  onClick={onNavigate}
                                  className="block py-1 font-sans text-[12.5px] text-muted-foreground hover:text-[hsl(var(--header-or-fonce))] transition-colors"
                                >
                                  · {s.nom}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-5 border-t border-[hsl(var(--header-or-fonce)/0.15)] flex justify-end">
              <Link
                to="/prestataires"
                onClick={onNavigate}
                className="inline-flex items-center gap-2 font-sans text-sm text-[hsl(var(--header-or-fonce))] hover:underline"
              >
                Voir toutes les catégories
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
