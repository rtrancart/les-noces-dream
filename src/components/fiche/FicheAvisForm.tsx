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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const buildSchema = (isAnonymous: boolean) =>
  z.object({
    nom: isAnonymous
      ? z.string().trim().min(2, "Nom requis").max(80)
      : z.string().optional(),
    email: isAnonymous
      ? z.string().trim().email("Email invalide").max(255)
      : z.string().optional(),
    titre: z.string().trim().min(3, "Titre requis (3 caractères min.)").max(120, "Maximum 120 caractères"),
    note_qualite_presta: z.number().min(1, "Obligatoire").max(5),
    note_professionnalisme: z.number().min(1, "Obligatoire").max(5),
    note_rapport_qualite_prix: z.number().min(1, "Obligatoire").max(5),
    note_flexibilite: z.number().min(1, "Obligatoire").max(5),
    commentaire: z.string().trim().min(1, "Commentaire requis").max(2000, "Maximum 2000 caractères"),
  });

type AvisFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestataireId: string;
  onSuccess: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
            className={i <= (hover || value) ? "text-primary fill-primary" : "text-border"}
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
  const isAnonymous = !user;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AvisFormValues>({
    resolver: zodResolver(buildSchema(isAnonymous)),
    defaultValues: {
      nom: "",
      email: "",
      note_qualite_presta: 0,
      note_professionnalisme: 0,
      note_rapport_qualite_prix: 0,
      note_flexibilite: 0,
      commentaire: "",
    },
  });

  const handleOpenChange = (v: boolean) => {
    if (!v) form.reset();
    onOpenChange(v);
  };

  const onSubmit = async (values: AvisFormValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("soumettre_avis", {
        p_prestataire_id: prestataireId,
        p_note_qualite_presta: values.note_qualite_presta,
        p_note_professionnalisme: values.note_professionnalisme,
        p_note_rapport_qualite_prix: values.note_rapport_qualite_prix,
        p_note_flexibilite: values.note_flexibilite,
        p_commentaire: values.commentaire,
        p_nom: isAnonymous ? values.nom : null,
        p_email: isAnonymous ? values.email : null,
      });

      if (error) throw error;

      toast.success("Merci ! Votre avis sera publié après validation.");
      form.reset();
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi de l'avis.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {isAnonymous && (
            <>
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Votre nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Votre email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="vous@exemple.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {criteres.map((c) => (
            <FormField
              key={c.name}
              control={form.control}
              name={c.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c.label}</FormLabel>
                  <FormControl>
                    <StarRating value={field.value as number} onChange={field.onChange} />
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
                    placeholder="Décrivez votre expérience…"
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
            <SheetDescription>Notez votre expérience</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laisser un avis</DialogTitle>
          <DialogDescription>Notez votre expérience</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
