import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Eye } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Prestataire = Database["public"]["Tables"]["prestataires"]["Row"];
type StatutPrestataire = Database["public"]["Enums"]["statut_prestataire"];

const statutLabels: Record<StatutPrestataire, string> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  a_corriger: "À corriger",
  actif: "Actif",
  suspendu: "Suspendu",
  archive: "Archivé",
};

const statutColors: Record<StatutPrestataire, string> = {
  brouillon: "bg-muted text-muted-foreground",
  en_attente: "bg-champagne/30 text-foreground",
  a_corriger: "bg-destructive/10 text-destructive",
  actif: "bg-sauge/20 text-sauge",
  suspendu: "bg-destructive/10 text-destructive",
  archive: "bg-muted text-muted-foreground",
};

export default function Prestataires() {
  const [data, setData] = useState<Prestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("tous");

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("prestataires")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterStatut !== "tous") {
      query = query.eq("statut", filterStatut);
    }
    if (search) {
      query = query.ilike("nom_commercial", `%${search}%`);
    }

    const { data: result, error } = await query;
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterStatut, search]);

  const updateStatut = async (id: string, statut: StatutPrestataire) => {
    const { error } = await supabase.from("prestataires").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Prestataires</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Gérez les fiches prestataires de la plateforme
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un prestataire…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 font-sans text-sm"
              />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[180px] font-sans text-sm">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                {Object.entries(statutLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Nom commercial</TableHead>
                <TableHead className="font-sans text-xs">Ville</TableHead>
                <TableHead className="font-sans text-xs">Région</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Note</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun prestataire trouvé
                  </TableCell>
                </TableRow>
              ) : (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-sans text-sm font-medium">{p.nom_commercial}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{p.ville}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{p.region}</TableCell>
                    <TableCell>
                      <Select
                        value={p.statut}
                        onValueChange={(val) => updateStatut(p.id, val as StatutPrestataire)}
                      >
                        <SelectTrigger className="h-7 w-[130px] border-0 p-0">
                          <Badge className={`${statutColors[p.statut]} font-sans text-[11px] font-normal`}>
                            {statutLabels[p.statut]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statutLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-sans text-sm">
                      {p.note_moyenne ? `${p.note_moyenne.toFixed(1)}/5` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
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
