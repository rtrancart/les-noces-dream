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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye, Search, MessageSquare } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Demande = Database["public"]["Tables"]["demandes_devis"]["Row"];
type StatutDemande = Database["public"]["Enums"]["statut_demande"];

const statutLabels: Record<StatutDemande, string> = {
  nouveau: "Nouveau", lu: "Lu", en_discussion: "En discussion", devis_envoye: "Devis envoyé", accepte: "Accepté", refuse: "Refusé", archive: "Archivé",
};

const statutColors: Record<StatutDemande, string> = {
  nouveau: "bg-primary/15 text-primary", lu: "bg-accent/15 text-accent-foreground", en_discussion: "bg-champagne/30 text-foreground",
  devis_envoye: "bg-bleu-petrole/15 text-bleu-petrole", accepte: "bg-sauge/20 text-sauge", refuse: "bg-destructive/10 text-destructive", archive: "bg-muted/40 text-muted-foreground",
};

interface DemandeWithPrestataire extends Demande {
  prestataire_nom?: string;
}

export default function Demandes() {
  const [data, setData] = useState<DemandeWithPrestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DemandeWithPrestataire | null>(null);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from("demandes_devis")
      .select("*, prestataires!demandes_devis_prestataire_id_fkey(nom_commercial)")
      .order("created_at", { ascending: false }).limit(200);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut as StatutDemande);
    const { data: result, error } = await query;
    if (error) toast.error(error.message);
    else {
      const mapped = (result ?? []).map((d: any) => ({
        ...d,
        prestataire_nom: d.prestataires?.nom_commercial ?? "—",
      }));
      setData(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatut]);

  const updateStatut = async (id: string, statut: StatutDemande) => {
    const { error } = await supabase.from("demandes_devis").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      fetchData();
      if (selected?.id === id) setSelected({ ...selected, statut });
    }
  };

  const filtered = search
    ? data.filter((d) =>
      `${d.nom_contact} ${d.email_contact} ${d.prestataire_nom ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )
    : data;

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex justify-between py-2">
      <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-sans text-sm text-foreground text-right max-w-[60%]">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Demandes de devis</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {data.length} demande{data.length > 1 ? "s" : ""} · {data.filter((d) => d.statut === "nouveau").length} nouvelle{data.filter((d) => d.statut === "nouveau").length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-sans text-sm" />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer" /></SelectTrigger>
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
                <TableHead className="font-sans text-xs">Contact</TableHead>
                <TableHead className="font-sans text-xs">Prestataire</TableHead>
                <TableHead className="font-sans text-xs">Objet</TableHead>
                <TableHead className="font-sans text-xs">Statut</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow key={d.id} className={d.statut === "nouveau" ? "bg-primary/5" : ""}>
                    <TableCell>
                      <p className="font-sans text-sm font-medium">{d.nom_contact}</p>
                      <p className="font-sans text-xs text-muted-foreground">{d.email_contact}</p>
                    </TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{d.prestataire_nom}</TableCell>
                    <TableCell className="font-sans text-sm capitalize">{d.objet.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Select value={d.statut} onValueChange={(v) => updateStatut(d.id, v as StatutDemande)}>
                        <SelectTrigger className="h-7 w-[130px] border-0 p-0">
                          <Badge className={`${statutColors[d.statut]} font-sans text-[11px] font-normal`}>{statutLabels[d.statut]}</Badge>
                        </SelectTrigger>
                        <SelectContent>{Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelected(d)}>
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

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-lg">Détail de la demande</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-1">
              <InfoRow label="Contact" value={selected.nom_contact} />
              <Separator />
              <InfoRow label="Email" value={selected.email_contact} />
              <Separator />
              <InfoRow label="Téléphone" value={selected.telephone_contact} />
              <Separator />
              <InfoRow label="Prestataire" value={selected.prestataire_nom} />
              <Separator />
              <InfoRow label="Objet" value={selected.objet.replace(/_/g, " ")} />
              <Separator />
              <InfoRow label="Date événement" value={selected.date_evenement} />
              <Separator />
              <InfoRow label="Lieu" value={selected.lieu_evenement} />
              <Separator />
              <InfoRow label="Invités" value={selected.nombre_invites_rang} />
              <Separator />
              <InfoRow label="Budget indicatif" value={selected.budget_indicatif ? `${selected.budget_indicatif} €` : null} />
              <Separator />
              <div className="pt-3">
                <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Message</span>
                <p className="mt-1 font-sans text-sm text-foreground whitespace-pre-wrap bg-muted/10 rounded-md p-3">{selected.message}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-3">
                <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Statut</span>
                <Select value={selected.statut} onValueChange={(v) => updateStatut(selected.id, v as StatutDemande)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
