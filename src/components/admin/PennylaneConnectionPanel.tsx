import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Receipt, Trash2 } from "lucide-react";

type TestResult =
  | { ok: true; latence_ms: number; lecture_clients_ok: boolean; nb_clients_echantillon: number }
  | { ok: false; kind?: string; status?: number | null; motif?: string; message?: string };

interface Etape {
  libelle: string;
  ok: boolean;
  detail?: string;
}

interface E2eResult {
  ok: boolean;
  etapes?: Etape[];
  stripe_invoice_id?: string;
  prestataire?: string;
  pdf_url?: string | null;
  numero?: string | null;
  motif?: string;
  message?: string;
}

export function PennylaneConnectionPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [e2eLoading, setE2eLoading] = useState(false);
  const [e2e, setE2e] = useState<E2eResult | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);

  const test = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("pennylane-test-connection", {
        body: {},
      });
      if (error) {
        setResult({ ok: false, motif: "Appel de la fonction impossible", message: error.message });
      } else {
        setResult(data as TestResult);
      }
    } catch (e) {
      setResult({
        ok: false,
        motif: "Erreur inattendue",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  const testComplet = async () => {
    const confirme = window.confirm(
      "Une facture de démonstration (1,00 € HT) va être créée en brouillon dans Pennylane pour vérifier toute la chaîne. Vous pourrez la supprimer juste après. Continuer ?",
    );
    if (!confirme) return;
    setE2eLoading(true);
    setE2e(null);
    setCleanupMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("pennylane-test-e2e", {
        body: { action: "run" },
      });
      if (error) {
        setE2e({ ok: false, motif: "Appel de la fonction impossible", message: error.message });
      } else {
        setE2e(data as E2eResult);
      }
    } catch (e) {
      setE2e({
        ok: false,
        motif: "Erreur inattendue",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setE2eLoading(false);
    }
  };

  const nettoyer = async () => {
    if (!e2e?.stripe_invoice_id) return;
    setCleanupLoading(true);
    setCleanupMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("pennylane-test-e2e", {
        body: { action: "cleanup", stripe_invoice_id: e2e.stripe_invoice_id },
      });
      if (error) {
        setCleanupMsg(`Suppression impossible : ${error.message}`);
      } else {
        const res = data as {
          pennylane_supprime?: boolean;
          message_pennylane?: string | null;
          numero?: string | null;
        };
        setCleanupMsg(
          res.pennylane_supprime
            ? "Facture de test supprimée dans Pennylane et en base."
            : `Ligne supprimée en base. À annuler manuellement dans Pennylane${
                res.numero ? ` (n° ${res.numero})` : ""
              }${res.message_pennylane ? ` — ${res.message_pennylane}` : ""}.`,
        );
        setE2e(null);
      }
    } finally {
      setCleanupLoading(false);
    }
  };


  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-semibold">
            <Receipt className="h-4 w-4 text-primary" />
            Connexion Pennylane
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={test}
              disabled={loading}
              className="font-sans text-xs"
            >
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Tester la connexion
            </Button>
            <Button
              size="sm"
              onClick={testComplet}
              disabled={e2eLoading}
              className="font-sans text-xs"
            >
              {e2eLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Test complet (facture de démo)
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!result && (
          <p className="font-sans text-sm text-muted-foreground">
            Vérifie que le jeton API Pennylane est valide et que la lecture des clients aboutit
            (lecture seule, aucune facture créée).
          </p>
        )}

        {result?.ok === true && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm">
            <Badge className="bg-sauge/20 text-sauge font-sans text-[10px] font-normal">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Connexion OK
            </Badge>
            <span className="text-foreground">
              Lecture des clients {result.lecture_clients_ok ? "autorisée" : "indisponible"}
            </span>
            <span className="text-[11px] text-muted-foreground">{result.latence_ms} ms</span>
          </div>
        )}

        {result && result.ok === false && (
          <div className="space-y-1 font-sans text-sm">
            <Badge className="bg-destructive/10 text-destructive font-sans text-[10px] font-normal">
              <XCircle className="mr-1 h-3 w-3" /> Échec
            </Badge>
            <p className="text-foreground">
              {result.motif ?? "Échec de la connexion"}
              {result.status ? ` (HTTP ${result.status})` : ""}
            </p>
            {result.message && (
              <p className="text-xs text-muted-foreground break-words">{result.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
