import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Ligne {
  semaine: string;
  visites: number;
  demandes: number;
  telephones: number;
}

/** Activité globale du site (toutes fiches) sur 8 semaines, heure de Paris. */
export default function ActiviteGlobalePanel() {
  const [data, setData] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_statistiques_activite_hebdo").then(({ data, error }) => {
      if (error) return setErreur(error.message);
      setData(
        (data ?? []).map((r) => ({
          semaine:
            format(parseISO(r.semaine_debut), "d MMM", { locale: fr }) + (r.est_partielle ? " (en cours)" : ""),
          visites: Number(r.visites),
          demandes: Number(r.demandes_devis),
          telephones: Number(r.telephones),
        })),
      );
    });
  }, []);

  const total = (k: keyof Omit<Ligne, "semaine">) => data.reduce((s, l) => s + l[k], 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="font-sans text-lg">Activité du site — 8 dernières semaines</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{total("visites")} visites</Badge>
          <Badge variant="outline">{total("demandes")} devis validés</Badge>
          <Badge variant="outline">{total("telephones")} téléphones</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {erreur ? (
          <p className="text-sm text-destructive">{erreur}</p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="semaine" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="visites" name="Visites de fiche" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="demandes" name="Demandes de devis validées" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="telephones" name="Affichages téléphone" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Semaines du lundi au dimanche, heure de Paris. La dernière semaine est en cours.</p>
      </CardContent>
    </Card>
  );
}
