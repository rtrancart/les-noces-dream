import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

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
}

export default function ClientMessagerie() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState<DemandeMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchDemandes = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("demandes_devis")
        .select("id, nom_contact, email_contact, message, statut, created_at, prestataire:prestataires(nom_commercial, slug)")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false });

      setDemandes(
        (data ?? []).map((d: any) => ({
          id: d.id,
          nom_contact: d.nom_contact,
          email_contact: d.email_contact,
          message: d.message,
          statut: d.statut,
          created_at: d.created_at,
          prestataire: {
            nom_commercial: d.prestataire?.nom_commercial ?? "",
            slug: d.prestataire?.slug ?? "",
          },
        }))
      );
      setLoading(false);
    };

    fetchDemandes();
  }, [user?.id]);

  const statutLabel: Record<string, { label: string; className: string }> = {
    nouveau: { label: "Envoyée", className: "bg-blue-50 text-blue-700" },
    lu: { label: "Lue", className: "bg-secondary text-muted-foreground" },
    en_discussion: { label: "En discussion", className: "bg-amber-50 text-amber-700" },
    devis_envoye: { label: "Devis reçu", className: "bg-primary/10 text-primary" },
    accepte: { label: "Acceptée", className: "bg-green-50 text-green-700" },
    refuse: { label: "Refusée", className: "bg-red-50 text-red-700" },
    archive: { label: "Archivée", className: "bg-secondary text-muted-foreground" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
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
            const s = statutLabel[d.statut] ?? { label: d.statut, className: "bg-secondary text-muted-foreground" };
            return (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/prestataire/${d.prestataire.slug}`}
                          className="font-sans text-sm font-medium text-foreground hover:text-primary truncate"
                        >
                          {d.prestataire.nom_commercial}
                        </Link>
                        <span className={`font-sans text-xs px-2 py-0.5 rounded-full shrink-0 ${s.className}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="font-sans text-xs text-muted-foreground line-clamp-2">{d.message}</p>
                      <p className="font-sans text-xs text-muted-foreground/60 mt-1">
                        {new Date(d.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
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
