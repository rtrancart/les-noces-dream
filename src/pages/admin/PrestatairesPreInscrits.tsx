import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserPlus, Send, Archive, Mail } from "lucide-react";
import { toast } from "sonner";
import { logAdmin } from "@/lib/logAdmin";

interface PreInscrit {
  id: string;
  nom_commercial: string;
  email_contact: string | null;
  statut: string;
  magic_link_envoye_le: string | null;
  magic_link_ouvert: boolean;
  premier_login_le: string | null;
  relances_envoyees: number;
  notes_pre_inscription: string | null;
  created_at: string;
}

export default function PrestatairesPreInscrits() {
  const [items, setItems] = useState<PreInscrit[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [open, setOpen] = useState(false);

  // Invite form
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prestataires")
      .select("id, nom_commercial, email_contact, statut, magic_link_envoye_le, magic_link_ouvert, premier_login_le, relances_envoyees, notes_pre_inscription, created_at")
      .eq("statut", "pre_inscrit")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as PreInscrit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleInvite = async () => {
    if (!nom.trim() || !email.trim()) {
      toast.error("Nom et email requis.");
      return;
    }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-prestataire", {
        body: { nom_commercial: nom, email_contact: email, notes_pre_inscription: notes },
      });
      if (error) throw error;
      await logAdmin("invite_prestataire", "prestataires", undefined, { nom_commercial: nom, email_contact: email });
      toast.success("Invitation envoyée.");
      setOpen(false);
      setNom("");
      setEmail("");
      setNotes("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("resend-magic-link", {
        body: { prestataire_id: id },
      });
      if (error) throw error;
      toast.success("Magic link renvoyé.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors du renvoi.");
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archiver ce prestataire pré-inscrit ?")) return;
    const { error } = await supabase
      .from("prestataires")
      .update({ statut: "archive", motif_suspension: "archive" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Prestataire archivé.");
      load();
    }
  };

  const statusLabel = (s: string) => (s === "pre_inscrit" ? "Pré-inscrit" : s);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Prestataires pré-inscrits</h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Gestion des invitations et du suivi de signature de la Charte Qualité.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" /> Inviter un prestataire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un prestataire</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom commercial</Label>
                <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes internes (optionnel)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucun prestataire pré-inscrit.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom commercial</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Magic link</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Relances</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nom_commercial}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.email_contact ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{statusLabel(p.statut)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.magic_link_envoye_le
                      ? new Date(p.magic_link_envoye_le).toLocaleDateString("fr-FR")
                      : "—"}
                    {p.magic_link_ouvert && (
                      <Badge variant="outline" className="ml-2">ouvert</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.premier_login_le
                      ? new Date(p.premier_login_le).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>
                  <TableCell>{p.relances_envoyees}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleResend(p.id)} title="Renvoyer magic link">
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleArchive(p.id)} title="Archiver">
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
