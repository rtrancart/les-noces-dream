import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export type ChampCategorie = Tables<"champs_categories">;
export type ChampsValues = Record<string, unknown>;

const GROUPE_PAR_DEFAUT = "Informations complémentaires";

/** Un champ conditionnel n'est visible que si sa condition est satisfaite. */
export function isChampVisible(champ: ChampCategorie, values: ChampsValues): boolean {
  if (!champ.condition_cle) return true;
  const current = values[champ.condition_cle];
  const attendu = (champ.condition_valeur ?? "").trim().toLowerCase();
  if (typeof current === "boolean") {
    return current === (attendu === "true" || attendu === "oui" || attendu === "1");
  }
  if (Array.isArray(current)) {
    return current.some((v) => String(v).trim().toLowerCase() === attendu);
  }
  if (current == null) return false;
  return String(current).trim().toLowerCase() === attendu;
}

function isRenseigne(champ: ChampCategorie, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (champ.type_champ === "booleen") return typeof value === "boolean";
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

/**
 * Construit l'objet à écrire : fusion avec l'existant (édition partielle),
 * champs masqués retirés, typage conforme au référentiel.
 */
export function buildChampsPayload(
  champs: ChampCategorie[],
  values: ChampsValues,
  existing: ChampsValues,
): ChampsValues {
  const payload: ChampsValues = { ...(existing ?? {}) };
  for (const champ of champs) {
    const visible = isChampVisible(champ, values);
    if (!visible) {
      delete payload[champ.cle];
      continue;
    }
    const raw = values[champ.cle];
    if (!isRenseigne(champ, raw)) {
      delete payload[champ.cle];
      continue;
    }
    switch (champ.type_champ) {
      case "booleen":
        payload[champ.cle] = Boolean(raw);
        break;
      case "multi_choix":
        payload[champ.cle] = (raw as unknown[]).map(String);
        break;
      case "nombre": {
        const n = Number(raw);
        if (Number.isNaN(n)) delete payload[champ.cle];
        else payload[champ.cle] = n;
        break;
      }
      default:
        payload[champ.cle] = String(raw);
    }
  }
  return payload;
}

interface Props {
  categorieMereId: string | null;
  categorieFilleId: string | null;
  values: ChampsValues;
  onChange: (values: ChampsValues) => void;
  onChampsLoaded: (champs: ChampCategorie[]) => void;
}

export default function ChampsSpecifiquesForm({
  categorieMereId,
  categorieFilleId,
  values,
  onChange,
  onChampsLoaded,
}: Props) {
  const [champs, setChamps] = useState<ChampCategorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const ids = [categorieMereId, categorieFilleId].filter(Boolean) as string[];
      const filtre = ids.length
        ? `categorie_id.is.null,categorie_id.in.(${ids.join(",")})`
        : "categorie_id.is.null";
      const { data, error } = await supabase
        .from("champs_categories")
        .select("*")
        .or(filtre)
        .order("groupe", { ascending: true, nullsFirst: false })
        .order("ordre_affichage", { ascending: true });
      if (cancelled) return;
      if (error) console.error(error);
      const rows = (data ?? []) as ChampCategorie[];
      setChamps(rows);
      onChampsLoaded(rows);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorieMereId, categorieFilleId]);

  const groupes = useMemo(() => {
    const map = new Map<string, ChampCategorie[]>();
    for (const c of champs) {
      const g = c.groupe?.trim() || GROUPE_PAR_DEFAUT;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return [...map.entries()];
  }, [champs]);

  const visibles = useMemo(
    () => champs.filter((c) => isChampVisible(c, values)),
    [champs, values],
  );
  const remplis = visibles.filter((c) => isRenseigne(c, values[c.cle])).length;

  const setValue = (cle: string, v: unknown) => onChange({ ...values, [cle]: v });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (champs.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-foreground py-4">
        Aucun champ spécifique n'est encore défini pour votre catégorie.
      </p>
    );
  }

  const pct = visibles.length ? Math.round((remplis / visibles.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Indicateur de complétion — purement incitatif */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-sans text-xs text-muted-foreground">
          <span>
            {remplis} champ{remplis > 1 ? "s" : ""} renseigné{remplis > 1 ? "s" : ""} sur{" "}
            {visibles.length}
          </span>
          <span>{pct} %</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="font-sans text-xs text-muted-foreground">
          Facultatif : ces informations enrichissent votre fiche, elles ne conditionnent ni sa
          validation ni sa visibilité.
        </p>
      </div>

      {groupes.map(([groupe, items], idx) => {
        const itemsVisibles = items.filter((c) => isChampVisible(c, values));
        if (itemsVisibles.length === 0) return null;
        const open = openGroups[groupe] ?? idx === 0;
        const nbRemplis = itemsVisibles.filter((c) => isRenseigne(c, values[c.cle])).length;
        return (
          <Collapsible
            key={groupe}
            open={open}
            onOpenChange={(o) => setOpenGroups((s) => ({ ...s, [groupe]: o }))}
            className="rounded-lg border border-border"
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-4 py-3 h-auto text-left"
              >
                <span className="font-sans text-sm font-medium">{groupe}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-sans text-xs text-muted-foreground">
                    {nbRemplis}/{itemsVisibles.length}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                  />
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-1 space-y-5">
              {itemsVisibles.map((champ) => {
                const v = values[champ.cle];
                switch (champ.type_champ) {
                  case "booleen":
                    return (
                      <div key={champ.id} className="flex items-center justify-between gap-4">
                        <Label className="font-sans text-sm leading-snug">{champ.label}</Label>
                        <Switch
                          checked={v === true}
                          onCheckedChange={(c) => setValue(champ.cle, c)}
                        />
                      </div>
                    );
                  case "liste":
                    return (
                      <div key={champ.id} className="space-y-2">
                        <Label className="font-sans text-sm">{champ.label}</Label>
                        <Select
                          value={typeof v === "string" && v ? v : undefined}
                          onValueChange={(val) => setValue(champ.cle, val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Non renseigné" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {(champ.options_liste ?? []).map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  case "multi_choix": {
                    const arr = Array.isArray(v) ? (v as string[]) : [];
                    return (
                      <div key={champ.id} className="space-y-2">
                        <Label className="font-sans text-sm">{champ.label}</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(champ.options_liste ?? []).map((o) => (
                            <label
                              key={o}
                              className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 cursor-pointer"
                            >
                              <Checkbox
                                checked={arr.includes(o)}
                                onCheckedChange={(c) =>
                                  setValue(
                                    champ.cle,
                                    c ? [...arr, o] : arr.filter((x) => x !== o),
                                  )
                                }
                              />
                              <span className="font-sans text-sm">{o}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  case "nombre":
                  case "date":
                    return (
                      <div key={champ.id} className="space-y-2">
                        <Label className="font-sans text-sm">{champ.label}</Label>
                        <Input
                          type={champ.type_champ === "date" ? "date" : "number"}
                          value={v == null ? "" : String(v)}
                          onChange={(e) => setValue(champ.cle, e.target.value)}
                        />
                      </div>
                    );
                  default:
                    return (
                      <div key={champ.id} className="space-y-2">
                        <Label className="font-sans text-sm">{champ.label}</Label>
                        <Textarea
                          rows={3}
                          value={v == null ? "" : String(v)}
                          onChange={(e) => setValue(champ.cle, e.target.value)}
                        />
                      </div>
                    );
                }
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
