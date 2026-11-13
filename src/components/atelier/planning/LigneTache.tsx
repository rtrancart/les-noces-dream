import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, MoreHorizontal, Search, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { dateCourte, type ModeleLien, type Tache } from "@/lib/planning";

type Props = {
  tache: Tache; lien?: ModeleLien; compacte?: boolean;
  onCocher: (t: Tache) => void; onEcheance?: (t: Tache, date: string) => void; onMasquer?: (t: Tache) => void; onSupprimer?: (t: Tache) => void;
};

export default function LigneTache({ tache: t, lien, compacte, onCocher, onEcheance, onMasquer, onSupprimer }: Props) {
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState(false);
  const [edition, setEdition] = useState(false);
  const message = lien?.categorie_prestataire ? (lien.message_assistant || `Nous cherchons : ${lien.categorie_prestataire.toLowerCase()} pour notre mariage.`) : null;
  const module = lien?.lien_module === "style" ? { to: "/atelier/style", label: "Ouvrir Notre style" }
    : lien?.lien_module === "livret" ? { to: "/atelier/livret", label: "Ouvrir le livret" } : null;

  return (
    <div className="flex gap-3 py-3">
      <button type="button" role="checkbox" aria-checked={t.faite} aria-label={t.faite ? `Décocher « ${t.titre} »` : `Cocher « ${t.titre} »`}
        onClick={() => onCocher(t)}
        className={cn("mt-0.5 h-6 w-6 shrink-0 rounded-md border-2 transition-colors",
          t.faite ? "bg-atelier-or border-atelier-or" : "border-atelier-filet bg-card hover:border-atelier-or")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => t.description && setOuverte(!ouverte)} className="text-left min-w-0 flex-1">
            <span className={cn("font-sans text-[15px] font-medium leading-snug", t.faite ? "line-through text-muted-foreground" : "text-foreground")}>{t.titre}</span>
            {t.priorite === 3 && <span className="ml-2 align-middle font-sans text-[11px] text-muted-foreground">facultatif</span>}
            {t.description && !compacte && <ChevronDown className={cn("inline ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform", ouverte && "rotate-180")} />}
          </button>
          {!compacte && (onMasquer || onSupprimer) && (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Plus d'options" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-atelier-lin"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEcheance && <DropdownMenuItem onClick={() => setEdition(true)}>Changer l'échéance</DropdownMenuItem>}
                {onMasquer && <DropdownMenuItem onClick={() => onMasquer(t)}>Masquer</DropdownMenuItem>}
                {t.perso && onSupprimer && <DropdownMenuItem className="text-destructive" onClick={() => onSupprimer(t)}>Supprimer</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {edition && onEcheance ? (
          <input type="date" autoFocus defaultValue={t.date_echeance} aria-label="Nouvelle échéance"
            className="mt-1 rounded-md border border-atelier-filet bg-card px-2 py-1 font-sans text-sm"
            onBlur={(e) => { setEdition(false); if (e.target.value && e.target.value !== t.date_echeance) onEcheance(t, e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdition(false); }} />
        ) : (
          <button type="button" disabled={!onEcheance || compacte} onClick={() => setEdition(true)}
            className="block font-sans text-xs text-muted-foreground mt-0.5 enabled:hover:text-atelier-or">
            {t.faite && t.faite_le ? `Fait le ${dateCourte(t.faite_le.slice(0, 10))}` : `Avant le ${dateCourte(t.date_echeance)}`}
          </button>
        )}
        {ouverte && t.description && !compacte && <p className="font-sans text-sm text-muted-foreground mt-1.5 leading-relaxed">{t.description}</p>}
        {!t.faite && !compacte && (message || module) && (
          <div className="mt-2">
            {message && (
              <button type="button" onClick={() => navigate("/atelier/assistant", { state: { message } })}
                className="inline-flex items-center gap-2 rounded-full bg-atelier-lin px-4 py-2 font-sans text-sm font-semibold text-atelier-or hover:bg-atelier-lin/70">
                <Search className="h-4 w-4" />Trouver un prestataire
              </button>
            )}
            {module && (
              <button type="button" onClick={() => navigate(module.to)}
                className="inline-flex items-center gap-2 rounded-full bg-atelier-lin px-4 py-2 font-sans text-sm font-semibold text-atelier-or hover:bg-atelier-lin/70">
                {module.label}<ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {compacte && message && !t.faite && (
        <button type="button" onClick={() => navigate("/atelier/assistant", { state: { message } })}
          className="hidden sm:inline-flex self-center shrink-0 items-center gap-1.5 rounded-full bg-atelier-lin px-3 py-1.5 font-sans text-xs font-semibold text-atelier-or">
          <Search className="h-3.5 w-3.5" />Trouver un prestataire
        </button>
      )}
    </div>
  );
}
