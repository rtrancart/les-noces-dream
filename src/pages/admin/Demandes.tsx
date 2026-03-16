import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye } from "lucide-react";
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

export default function Demandes() {
  const [data, setData] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [selected, setSelected] = useState<Demande | null>(null);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from("demandes_devis").select("*").order("created_at", { ascending: false }).limit(200);
    if (filterStatut !== "tous") query = query.eq("statut", filterStatut as StatutDemande);
    const { data: result, error } = await query;
    if (error) toast.error(error.message);
    else setData(result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatut]);

  const updateStatut = async (id: string, statut: StatutDemande) => {
    const { error } = await supabase.from("demandes_devis").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); fetchData(); if (selected?.id === id) setSelected({ ...selected, statut }); }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex justify-between py-2">
      <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-sans text-sm text-foreground">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Demandes de devis</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Suivez toutes les demandes envoyées aux prestataires</p>
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[180px] font-sans text-sm"><SelectValue placeholder="Filtrer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                <TableHead className="font-sans text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>))}</TableRow>))
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-sans text-sm text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
              ) : (
                data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-sans text-sm font-medium">{d.nom_contact}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{d.email_contact}</TableCell>
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
                <p className="mt-1 font-sans text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
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
