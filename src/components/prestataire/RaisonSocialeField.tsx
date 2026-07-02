import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface RaisonSocialeFieldProps {
  /** Valeur courante du nom commercial (source de vérité tant que la case n'est pas cochée). */
  nomCommercial: string;
  /** Valeur courante de la raison sociale (persistée en base). */
  raisonSociale: string;
  /** Callback appelé à chaque modification de la raison sociale effective. */
  onChange: (value: string) => void;
  /** Label optionnel pour l'input dédié. */
  inputLabel?: string;
  /** Placeholder optionnel pour l'input dédié. */
  inputPlaceholder?: string;
  /** Classes optionnelles pour le conteneur. */
  className?: string;
}

/**
 * Champ "Raison sociale" à comportement miroir + case à cocher.
 *
 * - Décoché (défaut) : la raison sociale suit le nom commercial en temps réel.
 * - Coché : un champ texte apparaît, pré-rempli avec le nom commercial courant, puis éditable.
 * - Re-décoché : la raison sociale reprend la valeur du nom commercial.
 *
 * L'état de la case n'est pas persisté : on considère qu'elle est cochée si
 * `raisonSociale` est non nulle et différente du `nomCommercial` au montage.
 */
export default function RaisonSocialeField({
  nomCommercial,
  raisonSociale,
  onChange,
  inputLabel = "Raison sociale",
  inputPlaceholder = "SAS Nom Légal",
  className,
}: RaisonSocialeFieldProps) {
  // Initialisation : cochée si raisonSociale non vide et distincte du nom commercial.
  const [different, setDifferent] = useState<boolean>(
    () => !!raisonSociale && raisonSociale.trim() !== (nomCommercial ?? "").trim(),
  );
  const initialized = useRef(false);

  // Re-synchro quand la valeur persistée change (chargement asynchrone du prestataire).
  useEffect(() => {
    if (initialized.current) return;
    if (raisonSociale || nomCommercial) {
      setDifferent(!!raisonSociale && raisonSociale.trim() !== (nomCommercial ?? "").trim());
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raisonSociale, nomCommercial]);

  // Miroir : quand la case est décochée, la raison sociale suit le nom commercial.
  useEffect(() => {
    if (!different && raisonSociale !== nomCommercial) {
      onChange(nomCommercial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomCommercial, different]);

  const handleToggle = (checked: boolean | "indeterminate") => {
    const next = checked === true;
    setDifferent(next);
    if (next) {
      // Pré-remplir avec le nom commercial si vide.
      if (!raisonSociale) onChange(nomCommercial);
    } else {
      // Reprendre la valeur du nom commercial.
      onChange(nomCommercial);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <Checkbox
          id="raison-sociale-different"
          checked={different}
          onCheckedChange={handleToggle}
          className="mt-0.5"
        />
        <Label
          htmlFor="raison-sociale-different"
          className="font-sans text-sm leading-tight cursor-pointer"
        >
          Utiliser un nom différent pour la raison sociale
          <span className="block text-xs text-muted-foreground font-normal mt-0.5">
            Nom légal de l'entreprise (facturation, comptabilité, Charte Qualité).
          </span>
        </Label>
      </div>

      {different && (
        <div className="mt-3 space-y-2 pl-6">
          <Label className="font-sans text-sm">{inputLabel}</Label>
          <Input
            value={raisonSociale}
            onChange={(e) => onChange(e.target.value)}
            placeholder={inputPlaceholder}
          />
        </div>
      )}
    </div>
  );
}
