import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileText,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ArrowLeft,
  Circle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import ConversationThread from "@/components/messaging/ConversationThread";

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
  has_unread: boolean;
}

type VisualStatus = "non_lu" | "en_discussion" | "cloture";

function getVisualStatus(statut: string): VisualStatus {
  if (statut === "nouveau") return "non_lu";
  if (statut === "lu" || statut === "en_discussion") return "en_discussion";
  return "cloture";
}

const visualLabels: Record<VisualStatus, { label: string; className: string }> = {
  non_lu: { label: "Non lu", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  en_discussion: { label: "En discussion", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  cloture: { label: "Clôturé", className: "bg-muted text-muted-foreground" },
};

const closedStatuses = [
  { value: "devis_envoye", label: "Devis envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "archive", label: "Archivé" },
];

export default function PrestataireDemandes() {
  const { prestataire, loading: loadingPrest } = useSharedPrestataire();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchDemandes = useCallback(async () => {
    if (!prestataire?.id) return;
    const { data } = await supabase
      .from("demandes_devis")
      .select("id, nom_contact, email_contact, telephone_contact, message, statut, date_evenement, lieu_evenement, nombre_invites_rang, budget_indicatif, created_at")
      .eq("prestataire_id", prestataire.id)
      .order("created_at", { ascending: false });

    // Check for unread messages per demande
    const demandesWithUnread: Demande[] = [];
    for (const d of data ?? []) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("demande_id", d.id)
        .eq("expediteur_type", "visiteur")
        .is("lu_le", null);

      demandesWithUnread.push({ ...d, has_unread: (count ?? 0) > 0 });
    }

    setDemandes(demandesWithUnread);
    setLoading(false);
  }, [prestataire?.id]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  // Auto-mark as "lu" when opening a "nouveau" demande
  useEffect(() => {
    if (!selectedId) return;
    const demande = demandes.find((d) => d.id === selectedId);
    if (demande?.statut === "nouveau") {
      supabase
        .from("demandes_devis")
        .update({ statut: "lu" })
        .eq("id", selectedId)
        .then(() => {
          setDemandes((prev) =>
            prev.map((d) => (d.id === selectedId ? { ...d, statut: "lu" } : d))
          );
        });
    }
  }, [selectedId]);

  const handleStatusChange = async (demandeId: string, newStatut: "devis_envoye" | "accepte" | "refuse" | "archive") => {
    await supabase
      .from("demandes_devis")
      .update({ statut: newStatut })
      .eq("id", demandeId);

    setDemandes((prev) =>
      prev.map((d) => (d.id === demandeId ? { ...d, statut: newStatut } : d))
    );
  };

  const selected = demandes.find((d) => d.id === selectedId);

  if (loadingPrest || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Mobile: show either list or conversation
  if (selected) {
    const vs = getVisualStatus(selected.statut);
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="border-b p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-semibold text-foreground truncate">
                {selected.nom_contact}
              </h2>
              <Badge className={visualLabels[vs].className}>{visualLabels[vs].label}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {selected.email_contact}
              </span>
              {selected.telephone_contact && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {selected.telephone_contact}
                </span>
              )}
              {selected.date_evenement && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selected.date_evenement), "d MMMM yyyy", { locale: fr })}
                </span>
              )}
              {selected.lieu_evenement && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {selected.lieu_evenement}
                </span>
              )}
            </div>
          </div>

          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs shrink-0">
                Clôturer
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {closedStatuses.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onClick={() => handleStatusChange(selected.id, s.value)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conversation */}
        <ConversationThread
          demandeId={selected.id}
          role="prestataire"
          initialMessage={selected.message}
          onMessageSent={() => fetchDemandes()}
        />
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
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {(d.has_unread || d.statut === "nouveau") && (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />
                        )}
                        <h3 className="font-sans font-semibold text-foreground truncate">
                          {d.nom_contact}
                        </h3>
                        <Badge className={`${visualLabels[vs].className} shrink-0`}>
                          {visualLabels[vs].label}
                        </Badge>
                      </div>
                      <p className="font-sans text-sm text-muted-foreground line-clamp-1">
                        {d.message}
                      </p>
                    </div>
                    <p className="font-sans text-xs text-muted-foreground whitespace-nowrap">
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
