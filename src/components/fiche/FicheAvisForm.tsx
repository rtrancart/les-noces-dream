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
  commentaire: z.string().min(20, "Minimum 20 caractères"),
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
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const isMobile = useIsMobile();
  const [step, setStep] = useState<"email" | "form">("email");
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [demandeId, setDemandeId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [emailError, setEmailError] = useState("");
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
    setStep(isSuperAdmin ? "form" : "email");
    setEmail("");
    setContactId(null);
    setDemandeId(null);
    setEmailError("");
    form.reset();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  const checkEmail = async () => {
    if (!user) {
      toast.error("Vous devez être connecté pour laisser un avis.");
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Veuillez saisir un email valide");
      return;
    }

    setChecking(true);
    setEmailError("");

    try {
      // Use the SECURITY DEFINER function
      const { data: canReview, error: fnError } = await supabase.rpc(
        "can_review_prestataire",
        { p_prestataire_id: prestataireId }
      );

      if (fnError) throw fnError;

      if (!canReview) {
        setEmailError(
          "Vous devez avoir contacté ce prestataire via une demande de devis pour pouvoir laisser un avis."
        );
        return;
      }

      // Find contact_id and demande_id for linking
      const { data: demandes } = await supabase
        .from("demandes_devis")
        .select("id, contact_id")
        .eq("prestataire_id", prestataireId)
        .eq("email_contact", trimmed)
        .limit(1);

      if (demandes && demandes.length > 0) {
        setContactId(demandes[0].contact_id);
        setDemandeId(demandes[0].id);
      }

      setStep("form");
    } catch {
      toast.error("Erreur lors de la vérification.");
    } finally {
      setChecking(false);
    }
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
        contact_id: contactId,
        demande_id: demandeId,
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
      {step === "email" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pour déposer un avis, nous vérifions que vous avez bien contacté ce prestataire
            via une demande de devis.
          </p>
          <div className="space-y-2">
            <Label htmlFor="avis-email">Votre adresse email</Label>
            <Input
              id="avis-email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && checkEmail()}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>
          <Button onClick={checkEmail} disabled={checking} className="w-full">
            {checking ? "Vérification…" : "Continuer"}
          </Button>
        </div>
      ) : (
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
                      placeholder="Décrivez votre expérience (min. 20 caractères)…"
                      rows={4}
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
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Laisser un avis</SheetTitle>
            <SheetDescription>
              {step === "email"
                ? "Vérification de votre éligibilité"
                : "Notez votre expérience"}
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
