import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowUpDown, ChevronRight, Mail, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import EmailTemplateDrawer from "@/components/admin/EmailTemplateDrawer";

export interface EmailTemplateItem {
  templateName: string;
  displayName: string;
  variables: string[];
  previewData?: Record<string, unknown>;
  defaultSubject: string;
  defaultHtml: string;
  shellHead?: string;
  shellFoot?: string;
  source: "db" | "code";
  dbRow: {
    id: string;
    sujet: string | null;
    sous_objet: string | null;
    corps_html: string | null;
    destinataire: string | null;
    description: string | null;
    est_actif: boolean;
    updated_at: string;
    created_at: string;
  } | null;
}

const DESTINATAIRES = [
  { value: "tous", label: "Tous" },
  { value: "client", label: "Client" },
  { value: "prestataire", label: "Prestataire" },
  { value: "equipe", label: "Équipe" },
] as const;

const ETATS = [
  { value: "tous", label: "Tous les états" },
  { value: "modifies", label: "Modifiés" },
  { value: "origine", label: "Texte d'origine" },
  { value: "desactives", label: "Désactivés" },
] as const;

const DEST_LABEL: Record<string, string> = {
  client: "Client",
  prestataire: "Prestataire",
  equipe: "Équipe",
};

const destOf = (it: EmailTemplateItem) => it.dbRow?.destinataire ?? "prestataire";
const isModifie = (it: EmailTemplateItem) =>
  !!it.dbRow &&
  ((it.dbRow.sujet ?? "") !== (it.defaultSubject ?? "") ||
    (it.dbRow.corps_html ?? "") !== (it.defaultHtml ?? "") ||
    !!it.dbRow.sous_objet);
const isActif = (it: EmailTemplateItem) => it.dbRow?.est_actif ?? false;
const sujetOf = (it: EmailTemplateItem) => it.dbRow?.sujet ?? it.defaultSubject;

