import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const avisSchema = z.object({
  note_qualite_presta: z.number().min(1, "Obligatoire").max(5),
  note_professionnalisme: z.number().min(1, "Obligatoire").max(5),
  note_rapport_qualite_prix: z.number().min(1, "Obligatoire").max(5),
  note_flexibilite: z.number().min(1, "Obligatoire").max(5),
  commentaire: z
    .string()
    .min(
      100,
      "Votre avis doit contenir au moins 100 caractères pour être publié. Les avis détaillés aident les autres couples à choisir.",
    ),
});

type AvisFormValues = z.infer<typeof avisSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestataireId: string;
  onSuccess: () => void;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={24}
            className={
              i <= (hover || value)
                ? "text-primary fill-primary"
                : "text-border"
            }
          />
        </button>
      ))}
    </div>
  );
}

const criteres = [
  { name: "note_qualite_presta" as const, label: "Qualité de prestation" },
  { name: "note_professionnalisme" as const, label: "Professionnalisme" },
  { name: "note_rapport_qualite_prix" as const, label: "Rapport qualité/prix" },
  { name: "note_flexibilite" as const, label: "Flexibilité" },
];

export default function FicheAvisForm({ open, onOpenChange, prestataireId, onSuccess }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AvisFormValues>({
    resolver: zodResolver(avisSchema),
    defaultValues: {
      note_qualite_presta: 0,
      note_professionnalisme: 0,
      note_rapport_qualite_prix: 0,
      note_flexibilite: 0,
      commentaire: "",
    },
  });

  const resetAll = () => {
    form.reset();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  const onSubmit = async (values: AvisFormValues) => {
    if (!user) return;

    setSubmitting(true);
    try {
      // Pondération : (Q*2 + P + R + F) / 5
      const noteGlobale =
        (values.note_qualite_presta * 2 +
          values.note_professionnalisme +
          values.note_rapport_qualite_prix +
          values.note_flexibilite) /
        5;

      const { error } = await supabase.from("avis").insert({
        prestataire_id: prestataireId,
        client_id: user.id,
        note_qualite_presta: values.note_qualite_presta,
        note_professionnalisme: values.note_professionnalisme,
        note_rapport_qualite_prix: values.note_rapport_qualite_prix,
        note_flexibilite: values.note_flexibilite,
        note_globale: parseFloat(noteGlobale.toFixed(2)),
        commentaire: values.commentaire,
        statut: "en_attente",
      });

      if (error) throw error;

      toast.success("Merci ! Votre avis sera publié après validation.");
      onSuccess();
    } catch {
      toast.error("Erreur lors de l'envoi de l'avis.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {criteres.map((c) => (
            <FormField
              key={c.name}
              control={form.control}
              name={c.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c.label}</FormLabel>
                  <FormControl>
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <FormField
            control={form.control}
            name="commentaire"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Votre avis</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Décrivez votre expérience (min. 100 caractères)…"
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Envoi…" : "Envoyer mon avis"}
          </Button>
        </form>
      </Form>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Laisser un avis</SheetTitle>
            <SheetDescription>
              Notez votre expérience
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Laisser un avis</DialogTitle>
          <DialogDescription>
            {step === "email"
              ? "Vérification de votre éligibilité"
              : "Notez votre expérience"}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
