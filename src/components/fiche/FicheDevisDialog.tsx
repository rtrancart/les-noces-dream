import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEvent } from "@/lib/analytics";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const devisSchema = z.object({
  nom: z.string().min(2, "Minimum 2 caractères").max(100),
  email: z.string().email("Email invalide").max(255),
  telephone: z.string().optional(),
  objet: z.enum(["mariage", "evenement_entreprise", "cocktail", "autre"]),
  date_evenement: z.string().optional(),
  lieu_evenement: z.string().max(200).optional(),
  nombre_invites_rang: z.string().optional(),
  message: z.string().min(10, "Minimum 10 caractères").max(2000),
});

type DevisFormValues = z.infer<typeof devisSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestataireId: string;
  prestataireName: string;
}

const objets = [
  { value: "mariage", label: "Mariage" },
  { value: "evenement_entreprise", label: "Événement d'entreprise" },
  { value: "cocktail", label: "Cocktail" },
  { value: "autre", label: "Autre" },
];

export default function FicheDevisDialog({ open, onOpenChange, prestataireId, prestataireName }: Props) {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DevisFormValues>({
    resolver: zodResolver(devisSchema),
    defaultValues: {
      nom: profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() : "",
      email: profile?.email ?? "",
      telephone: profile?.telephone ?? "",
      objet: "mariage",
      message: "",
    },
  });

  const onSubmit = async (values: DevisFormValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("soumettre_demande_devis", {
        p_prestataire_id: prestataireId,
        p_nom: values.nom,
        p_email: values.email.toLowerCase().trim(),
        p_telephone: values.telephone || null,
        p_objet: values.objet,
        p_message: values.message,
        p_date_evenement: values.date_evenement || null,
        p_lieu_evenement: values.lieu_evenement || null,
        p_nombre_invites_rang: values.nombre_invites_rang || null,
      });

      if (error) throw error;

      toast.success("Votre demande de devis a été envoyée !");
      trackEvent("premier_contact", { objet: values.objet }, prestataireId);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      console.error("Devis submit error:", e);
      toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="nom" render={({ field }) => (
            <FormItem>
              <FormLabel>Nom *</FormLabel>
              <FormControl><Input placeholder="Votre nom" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl><Input type="email" placeholder="votre@email.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="telephone" render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone</FormLabel>
              <FormControl><Input placeholder="06 ..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="objet" render={({ field }) => (
            <FormItem>
              <FormLabel>Type d'événement *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {objets.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="date_evenement" render={({ field }) => (
            <FormItem>
              <FormLabel>Date de l'événement</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lieu_evenement" render={({ field }) => (
            <FormItem>
              <FormLabel>Lieu</FormLabel>
              <FormControl><Input placeholder="Ville ou lieu" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="nombre_invites_rang" render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre d'invités</FormLabel>
            <FormControl><Input placeholder="ex: 80-100" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="message" render={({ field }) => (
          <FormItem>
            <FormLabel>Votre message *</FormLabel>
            <FormControl>
              <Textarea placeholder="Décrivez votre projet…" rows={4} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Envoi…" : "Envoyer ma demande"}
        </Button>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Demander un devis</SheetTitle>
            <SheetDescription>Contactez {prestataireName}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{formContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Demander un devis</DialogTitle>
          <DialogDescription>Contactez {prestataireName}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
