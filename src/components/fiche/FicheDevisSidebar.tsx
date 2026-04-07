import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";

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

const objets = [
  { value: "mariage", label: "Mariage" },
  { value: "evenement_entreprise", label: "Événement d'entreprise" },
  { value: "cocktail", label: "Cocktail" },
  { value: "autre", label: "Autre" },
];

interface Props {
  prestataireId: string;
  prestataireName: string;
}

export default function FicheDevisSidebar({ prestataireId, prestataireName }: Props) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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
      const { data: contact, error: contactErr } = await supabase
        .from("contacts_anonymes")
        .upsert(
          {
            email: values.email.toLowerCase().trim(),
            prenom: values.nom.split(" ")[0],
            telephone: values.telephone || null,
            origine_premiere: "fiche_prestataire",
            ...(user ? { profile_id: user.id } : {}),
          },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (contactErr) throw contactErr;

      const { error } = await supabase.from("demandes_devis").insert({
        prestataire_id: prestataireId,
        contact_id: contact.id,
        profile_id: user?.id ?? null,
        nom_contact: values.nom,
        email_contact: values.email.toLowerCase().trim(),
        telephone_contact: values.telephone || null,
        objet: values.objet,
        date_evenement: values.date_evenement || null,
        lieu_evenement: values.lieu_evenement || null,
        nombre_invites_rang: values.nombre_invites_rang || null,
        message: values.message,
      });

      if (error) throw error;

      toast.success("Votre demande de devis a été envoyée !");
      setSent(true);
      form.reset();
    } catch {
      toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8 text-center space-y-2">
          <Send className="h-8 w-8 text-primary mx-auto" />
          <p className="font-sans text-sm font-medium text-foreground">Demande envoyée !</p>
          <p className="font-sans text-xs text-muted-foreground">
            {prestataireName} vous répondra rapidement.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setSent(false)}>
            Envoyer une autre demande
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-sans text-base">Demander un devis</CardTitle>
        <p className="font-sans text-xs text-muted-foreground">Contactez {prestataireName}</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Nom *</FormLabel>
                <FormControl><Input placeholder="Votre nom" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email *</FormLabel>
                <FormControl><Input type="email" placeholder="votre@email.com" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="telephone" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Téléphone</FormLabel>
                <FormControl><Input placeholder="06 ..." className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="objet" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Type d'événement *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
            <div className="grid grid-cols-2 gap-2">
              <FormField control={form.control} name="date_evenement" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Date</FormLabel>
                  <FormControl><Input type="date" className="h-9 text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nombre_invites_rang" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Invités</FormLabel>
                  <FormControl><Input placeholder="80-100" className="h-9 text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="lieu_evenement" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Lieu</FormLabel>
                <FormControl><Input placeholder="Ville ou lieu" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Message *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Décrivez votre projet…" rows={3} className="text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Envoi…" : "Envoyer ma demande"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
