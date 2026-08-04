// TEMPORAIRE — À retirer après la migration photos.
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, StopCircle } from "lucide-react";

const BATCH_SIZE = 50;
const DELAI_MS = 1500;

type Progress = {
  appels: number;
  fichesTraitees: number;
  fichesSansPresta: number;
  fichiersOk: number;
  fichiersKo: number;
  restantes: number | null;
};

const initialProgress: Progress = {
  appels: 0,
  fichesTraitees: 0,
  fichesSansPresta: 0,
  fichiersOk: 0,
  fichiersKo: 0,
  restantes: null,
};

export function MigratePhotosBatchPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const stopRef = useRef(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(initialProgress);
    setStartedAt(new Date().toLocaleTimeString("fr-FR"));
    stopRef.current = false;

    const cumul = { ...initialProgress };

    try {
      // Boucle tant qu'il reste des fiches à traiter.
      for (;;) {
        const { data, error } = await supabase.functions.invoke(
          `migrate-photos-batch?batch_size=${BATCH_SIZE}`,
          { method: "POST", body: {} },
        );
        if (error) throw error;

        cumul.appels += 1;
        cumul.fichesTraitees += Number(data?.fiches_traitees ?? 0);
        cumul.fichesSansPresta += Number(data?.fiches_sans_prestataire ?? 0);
        cumul.fichiersOk += Number(data?.fichiers_ok ?? 0);
        cumul.fichiersKo += Number(data?.fichiers_ko ?? 0);
        cumul.restantes = data?.restantes ?? null;
        setProgress({ ...cumul });
        setResult(JSON.stringify(data, null, 2));

        if (data?.done === true) break;
        if (typeof data?.restantes === "number" && data.restantes <= 0) break;
        if (stopRef.current) break;
        // Petit délai pour ménager le serveur source.
        await new Promise((r) => setTimeout(r, DELAI_MS));
      }
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
          Migration photos — lots automatiques
          <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Temporaire
          </span>
        </CardTitle>
        <p className="font-sans text-xs text-muted-foreground">
          Invoque <code>migrate-photos-batch</code> en boucle ({BATCH_SIZE} fiches par appel) jusqu'à
          épuisement des fiches restantes. À retirer après la migration.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {loading ? "Migration en cours…" : "Lancer la migration"}
          </Button>
          {loading && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              <StopCircle className="h-4 w-4" />
              Arrêter après le lot en cours
            </Button>
          )}
        </div>

        {startedAt && (
          <p className="font-sans text-[11px] text-muted-foreground">Démarré à : {startedAt}</p>
        )}

        {progress.appels > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: "Appels", value: progress.appels },
              { label: "Fiches traitées", value: progress.fichesTraitees },
              { label: "Fichiers OK", value: progress.fichiersOk },
              { label: "Fichiers KO", value: progress.fichiersKo },
              { label: "Restantes", value: progress.restantes ?? "—" },
            ].map((s) => (
              <div key={s.label} className="rounded border border-border bg-muted/20 p-2">
                <p className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="font-serif text-lg font-semibold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {progress.fichesSansPresta > 0 && (
          <p className="font-sans text-[11px] text-muted-foreground">
            Fiches sans prestataire (non traitées) : {progress.fichesSansPresta}
          </p>
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