function relative(iso?: string | null) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap overflow-hidden rounded-md border border-border bg-card">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-2 text-sm transition-colors",
            value === o.value
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-serif text-3xl leading-none text-foreground">{value}</span>
          {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function EtatCell({ it }: { it: EmailTemplateItem }) {
  if (!isModifie(it)) {
    return (
      <div>
        <Badge variant="outline" className="font-normal">
          Texte d'origine
        </Badge>
        <p className="mt-1 text-xs text-muted-foreground">texte d'origine</p>
      </div>
    );
  }
  return (
    <div>
      <Badge className="bg-primary/10 font-normal text-primary hover:bg-primary/15">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        Modifié
      </Badge>
      <p className="mt-1 text-xs text-muted-foreground">{relative(it.dbRow?.updated_at)}</p>
    </div>
  );
}

export default function Emails() {
  const [items, setItems] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dest, setDest] = useState<(typeof DESTINATAIRES)[number]["value"]>("tous");
  const [etat, setEtat] = useState<(typeof ETATS)[number]["value"]>("tous");
  const [grouped, setGrouped] = useState(true);
  const [sortBy, setSortBy] = useState<"template" | "etat">("template");
  const [sortAsc, setSortAsc] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-email-textes", {
      body: { action: "list" },
    });
    if (error || !data?.items) {
      toast.error("Erreur lors du chargement des emails");
    } else {
      setItems(data.items as EmailTemplateItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const actifs = items.filter(isActif).length;
    const modifies = items.filter(isModifie).length;
    const last = items
      .filter(isModifie)
      .map((i) => i.dbRow?.updated_at)
      .filter(Boolean)
      .sort()
      .pop();
    return { total, actifs, desactives: total - actifs, modifies, origine: total - modifies, last };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      if (q) {
        const hay = `${it.displayName} ${it.templateName} ${sujetOf(it)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dest !== "tous" && destOf(it) !== dest) return false;
      if (etat === "modifies" && !isModifie(it)) return false;
      if (etat === "origine" && isModifie(it)) return false;
      if (etat === "desactives" && isActif(it)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const cmp =
        sortBy === "template"
          ? a.displayName.localeCompare(b.displayName, "fr")
          : Number(isModifie(b)) - Number(isModifie(a));
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [items, search, dest, etat, sortBy, sortAsc]);

  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", label: "", rows: filtered }];
    const order = ["prestataire", "client", "equipe"];
    return order
      .map((k) => ({
        key: k,
        label: DEST_LABEL[k] ?? k,
        rows: filtered.filter((it) => destOf(it) === k),
      }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, grouped]);

  const toggleSort = (col: "template" | "etat") => {
    if (sortBy === col) setSortAsc((v) => !v);
    else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  const toggleActif = async (it: EmailTemplateItem, v: boolean) => {
    const { error } = await supabase
      .from("email_textes")
      .update({ est_actif: v })
      .eq("template_name", it.templateName)
      .select();
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success(v ? "Email activé." : "Email désactivé — il ne sera plus envoyé.");
    void load();
  };

  const openItem = items.find((i) => i.templateName === openKey) ?? null;

  return (
    <div className="space-y-6">
      {/* Fil d'ariane + titre */}
      <div>
        <p className="text-sm text-muted-foreground">
          Contenu <ChevronRight className="inline h-3.5 w-3.5 align-[-2px]" />{" "}
          <span className="text-foreground">Emails</span>
        </p>
        <h1 className="mt-2 flex items-center gap-3 font-serif text-3xl text-foreground">
          <Mail className="h-7 w-7 text-primary" />
          Emails de notification
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Textes des emails automatiques envoyés aux prestataires et aux clients. Les variables comme{" "}
          <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
            {"{{clientNom}}"}
          </code>{" "}
          sont remplacées à l'envoi. L'en-tête et le pied de page LesNoces sont appliqués
          automatiquement autour de votre contenu — vous éditez les textes.
        </p>
      </div>

      {/* Tuiles */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Templates" value={String(stats.total)} />
          <StatTile
            label="Actifs"
            value={String(stats.actifs)}
            hint={`${stats.desactives} désactivé${stats.desactives > 1 ? "s" : ""}`}
          />
          <StatTile
            label="Textes modifiés"
            value={String(stats.modifies)}
            hint={`${stats.origine} d'origine`}
          />
          <StatTile label="Dernière modification" value={relative(stats.last)} />
        </div>
      )}

      {/* Barre d'outils */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un template, une clé, un sujet…"
              className="pl-9"
            />
          </div>
          <Segmented value={dest} onChange={setDest} options={DESTINATAIRES} />
          <Segmented value={etat} onChange={setEtat} options={ETATS} />
        </div>
        <Segmented
          value={grouped ? "groupe" : "plat"}
          onChange={(v) => setGrouped(v === "groupe")}
          options={[
            { value: "groupe", label: "Grouper : destinataire" },
            { value: "plat", label: "Sans regroupement" },
          ]}
        />
      </div>

      {/* Tableau */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card className="overflow-hidden shadow-card">
          {/* En-têtes (desktop) */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_120px_160px_72px] items-center gap-4 border-b border-border bg-muted/20 px-5 py-3 text-[11px] uppercase tracking-[0.1em] text-muted-foreground lg:grid">
            <button className="flex items-center gap-1.5 text-left" onClick={() => toggleSort("template")}>
              Template <ArrowUpDown className="h-3 w-3" />
            </button>
            <span>Sujet</span>
            <span>Destinataire</span>
            <button className="flex items-center gap-1.5 text-left" onClick={() => toggleSort("etat")}>
              État du texte <ArrowUpDown className="h-3 w-3" />
            </button>
            <span className="text-right">Actif</span>
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Aucun email ne correspond à votre recherche.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                {grouped && (
                  <div className="border-b border-border bg-muted/10 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-foreground">
                    {g.label} <span className="text-muted-foreground">· {g.rows.length} templates</span>
                  </div>
                )}
                {g.rows.map((it) => (
                  <div
                    key={it.templateName}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenKey(it.templateName)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenKey(it.templateName)}
                    className="grid cursor-pointer grid-cols-1 items-start gap-2 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/20 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_120px_160px_72px] lg:items-center lg:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base text-foreground">{it.displayName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {it.templateName}
                      </p>
                    </div>
                    <p className="truncate text-sm text-primary">{sujetOf(it)}</p>
                    <div>
                      <Badge variant="secondary" className="font-normal">
                        {DEST_LABEL[destOf(it)] ?? destOf(it)}
                      </Badge>
                    </div>
                    <EtatCell it={it} />
                    <div
                      className="lg:text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={isActif(it)}
                        onCheckedChange={(v) => toggleActif(it, v)}
                        aria-label="Activer cet email"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Un template désactivé n'est plus envoyé : la fonction d'envoi l'ignore silencieusement et
        retombe sur le contenu par défaut du code.
      </p>

      {openItem && (
        <EmailTemplateDrawer
          item={openItem}
          onClose={() => setOpenKey(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
