import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  variant?: "desktop" | "mobile";
}

export default function HeaderSearchPanel({ open, onClose, variant = "desktop" }: Props) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [lieu, setLieu] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && variant === "desktop") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, variant]);

  if (!open && variant === "desktop") return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (lieu.trim()) params.set("ville", lieu.trim());
    navigate(params.size ? `/recherche?${params.toString()}` : "/recherche");
    onClose();
  };

  const isMobile = variant === "mobile";

  return (
    <div
      className={
        isMobile
          ? "bg-[hsl(var(--header-ivoire))] border-b border-[hsl(var(--header-or-fonce)/0.2)] px-4 py-3"
          : "absolute left-0 right-0 top-full bg-[hsl(var(--header-ivoire))] shadow-[var(--shadow-header-mega)] border-t border-[hsl(var(--header-or-fonce)/0.15)] z-40 animate-in fade-in slide-in-from-top-2 duration-200"
      }
    >
      <form
        onSubmit={submit}
        className={
          isMobile
            ? "flex flex-col gap-2"
            : "max-w-[1320px] mx-auto px-8 py-6 flex flex-col md:flex-row items-stretch md:items-end gap-3"
        }
      >
        <div className="flex-1 space-y-1.5">
          {!isMobile && (
            <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-[hsl(var(--header-or-fonce))]">
              Que recherchez-vous ?
            </label>
          )}
          <Input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Photographe, traiteur, château…"
            className="bg-white border-[hsl(var(--header-or-fonce)/0.3)] focus-visible:ring-[hsl(var(--header-or-fonce))]"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          {!isMobile && (
            <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-[hsl(var(--header-or-fonce))]">
              Où ?
            </label>
          )}
          <Input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Ville, région…"
            className="bg-white border-[hsl(var(--header-or-fonce)/0.3)] focus-visible:ring-[hsl(var(--header-or-fonce))]"
          />
        </div>
        <Button
          type="submit"
          className="bg-[hsl(var(--header-or-fonce))] hover:bg-[hsl(var(--header-or-to))] text-white gap-2 px-6"
        >
          <Search className="w-4 h-4" />
          Rechercher
        </Button>
        {!isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="md:absolute md:top-3 md:right-4 text-[hsl(var(--header-or-fonce))] hover:opacity-70"
            aria-label="Fermer la recherche"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </form>
    </div>
  );
}
