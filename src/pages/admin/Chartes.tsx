import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, FilePlus, Download, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { logAdmin } from "@/lib/logAdmin";

interface ChartVersion {
  id: string;
  numero_version: string;
  titre: string;
  contenu_html: string;
  contenu_hash: string;
  entree_en_vigueur_le: string;
  archivee_le: string | null;
  created_at: string;
}

interface Signature {
  id: string;
  prestataire_id: string;
  charte_numero_version: string;
  signe_le: string;
  ip_signataire: string | null;
  methode_auth: string;
  prestataires?: { nom_commercial: string } | null;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminChartes() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const [versions, setVersions] = useState<ChartVersion[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  const [numero, setNumero] = useState("");
  const [titre, setTitre] = useState("Charte Qualité — LesNoces.net");
  const [contenu, setContenu] = useState("");
  const [contenuHash, setContenuHash] = useState("");
  const [creating, setCreating] = useState(false);

  // Live SHA-256 (affichage temps réel uniquement — la valeur probatoire est recalculée
  // côté serveur par le trigger `chartes_versions_enforce_hash` qui écrase toute valeur
  // fournie par le client à l'INSERT/UPDATE de chartes_versions).
  useEffect(() => {
    let cancelled = false;
    if (!contenu) {
      setContenuHash("");
      return;
    }
    sha256(contenu).then((h) => {
      if (!cancelled) setContenuHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [contenu]);

  const load = async () => {
    setLoading(true);
    const [vRes, sRes] = await Promise.all([
      supabase
        .from("chartes_versions")
        .select("*")
        .order("entree_en_vigueur_le", { ascending: false }),
      supabase
        .from("signatures_charte")
        .select("id, prestataire_id, charte_numero_version, signe_le, ip_signataire, methode_auth, prestataires(nom_commercial)")
        .order("signe_le", { ascending: false })
        .limit(500),
    ]);
    if (vRes.error) toast.error(vRes.error.message);
    if (sRes.error) toast.error(sRes.error.message);
    setVersions((vRes.data ?? []) as ChartVersion[]);
    setSignatures((sRes.data ?? []) as unknown as Signature[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateVersion = async () => {
    if (!numero.trim() || !contenu.trim()) {
      toast.error("Numéro et contenu requis.");
      return;
    }
    setCreating(true);
    try {
      const hash = await sha256(contenu);
      const now = new Date().toISOString();

      // 1. Archive current active version
      const current = versions.find((v) => !v.archivee_le);
      if (current) {
        const { error: arErr } = await supabase
          .from("chartes_versions")
          .update({ archivee_le: now })
          .eq("id", current.id);
        if (arErr) throw arErr;
      }

      // 2. Insert new active version
      const { data: inserted, error: insErr } = await supabase
        .from("chartes_versions")
        .insert({
          numero_version: numero.trim(),
          titre: titre.trim(),
          contenu_html: contenu,
          contenu_hash: hash,
          entree_en_vigueur_le: now,
        })
        .select("id")
        .maybeSingle();
      if (insErr) throw insErr;

      await logAdmin("publish_charte_version", "chartes_versions", inserted?.id, {
        numero_version: numero.trim(),
        archived_previous: current?.numero_version ?? null,
        client_hash_preview: hash.slice(0, 16),
      });

      toast.success("Nouvelle version publiée.");
      setOpenNew(false);
      setNumero("");
      setContenu("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  const handleNotifyAll = async () => {
    if (!confirm("Notifier tous les prestataires actifs de la nouvelle version ?")) return;
    try {
      const { error } = await supabase.functions.invoke("notify-charte-version-update", { body: {} });
      if (error) throw error;
      await logAdmin("notify_charte_version_update", "chartes_versions");
      toast.success("Notifications envoyées.");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'envoi.");
    }
  };

  const handleDownloadPdf = async (sig: Signature) => {
    try {
      // Génération à la demande : la fonction renvoie un flux PDF direct,
      // sans stockage bucket et sans URL persistante.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/generate-charte-pdf-preuve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ signature_id: sig.id }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Erreur de génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `preuve-${sig.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message ?? "PDF preuve indisponible.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Gestion de la Charte Qualité</h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Versions, signatures et exports de preuves.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNotifyAll}>
              <BellRing className="h-4 w-4 mr-2" /> Notifier les prestataires
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button>
                  <FilePlus className="h-4 w-4 mr-2" /> Nouvelle version
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl">
                <DialogHeader>
                  <DialogTitle>Publier une nouvelle version</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Numéro de version</Label>
                      <Input id="numero" placeholder="ex. 2.0" value={numero} onChange={(e) => setNumero(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="titre">Titre</Label>
                      <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
                    </div>
                  </div>

                  {/* Editor + Preview: 50/50 desktop, collapsible on mobile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contenu">Contenu HTML</Label>
                      <Textarea
                        id="contenu"
                        value={contenu}
                        onChange={(e) => setContenu(e.target.value)}
                        placeholder="<h2>Article 1...</h2><p>...</p>"
                        className="min-h-[500px] resize-y"
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: "14px",
                          lineHeight: "1.5",
                        }}
                      />
                    </div>

                    {/* Desktop preview */}
                    <div className="hidden md:flex md:flex-col space-y-2">
                      <Label>Prévisualisation</Label>
                      <div className="border rounded-md bg-card overflow-auto min-h-[500px] max-h-[600px] p-6">
                        <article
                          className="prose prose-sm md:prose-base max-w-none font-sans"
                          dangerouslySetInnerHTML={{ __html: contenu || "<p class='text-muted-foreground'>La prévisualisation apparaîtra ici…</p>" }}
                        />
                      </div>
                    </div>

                    {/* Mobile preview (accordion) */}
                    <div className="md:hidden">
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border rounded-md text-sm font-medium">
                          Prévisualisation
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border border-t-0 rounded-b-md bg-card overflow-auto max-h-[400px] p-4">
                            <article
                              className="prose prose-sm max-w-none font-sans"
                              dangerouslySetInnerHTML={{ __html: contenu || "<p class='text-muted-foreground'>La prévisualisation apparaîtra ici…</p>" }}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
                    <span>
                      {contenu.length.toLocaleString("fr-FR")} caractères
                    </span>
                    <span className="font-mono">
                      SHA-256 (indicatif) : {contenuHash ? `${contenuHash.slice(0, 16)}…${contenuHash.slice(-8)}` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La version actuellement active sera automatiquement archivée. Le hash affiché est calculé côté client à titre indicatif ; le hash probatoire est recalculé côté serveur (trigger PostgreSQL sur <code>chartes_versions</code>) à partir du contenu HTML réel, et toute valeur envoyée par le client est écrasée.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenNew(false)}>Annuler</Button>
                  <Button onClick={handleCreateVersion} disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Publier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </header>

      <Tabs defaultValue="versions">
        <TabsList>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
          <TabsTrigger value="signatures">Signatures ({signatures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="mt-4">
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>En vigueur depuis</TableHead>
                    <TableHead>Archivée le</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">v{v.numero_version}</TableCell>
                      <TableCell>{v.titre}</TableCell>
                      <TableCell className="text-xs">{new Date(v.entree_en_vigueur_le).toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-xs">
                        {v.archivee_le ? new Date(v.archivee_le).toLocaleString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{v.contenu_hash.slice(0, 12)}…</TableCell>
                      <TableCell>
                        {v.archivee_le ? (
                          <Badge variant="secondary">Archivée</Badge>
                        ) : (
                          <Badge>En vigueur</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="signatures" className="mt-4">
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : signatures.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Aucune signature enregistrée.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestataire</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Signé le</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead className="text-right">Preuve</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signatures.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.prestataires?.nom_commercial ?? s.prestataire_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>v{s.charte_numero_version}</TableCell>
                      <TableCell className="text-xs">{new Date(s.signe_le).toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="font-mono text-xs">{s.ip_signataire ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.methode_auth}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(s)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
