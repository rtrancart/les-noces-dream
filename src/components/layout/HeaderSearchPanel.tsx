import { X } from "lucide-react";
import SearchBar from "@/components/search/SearchBar";

interface Props {
  open: boolean;
  onClose: () => void;
  variant?: "desktop" | "mobile";
}

export default function HeaderSearchPanel({ open, onClose, variant = "desktop" }: Props) {
  if (!open && variant === "desktop") return null;

  const isMobile = variant === "mobile";

  if (isMobile) {
    return (
      <div className="bg-[hsl(var(--header-ivoire))] border-b border-[hsl(var(--header-or-fonce)/0.2)] px-4 py-3">
        <SearchBar variant="header-mobile" onSubmit={onClose} />
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-full bg-[hsl(var(--header-ivoire))] shadow-[var(--shadow-header-mega)] border-t border-[hsl(var(--header-or-fonce)/0.15)] z-40 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="relative max-w-[1320px] mx-auto px-8 py-6">
        <SearchBar variant="header-desktop" onSubmit={onClose} />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-4 text-[hsl(var(--header-or-fonce))] hover:opacity-70"
          aria-label="Fermer la recherche"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
