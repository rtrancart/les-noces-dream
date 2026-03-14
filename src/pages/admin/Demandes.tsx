import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Demande = Database["public"]["Tables"]["demandes_devis"]["Row"];
type StatutDemande = Database["public"]["Enums"]["statut_demande"];

const statutLabels: Record<StatutDemande, string> = {
  nouveau: "Nouveau",
  lu: "Lu",
  en_discussion: "En discussion",
  devis_envoye: "Devis envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  archive: "Archivé",
};

const statutColors: Record<StatutDemande, string> = {
  nouveau: "bg-primary/15 text-primary",
  lu: "bg-accent/15 text-accent-foreground",
  en_discussion: "bg-champagne/30 text-foreground",
  devis_envoye: "bg-bleu-petrole/15 text-bleu-petrole",
  accepte: "bg-sauge/20 text-sauge",
  refuse: "bg-destructive/10 text-destructive",
  archive: "bg-muted text-muted-foreground",
};

export default function Demandes() {
  const [data, setData] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("tous");

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("demandes_devis")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut);
    const { data: result, error } = await query;
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatut]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Demandes de devis</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Suivez toutes les demandes envoyées aux prestataires</p>
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[180px] font-sans text-sm">
            <SelectValue placeholder="Filtrer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {Object.entries(statutLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Contact</TableHead>
                <TableHead className="font-sans text-xs">Email</TableHead>
                <TableHead className="font-sans text-xs">Objet</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucune demande
                  </TableCell>
                </TableRow>
              ) : (
                data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-sans text-sm font-medium">{d.nom_contact}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{d.email_contact}</TableCell>
                    <TableCell className="font-sans text-sm capitalize">{d.objet.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge className={`${statutColors[d.statut]} font-sans text-[11px] font-normal`}>
                        {statutLabels[d.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}
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
