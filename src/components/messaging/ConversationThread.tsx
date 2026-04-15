import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { trackEvent } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

type ExpediteurType = Database["public"]["Enums"]["expediteur_type"];

interface Message {
  id: string;
  contenu: string;
  expediteur_type: ExpediteurType;
  expediteur_id: string | null;
  created_at: string;
  lu_le: string | null;
}

interface ConversationThreadProps {
  demandeId: string;
  /** "prestataire" when used from provider space, "visiteur" from client space */
  role: ExpediteurType;
  initialMessage?: string;
  onMessageSent?: () => void;
}

export default function ConversationThread({
  demandeId,
  role,
  initialMessage,
  onMessageSent,
}: ConversationThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    if (!demandeId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id, contenu, expediteur_type, expediteur_id, created_at, lu_le")
        .eq("demande_id", demandeId)
        .order("created_at", { ascending: true });

      setMessages(data ?? []);
      setLoading(false);
    };

    fetchMessages();
  }, [demandeId]);

  // Mark unread messages as read
  useEffect(() => {
    if (!user?.id || messages.length === 0) return;

    const unread = messages.filter(
      (m) => !m.lu_le && m.expediteur_type !== role && m.expediteur_id !== user.id
    );

    if (unread.length > 0) {
      const ids = unread.map((m) => m.id);
      supabase
        .from("messages")
        .update({ lu_le: new Date().toISOString() })
        .in("id", ids)
        .then();
    }
  }, [messages, user?.id, role]);

  // Realtime subscription
  useEffect(() => {
    if (!demandeId) return;

    const channel = supabase
      .channel(`messages-${demandeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `demande_id=eq.${demandeId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demandeId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id || sending) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      demande_id: demandeId,
      expediteur_type: role,
      expediteur_id: user.id,
      contenu: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
      trackEvent("envoi_message", { role });
      // Update demande status to en_discussion if needed
      await supabase
        .from("demandes_devis")
        .update({ statut: "en_discussion" })
        .eq("id", demandeId)
        .in("statut", ["nouveau", "lu"]);

      onMessageSent?.();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {/* Initial demande message */}
        {initialMessage && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted text-foreground">
              <p className="text-xs font-medium text-muted-foreground mb-1">Demande initiale</p>
              <p className="text-sm whitespace-pre-wrap">{initialMessage}</p>
            </div>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Aucun message pour le moment. Envoyez le premier !
          </p>
        )}

        {messages.map((msg) => {
          const isMine = msg.expediteur_type === role;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  isMine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.contenu}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                  }`}
                >
                  {format(new Date(msg.created_at), "d MMM HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message…"
          className="resize-none min-h-[40px] max-h-[120px] text-sm"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
