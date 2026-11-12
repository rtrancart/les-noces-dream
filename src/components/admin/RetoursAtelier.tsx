import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;
const jourParis = (d: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(d));

type Retour = {
  id: string; created_at: string; note: string; commentaire: string | null;
  copie_question: string | null; copie_reponse: string | null;
  copie_recommandations: { prestataire_id: string; nom_commercial?: string; raison?: string; hors_zone?: boolean }[];
};

/** Retours 👎 de l'Atelier (seule copie de conversation visible par l'équipe) et erreurs id_invente par jour. */
export function RetoursAtelier() {
  const [retours, setRetours] = useState<Retour[]>([]);
  const [inventes, setInventes] = useState<string[]>([]);
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    (async () => {
      const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
      const [r, l] = await Promise.all([
        db.from("retours_atelier").select("id, created_at, note, commentaire, copie_question, copie_reponse, copie_recommandations")
          .eq("note", "pas_utile").order("created_at", { ascending: false }).limit(200),
        db.from("ia_logs").select("created_at").eq("erreur", "id_invente").gte("created_at", depuis).limit(5000),
      ]);
      setRetours(r.data ?? []);
      setInventes((l.data ?? []).map((x: { created_at: string }) => x.created_at));
      setCharge(false);
    })();
  }, []);

  const parJour = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of inventes) m.set(jourParis(d), (m.get(jourParis(d)) ?? 0) + 1);
    return [...m.entries()].sort().reverse();
  }, [inventes]);

  if (charge) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-base">Prestataires inventés par l'IA (30 j)</CardTitle></CardHeader><CardContent>
        {parJour.length === 0 ? <p className="text-sm text-muted-foreground">Aucune recommandation inventée.</p> :
          <Table><TableHeader><TableRow><TableHead>Jour</TableHead><TableHead className="text-right">Recommandations supprimées</TableHead></TableRow></TableHeader>
            <TableBody>{parJour.map(([j, n]) => <TableRow key={j}><TableCell>{j}</TableCell><TableCell className="text-right">{n}</TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Réponses signalées 👎 ({retours.length})</CardTitle></CardHeader><CardContent className="space-y-4">
        {retours.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement pour l'instant.</p>}
        {retours.map((r) => (
          <div key={r.id} className="space-y-2 rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
            <p><strong>Question :</strong> {r.copie_question ?? "—"}</p>
            <p className="whitespace-pre-wrap"><strong>Réponse :</strong> {r.copie_reponse ?? "—"}</p>
            {r.copie_recommandations?.length > 0 && (
              <ul className="list-disc pl-5">{r.copie_recommandations.map((c) => (
                <li key={c.prestataire_id}>{c.nom_commercial ?? c.prestataire_id}{c.hors_zone && <Badge variant="outline" className="ml-2">hors zone</Badge>} — {c.raison}</li>
              ))}</ul>
            )}
            {r.commentaire && <p className="rounded bg-muted p-2"><strong>Commentaire :</strong> {r.commentaire}</p>}
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
