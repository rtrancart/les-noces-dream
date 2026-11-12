import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function RetourReponse({ messageId, initial }: { messageId: string; initial?: "utile" | "pas_utile" }) {
  const [note, setNote] = useState<"utile" | "pas_utile" | undefined>(initial);
  const [ouvert, setOuvert] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (n: "utile" | "pas_utile", c?: string) => {
    setEnvoi(true);
    await supabase.from("retours_atelier").delete().eq("message_id", messageId);
    const { error } = await supabase.from("retours_atelier").insert({ message_id: messageId, note: n, commentaire: c?.trim() || null }).select("id");
    setEnvoi(false);
    if (error) { toast.error("Votre avis n'a pas pu être enregistré."); return; }
    setNote(n); setOuvert(false);
    toast.success(n === "utile" ? "Merci pour votre avis !" : "Merci, votre signalement aide l'équipe à améliorer l'assistant.");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Réponse utile" disabled={envoi} onClick={() => enregistrer("utile")}
          className={cn("p-1.5 rounded-full hover:bg-atelier-lin", note === "utile" ? "text-atelier-or" : "text-muted-foreground")}>
          <ThumbsUp className="h-4 w-4" fill={note === "utile" ? "currentColor" : "none"} />
        </button>
        <button type="button" aria-label="Réponse pas utile" disabled={envoi} onClick={() => setOuvert((o) => !o)}
          className={cn("p-1.5 rounded-full hover:bg-atelier-lin", note === "pas_utile" ? "text-atelier-or" : "text-muted-foreground")}>
          <ThumbsDown className="h-4 w-4" fill={note === "pas_utile" ? "currentColor" : "none"} />
        </button>
      </div>
      {ouvert && (
        <div className="rounded-xl border border-atelier-filet bg-card p-3 space-y-2 max-w-md">
          <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value.slice(0, 2000))} rows={2}
            placeholder="Qu'est-ce qui n'allait pas ? (facultatif)" className="text-sm" />
          <p className="font-sans text-xs text-muted-foreground">En signalant cette réponse, vous la partagez avec l'équipe LesNoces pour l'améliorer.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button size="sm" disabled={envoi} className="bg-atelier-or hover:bg-atelier-or/90 rounded-full" onClick={() => enregistrer("pas_utile", commentaire)}>Signaler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
