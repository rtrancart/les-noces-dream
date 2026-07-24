// TEMPORAIRE — À retirer après la migration photos.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle } from "lucide-react";

export function MigratePhotosBatchPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setStartedAt(new Date().toLocaleTimeString("fr-FR"));
    try {
      const { data, error } = await supabase.functions.invoke("migrate-photos-batch", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/40 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-base font-semibold flex items-center gap-2">
          Migration photos — lot manuel
          <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Temporaire
          </span>
        </CardTitle>
        <p className="font-sans text-xs text-muted-foreground">
          Invoque <code>migrate-photos-batch</code> (20 fiches par appel). À retirer après la migration.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {loading ? "Traitement en cours…" : "Lancer un lot"}
        </Button>
        {startedAt && (
          <p className="font-sans text-[11px] text-muted-foreground">Dernier appel : {startedAt}</p>
        )}
        {error && (
          <pre className="whitespace-pre-wrap rounded border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive">
            {error}
          </pre>
        )}
        {result && (
          <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/20 p-3 font-mono text-xs text-foreground">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
