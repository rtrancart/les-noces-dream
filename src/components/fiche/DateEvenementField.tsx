import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Valeur encodée du champ date de la demande :
 *  - "" → pas de date
 *  - "AAAA-MM-JJ" → date précise
 *  - "AAAA-MM" → mois seulement
 */
export function versParametresDate(valeur?: string | null): {
  p_date_evenement: string | null;
  p_date_precision: "jour" | "mois" | null;
} {
  const v = (valeur ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { p_date_evenement: v, p_date_precision: "jour" };
  if (/^\d{4}-\d{2}$/.test(v)) return { p_date_evenement: `${v}-01`, p_date_precision: "mois" };
  return { p_date_evenement: null, p_date_precision: null };
}

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function aujourdhuiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  value?: string;
  onChange: (v: string) => void;
  compact?: boolean;
}

export default function DateEvenementField({ value, onChange, compact }: Props) {
  const [mode, setMode] = useState<"precise" | "mois">(value && /^\d{4}-\d{2}$/.test(value) ? "mois" : "precise");
  const now = new Date();
  const anneeCourante = now.getFullYear();
  const moisCourant = now.getMonth() + 1;
  const annees = useMemo(() => [anneeCourante, anneeCourante + 1, anneeCourante + 2], [anneeCourante]);
  const h = compact ? "h-9 text-sm" : "";

  const [anneeSel, moisSel] = mode === "mois" && value && /^\d{4}-\d{2}$/.test(value) ? value.split("-") : ["", ""];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-[11px] text-primary hover:underline"
          onClick={() => { setMode((m) => (m === "precise" ? "mois" : "precise")); onChange(""); }}
        >
          {mode === "precise" ? "Je connais juste le mois" : "Date précise"}
        </button>
        {value && (
          <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={() => onChange("")}>
            Effacer
          </button>
        )}
      </div>
      {mode === "precise" ? (
        <Input type="date" min={aujourdhuiIso()} className={h} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            value={moisSel ? String(parseInt(moisSel, 10)) : ""}
            onValueChange={(m) => {
              const a = anneeSel || String(anneeCourante);
              onChange(`${a}-${m.padStart(2, "0")}`);
            }}
          >
            <SelectTrigger className={h}><SelectValue placeholder="Mois" /></SelectTrigger>
            <SelectContent>
              {MOIS.map((m, i) => (
                <SelectItem
                  key={m}
                  value={String(i + 1)}
                  disabled={(anneeSel ? parseInt(anneeSel, 10) : anneeCourante) === anneeCourante && i + 1 < moisCourant}
                >
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={anneeSel}
            onValueChange={(a) => {
              let m = moisSel ? parseInt(moisSel, 10) : moisCourant;
              if (parseInt(a, 10) === anneeCourante && m < moisCourant) m = moisCourant;
              onChange(`${a}-${String(m).padStart(2, "0")}`);
            }}
          >
            <SelectTrigger className={h}><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>
              {annees.map((a) => (<SelectItem key={a} value={String(a)}>{a}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
