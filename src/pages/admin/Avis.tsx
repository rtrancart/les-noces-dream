import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Check, X, Search, Star, Eye } from "lucide-react";
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

interface AvisWithPrestataire extends Avis {
  prestataire_nom?: string;
}

export default function Avis() {
  const [data, setData] = useState<AvisWithPrestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AvisWithPrestataire | null>(null);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("avis")
      .select("*, prestataires!avis_prestataire_id_fkey(nom_commercial)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut as StatutAvis);

    const { data: result, error } = await query;
    if (error) toast.error(error.message);
    else {
      const mapped = (result ?? []).map((a: any) => ({
        ...a,
        prestataire_nom: a.prestataires?.nom_commercial ?? "—",
      }));
      setData(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatut]);

  const updateStatut = async (id: string, statut: StatutAvis) => {
    const { error } = await supabase.from("avis").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Avis ${statut === "valide" ? "validé" : "rejeté"}`); fetchData(); setSelected(null); }
  };

  const filtered = search
    ? data.filter((a) =>
      `${a.titre ?? ""} ${a.commentaire} ${a.prestataire_nom ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )
    : data;

  const StarRating = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-sans text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`h-3 w-3 ${s <= value ? "text-or-riche fill-or-riche" : "text-muted/30"}`} />
        ))}
        <span className="ml-1 font-sans text-xs font-medium">{value}/5</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Avis</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {data.length} avis · {data.filter((a) => a.statut === "en_attente").length} en attente de modération
          </p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher un avis…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer par statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                {Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Prestataire</TableHead>
                <TableHead className="font-sans text-xs">Note</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-16 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">Aucun avis</TableCell></TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} className={a.statut === "en_attente" ? "bg-champagne/5" : ""}>
                    <TableCell className="font-sans text-sm font-medium">{a.titre ?? "Sans titre"}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{a.prestataire_nom}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-or-riche fill-or-riche" />
                        <span className="font-sans text-sm font-medium">{a.note_globale.toFixed(1)}</span>
                      </div>
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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelected(a)}>
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        {a.statut === "en_attente" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sauge hover:text-sauge" onClick={() => updateStatut(a.id, "valide")}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => updateStatut(a.id, "rejete")}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Détail de l'avis</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <p className="font-sans text-sm font-medium text-foreground">{selected.titre ?? "Sans titre"}</p>
                <p className="font-sans text-xs text-muted-foreground">Prestataire : {selected.prestataire_nom}</p>
              </div>
              <Separator />
              <div className="space-y-0">
                <StarRating value={selected.note_qualite_presta} label="Qualité de prestation" />
                <StarRating value={selected.note_professionnalisme} label="Professionnalisme" />
                <StarRating value={selected.note_rapport_qualite_prix} label="Rapport qualité/prix" />
                <StarRating value={selected.note_flexibilite} label="Flexibilité" />
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-1.5">
                  <span className="font-sans text-xs font-semibold text-foreground">Note globale</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-or-riche fill-or-riche" />
                    <span className="font-sans text-sm font-bold">{selected.note_globale.toFixed(1)}/5</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground mb-1">Commentaire</p>
                <p className="font-sans text-sm text-foreground whitespace-pre-wrap">{selected.commentaire}</p>
              </div>
              {selected.reponse_prestataire && (
                <>
                  <Separator />
                  <div>
                    <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground mb-1">Réponse du prestataire</p>
                    <p className="font-sans text-sm text-foreground whitespace-pre-wrap italic">{selected.reponse_prestataire}</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <Badge className={`${statutColors[selected.statut]} font-sans text-xs`}>{statutLabels[selected.statut]}</Badge>
                {selected.statut === "en_attente" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 font-sans text-xs text-sauge border-sauge/30" onClick={() => updateStatut(selected.id, "valide")}>
                      <Check className="h-3 w-3" /> Valider
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 font-sans text-xs text-destructive border-destructive/30" onClick={() => updateStatut(selected.id, "rejete")}>
                      <X className="h-3 w-3" /> Rejeter
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
