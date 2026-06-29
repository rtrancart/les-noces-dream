import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, X, User, MapPin } from "lucide-react";
import { useHeaderCategories, useHeaderRegions, type HeaderMereCategory } from "@/hooks/useHeaderCategories";
import HeaderSearchPanel from "./HeaderSearchPanel";
import CategoryMedallion from "./CategoryMedallion";

interface Props {
  open: boolean;
  onClose: () => void;
  accountLink: string;
}

type Panel =
  | { kind: "root" }
  | { kind: "prestataires" }
  | { kind: "regions" }
  | { kind: "sous-categories"; mere: HeaderMereCategory };

const slide = {
  enter: { x: "100%" },
  active: { x: 0 },
  exit: { x: "-100%" },
};

export default function HeaderMobileMenu({ open, onClose, accountLink }: Props) {
  const [stack, setStack] = useState<Panel[]>([{ kind: "root" }]);
  const top = stack[stack.length - 1];
  const push = (p: Panel) => setStack((s) => [...s, p]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const close = () => {
    onClose();
    setTimeout(() => setStack([{ kind: "root" }]), 250);
  };

  const { data: familles } = useHeaderCategories();
  const { data: regions } = useHeaderRegions();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-[hsl(var(--header-ivoire))] flex flex-col shadow-2xl">
        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 h-14 border-b border-[hsl(var(--header-or-fonce)/0.2)] bg-gradient-to-b from-[hsl(var(--header-or-from))] to-[hsl(var(--header-or-to))]">
          {top.kind === "root" ? (
            <span className="font-serif text-white text-lg tracking-wide">Menu</span>
          ) : (
            <button
              onClick={back}
              className="flex items-center gap-2 text-white font-sans text-sm"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Retour</span>
            </button>
          )}
          <button onClick={close} className="text-white p-2 -mr-2" aria-label="Fermer le menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search persistant */}
        <HeaderSearchPanel open onClose={close} variant="mobile" />

        {/* Stacked panels */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={stack.length + "-" + top.kind + ("mere" in top ? "-" + top.mere.id : "")}
              initial={slide.enter}
              animate={slide.active}
              exit={slide.exit}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              {top.kind === "root" && (
                <RootPanel
                  onPrestataires={() => push({ kind: "prestataires" })}
                  onRegions={() => push({ kind: "regions" })}
                  onClose={close}
                  accountLink={accountLink}
                />
              )}
              {top.kind === "prestataires" && (
                <PrestatairesPanel
                  familles={familles ?? []}
                  onMere={(m) =>
                    m.enfants.length > 0 ? push({ kind: "sous-categories", mere: m }) : close()
                  }
                  onClose={close}
                />
              )}
              {top.kind === "regions" && <RegionsPanel regions={regions ?? []} onClose={close} />}
              {top.kind === "sous-categories" && (
                <SousCategoriesPanel mere={top.mere} onClose={close} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function RootPanel({
  onPrestataires,
  onRegions,
  onClose,
  accountLink,
}: {
  onPrestataires: () => void;
  onRegions: () => void;
  onClose: () => void;
  accountLink: string;
}) {
  return (
    <nav className="py-2">
      <DrillRow label="Prestataires" onClick={onPrestataires} />
      <DrillRow label="Mariage par région" onClick={onRegions} />
      <NavRow to="/blog" onClick={onClose}>Inspirations & Conseils</NavRow>
      <div className="h-px bg-[hsl(var(--header-or-fonce)/0.15)] my-2 mx-5" />
      <NavRow to={accountLink} onClick={onClose} icon={<User className="w-4 h-4" />}>
        Mon compte
      </NavRow>
      <div className="px-5 pt-4 pb-6">
        <Link
          to="/inscription"
          onClick={onClose}
          className="block w-full text-center py-3 rounded-full border border-[hsl(var(--header-or-fonce))] text-[hsl(var(--header-or-fonce))] font-sans text-sm font-medium hover:bg-[hsl(var(--header-or-fonce))] hover:text-white transition-colors"
        >
          Vous êtes prestataire&nbsp;?
        </Link>
      </div>
    </nav>
  );
}

function PrestatairesPanel({
  familles,
  onMere,
  onClose,
}: {
  familles: ReturnType<typeof useHeaderCategories>["data"] extends infer T
    ? T extends undefined
      ? never
      : T
    : never;
  onMere: (m: HeaderMereCategory) => void;
  onClose: () => void;
}) {
  if (!familles || familles.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Chargement…</p>;
  }
  return (
    <div className="py-3">
      {familles.map((f) => (
        <div key={f.cle} className="mb-4">
          <h4 className="px-5 mb-2 flex items-center gap-3 text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[hsl(var(--header-or-fonce))]">
            <span>{f.libelle}</span>
            <span className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--header-or-fonce)/0.3)] to-transparent" />
          </h4>
          <ul>
            {f.meres.map((m) => (
              <li key={m.id}>
                {m.enfants.length > 0 ? (
                  <button
                    onClick={() => onMere(m)}
                    className="w-full flex items-center gap-3 px-5 py-3 min-h-[52px] hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)] transition-colors text-left"
                  >
                    <CategoryMedallion iconUrl={m.icone_url} alt={m.nom} />
                    <span className="flex-1 font-sans text-[15px] text-foreground/90">{m.nom}</span>
                    <ChevronRight className="w-4 h-4 text-[hsl(var(--header-or-fonce))]" />
                  </button>
                ) : (
                  <Link
                    to={`/recherche?categorie=${m.slug}&lieu=france_entiere`}
                    onClick={onClose}
                    className="w-full flex items-center gap-3 px-5 py-3 min-h-[52px] hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)] transition-colors"
                  >
                    <CategoryMedallion iconUrl={m.icone_url} alt={m.nom} />
                    <span className="flex-1 font-sans text-[15px] text-foreground/90">{m.nom}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="px-5 py-4 border-t border-[hsl(var(--header-or-fonce)/0.15)]">
        <Link
          to="/prestataires"
          onClick={onClose}
          className="block text-center font-sans text-sm text-[hsl(var(--header-or-fonce))] py-2"
        >
          Voir toutes les catégories →
        </Link>
      </div>
    </div>
  );
}

function SousCategoriesPanel({
  mere,
  onClose,
}: {
  mere: HeaderMereCategory;
  onClose: () => void;
}) {
  return (
    <div className="py-3">
      <div className="px-5 pb-4 flex items-center gap-3 border-b border-[hsl(var(--header-or-fonce)/0.15)] mb-2">
        <CategoryMedallion iconUrl={mere.icone_url} alt={mere.nom} />
        <div className="flex-1">
          <p className="font-serif text-base text-foreground">{mere.nom}</p>
          <Link
            to={`/recherche?categorie=${mere.slug}&lieu=france_entiere`}
            onClick={onClose}
            className="font-sans text-xs text-[hsl(var(--header-or-fonce))]"
          >
            Tout voir →
          </Link>
        </div>
      </div>
      <ul>
        {mere.enfants.map((s) => (
          <li key={s.id}>
            <Link
              to={`/recherche?categorie=${s.slug}&lieu=france_entiere`}
              onClick={onClose}
              className="flex items-center justify-between px-5 py-3 min-h-[52px] font-sans text-[15px] text-foreground/90 hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)]"
            >
              {s.nom}
              <ChevronRight className="w-4 h-4 text-[hsl(var(--header-or-fonce)/0.6)]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RegionsPanel({
  regions,
  onClose,
}: {
  regions: { slug_region: string; nom_region: string }[];
  onClose: () => void;
}) {
  if (regions.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucune région publiée.</p>;
  }
  return (
    <ul className="py-2">
      {regions.map((r) => (
        <li key={r.slug_region}>
          <Link
            to={`/mariage/${r.slug_region}`}
            onClick={onClose}
            className="flex items-center gap-3 px-5 py-3 min-h-[52px] hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)]"
          >
            <MapPin className="w-4 h-4 text-[hsl(var(--header-or-fonce))]" />
            <span className="font-sans text-[15px] text-foreground/90">{r.nom_region}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DrillRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] font-sans text-[15px] text-foreground hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)] transition-colors text-left"
    >
      {label}
      <ChevronRight className="w-5 h-5 text-[hsl(var(--header-or-fonce))]" />
    </button>
  );
}

function NavRow({
  to,
  onClick,
  children,
  icon,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-4 min-h-[56px] font-sans text-[15px] text-foreground hover:bg-[hsl(var(--header-or-fonce)/0.06)] active:bg-[hsl(var(--header-or-fonce)/0.1)] transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
