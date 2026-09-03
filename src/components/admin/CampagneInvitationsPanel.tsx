import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

type RunDetails = {
  run_id?: string;
  demarre_le?: string;
  termine_le?: string;
  duree_ms?: number;
  selection?: number;
  traitees?: number;
  non_traitees?: number;
  invitations_envoyees?: number;
  debit_invitations_par_min?: number | null;
  chunk_size?: number;
  chunk_delay_ms?: number;
  max_per_run?: number;
  email_send_batch_size?: number | null;
  email_send_delay_ms?: number | null;
  annule?: boolean;
  full_success?: number;
  partial_success?: number;
  failed?: number;
  skipped?: number;
};

type Run = { id: string; created_at: string; details: RunDetails };

const fmtDuree = (ms?: number) => {
  if (!ms && ms !== 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
};

export function CampagneInvitationsPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [state, setState] = useState<{ batch_size: number; send_delay_ms: number; retry_after_until: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [logsRes, stateRes] = await Promise.all([
      supabase
        .from("logs_admin")
        .select("id, created_at, details")
        .eq("action", "bulk_validate_invite")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("email_send_state").select("batch_size, send_delay_ms, retry_after_until").maybeSingle(),
    ]);
    setRuns(((logsRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      details: (r.details ?? {}) as RunDetails,
    })));
    setState((stateRes.data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const cumulEnvoyees = runs.reduce((n, r) => n + (r.details.invitations_envoyees ?? 0), 0);
  const cumulTraitees = runs.reduce((n, r) => n + (r.details.traitees ?? 0), 0);
  const cumulEchecs = runs.reduce((n, r) => n + (r.details.failed ?? 0) + (r.details.partial_success ?? 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-serif text-lg">Campagne invitations — prestataires migrés</CardTitle>
          <CardDescription className="font-sans text-sm">
            Trace en lecture seule de la cadence réelle des runs « Valider & inviter » (50 derniers).
            Paramètres recommandés : voir <code>docs/campagne-invitations-migration.md</code>.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="font-sans text-xs">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Runs enregistrés", value: runs.length },
            { label: "Fiches traitées (cumul)", value: cumulTraitees },
            { label: "Invitations envoyées", value: cumulEnvoyees },
            { label: "Échecs / partiels", value: cumulEchecs },
          ].map((s) => (
            <div key={s.label} className="rounded border bg-muted/20 p-3">
              <div className="font-sans text-xs text-muted-foreground">{s.label}</div>
              <div className="font-serif text-xl">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded border bg-muted/10 p-3 font-sans text-xs text-muted-foreground">
          Débit d'envoi actuel :{" "}
          {state ? (
            <>
              lots de <strong>{state.batch_size}</strong>, délai <strong>{state.send_delay_ms} ms</strong>
              {state.retry_after_until && (
                <Badge variant="outline" className="ml-2 border-destructive/40 bg-destructive/10 text-destructive">
                  Cooldown jusqu'à {new Date(state.retry_after_until).toLocaleString("fr-FR")}
                </Badge>
              )}
            </>
          ) : "—"}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs">Sélection</TableHead>
                <TableHead className="font-sans text-xs">Traitées</TableHead>
                <TableHead className="font-sans text-xs">Invit. OK</TableHead>
                <TableHead className="font-sans text-xs">Partiels / échecs</TableHead>
                <TableHead className="font-sans text-xs">Durée</TableHead>
                <TableHead className="font-sans text-xs">Débit /min</TableHead>
                <TableHead className="font-sans text-xs">Débit file</TableHead>
                <TableHead className="font-sans text-xs">État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center font-sans text-sm text-muted-foreground">
                    Aucun run enregistré pour le moment.
                  </TableCell>
                </TableRow>
              ) : runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-sans text-sm">
                    {new Date(r.details.demarre_le ?? r.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-sans text-sm">{r.details.selection ?? "—"}</TableCell>
                  <TableCell className="font-sans text-sm">{r.details.traitees ?? "—"}</TableCell>
                  <TableCell className="font-sans text-sm text-emerald-700">{r.details.invitations_envoyees ?? "—"}</TableCell>
                  <TableCell className="font-sans text-sm">
                    {(r.details.partial_success ?? 0)} / {(r.details.failed ?? 0)}
                  </TableCell>
                  <TableCell className="font-sans text-sm">{fmtDuree(r.details.duree_ms)}</TableCell>
                  <TableCell className="font-sans text-sm">{r.details.debit_invitations_par_min ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-sans text-xs text-muted-foreground">
                    {r.details.email_send_batch_size ?? "—"} / {r.details.email_send_delay_ms ?? "—"} ms
                  </TableCell>
                  <TableCell>
                    {r.details.annule ? (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 font-sans text-[10px] text-amber-700">
                        Interrompu ({r.details.non_traitees ?? 0} restantes)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 font-sans text-[10px] text-emerald-700">
                        Terminé
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
