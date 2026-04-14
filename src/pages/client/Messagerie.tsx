import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowLeft, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ConversationThread from "@/components/messaging/ConversationThread";

interface DemandeMessage {
  id: string;
  nom_contact: string;
  email_contact: string;
  message: string;
  statut: string;
  created_at: string;
  prestataire: {
    nom_commercial: string;
    slug: string;
  };
  has_unread: boolean;
}

type VisualStatus = "non_lu" | "en_discussion" | "cloture";

function getVisualStatus(statut: string): VisualStatus {
  if (statut === "nouveau") return "non_lu";
  if (statut === "lu" || statut === "en_discussion") return "en_discussion";
  return "cloture";
}

const visualLabels: Record<VisualStatus, { label: string; className: string }> = {
  non_lu: { label: "Non lu", className: "bg-blue-50 text-blue-700" },
  en_discussion: { label: "En discussion", className: "bg-amber-50 text-amber-700" },
  cloture: { label: "Clôturé", className: "bg-secondary text-muted-foreground" },
};

export default function ClientMessagerie() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState<DemandeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchDemandes = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("demandes_devis")
      .select("id, nom_contact, email_contact, message, statut, created_at, prestataire:prestataires(nom_commercial, slug)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    const demandesWithUnread: DemandeMessage[] = [];
    for (const d of data ?? []) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("demande_id", d.id)
        .eq("expediteur_type", "prestataire")
        .is("lu_le", null);

      demandesWithUnread.push({
        id: d.id,
        nom_contact: d.nom_contact,
        email_contact: d.email_contact,
        message: d.message,
        statut: d.statut,
        created_at: d.created_at,
        prestataire: {
          nom_commercial: (d.prestataire as any)?.nom_commercial ?? "",
          slug: (d.prestataire as any)?.slug ?? "",
        },
        has_unread: (count ?? 0) > 0,
      });
    }

    setDemandes(demandesWithUnread);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  const selected = demandes.find((d) => d.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Detail view
  if (selected) {
    const vs = getVisualStatus(selected.statut);
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="border-b p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={`/prestataire/${selected.prestataire.slug}`}
                className="font-sans font-semibold text-foreground hover:text-primary truncate"
              >
                {selected.prestataire.nom_commercial}
              </Link>
              <Badge className={visualLabels[vs].className}>{visualLabels[vs].label}</Badge>
            </div>
          </div>
        </div>

        <ConversationThread
          demandeId={selected.id}
          role="visiteur"
          initialMessage={selected.message}
          onMessageSent={() => fetchDemandes()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Messagerie</h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Vos demandes de devis et échanges avec les prestataires
        </p>
      </div>

      {demandes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-sans text-sm text-muted-foreground text-center">
              Aucune demande de devis pour le moment.
            </p>
            <Link to="/recherche" className="font-sans text-sm text-primary hover:underline">
              Rechercher des prestataires
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {demandes.map((d) => {
            const vs = getVisualStatus(d.statut);
            return (
              <Card
                key={d.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedId(d.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {d.has_unread && (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />
                        )}
                        <span className="font-sans text-sm font-medium text-foreground truncate">
                          {d.prestataire.nom_commercial}
                        </span>
                        <Badge className={`${visualLabels[vs].className} shrink-0`}>
                          {visualLabels[vs].label}
                        </Badge>
                      </div>
                      <p className="font-sans text-xs text-muted-foreground line-clamp-1">
                        {d.message}
                      </p>
                    </div>
                    <p className="font-sans text-xs text-muted-foreground/60 whitespace-nowrap">
                      {format(new Date(d.created_at), "d MMM", { locale: fr })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
