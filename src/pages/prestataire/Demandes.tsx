import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrestataire } from "@/hooks/usePrestataire";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Mail, Phone, Calendar, MapPin } from "lucide-react";

interface Demande {
  id: string;
  nom_contact: string;
  email_contact: string;
  telephone_contact: string | null;
  message: string;
  statut: string;
  date_evenement: string | null;
  lieu_evenement: string | null;
  nombre_invites_rang: string | null;
  budget_indicatif: number | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  nouveau: "Nouveau",
  lu: "Lu",
  en_discussion: "En discussion",
  devis_envoye: "Devis envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  archive: "Archivé",
};

const statusColors: Record<string, string> = {
  nouveau: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  lu: "bg-muted text-muted-foreground",
  en_discussion: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  devis_envoye: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  accepte: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  refuse: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archive: "bg-muted text-muted-foreground",
};

export default function PrestataireDemandes() {
  const { prestataire, loading: loadingPrest } = usePrestataire();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prestataire?.id) return;

    async function fetch() {
      const { data } = await supabase
        .from("demandes_devis")
        .select("id, nom_contact, email_contact, telephone_contact, message, statut, date_evenement, lieu_evenement, nombre_invites_rang, budget_indicatif, created_at")
        .eq("prestataire_id", prestataire!.id)
        .order("created_at", { ascending: false });

      setDemandes(data ?? []);
      setLoading(false);
    }

    fetch();
  }, [prestataire?.id]);

  if (loadingPrest || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-foreground">Demandes reçues</h1>

      {demandes.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-sans text-lg text-foreground mb-1">Aucune demande pour le moment</h3>
          <p className="font-sans text-sm text-muted-foreground">
            Les demandes de devis apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {demandes.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-sans font-semibold text-foreground">{d.nom_contact}</h3>
                      <Badge className={statusColors[d.statut] ?? "bg-muted text-muted-foreground"}>
                        {statusLabels[d.statut] ?? d.statut}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-sans">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {d.email_contact}
                      </span>
                      {d.telephone_contact && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {d.telephone_contact}
                        </span>
                      )}
                      {d.date_evenement && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(d.date_evenement), "d MMMM yyyy", { locale: fr })}
                        </span>
                      )}
                      {d.lieu_evenement && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {d.lieu_evenement}
                        </span>
                      )}
                    </div>

                    <p className="font-sans text-sm text-foreground/80 line-clamp-2">{d.message}</p>
                  </div>

                  <p className="font-sans text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
