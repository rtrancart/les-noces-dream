import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MailCheck,
  MailX,
  AlertTriangle,
  Ban,
  MessagesSquare,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailRow {
  message_id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  complained: number;
  suppressed: number;
  pending: number;
}

interface DashboardResponse {
  stats: Stats;
  total: number;
  templates: string[];
  rows: EmailRow[];
}

const PAGE_SIZE = 50;

type Preset = "24h" | "7j" | "30j" | "custom";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "sent", label: "Délivré" },
  { value: "dlq", label: "Échec" },
  { value: "bounced", label: "Rebond" },
  { value: "complained", label: "Plainte spam" },
  { value: "suppressed", label: "Désinscrit" },
  { value: "pending", label: "En cours" },
];

function statusBadge(status: string) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
          Délivré
        </Badge>
      );
    case "dlq":
      return <Badge variant="destructive">Échec</Badge>;
    case "bounced":
      return <Badge variant="destructive">Rebond</Badge>;
    case "complained":
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
          Plainte spam
        </Badge>
      );
    case "suppressed":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
          Désinscrit
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">En cours</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SuiviEmails() {
  const [preset, setPreset] = useState<Preset>("7j");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sortDesc, setSortDesc] = useState(true);

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const until = new Date();
    if (preset === "custom") {
      if (!customFrom || !customTo) return null;
      const from = new Date(`${customFrom}T00:00:00`);
      const to = new Date(`${customTo}T23:59:59.999`);
      return { since: from, until: to };
    }
    const hours = preset === "24h" ? 24 : preset === "7j" ? 7 * 24 : 30 * 24;
    return { since: new Date(until.getTime() - hours * 3600_000), until };
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    const { data: res, error } = await supabase.rpc("get_email_dashboard", {
      p_since: range.since.toISOString(),
      p_until: range.until.toISOString(),
      p_templates: selectedTemplates.length > 0 ? selectedTemplates : null,
      p_status: status === "all" ? null : status,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });
    if (error) {
      toast.error("Erreur lors du chargement du suivi des emails");
      setLoading(false);
      return;
    }
    setData(res as unknown as DashboardResponse);
    setLoading(false);
  }, [range, selectedTemplates, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset page quand les filtres changent
  useEffect(() => {
    setPage(0);
  }, [preset, customFrom, customTo, status, selectedTemplates]);

  const rows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.rows];
    sorted.sort((a, b) =>
      sortDesc
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
    return sorted;
  }, [data, sortDesc]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const toggleTemplate = (t: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Suivi des emails</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Délivrabilité, rebonds, plaintes et désinscriptions des emails envoyés
          par la plateforme. Données réservées aux administrateurs.
        </p>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-sans uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessagesSquare className="h-3.5 w-3.5" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-serif text-3xl">{stats?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-sans uppercase tracking-wider text-emerald-700 flex items-center gap-2">
              <MailCheck className="h-3.5 w-3.5" /> Délivrés
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-serif text-3xl text-emerald-700">
                {stats?.sent ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-sans uppercase tracking-wider text-red-700 flex items-center gap-2">
              <MailX className="h-3.5 w-3.5" /> Échecs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-serif text-3xl text-red-700">
                {stats?.failed ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-sans uppercase tracking-wider text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Rebonds
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-serif text-3xl text-red-700">
                {(stats?.bounced ?? 0) + (stats?.complained ?? 0)}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              dont {stats?.complained ?? 0} plainte(s) spam
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-sans uppercase tracking-wider text-amber-700 flex items-center gap-2">
              <Ban className="h-3.5 w-3.5" /> Désinscrits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-serif text-3xl text-amber-700">
                {stats?.suppressed ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Période</Label>
            <div className="flex gap-1">
              {(
                [
                  ["24h", "24 h"],
                  ["7j", "7 jours"],
                  ["30j", "30 jours"],
                  ["custom", "Personnalisée"],
                ] as [Preset, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={preset === value ? "default" : "outline"}
                  onClick={() => setPreset(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {preset === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="from">
                  Du
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="to">
                  Au
                </Label>
                <Input
                  id="to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Type d'email</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-64 justify-between">
                  {selectedTemplates.length === 0
                    ? "Tous les types"
                    : `${selectedTemplates.length} type(s) sélectionné(s)`}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-72 overflow-auto" align="start">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => setSelectedTemplates([])}
                  >
                    Tout désélectionner
                  </Button>
                  {(data?.templates ?? []).map((t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5"
                    >
                      <Checkbox
                        checked={selectedTemplates.includes(t)}
                        onCheckedChange={() => toggleTemplate(t)}
                      />
                      <span className="truncate">{t}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type d'email</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => setSortDesc((v) => !v)}
                  >
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((r) => (
                    <TableRow key={r.message_id}>
                      <TableCell className="font-sans text-sm">
                        {r.template_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.recipient_email}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), "dd MMM yyyy HH:mm", {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[280px] truncate"
                        title={r.error_message ?? undefined}
                      >
                        {r.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Aucun email sur cette sélection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} / {totalPages} — {data.total} email(s)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
