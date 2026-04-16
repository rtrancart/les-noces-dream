import { useState, useMemo } from "react";
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Send } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const countryCodes = [
  { code: "+33", label: "🇫🇷 +33", country: "FR" },
  { code: "+32", label: "🇧🇪 +32", country: "BE" },
  { code: "+41", label: "🇨🇭 +41", country: "CH" },
  { code: "+352", label: "🇱🇺 +352", country: "LU" },
  { code: "+377", label: "🇲🇨 +377", country: "MC" },
  { code: "+44", label: "🇬🇧 +44", country: "GB" },
  { code: "+49", label: "🇩🇪 +49", country: "DE" },
  { code: "+34", label: "🇪🇸 +34", country: "ES" },
  { code: "+39", label: "🇮🇹 +39", country: "IT" },
  { code: "+351", label: "🇵🇹 +351", country: "PT" },
];

const phoneRegex = /^[0-9\s]{6,15}$/;

const devisSchema = z.object({
  nom: z.string().min(2, "Minimum 2 caractères").max(100),
  email: z.string().email("Email invalide").max(255),
  indicatif: z.string().default("+33"),
  telephone: z
    .string()
    .optional()
    .refine(
      (val) => !val || phoneRegex.test(val.replace(/\s/g, "")),
      "Numéro invalide (6 à 15 chiffres)"
    ),
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

const moisOptions = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface Props {
  prestataireId: string;
  prestataireName: string;
}

export default function FicheDevisSidebar({ prestataireId, prestataireName }: Props) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dateMode, setDateMode] = useState<"precise" | "mois">("precise");

  const currentYear = new Date().getFullYear();
  const annees = useMemo(() => [currentYear, currentYear + 1, currentYear + 2], [currentYear]);

  const form = useForm<DevisFormValues>({
    resolver: zodResolver(devisSchema),
    defaultValues: {
      nom: profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() : "",
      email: profile?.email ?? "",
      indicatif: "+33",
      telephone: profile?.telephone ?? "",
      objet: "mariage",
      message: "",
    },
  });

  const handleFocus = () => {
    if (!expanded) setExpanded(true);
  };

  const onSubmit = async (values: DevisFormValues) => {
    setSubmitting(true);
    try {
      // Build full phone number with country code
      const fullPhone = values.telephone
        ? `${values.indicatif} ${values.telephone.trim()}`
        : null;

      const { error } = await supabase.rpc("soumettre_demande_devis", {
        p_prestataire_id: prestataireId,
        p_nom: values.nom,
        p_email: values.email.toLowerCase().trim(),
        p_telephone: fullPhone,
        p_objet: values.objet,
        p_message: values.message,
        p_date_evenement: values.date_evenement || null,
        p_lieu_evenement: values.lieu_evenement || null,
        p_nombre_invites_rang: values.nombre_invites_rang || null,
      });

      if (error) throw error;

      toast.success("Votre demande de devis a été envoyée !");
      trackEvent("premier_contact", { objet: values.objet }, prestataireId);
      setSent(true);
      form.reset();
    } catch (e) {
      console.error("Devis submit error:", e);
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
            {/* Always visible fields */}
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Nom *</FormLabel>
                <FormControl>
                  <Input placeholder="Votre nom" className="h-9 text-sm" {...field} onFocus={(e) => { handleFocus(); field.onBlur && e; }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="votre@email.com" className="h-9 text-sm" {...field} onFocus={handleFocus} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Message *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Décrivez votre projet…" rows={3} className="text-sm" {...field} onFocus={handleFocus} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Collapsible secondary fields */}
            <Collapsible open={expanded}>
              <CollapsibleContent className="space-y-3">
                {/* Phone with country code */}
                <FormField control={form.control} name="telephone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Téléphone</FormLabel>
                    <div className="flex gap-1.5">
                      <FormField control={form.control} name="indicatif" render={({ field: indField }) => (
                        <Select onValueChange={indField.onChange} value={indField.value}>
                          <SelectTrigger className="h-9 text-sm w-[100px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {countryCodes.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )} />
                      <FormControl>
                        <Input
                          placeholder="6 12 34 56 78"
                          className="h-9 text-sm"
                          inputMode="tel"
                          {...field}
                        />
                      </FormControl>
                    </div>
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
                    <FormItem className="col-span-2">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs">Date</FormLabel>
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            setDateMode(prev => prev === "precise" ? "mois" : "precise");
                            field.onChange("");
                          }}
                        >
                          {dateMode === "precise" ? "Je connais juste le mois" : "Date précise"}
                        </button>
                      </div>
                      <FormControl>
                        {dateMode === "precise" ? (
                          <Input type="date" className="h-9 text-sm" {...field} />
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            <Select
                              onValueChange={(m) => {
                                const annee = field.value?.split(" ")[1] || String(currentYear);
                                field.onChange(`${m} ${annee}`);
                              }}
                              value={field.value?.split(" ")[0] || ""}
                            >
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mois" /></SelectTrigger>
                              <SelectContent>
                                {moisOptions.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              onValueChange={(a) => {
                                const mois = field.value?.split(" ")[0] || "";
                                field.onChange(`${mois} ${a}`);
                              }}
                              value={field.value?.split(" ")[1] || ""}
                            >
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Année" /></SelectTrigger>
                              <SelectContent>
                                {annees.map((a) => (
                                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormControl>
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
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Envoi…" : "Envoyer ma demande"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
