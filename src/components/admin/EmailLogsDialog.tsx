import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function EmailLogsDialog({ open, onOpenChange, recipientEmail, nomCommercial }: Props) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    if (!recipientEmail) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .eq("recipient_email", recipientEmail.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      // Dedupe by message_id (keep latest)
      const seen = new Set<string>();
      const deduped: EmailLog[] = [];
      for (const row of data as EmailLog[]) {
        const key = row.message_id ?? row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
      }
      setLogs(deduped);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchLogs();
  }, [open, recipientEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            État des envois — {nomCommercial}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-sans">
              Destinataire : {recipientEmail ?? "—"}
            </p>
            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-sans">
              Aucun email envoyé à cette adresse.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
