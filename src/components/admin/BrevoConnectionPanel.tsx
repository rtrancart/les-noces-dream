import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Plug, ListChecks } from "lucide-react";

type TestResult =
  | { ok: true; latence_ms: number; compte: { email: string | null; companyName: string | null } }
  | { ok: false; kind?: string; status?: number | null; motif?: string; message?: string };

interface Ligne {
  attribut: string;
  type: string;
  etat: "cree" | "deja_present" | "complete" | "echec";
  motif?: string;
  valeurs?: string[];
}

interface ProvisionResult {
  ok: boolean;
  message?: string;
  resume?: { crees: number; deja_presents: number; completes: number; echecs: number };
  attributs?: Ligne[];
  verification_categories?: Record<
    string,
    { attendues: string[]; presentes: string[]; conforme: boolean }
  >;
}

const ETAT_LABEL: Record<Ligne["etat"], string> = {
  cree: "Créé",
  deja_present: "Déjà présent",
  complete: "Complété",
  echec: "Échec",
};

export function BrevoConnectionPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [provLoading, setProvLoading] = useState(false);
  const [prov, setProv] = useState<ProvisionResult | null>(null);

  const test = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("brevo-test-connection", {
        body: {},
      });
      if (error) {
        setResult({ ok: false, motif: "Appel de la fonction impossible", message: error.message });
      } else {
        setResult(data as TestResult);
      }
    } catch (e) {
      setResult({ ok: false, motif: "Erreur inattendue", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const provisionner = async () => {
    setProvLoading(true);
    setProv(null);
    try {
      const { data, error } = await supabase.functions.invoke("brevo-provision-schema", {
        body: {},
      });
      if (error) {
        setProv({ ok: false, message: error.message });
      } else {
        setProv(data as ProvisionResult);
      }
    } catch (e) {
      setProv({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setProvLoading(false);
    }
  };


  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-semibold">
            <Plug className="h-4 w-4 text-primary" />
            Connexion Brevo
          </CardTitle>
          <Button size="sm" onClick={test} disabled={loading} className="font-sans text-xs">
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Tester la connexion
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result && (
          <p className="font-sans text-sm text-muted-foreground">
            Vérifie que la clé API Brevo est valide et que les échanges aboutissent (lecture seule).
          </p>
        )}

        {result?.ok === true && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm">
            <Badge className="bg-sauge/20 text-sauge font-sans text-[10px] font-normal">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Connexion OK
            </Badge>
            <span className="text-foreground">
              {result.compte.companyName ?? "Compte Brevo"}
            </span>
            {result.compte.email && (
              <span className="text-muted-foreground">{result.compte.email}</span>
            )}
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
