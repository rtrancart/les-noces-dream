import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Avis = Database["public"]["Tables"]["avis"]["Row"];
type StatutAvis = Database["public"]["Enums"]["statut_avis"];

const statutLabels: Record<StatutAvis, string> = {
  en_attente: "En attente",
  valide: "Validé",
  rejete: "Rejeté",
};

const statutColors: Record<StatutAvis, string> = {
  en_attente: "bg-champagne/30 text-foreground",
  valide: "bg-sauge/20 text-sauge",
  rejete: "bg-destructive/10 text-destructive",
};

export default function Avis() {
  const [data, setData] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase
      .from("avis")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatut = async (id: string, statut: StatutAvis) => {
    const { error } = await supabase.from("avis").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Avis ${statut === "valide" ? "validé" : "rejeté"}`); fetchData(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Avis</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">Modérez les avis laissés par les clients</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Note</TableHead>
                <TableHead className="font-sans text-xs">Commentaire</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-16 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun avis
                  </TableCell>
                </TableRow>
              ) : (
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-sans text-sm font-medium">{a.titre ?? "Sans titre"}</TableCell>
                    <TableCell className="font-sans text-sm">{a.note_globale.toFixed(1)}/5</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground max-w-[250px] truncate">
                      {a.commentaire}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statutColors[a.statut]} font-sans text-[11px] font-normal`}>
                        {statutLabels[a.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.statut === "en_attente" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-sauge hover:text-sauge"
                            onClick={() => updateStatut(a.id, "valide")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => updateStatut(a.id, "rejete")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
