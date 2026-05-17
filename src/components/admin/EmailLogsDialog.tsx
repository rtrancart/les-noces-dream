import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string | null;
  nomCommercial: string;
}

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  total_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-sauge/20 text-sauge",
  pending: "bg-champagne/30 text-foreground",
  dlq: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  bounced: "bg-destructive/10 text-destructive",
  suppressed: "bg-muted/40 text-muted-foreground",
  complained: "bg-destructive/10 text-destructive",
};

const TEMPLATE_LABELS: Record<string, string> = {
  invitation_prestataire: "Invitation",
  relance_signature_charte: "Relance signature",
  notif_nouvelle_soumission_fiche: "Soumission (admins)",
  validation_publication_fiche: "Publication fiche",
  notif_nouvelle_version_charte: "Nouvelle version charte",
};

const STATUS_OPTIONS = ["sent", "pending", "dlq", "failed", "bounced", "suppressed", "complained"];
const PERIOD_OPTIONS = [
  { value: "24h", label: "Dernières 24h", hours: 24 },
  { value: "7d", label: "7 derniers jours", hours: 24 * 7 },
  { value: "30d", label: "30 derniers jours", hours: 24 * 30 },
  { value: "90d", label: "90 derniers jours", hours: 24 * 90 },
  { value: "all", label: "Toute la période", hours: null as number | null },
];
const PAGE_SIZE = 10;

export function EmailLogsDialog({ open, onOpenChange, recipientEmail, nomCommercial }: Props) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30d");
  const [page, setPage] = useState(0);

  const fetchLogs = async () => {
    if (!recipientEmail) return;
    setLoading(true);
    const period = PERIOD_OPTIONS.find((p) => p.value === periodFilter);
    const since = period?.hours
      ? new Date(Date.now() - period.hours * 3600 * 1000).toISOString()
      : null;

    const { data, error } = await supabase.rpc("get_email_logs_for_recipient", {
      p_recipient: recipientEmail,
      p_status: statusFilter === "all" ? null : statusFilter,
      p_since: since,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });

    if (!error && data) {
      const rows = data as EmailLog[];
      setLogs(rows);
      setTotal(rows[0]?.total_count ?? 0);
    } else {
      setLogs([]);
      setTotal(0);
    }
    setLoading(false);
  };

  // Reset to page 0 when filters or recipient change
  useEffect(() => {
    if (open) setPage(0);
  }, [open, recipientEmail, periodFilter, statusFilter]);

  // Refetch on page change / open
  useEffect(() => {
    if (open) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipientEmail, periodFilter, statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            État des envois — {nomCommercial}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-sans">
            Destinataire : {recipientEmail ?? "—"}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs font-sans">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs font-sans">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <span className="text-xs text-muted-foreground font-sans ml-auto">
              {total} envoi{total > 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-sans">
              Aucun envoi correspondant.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium font-sans truncate">
                      {TEMPLATE_LABELS[log.template_name] ?? log.template_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-sans">
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-destructive font-sans mt-0.5 break-words">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`${STATUS_COLORS[log.status] ?? "bg-muted/40"} font-sans text-[11px] font-normal shrink-0`}
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Précédent
              </Button>
              <span className="text-xs text-muted-foreground font-sans">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
              >
                Suivant <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
