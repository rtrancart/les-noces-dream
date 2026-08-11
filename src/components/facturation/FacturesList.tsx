import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2 } from "lucide-react";

interface FactureRow {
  id: string;
  numero: string | null;
  date_facture: string | null;
  montant_ttc_cents: number | null;
  devise: string;
  statut: string;
  pdf_url: string | null;
}

const STATUT_LABEL: Record<string, string> = {
  payee: "Payée",
  paid: "Payée",
  open: "En attente",
  brouillon: "Brouillon",
  draft: "Brouillon",
  void: "Annulée",
  uncollectible: "Impayée",
};

function formatMontant(cents: number | null, devise: string) {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise || "EUR",
  }).format(cents / 100);
}

export default function FacturesList({ prestataireId }: { prestataireId?: string | null }) {
  const [rows, setRows] = useState<FactureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!prestataireId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("factures_pennylane")
        .select("id, numero, date_facture, montant_ttc_cents, devise, statut, pdf_url")
        .eq("prestataire_id", prestataireId)
        .order("date_facture", { ascending: false })
        .limit(50);
      if (!active) return;
      if (error) console.error("factures", error);
      setRows((data as FactureRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [prestataireId]);

  return (
    <section className="rounded-xl border border-border/60 bg-background/70 p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-primary" />
        <h3 className="font-serif text-lg text-foreground">Factures</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground font-sans text-sm">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          Aucune facture disponible pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-foreground truncate">
                  {f.numero ?? "Facture"}
                </p>
                <p className="font-sans text-xs text-muted-foreground">
                  {f.date_facture
                    ? new Date(f.date_facture).toLocaleDateString("fr-FR")
                    : "—"}{" "}
                  · {STATUT_LABEL[f.statut] ?? f.statut}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-sans text-sm text-foreground">
                  {formatMontant(f.montant_ttc_cents, f.devise)}
                </span>
                {f.pdf_url && (
                  <a
                    href={f.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-sans text-xs"
                  >
                    <Download size={14} /> PDF
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
