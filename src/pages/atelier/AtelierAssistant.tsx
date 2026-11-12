import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Send, Plus, MessagesSquare, Pencil, Trash2, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTracking } from "@/hooks/useTracking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TexteLeger from "@/components/atelier/TexteLeger";
import CarteReco from "@/components/atelier/CarteReco";
import RetourReponse from "@/components/atelier/RetourReponse";
import {
  envoyerMessage, lireMessagesRestants, ErreurAtelier, SUGGESTIONS, ETAPES_ATTENTE,
  type ConversationAtelier, type MessageAtelier,
} from "@/lib/atelier";
import { cn } from "@/lib/utils";

function ListeConversations({ conversations, active, onChoisir, onNouvelle }: {
  conversations: ConversationAtelier[]; active: string | null;
  onChoisir: (id: string) => void; onNouvelle: () => void;
}) {
  const qc = useQueryClient();
  const [edition, setEdition] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [aSupprimer, setASupprimer] = useState<ConversationAtelier | null>(null);

  const renommer = async (id: string) => {
    const t = titre.trim().slice(0, 120);
    if (!t) return setEdition(null);
    const { error } = await supabase.from("conversations_atelier").update({ titre: t }).eq("id", id).select("id");
    if (error) toast.error("Le nom n'a pas pu être modifié.");
    setEdition(null);
    qc.invalidateQueries({ queryKey: ["atelier-conversations"] });
  };
  const supprimer = async () => {
    if (!aSupprimer) return;
    const { error } = await supabase.from("conversations_atelier").delete().eq("id", aSupprimer.id).select("id");
    if (error) toast.error("La conversation n'a pas pu être supprimée.");
    else { toast.success("Conversation supprimée."); if (active === aSupprimer.id) onNouvelle(); }
    setASupprimer(null);
    qc.invalidateQueries({ queryKey: ["atelier-conversations"] });
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <Button onClick={onNouvelle} className="rounded-full bg-atelier-or hover:bg-atelier-or/90 gap-2"><Plus className="h-4 w-4" />Nouvelle conversation</Button>
      <div className="space-y-1 overflow-y-auto min-h-0">
        {conversations.length === 0 && <p className="font-sans text-sm text-muted-foreground px-2 py-3">Aucune conversation pour l'instant.</p>}
        {conversations.map((c) => (
          <div key={c.id} className={cn("group rounded-lg px-3 py-2.5 flex items-center gap-2", active === c.id ? "bg-card border border-atelier-filet" : "hover:bg-card/60")}>
            {edition === c.id ? (
              <>
                <Input autoFocus value={titre} onChange={(e) => setTitre(e.target.value)} className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") renommer(c.id); if (e.key === "Escape") setEdition(null); }} />
                <button aria-label="Valider" onClick={() => renommer(c.id)} className="text-atelier-or"><Check className="h-4 w-4" /></button>
                <button aria-label="Annuler" onClick={() => setEdition(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <button onClick={() => onChoisir(c.id)} className="flex-1 min-w-0 text-left">
                  <span className="block truncate font-sans text-sm text-foreground">{c.titre || "Conversation"}</span>
                  <span className="block font-sans text-[11px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                </button>
                <button aria-label="Renommer" onClick={() => { setEdition(c.id); setTitre(c.titre ?? ""); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button aria-label="Supprimer" onClick={() => setASupprimer(c)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <AlertDialog open={!!aSupprimer} onOpenChange={(o) => !o && setASupprimer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>« {aSupprimer?.titre} » et tous ses messages seront supprimés définitivement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={supprimer} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Attente() {
  const [etape, setEtape] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setEtape(1), 2500);
    const t2 = setTimeout(() => setEtape(2), 9000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="rounded-2xl border border-atelier-filet bg-card p-4 max-w-md" role="status" aria-live="polite">
      <p className="font-serif italic text-lg text-foreground flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-atelier-or animate-pulse" />{ETAPES_ATTENTE[etape]}
      </p>
      <ul className="mt-3 space-y-1.5">
        {ETAPES_ATTENTE.map((e, i) => (
          <li key={e} className={cn("flex items-center gap-2 font-sans text-sm", i < etape ? "text-muted-foreground" : i === etape ? "text-foreground font-medium" : "text-muted-foreground/60")}>
            <span className={cn("h-4 w-4 rounded-full border grid place-items-center", i < etape ? "border-atelier-or bg-atelier-or/10" : i === etape ? "border-atelier-or" : "border-border")}>
              {i < etape && <Check className="h-3 w-3 text-atelier-or" />}
            </span>{e.replace("…", "")}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AtelierAssistant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { trackAtelierMessage } = useTracking();
  const [convId, setConvId] = useState<string | null>(null);
  const [locaux, setLocaux] = useState<MessageAtelier[]>([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [restants, setRestants] = useState<number | null>(null);
  const [liste, setListe] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["atelier-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("conversations_atelier").select("id, titre, updated_at").order("updated_at", { ascending: false }).limit(50);
      return (data ?? []) as ConversationAtelier[];
    },
  });
  const { data: historique = [], isFetching } = useQuery({
    queryKey: ["atelier-messages", convId],
    enabled: !!convId,
    queryFn: async () => {
      const { data } = await supabase.from("messages_atelier").select("id, role, contenu, recommandations, created_at")
        .eq("conversation_id", convId!).order("created_at", { ascending: true }).limit(200);
      return (data ?? []) as unknown as MessageAtelier[];
    },
  });
  const { data: retours = {} } = useQuery({
    queryKey: ["atelier-retours", convId, historique.length],
    enabled: !!convId && historique.length > 0,
    queryFn: async () => {
      const ids = historique.filter((m) => m.role === "assistant").map((m) => m.id);
      const { data } = await supabase.from("retours_atelier").select("message_id, note").in("message_id", ids);
      return Object.fromEntries((data ?? []).map((r) => [r.message_id, r.note])) as Record<string, "utile" | "pas_utile">;
    },
  });

  useEffect(() => { lireMessagesRestants().then(setRestants).catch(() => setRestants(null)); }, []);

  const messages = useMemo(() => [...(convId ? historique : []), ...locaux], [convId, historique, locaux]);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, envoi]);

  const nouvelle = () => { setConvId(null); setLocaux([]); setErreur(null); setListe(false); };
  const choisir = (id: string) => { setConvId(id); setLocaux([]); setErreur(null); setListe(false); };

  const envoyer = async (contenu: string) => {
    const m = contenu.trim();
    if (!m || envoi) return;
    setErreur(null); setTexte(""); setEnvoi(true);
    setLocaux((l) => [...l, { id: `local-${Date.now()}`, role: "user", contenu: m, recommandations: null, created_at: new Date().toISOString() }]);
    trackAtelierMessage();
    try {
      const r = await envoyerMessage(m, convId ?? undefined);
      if (r.messages_restants !== null && r.messages_restants !== undefined) setRestants(r.messages_restants);
      await qc.invalidateQueries({ queryKey: ["atelier-messages", r.conversation_id] });
      if (r.conversation_id !== convId) setConvId(r.conversation_id);
      await qc.refetchQueries({ queryKey: ["atelier-messages", r.conversation_id] });
      setLocaux([]);
      qc.invalidateQueries({ queryKey: ["atelier-conversations"] });
    } catch (e) {
      setErreur(e instanceof ErreurAtelier ? e.message : "L'assistant n'a pas pu répondre. Réessayez dans un instant.");
      setLocaux([]); setTexte(m);
      if (e instanceof ErreurAtelier && e.code === "quota_atteint") setRestants(0);
    } finally {
      setEnvoi(false);
    }
  };

  const vide = messages.length === 0 && !envoi && !(convId && isFetching);

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.25rem)] lg:h-[calc(100vh-5rem)]">
      <aside className="hidden xl:flex w-72 shrink-0 flex-col border-r border-atelier-filet p-4 min-h-0">
        <ListeConversations conversations={conversations} active={convId} onChoisir={choisir} onNouvelle={nouvelle} />
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 border-b border-atelier-filet bg-atelier-lin/70 px-4 py-2.5 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-atelier-or shrink-0" />
          <p className="font-sans text-xs leading-relaxed text-foreground/80 flex-1">
            Vous échangez avec un assistant IA. Ses suggestions sont indicatives : seul le devis du prestataire fait foi.
          </p>
          <button onClick={() => setListe(true)} className="xl:hidden shrink-0 inline-flex items-center gap-1 font-sans text-xs font-semibold text-atelier-or" aria-label="Mes conversations">
            <MessagesSquare className="h-4 w-4" /><span className="hidden sm:inline">Conversations</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {vide && (
              <div className="pt-4 lg:pt-10 space-y-5">
                <span className="h-11 w-11 rounded-full bg-atelier-lin text-atelier-or grid place-items-center"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <h1 className="font-serif text-3xl text-foreground">Que cherchez-vous pour votre mariage ?</h1>
                  <p className="font-sans text-sm text-muted-foreground mt-2">Décrivez votre projet avec vos mots : lieu, style, nombre d'invités, budget…</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label} onClick={() => s.message.endsWith(":") ? setTexte(s.message + " ") : envoyer(s.message)}
                      className="rounded-xl border border-atelier-filet bg-card px-4 py-3 text-left font-sans text-sm font-medium text-foreground hover:border-atelier-or transition-colors">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-atelier-or px-4 py-2.5 font-sans text-sm text-primary-foreground whitespace-pre-wrap">{m.contenu}</div>
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                <div className="rounded-2xl rounded-bl-sm border border-atelier-filet bg-card px-4 py-3 font-sans text-sm leading-relaxed text-foreground max-w-[95%]">
                  <TexteLeger texte={m.contenu} />
                </div>
                {!!m.recommandations?.length && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {m.recommandations.map((r) => <CarteReco key={r.prestataire_id} reco={r} cleAffichage={m.id} />)}
                  </div>
                )}
                {!m.id.startsWith("local-") && <RetourReponse key={`${m.id}-${retours[m.id] ?? ""}`} messageId={m.id} initial={retours[m.id]} />}
              </div>
            ))}

            {envoi && <Attente />}
            {erreur && <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 font-sans text-sm text-foreground">{erreur}</div>}
            <div ref={fin} />
          </div>
        </div>

        <div className="shrink-0 border-t border-atelier-filet bg-atelier-fond px-4 py-3 lg:px-8">
          <form className="max-w-3xl mx-auto flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); envoyer(texte); }}>
            <Textarea value={texte} onChange={(e) => setTexte(e.target.value.slice(0, 4000))} rows={1} disabled={envoi || restants === 0}
              placeholder={restants === 0 ? "Plus de messages aujourd'hui" : "Écrivez votre message…"}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(texte); } }}
              className="min-h-[44px] max-h-36 resize-none rounded-2xl bg-card text-sm" />
            <Button type="submit" size="icon" disabled={envoi || !texte.trim() || restants === 0} aria-label="Envoyer"
              className="h-11 w-11 shrink-0 rounded-full bg-atelier-or hover:bg-atelier-or/90"><Send className="h-4 w-4" /></Button>
          </form>
          {restants !== null && (
            <p className="max-w-3xl mx-auto mt-1.5 font-sans text-[11px] text-muted-foreground">
              {restants} message{restants > 1 ? "s" : ""} restant{restants > 1 ? "s" : ""} aujourd'hui
            </p>
          )}
        </div>
      </section>

      <Sheet open={liste} onOpenChange={setListe}>
        <SheetContent side="left" className="w-80 p-4 bg-atelier-fond flex flex-col">
          <SheetHeader><SheetTitle className="font-serif text-xl text-left">Mes conversations</SheetTitle></SheetHeader>
          <ListeConversations conversations={conversations} active={convId} onChoisir={choisir} onNouvelle={nouvelle} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
