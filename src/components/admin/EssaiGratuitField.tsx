import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAdmin } from "@/lib/logAdmin";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Édition admin de la date de fin d'essai gratuit (abonnements.fin_essai_le).
 * Autonome : lit et écrit directement, indépendamment du formulaire de la fiche.
 * Une date saisie ici prévaut sur le calcul automatique (activation + 90 j),
 * le trigger DB ne repositionnant la date que lorsqu'elle est vide.
 */
export function EssaiGratuitField({ prestataireId }: { prestataireId: string }) {
  const [aboId, setAboId] = useState<string | null>(null);
  const [finEssai, setFinEssai] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("abonnements")
        .select("id, fin_essai_le")
        .eq("prestataire_id", prestataireId)
        .maybeSingle();
      if (cancelled) return;
      setAboId(data?.id ?? null);
      setFinEssai(data?.fin_essai_le ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [prestataireId]);

  const save = async (value: string | null) => {
    if (!aboId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("abonnements")
      .update({ fin_essai_le: value })
      .eq("id", aboId)
      .select("id, fin_essai_le");
    setSaving(false);

    if (error || !data || data.length === 0) {
      toast({
        title: "Modification impossible",
        description: error?.message ?? "Aucune ligne mise à jour.",
        variant: "destructive",
      });
      return;
    }

    setFinEssai(data[0].fin_essai_le);
    await logAdmin("update_fin_essai", "abonnements", aboId, {
      prestataire_id: prestataireId,
      fin_essai_le: value,
    });
    toast({
      title: "Essai gratuit mis à jour",
      description: value
        ? `Fin de l'essai le ${new Date(value).toLocaleDateString("fr-FR")}.`
        : "Aucune date de fin d'essai.",
    });
  };

  if (loading) {
    return (
      <p className="font-sans text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Chargement de l'essai gratuit…
      </p>
    );
  }

  if (!aboId) {
    return (
      <div>
        <label className="font-sans text-sm font-medium text-foreground">Essai gratuit</label>
        <p className="font-sans text-xs text-muted-foreground mt-1">
          Aucun abonnement rattaché à cette fiche.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="font-sans text-sm font-medium text-foreground">
        Essai gratuit — date de fin
      </label>
      <div className="mt-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={saving}
              className={cn(
                "w-full justify-start text-left font-normal font-sans text-sm",
                !finEssai && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {finEssai
                ? new Date(finEssai).toLocaleDateString("fr-FR")
                : "Aucune date (essai non démarré)"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={finEssai ? new Date(finEssai) : undefined}
              onSelect={(d) => {
                if (!d) return;
                const day = new Date(d);
                day.setHours(23, 59, 59, 0);
                save(day.toISOString());
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      {finEssai && (
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          className="mt-1 text-xs text-muted-foreground"
          onClick={() => save(null)}
        >
          Retirer la date d'essai
        </Button>
      )}
      <p className="font-sans text-xs text-muted-foreground mt-1.5">
        Par défaut, l'essai des fiches migrées démarre à l'activation du compte et dure 90 jours.
        Une date saisie ici prévaut sur ce calcul.
      </p>
    </div>
  );
}
