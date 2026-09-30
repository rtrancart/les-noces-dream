import type { LucideIcon } from "lucide-react";
import { Camera, Check, Download, MapPin, ShieldCheck } from "lucide-react";

export type FieldType = "boolean" | "select" | "multi" | "text";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  value: boolean | string | string[] | null;
  options?: string[];
}

export interface FieldGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  fields: Field[];
}


export interface SourceChamp {
  label: string;
  cle: string;
  type_champ: string;
  groupe?: string | null;
  options_liste?: string[] | null;
}

const GROUP_ORGANISATION = "Profil & prestation";
const GROUP_CONDITIONS = "Conditions commerciales";

const LIVRAISON_KEYWORDS = [
  "delai",
  "livraison",
  "livre",
  "fichier",
  "support",
  "format",
  "video",
  "teaser",
  "court-metrage",
  "telechargement",
  "galerie",
  "album",
  "cle",
  "usb",
  "cloud",
  "photo",
  "image",
  "dvd",
  "pendrive",
  "numerique",
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ");
}

function looksLikeLivraison(ch: SourceChamp): boolean {
  const haystack = normalize(`${ch.cle} ${ch.label}`);
  return LIVRAISON_KEYWORDS.some((kw) => haystack.includes(kw));
}

function isRenseigne(typeChamp: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeChamp === "booleen") return true; // false is also a filled answer
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

function toFieldType(typeChamp: string): FieldType {
  switch (typeChamp) {
    case "booleen":
      return "boolean";
    case "multi_choix":
      return "multi";
    case "liste":
    case "date":
    case "nombre":
      return "select";
    default:
      return "text";
  }
}

function toFieldValue(typeChamp: string, value: unknown): Field["value"] {
  if (typeChamp === "booleen") {
    return value === true;
  }
  if (typeChamp === "multi_choix") {
    if (!Array.isArray(value)) return [];
    return value.map(String);
  }
  if (value == null) return null;
  return String(value);
}

function bucketFor(ch: SourceChamp): "prestation" | "inclus" | "livraison" | "organisation" | "conditions" {
  const groupe = (ch.groupe ?? "").trim();

  if (groupe === GROUP_ORGANISATION) return "organisation";
  if (groupe === GROUP_CONDITIONS) return "conditions";

  if (ch.type_champ === "booleen") return "inclus";

  if (looksLikeLivraison(ch)) return "livraison";

  return "prestation";
}


export function buildServicesGroups(
  champsCategorie: SourceChamp[],
  champsSpecifiques: Record<string, unknown> | null,
): FieldGroup[] {
  const buckets: Record<FieldGroup["id"], Field[]> = {
    prestation: [],
    inclus: [],
    livraison: [],
    organisation: [],
    conditions: [],
  };

  for (const ch of champsCategorie) {
    const raw = champsSpecifiques?.[ch.cle];
    if (!isRenseigne(ch.type_champ, raw)) continue;

    const field: Field = {
      key: ch.cle,
      label: ch.label,
      type: toFieldType(ch.type_champ),
      value: toFieldValue(ch.type_champ, raw),
    };
    if (ch.type_champ === "multi_choix" && Array.isArray(ch.options_liste)) {
      field.options = ch.options_liste.map(String);
    }

    const bucket = bucketFor(ch);
    buckets[bucket].push(field);
  }

  // Sort booleans: yes first, then no
  buckets.inclus.sort((a, b) => {
    if (a.value === true && b.value !== true) return -1;
    if (a.value !== true && b.value === true) return 1;
    return a.label.localeCompare(b.label);
  });

  // Ordre par typologie au sein de chaque bloc : choix multiples, listes,
  // textes, puis booléens. Tri stable → l'ordre_affichage est conservé
  // à l'intérieur d'une même typologie.
  const TYPE_WEIGHT: Record<FieldType, number> = {
    multi: 1,
    select: 2,
    text: 3,
    boolean: 4,
  };
  for (const id of Object.keys(buckets) as FieldGroup["id"][]) {
    buckets[id] = buckets[id]
      .map((field, index) => ({ field, index }))
      .sort(
        (a, b) =>
          TYPE_WEIGHT[a.field.type] - TYPE_WEIGHT[b.field.type] ||
          a.index - b.index,
      )
      .map(({ field }) => field);
  }

  const groupDefs: { id: FieldGroup["id"]; title: string; icon: LucideIcon }[] = [
    { id: "prestation", title: "La prestation", icon: Camera },
    { id: "inclus", title: "Inclus & options", icon: Check },
    { id: "livraison", title: "Livraison", icon: Download },
    { id: "organisation", title: "Organisation", icon: MapPin },
    { id: "conditions", title: "Conditions & garanties", icon: ShieldCheck },
  ];

  return groupDefs
    .map(({ id, title, icon }) => {
      const fields = buckets[id];
      if (fields.length === 0) return null;
      const group: FieldGroup = {
        id,
        title,
        icon,
        fields,
      };
      return group;
    })
    .filter((g): g is FieldGroup => g !== null);
}
