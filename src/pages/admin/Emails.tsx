import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Mail, Save, Variable } from "lucide-react";
import { logAdmin } from "@/lib/logAdmin";

interface EmailTexte {
  id: string;
  template_name: string;
  display_name: string;
  description: string | null;
  sujet: string;
  titre: string | null;
  intro: string | null;
  corps: string | null;
  cta_label: string | null;
  footer: string | null;
  est_actif: boolean;
  variables_disponibles: string[] | null;
}

export default function Emails() {
  const [textes, setTextes] = useState<EmailTexte[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<EmailTexte>>>({});

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_textes")
      .select("*")
      .order("display_name");

    if (error) {
      toast.error("Erreur lors du chargement des emails");
    } else {
      setTextes(data ?? []);
    }
    setLoading(false);
  };

  const updateDraft = (id: string, field: keyof EmailTexte, value: string | boolean) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const getValue = (texte: EmailTexte, field: keyof EmailTexte) => {
    const draft = drafts[texte.id];
    if (draft && field in draft) return draft[field];
    return texte[field];
  };

  const save = async (texte: EmailTexte) => {
    const draft = drafts[texte.id];
    if (!draft || Object.keys(draft).length === 0) return;

    setSavingId(texte.id);
    const { data, error } = await supabase
      .from("email_textes")
      .update(draft)
      .eq("id", texte.id)
      .select()
      .single();

    setSavingId(null);

    if (error || !data) {
      toast.error("Erreur lors de la sauvegarde");
      return;
    }

    setTextes((prev) => prev.map((t) => (t.id === texte.id ? data : t)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[texte.id];
      return next;
    });
    void logAdmin("email_texte_update", "email_textes", texte.id, {
      template_name: texte.template_name,
    });
    toast.success("Email mis à jour");
  };

  const toggleActif = async (texte: EmailTexte, est_actif: boolean) => {
    const { data, error } = await supabase
      .from("email_textes")
      .update({ est_actif })
      .eq("id", texte.id)
      .select()
      .single();

    if (error || !data) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    setTextes((prev) => prev.map((t) => (t.id === texte.id ? data : t)));
    void logAdmin("email_texte_toggle", "email_textes", texte.id, {
      template_name: texte.template_name,
      est_actif,
    });
    toast.success(est_actif ? "Email activé" : "Email désactivé");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-2 flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          Emails de notification
        </h1>
        <p className="text-sm text-muted-foreground">
          Personnalisez les textes des emails automatiques envoyés aux prestataires et aux clients.
          Utilisez les variables comme <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{"{{clientNom}}"}</code> qui seront remplacées à l'envoi.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {textes.map((texte) => {
            const hasDraft = !!drafts[texte.id] && Object.keys(drafts[texte.id]).length > 0;
            return (
              <Card key={texte.id} className="border-border">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="font-serif text-xl">{texte.display_name}</CardTitle>
                        {!texte.est_actif && <Badge variant="secondary">Désactivé</Badge>}
                      </div>
                      {texte.description && (
                        <CardDescription className="text-xs">{texte.description}</CardDescription>
                      )}
                      <code className="inline-block mt-2 text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {texte.template_name}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`actif-${texte.id}`} className="text-xs text-muted-foreground">
                        Actif
                      </Label>
                      <Switch
                        id={`actif-${texte.id}`}
                        checked={texte.est_actif}
                        onCheckedChange={(v) => toggleActif(texte, v)}
                      />
                    </div>
                  </div>

                  {texte.variables_disponibles && texte.variables_disponibles.length > 0 && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-muted/40 rounded-md">
                      <Variable className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="flex flex-wrap gap-1.5">
                        {texte.variables_disponibles.map((v) => (
                          <code
                            key={v}
                            className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border"
                          >
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`sujet-${texte.id}`}>Sujet de l'email *</Label>
                    <Input
                      id={`sujet-${texte.id}`}
                      value={getValue(texte, "sujet") as string}
                      onChange={(e) => updateDraft(texte.id, "sujet", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`titre-${texte.id}`}>Titre principal</Label>
                      <Input
                        id={`titre-${texte.id}`}
                        value={(getValue(texte, "titre") as string) ?? ""}
                        onChange={(e) => updateDraft(texte.id, "titre", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`cta-${texte.id}`}>Texte du bouton</Label>
                      <Input
                        id={`cta-${texte.id}`}
                        value={(getValue(texte, "cta_label") as string) ?? ""}
                        onChange={(e) => updateDraft(texte.id, "cta_label", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`intro-${texte.id}`}>Introduction</Label>
                    <Textarea
                      id={`intro-${texte.id}`}
                      value={(getValue(texte, "intro") as string) ?? ""}
                      onChange={(e) => updateDraft(texte.id, "intro", e.target.value)}
                      className="mt-1.5 min-h-[60px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`corps-${texte.id}`}>Corps du message</Label>
                    <Textarea
                      id={`corps-${texte.id}`}
                      value={(getValue(texte, "corps") as string) ?? ""}
                      onChange={(e) => updateDraft(texte.id, "corps", e.target.value)}
                      className="mt-1.5 min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`footer-${texte.id}`}>Pied de page</Label>
                    <Textarea
                      id={`footer-${texte.id}`}
                      value={(getValue(texte, "footer") as string) ?? ""}
                      onChange={(e) => updateDraft(texte.id, "footer", e.target.value)}
                      className="mt-1.5 min-h-[60px]"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => save(texte)}
                      disabled={!hasDraft || savingId === texte.id}
                      size="sm"
                    >
                      <Save className="h-4 w-4" />
                      {savingId === texte.id ? "Sauvegarde…" : "Enregistrer"}
                    </Button>
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
