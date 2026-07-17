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
import { Mail, Save, Variable, RotateCcw, Eye } from "lucide-react";
import { logAdmin } from "@/lib/logAdmin";

interface Item {
  templateName: string;
  displayName: string;
  variables: string[];
  defaultSubject: string;
  defaultHtml: string;
  shellHead?: string;
  shellFoot?: string;
  source: "db" | "code";
  dbRow: {
    id: string;
    sujet: string | null;
    corps_html: string | null;
    est_actif: boolean;
  } | null;
}


type Draft = { sujet?: string; corps_html?: string };

export default function Emails() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [previewFor, setPreviewFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-email-textes", {
      body: { action: "list" },
    });
    if (error || !data?.items) {
      toast.error("Erreur lors du chargement");
    } else {
      setItems(data.items);
      setDrafts({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // Seed missing rows on first load (idempotent)
    void supabase.functions.invoke("admin-email-textes", { body: { action: "seed_missing" } })
      .then(({ data }) => {
        if (data?.created?.length) void load();
      });
  }, []);

  const getSujet = (it: Item) =>
    drafts[it.templateName]?.sujet ?? it.dbRow?.sujet ?? it.defaultSubject;
  const getCorps = (it: Item) =>
    drafts[it.templateName]?.corps_html ?? it.dbRow?.corps_html ?? it.defaultHtml;

  const setDraft = (name: string, patch: Draft) =>
    setDrafts((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));

  const hasDraft = (name: string) => {
    const d = drafts[name];
    return !!d && (d.sujet !== undefined || d.corps_html !== undefined);
  };

  const save = async (it: Item) => {
    setSaving(it.templateName);
    const payload = {
      template_name: it.templateName,
      display_name: it.displayName,
      sujet: getSujet(it),
      corps_html: getCorps(it),
      est_actif: it.dbRow?.est_actif ?? true,
      variables_disponibles: it.variables,
    };
    const { error } = await supabase
      .from("email_textes")
      .upsert(payload, { onConflict: "template_name" });
    setSaving(null);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    void logAdmin("email_texte_update", "email_textes", it.templateName, {
      template_name: it.templateName,
    });
    toast.success("Contenu enregistré. Le prochain envoi utilisera ces textes.");
    void load();
  };

  const resetToDefault = async (it: Item) => {
    if (!confirm(`Réinitialiser « ${it.displayName} » au contenu par défaut du code ?`)) return;
    setSaving(it.templateName);
    const { error } = await supabase.functions.invoke("admin-email-textes", {
      body: { action: "reset", templateName: it.templateName },
    });
    setSaving(null);
    if (error) {
      toast.error("Erreur lors de la réinitialisation");
      return;
    }
    void logAdmin("email_texte_reset", "email_textes", it.templateName, {
      template_name: it.templateName,
    });
    toast.success("Contenu réinitialisé au défaut.");
    void load();
  };

  const toggleActif = async (it: Item, est_actif: boolean) => {
    if (!it.dbRow) {
      // Create row first
      await save(it);
    }
    const { error } = await supabase
      .from("email_textes")
      .update({ est_actif })
      .eq("template_name", it.templateName);
    if (error) {
      toast.error("Erreur");
      return;
    }
    toast.success(est_actif ? "Personnalisation active" : "Retour au contenu par défaut du code");
    void load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-2 flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          Emails de notification
        </h1>
        <p className="text-sm text-muted-foreground">
          Personnalisez le sujet et le corps HTML des emails transactionnels. Utilisez les variables
          entre doubles accolades (ex. <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{"{{clientNom}}"}</code>).
          Chaque template dispose d'un contenu par défaut dans le code : si vous désactivez la personnalisation
          ou la réinitialisez, ce contenu prend le relais automatiquement.
        </p>
        <div className="mt-3 p-3 rounded-md border border-primary/20 bg-primary/5 text-sm text-foreground">
          <b>Header et pied de page communs.</b> Tous les emails partagent la même en-tête (logo,
          navigation) et le même pied de page (coordonnées, signature). Vous n'éditez ici que le
          <i> contenu central </i>. L'aperçu ci-dessous affiche l'email complet, coquille comprise.
        </div>

        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!confirm("Charger le design LesNoces sur tous les templates ? Le contenu personnalisé actuel sera écrasé.")) return;
              const { data, error } = await supabase.functions.invoke("admin-email-textes", { body: { action: "seed_designed" } });
              if (error) { toast.error("Erreur : " + error.message); return; }
              toast.success(`Design chargé sur ${data?.updated?.length ?? 0} templates.`);
              void load();
            }}
          >
            Charger le design LesNoces sur tous les templates
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((it) => {
            const isCustom = it.source === "db";
            const showPreview = previewFor === it.templateName;
            return (
              <Card key={it.templateName} className="border-border">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="font-serif text-xl">{it.displayName}</CardTitle>
                        {isCustom ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Personnalisé</Badge>
                        ) : (
                          <Badge variant="secondary">Par défaut (code)</Badge>
                        )}
                      </div>
                      <code className="inline-block mt-1 text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {it.templateName}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Perso. active</Label>
                      <Switch
                        checked={it.dbRow?.est_actif ?? false}
                        onCheckedChange={(v) => toggleActif(it, v)}
                      />
                    </div>
                  </div>

                  {it.variables.length > 0 && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-muted/40 rounded-md">
                      <Variable className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="flex flex-wrap gap-1.5">
                        {it.variables.map((v) => (
                          <code key={v} className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`sujet-${it.templateName}`}>Sujet de l'email</Label>
                    <Input
                      id={`sujet-${it.templateName}`}
                      value={getSujet(it)}
                      onChange={(e) => setDraft(it.templateName, { sujet: e.target.value })}
                      className="mt-1.5 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`corps-${it.templateName}`}>Corps HTML</Label>
                    <Textarea
                      id={`corps-${it.templateName}`}
                      value={getCorps(it)}
                      onChange={(e) => setDraft(it.templateName, { corps_html: e.target.value })}
                      className="mt-1.5 min-h-[240px] font-mono text-xs"
                    />
                  </div>

                  {showPreview && (
                    <div className="border border-border rounded-md overflow-hidden">
                      <div className="bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">Aperçu</div>
                      <iframe
                        title={`preview-${it.templateName}`}
                        srcDoc={/<!doctype|<html/i.test(getCorps(it)) ? getCorps(it) : `${it.shellHead ?? ""}${getCorps(it)}${it.shellFoot ?? ""}`}
                        className="w-full h-[500px] bg-white"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between gap-2 pt-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewFor(showPreview ? null : it.templateName)}
                      >
                        <Eye className="h-4 w-4" />
                        {showPreview ? "Masquer" : "Aperçu"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetToDefault(it)}
                        disabled={saving === it.templateName}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Réinitialiser au défaut
                      </Button>
                    </div>
                    <Button
                      onClick={() => save(it)}
                      disabled={!hasDraft(it.templateName) || saving === it.templateName}
                      size="sm"
                    >
                      <Save className="h-4 w-4" />
                      {saving === it.templateName ? "Sauvegarde…" : "Enregistrer"}
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
