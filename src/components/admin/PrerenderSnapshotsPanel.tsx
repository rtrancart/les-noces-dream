// TEMPORAIRE — Outil d'administration pour le pré-rendu SEO.
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, RefreshCw, StopCircle, TestTube2 } from "lucide-react";

const DELAI_MS = 1500;
const MAX_ITERATIONS = 500;

type Progress = {
  appels: number;
  traites: number;
  reussis: number;
  echecs: number;
  ignores: number;
  abandonnes: number;
  restantes: number | null;
};

const initialProgress: Progress = {
  appels: 0,
  traites: 0,
  reussis: 0,
  echecs: 0,
  ignores: 0,
  abandonnes: 0,
  restantes: null,
};

export function PrerenderSnapshotsPanel() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const stopRef = useRef(false);

  const invoke = async (taille: number) => {
    const { data, error } = await supabase.functions.invoke("prerender-snapshots-batch", {
      method: "POST",
      body: { batch_size: taille },
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  };

  /** Réconciliation : recense les pages indexables, met la file à jour, purge les orphelines. */
  const synchroniser = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    setStartedAt(new Date().toLocaleTimeString("fr-FR"));
    try {
      let offset = 0;
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase.functions.invoke("prerender-reconcile", {
          method: "POST",
          body: { limit: 500, offset, purge: true },
        });
        if (error) throw error;
        const d = data as Record<string, unknown>;
        setResult(JSON.stringify(d, null, 2));
        if (d?.termine === true) break;
        offset = Number(d?.relance_offset ?? offset);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSyncing(false);
    }
  };

  const run = async (boucle: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(initialProgress);
    setStartedAt(new Date().toLocaleTimeString("fr-FR"));
    stopRef.current = false;

    const taille = Math.min(15, Math.max(1, Number(batchSize) || 1));
    const cumul = { ...initialProgress };

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const data = await invoke(taille);

        cumul.appels += 1;
        cumul.traites += Number(data?.traites ?? 0);
        cumul.reussis += Number(data?.reussis ?? 0);
        cumul.echecs += Number(data?.echecs ?? 0);
        cumul.ignores += Number(data?.ignores ?? 0);
        cumul.abandonnes += Number(data?.abandonnes ?? 0);
        cumul.restantes = (data?.restantes as number) ?? null;
        setProgress({ ...cumul });
        setResult(JSON.stringify(data, null, 2));

        if (!boucle) break;
        if (typeof data?.restantes === "number" && data.restantes <= 0) break;
        // File qui ne décroît pas : on évite la boucle infinie.
        if (Number(data?.traites ?? 0) === 0) break;
        if (stopRef.current) break;
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
          Snapshots de pré-rendu — lots automatiques
          <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Temporaire
          </span>
        </CardTitle>
        <p className="font-sans text-xs text-muted-foreground">
          « Synchroniser la file » recense les pages indexables (mêmes filtres que le sitemap),
          ajoute ou remet à traiter celles dont le contenu visible a changé et purge les entrées
          devenues non indexables. Les autres boutons invoquent{" "}
          <code>prerender-snapshots-batch</code> jusqu'à épuisement de la file. La chaîne complète
          tourne automatiquement chaque nuit à 03:00.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-1">
            <Label htmlFor="prerender-batch" className="font-sans text-xs">
              Taille du lot
            </Label>
            <Input
              id="prerender-batch"
              type="number"
              min={1}
              max={15}
              value={batchSize}
              disabled={loading || syncing}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>
          <Button
            variant="outline"
            onClick={synchroniser}
            disabled={loading || syncing}
            className="gap-2"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Synchronisation…" : "Synchroniser la file"}
          </Button>
          <Button
            variant="outline"
            onClick={() => run(false)}
            disabled={loading || syncing}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
            Lancer un lot de test
          </Button>
          <Button onClick={() => run(true)} disabled={loading || syncing} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {loading ? "Traitement en cours…" : "Traiter toute la file"}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "Appels", value: progress.appels },
              { label: "Traités", value: progress.traites },
              { label: "Réussis", value: progress.reussis },
              { label: "Échoués", value: progress.echecs },
              { label: "Ignorés", value: progress.ignores },
              { label: "Abandonnés", value: progress.abandonnes },
              { label: "Restants", value: progress.restantes ?? "—" },
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
