import { Star, MessageSquarePlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import FicheAvisForm from "./FicheAvisForm";

interface Avis {
  id: string;
  note_globale: number;
  note_qualite_presta: number;
  note_professionnalisme: number;
  note_rapport_qualite_prix: number;
  note_flexibilite: number;
  commentaire: string;
  titre: string | null;
  created_at: string;
  reponse_prestataire: string | null;
}

interface FicheAvisProps {
  avis: Avis[];
  prestataire: {
    id: string;
    nom_commercial: string;
    note_moyenne: number | null;
    note_qualite_prestation: number | null;
    note_professionnalisme: number | null;
    note_rapport_qualite_prix: number | null;
    note_flexibilite: number | null;
    nombre_avis: number | null;
  };
  onAvisAdded?: () => void;
}

const criteres = [
  { key: "note_qualite_prestation" as const, aviKey: "note_qualite_presta" as const, label: "Qualité de prestation" },
  { key: "note_professionnalisme" as const, aviKey: "note_professionnalisme" as const, label: "Professionnalisme" },
  { key: "note_rapport_qualite_prix" as const, aviKey: "note_rapport_qualite_prix" as const, label: "Rapport qualité/prix" },
  { key: "note_flexibilite" as const, aviKey: "note_flexibilite" as const, label: "Flexibilité" },
];

function Stars({ note, size = 14 }: { note: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(note) ? "text-primary fill-primary" : "text-border"}
        />
      ))}
    </div>
  );
}

export default function FicheAvis({ avis, prestataire, onAvisAdded }: FicheAvisProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section id="avis" className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Avis clients
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormOpen(true)}
          className="gap-2"
        >
          <MessageSquarePlus size={16} />
          <span className="hidden sm:inline">Laisser un avis</span>
          <span className="sm:hidden">Avis</span>
        </Button>
      </div>

      {/* Résumé global */}
      {prestataire.nombre_avis && prestataire.nombre_avis > 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <span className="font-serif text-4xl font-bold text-foreground">
                {prestataire.note_moyenne?.toFixed(1)}
              </span>
              <span className="text-muted-foreground text-sm">/5</span>
              <div className="mt-1">
                <Stars note={prestataire.note_moyenne ?? 0} size={16} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {prestataire.nombre_avis} avis
              </p>
            </div>
            <div className="flex-1 space-y-3">
              {criteres.map((c) => {
                const val = prestataire[c.key] ?? 0;
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-40 shrink-0">{c.label}</span>
                    <Progress value={(val / 5) * 100} className="h-2 flex-1" />
                    <span className="text-sm font-medium text-foreground w-8 text-right">
                      {val.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aucun avis pour le moment. Soyez le premier à donner votre avis !
        </p>
      )}

      {/* Liste des avis */}
      {avis.length > 0 && (
        <div className="space-y-6">
          {avis.map((a) => (
            <div key={a.id} className="border border-border rounded-xl p-5 space-y-4">
              {/* En-tête avis */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {a.titre && (
                    <h4 className="font-sans font-semibold text-foreground mb-1">{a.titre}</h4>
                  )}
                  <div className="flex items-center gap-2">
                    <Stars note={a.note_globale} />
                    <span className="text-sm font-medium text-foreground">
                      {a.note_globale.toFixed(1)}/5
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}
                </span>
              </div>

              {/* Détail des 4 notes */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {criteres.map((c) => {
                  const val = a[c.aviKey];
                  return (
                    <div key={c.aviKey} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                      <div className="flex items-center gap-1">
                        <Star size={10} className="text-primary fill-primary" />
                        <span className="text-xs font-medium">{val}/5</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Commentaire */}
              <p className="text-sm text-foreground leading-relaxed">{a.commentaire}</p>

              {/* Réponse prestataire */}
              {a.reponse_prestataire && (
                <div className="bg-secondary/30 rounded-lg p-4 ml-4 border-l-2 border-primary">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Réponse de {prestataire.nom_commercial}
                  </p>
                  <p className="text-sm text-foreground">{a.reponse_prestataire}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FicheAvisForm
        open={formOpen}
        onOpenChange={setFormOpen}
        prestataireId={prestataire.id}
        onSuccess={() => {
          setFormOpen(false);
          onAvisAdded?.();
        }}
      />
    </section>
  );
}
