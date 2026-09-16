import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Info, Send, X } from "lucide-react";
import { logAdmin } from "@/lib/logAdmin";
import type { EmailTemplateItem } from "@/pages/admin/Emails";

const DESTINATAIRE_LABEL: Record<string, string> = {
  client: "Client",
  prestataire: "Prestataire",
  equipe: "Équipe interne",
};

type Field = "sujet" | "sous_objet" | "corps_html";

interface Props {
  item: EmailTemplateItem;
  onClose: () => void;
  onSaved: () => void;
}

function buildPreviewDoc(item: EmailTemplateItem, corps: string) {
  const data = item.previewData ?? {};
  const substitute = (tpl: string) =>
    tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k: string) => {
      const v = (data as Record<string, unknown>)[k];
      return v === undefined || v === null || v === "" ? `{{${k}}}` : String(v);
    });

  const isFullDoc = /<!doctype|<html/i.test(corps);
  let inner = corps;
  if (isFullDoc) {
    const m = corps.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    inner = (m ? m[1] : corps)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .trim();
  }
  return substitute(`${item.shellHead ?? ""}${inner}${item.shellFoot ?? ""}`);
}

export default function EmailTemplateDrawer({ item, onClose, onSaved }: Props) {
  const row = item.dbRow;
  const initial = useMemo(
    () => ({
      sujet: row?.sujet ?? item.defaultSubject ?? "",
      sous_objet: row?.sous_objet ?? "",
      corps_html: row?.corps_html ?? item.defaultHtml ?? "",
      destinataire: row?.destinataire ?? "prestataire",
    }),
    [row, item],
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [togglingActif, setTogglingActif] = useState(false);
  const [estActif, setEstActif] = useState(row?.est_actif ?? true);
  const [tab, setTab] = useState("textes");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const lastField = useRef<Field>("sujet");
  const refs = {
    sujet: useRef<HTMLInputElement>(null),
    sous_objet: useRef<HTMLInputElement>(null),
    corps_html: useRef<HTMLTextAreaElement>(null),
  };

  useEffect(() => {
    setForm(initial);
    setEstActif(row?.est_actif ?? true);
  }, [initial, row]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty =
    form.sujet !== initial.sujet ||
    form.sous_objet !== initial.sous_objet ||
    form.corps_html !== initial.corps_html ||
    form.destinataire !== initial.destinataire;

  const insertVariable = (name: string) => {
    const field = lastField.current;
    const token = `{{${name}}}`;
    const el = refs[field].current as HTMLInputElement | HTMLTextAreaElement | null;
    const current = form[field];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setForm((f) => ({ ...f, [field]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + token.length;
      el?.setSelectionRange?.(pos, pos);
    });
  };

  const save = async () => {
    if (!form.sujet.trim()) {
      toast.error("L'objet de l'email est obligatoire.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("email_textes")
      .upsert(
        {
          template_name: item.templateName,
          display_name: item.displayName,
          sujet: form.sujet,
          sous_objet: form.sous_objet.trim() ? form.sous_objet : null,
          corps_html: form.corps_html,
          destinataire: form.destinataire,
          est_actif: estActif,
          variables_disponibles: item.variables,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "template_name" },
      )
      .select();
    setSaving(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    void logAdmin("email_texte_update", "email_textes", item.templateName, {
      template_name: item.templateName,
    });
    toast.success("Contenu enregistré. Le prochain envoi utilisera ces textes.");
    onSaved();
  };

  const toggleActif = async (v: boolean) => {
    setTogglingActif(true);
    const { error } = await supabase
      .from("email_textes")
      .update({ est_actif: v })
      .eq("template_name", item.templateName)
      .select();
    setTogglingActif(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setEstActif(v);
    toast.success(v ? "Email activé." : "Email désactivé — il ne sera plus envoyé.");
    onSaved();
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Renseignez une adresse email de test.");
      return;
    }
    setSendingTest(true);
    const { data, error } = await supabase.functions.invoke("admin-email-textes", {
      body: { action: "send_test", templateName: item.templateName, to: testEmail.trim() },
    });
    setSendingTest(false);
    if (error || data?.error) {
      toast.error("Envoi impossible : " + (data?.error ?? error?.message ?? "erreur inconnue"));
      return;
    }
    toast.success(`Email de test envoyé à ${testEmail.trim()}.`);
  };

  const previewDoc = buildPreviewDoc(item, form.corps_html);
  const previewSubject = form.sujet.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k: string) => {
    const v = (item.previewData as Record<string, unknown> | undefined)?.[k];
    return v === undefined || v === null || v === "" ? `{{${k}}}` : String(v);
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
      />
      <aside className="relative ml-auto flex h-full w-full flex-col bg-card shadow-elevated sm:max-w-2xl">
        {/* En-tête */}
        <header className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl leading-tight text-foreground sm:text-2xl">
              {item.displayName}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {item.templateName} · destinataire : {DESTINATAIRE_LABEL[form.destinataire] ?? form.destinataire}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label className="hidden text-xs text-muted-foreground sm:block">Actif</Label>
            <Switch checked={estActif} disabled={togglingActif} onCheckedChange={toggleActif} />
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le panneau">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-4 w-fit sm:mx-6">
            <TabsTrigger value="textes">Textes</TabsTrigger>
            <TabsTrigger value="apercu">Aperçu</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {/* Textes */}
            <TabsContent value="textes" className="mt-0 space-y-6">
              {item.dbRow?.description && (
                <div className="flex gap-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-foreground">
                    <b>Déclencheur :</b> {item.dbRow.description}
                  </p>
                </div>
              )}

              {item.variables.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-foreground">
                    Variables disponibles{" "}
                    <span className="text-muted-foreground">
                      — cliquez pour insérer dans le dernier champ actif
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-muted/20 p-3">
                    {item.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="sujet">
                    Objet de l'email <span className="text-muted-foreground">· obligatoire</span>
                  </Label>
                  <Input
                    id="sujet"
                    ref={refs.sujet}
                    value={form.sujet}
                    onFocus={() => (lastField.current = "sujet")}
                    onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="sous_objet">Sous-objet</Label>
                  <Input
                    id="sous_objet"
                    ref={refs.sous_objet}
                    value={form.sous_objet}
                    onFocus={() => (lastField.current = "sous_objet")}
                    onChange={(e) => setForm((f) => ({ ...f, sous_objet: e.target.value }))}
                    className="mt-1.5"
                    placeholder="Texte d'aperçu affiché après l'objet dans la boîte de réception"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Facultatif. Envoyé masqué en tête de l'email : visible uniquement dans la liste
                    des messages, à côté de l'objet.
                  </p>
                </div>

                <div>
                  <Label htmlFor="destinataire">Destinataire</Label>
                  <Select
                    value={form.destinataire}
                    onValueChange={(v) => setForm((f) => ({ ...f, destinataire: v }))}
                  >
                    <SelectTrigger id="destinataire" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="prestataire">Prestataire</SelectItem>
                      <SelectItem value="equipe">Équipe interne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="corps_html">Corps de l'email (HTML)</Label>
                  <Textarea
                    id="corps_html"
                    ref={refs.corps_html}
                    value={form.corps_html}
                    onFocus={() => (lastField.current = "corps_html")}
                    onChange={(e) => setForm((f) => ({ ...f, corps_html: e.target.value }))}
                    className="mt-1.5 min-h-[280px] font-mono text-xs"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    L'en-tête, le logo, la signature et le pied de page LesNoces sont ajoutés
                    automatiquement autour de ce contenu.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Aperçu */}
            <TabsContent value="apercu" className="mt-0 space-y-3">
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="uppercase tracking-wide text-[11px]">À</span> ·{" "}
                  {String(
                    (item.previewData as Record<string, unknown> | undefined)?.email ??
                      "destinataire@exemple.fr",
                  )}
                </p>
                <p className="mt-1 text-foreground">
                  <span className="uppercase tracking-wide text-[11px] text-muted-foreground">
                    Objet
                  </span>{" "}
                  · {previewSubject}
                </p>
                {form.sous_objet && (
                  <p className="mt-1 text-xs text-muted-foreground">{form.sous_objet}</p>
                )}
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <iframe
                  title="Aperçu de l'email"
                  srcDoc={previewDoc}
                  className="h-[560px] w-full bg-white"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Aperçu rendu avec les données d'exemple du modèle.
              </p>
            </TabsContent>

            {/* Variables */}
            <TabsContent value="variables" className="mt-0">
              {item.variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ce modèle ne reçoit aucune variable.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {item.variables.map((v) => {
                    const example = (item.previewData as Record<string, unknown> | undefined)?.[v];
                    return (
                      <div key={v} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:gap-4">
                        <code className="font-mono text-xs text-primary sm:w-56 sm:shrink-0">
                          {`{{${v}}}`}
                        </code>
                        <span className="text-sm text-muted-foreground">
                          {example === undefined || example === null || example === ""
                            ? "aucune valeur d'exemple"
                            : String(example)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Ces variables sont remplacées à l'envoi par les données réelles.
              </p>
            </TabsContent>
          </div>
        </Tabs>

        {/* Pied */}
        <footer className="space-y-3 border-t border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTab("apercu")}>
              <Eye className="h-4 w-4" />
              Aperçu
            </Button>
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="adresse de test"
              className="h-9 w-full sm:w-56"
              type="email"
            />
            <Button variant="outline" size="sm" onClick={sendTest} disabled={sendingTest}>
              <Send className="h-4 w-4" />
              {sendingTest ? "Envoi…" : "Envoyer un test"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {dirty ? "Modifié — non enregistré" : "Aucune modification"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!dirty || saving}
                onClick={() => setForm(initial)}
              >
                Annuler
              </Button>
              <Button size="sm" disabled={!dirty || saving} onClick={save}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}
