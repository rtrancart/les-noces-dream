import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import FavoriButton from "@/components/favoris/FavoriButton";
import type { HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";

interface Props {
  entries: HistoriqueEntry[];
  categorySlugByName?: Record<string, string>;
}

function formatRelative(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(date).toLocaleDateString("fr-FR");
}

const ALL = "__all__";

export default function HistoriqueByCategory({ entries, categorySlugByName = {} }: Props) {
  const [filter, setFilter] = useState<string>(ALL);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoriqueEntry[]>();
    for (const e of entries) {
      if (!e.prestataire) continue;
      const cat = e.prestataire.categorie_nom || "Autre";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    return map;
  }, [entries]);

  const categories = useMemo(
    () => Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length),
    [grouped]
  );

  const filtered = filter === ALL ? categories : categories.filter(([c]) => c === filter);

  return (
    <div className="space-y-8">
      {/* Filtres pills — scroll horizontal sur mobile, wrap sur desktop */}
      <div className="relative -mx-4 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto sm:flex-wrap px-4 sm:px-0 pb-2 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterPill
            active={filter === ALL}
            label="Tout voir"
            count={entries.filter((e) => e.prestataire).length}
            onClick={() => setFilter(ALL)}
          />
          {categories.map(([cat, items]) => (
            <FilterPill
              key={cat}
              active={filter === cat}
              label={cat}
              count={items.length}
              onClick={() => setFilter(cat)}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      {/* Sections par catégorie */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="font-sans text-sm text-muted-foreground">
            Aucun prestataire dans cette catégorie
          </p>
        </div>
      ) : (
        filtered.map(([cat, items]) => {
          const slug = categorySlugByName[cat];
          return (
            <section key={cat} className="space-y-4">
              <div className="flex items-end justify-between gap-3 border-l-4 border-primary pl-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-lg sm:text-xl text-foreground truncate">{cat}</h2>
                  <p className="font-sans text-xs text-muted-foreground mt-0.5">
                    {items.length} prestataire{items.length > 1 ? "s" : ""}
                  </p>
                </div>
                {slug && (
                  <Link
                    to={`/recherche?categorie=${slug}`}
                    className="font-sans text-sm text-primary hover:underline whitespace-nowrap shrink-0"
                  >
                    <span className="sm:hidden">Voir tout →</span>
                    <span className="hidden sm:inline">Voir tous les {cat.toLowerCase()}s →</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((e) => (
                  <HistoriqueCard key={e.prestataire_id} entry={e} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-sans text-sm whitespace-nowrap shrink-0 transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-medium ${
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function HistoriqueCard({ entry }: { entry: HistoriqueEntry }) {
  const p = entry.prestataire!;
  return (
    <Link
      to={`/prestataire/${p.slug}`}
      className="group block rounded-xl overflow-hidden bg-card hover:shadow-elevated transition-all"
    >
      <div className="relative aspect-[4/3] bg-secondary/30 overflow-hidden">
        {p.photo_principale_url ? (
          <img
            src={p.photo_principale_url}
            alt={p.nom_commercial}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-foreground/70 text-background rounded-md text-xs font-sans">
          {formatRelative(entry.consulte_le)}
        </div>
        <FavoriButton
          prestataireId={p.id}
          size="sm"
          className="absolute top-2 right-2"
        />
      </div>
      <div className="p-3">
        <p className="font-sans text-sm font-medium text-foreground truncate">{p.nom_commercial}</p>
        <p className="font-sans text-xs text-muted-foreground truncate mt-0.5">{p.ville}</p>
      </div>
    </Link>
  );
}
