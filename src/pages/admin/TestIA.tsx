import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { calculerCoutIa, formaterCoutIa, type IaTarif } from "@/lib/iaCout";

type Provider = "mistral" | "anthropic";
const CLIENT_TIMEOUT_MS = 125_000;

interface Resultat {
  provider: Provider;
  model: string;
  loading: boolean;
  id?: string | null;
  reponse?: string | null;
  error?: string | null;
  tokens_entree?: number | null;
  tokens_sortie?: number | null;
  duree_ms?: number | null;
  motif_arret?: string | null;
}

const nomFournisseur = (p: Provider) => (p === "mistral" ? "Mistral" : "Claude (Anthropic)");

async function appeler(body: Record<string, unknown>): Promise<Partial<Resultat>> {
  const timeout = new Promise<Partial<Resultat>>((res) =>
    setTimeout(() => res({ error: "Délai dépassé (120 s) : aucune réponse reçue." }), CLIENT_TIMEOUT_MS),
  );
  const call = supabase.functions.invoke("ai-playground", { body }).then(({ data, error }) => {
    if (error) return { error: error.message };
    return data as Partial<Resultat>;
  });
  return Promise.race([call, timeout]);
}

function Notation({ id }: { id: string }) {
  const [p, setP] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [r, setR] = useState<number | null>(null);
  const [rem, setRem] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("ia_tests")
      .update({ note_pertinence: p, note_francais: f, note_regles: r, remarque: rem || null })
      .eq("id", id)
      .select("id");
    setSaving(false);
    if (error || !data?.length) toast.error("Enregistrement impossible");
    else toast.success("Notes enregistrées");
  };
  const ligne = (label: string, v: number | null, set: (n: number) => void) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button key={n} type="button" size="sm" variant={v === n ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => set(n)}>
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-2 border-t border-border pt-3">
      {ligne("Pertinence", p, setP)}
      {ligne("Français", f, setF)}
      {ligne("Respect des règles", r, setR)}
      <Textarea placeholder="Remarque" value={rem} onChange={(e) => setRem(e.target.value)} rows={2} />
      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les notes"}</Button>
    </div>
  );
}

function CarteReponse({ titre, res, revele, tarifs }: { titre: string; res: Resultat; revele: boolean; tarifs: IaTarif[] }) {
  const tarif = tarifs.find((t) => t.model === res.model);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-serif text-lg">
          {titre} {revele && <span className="text-sm font-sans text-muted-foreground">— {nomFournisseur(res.provider)} · {res.model}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {res.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> En attente de la réponse (120 s max)…</div>
        ) : res.error ? (
          <p className="text-sm text-destructive">{res.error}</p>
        ) : (
          <>
            <div className="whitespace-pre-wrap text-sm max-h-[60vh] overflow-auto">{res.reponse}</div>
            <p className="text-xs text-muted-foreground">
              {res.tokens_entree ?? "?"} tokens entrée · {res.tokens_sortie ?? "?"} tokens sortie · {res.duree_ms} ms ·{" "}
              {formaterCoutIa(calculerCoutIa(res.tokens_entree ?? null, res.tokens_sortie ?? null, tarif))}
            </p>
            {res.id && <Notation id={res.id} />}
          </>
        )}
        {!res.loading && res.motif_arret && (
          <p className="text-xs text-muted-foreground">arrêt : {res.motif_arret}</p>
        )}
        {!res.loading && (res.motif_arret === "max_tokens" || res.motif_arret === "length") && (
          <p className="text-sm font-medium text-destructive">réponse coupée : limite de longueur atteinte</p>
        )}
        {revele && res.provider === "anthropic" && (
          <p className="text-xs text-muted-foreground">température : non applicable</p>
        )}
      </CardContent>
    </Card>
  );
}

function OngletTest({ tarifs }: { tarifs: IaTarif[] }) {
  const [label, setLabel] = useState<"A" | "B" | "C">("A");
  const [numero, setNumero] = useState("");
  const [system, setSystem] = useState("");
  const [message, setMessage] = useState("");
  const [temp, setTemp] = useState("0.3");
  const [mMistral, setMMistral] = useState("mistral-small-latest");
  const [mClaude, setMClaude] = useState("claude-haiku-5-5");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [revele, setRevele] = useState(false);

  const lancer = () => {
    if (!message.trim()) return toast.error("Message requis");
    const t = Number(temp.replace(",", "."));
    const base = { temperature: isNaN(t) ? 0.3 : t, system, message, prompt_label: label, demande_numero: numero || null };
    const liste: Resultat[] = [
      { provider: "mistral", model: mMistral, loading: true },
      { provider: "anthropic", model: mClaude, loading: true },
    ];
    if (Math.random() < 0.5) liste.reverse();
    setRevele(false);
    setResultats(liste);
    liste.forEach((r, i) => {
      appeler({ ...base, provider: r.provider, model: r.model }).then((out) =>
        setResultats((prev) => prev.map((x, j) => (j === i ? { ...x, ...out, loading: false } : x))),
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><Label>Prompt</Label>
          <Select value={label} onValueChange={(v) => setLabel(v as "A")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>N° de demande</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
        <div><Label>Température (Mistral)</Label><Input value={temp} onChange={(e) => setTemp(e.target.value)} /></div>
        <div><Label>Modèle Mistral</Label><Input value={mMistral} onChange={(e) => setMMistral(e.target.value)} /></div>
        <div><Label>Modèle Claude</Label><Input value={mClaude} onChange={(e) => setMClaude(e.target.value)} /></div>
      </div>
      <div><Label>Prompt système</Label><Textarea rows={10} value={system} onChange={(e) => setSystem(e.target.value)} /></div>
      <div><Label>Message</Label><Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={lancer} disabled={resultats.some((r) => r.loading)}>Lancer sur les deux</Button>
        {resultats.length > 0 && <Button variant="outline" onClick={() => setRevele(true)}><Eye className="mr-1 h-4 w-4" />Révéler</Button>}
      </div>
      {resultats.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {resultats.map((r, i) => <CarteReponse key={i} titre={`Réponse ${i + 1}`} res={r} revele={revele} tarifs={tarifs} />)}
        </div>
      )}
    </div>
  );
}

interface LigneTest {
  id: string; created_at: string; provider: string; model: string; prompt_label: string | null; demande_numero: string | null;
  tokens_entree: number | null; tokens_sortie: number | null; duree_ms: number | null; erreur: string | null;
  note_pertinence: number | null; note_francais: number | null; note_regles: number | null; remarque: string | null;
}

const moy = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "—";
};

function OngletResultats({ tarifs }: { tarifs: IaTarif[] }) {
  const [rows, setRows] = useState<LigneTest[]>([]);
  useEffect(() => {
    supabase.from("ia_tests").select("*").order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => setRows((data ?? []) as LigneTest[]));
  }, []);
  const groupes = useMemo(() => {
    const m = new Map<string, LigneTest[]>();
    rows.forEach((r) => { const k = `${r.provider}|${r.model}|${r.prompt_label ?? "—"}`; m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m.entries()].map(([k, list]) => {
      const [provider, model, prompt] = k.split("|");
      const tarif = tarifs.find((t) => t.model === model);
      const couts = list.map((r) => calculerCoutIa(r.tokens_entree, r.tokens_sortie, tarif));
      const cm = couts.some((c) => c == null) ? null : couts.reduce((a, b) => a! + b!, 0)! / couts.length;
      return { provider, model, prompt, n: list.length, p: moy(list.map((r) => r.note_pertinence)), f: moy(list.map((r) => r.note_francais)), r: moy(list.map((r) => r.note_regles)), cout: formaterCoutIa(cm) };
    });
  }, [rows, tarifs]);

  return (
    <div className="space-y-8">
      <Table>
        <TableHeader><TableRow><TableHead>Fournisseur</TableHead><TableHead>Modèle</TableHead><TableHead>Prompt</TableHead><TableHead>Tests</TableHead><TableHead>Pertinence</TableHead><TableHead>Français</TableHead><TableHead>Règles</TableHead><TableHead>Coût moyen</TableHead></TableRow></TableHeader>
        <TableBody>{groupes.map((g, i) => (
          <TableRow key={i}><TableCell>{g.provider}</TableCell><TableCell>{g.model}</TableCell><TableCell>{g.prompt}</TableCell><TableCell>{g.n}</TableCell><TableCell>{g.p}</TableCell><TableCell>{g.f}</TableCell><TableCell>{g.r}</TableCell><TableCell>{g.cout}</TableCell></TableRow>
        ))}</TableBody>
      </Table>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Fournisseur</TableHead><TableHead>Modèle</TableHead><TableHead>Prompt</TableHead><TableHead>Demande</TableHead><TableHead>Tokens</TableHead><TableHead>Durée</TableHead><TableHead>Coût</TableHead><TableHead>Notes</TableHead><TableHead>Remarque</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("fr-FR")}</TableCell>
              <TableCell>{r.provider}</TableCell><TableCell>{r.model}</TableCell><TableCell>{r.prompt_label}</TableCell><TableCell>{r.demande_numero}</TableCell>
              <TableCell>{r.erreur ? <span className="text-destructive">erreur</span> : `${r.tokens_entree ?? "?"} / ${r.tokens_sortie ?? "?"}`}</TableCell>
              <TableCell>{r.duree_ms} ms</TableCell>
              <TableCell>{formaterCoutIa(calculerCoutIa(r.tokens_entree, r.tokens_sortie, tarifs.find((t) => t.model === r.model)))}</TableCell>
              <TableCell>{[r.note_pertinence, r.note_francais, r.note_regles].map((n) => n ?? "—").join(" / ")}</TableCell>
              <TableCell className="max-w-xs truncate">{r.remarque}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}

function OngletTarifs({ tarifs, recharger }: { tarifs: IaTarif[]; recharger: () => void }) {
  const [edits, setEdits] = useState<Record<string, { in: string; out: string }>>({});
  const [nouveau, setNouveau] = useState("");
  const val = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const save = async (model: string) => {
    const e = edits[model]; if (!e) return;
    const { data, error } = await supabase.from("ia_tarifs").update({ prix_entree_eur_par_million: val(e.in), prix_sortie_eur_par_million: val(e.out) }).eq("model", model).select("model");
    if (error || !data?.length) toast.error("Enregistrement impossible"); else { toast.success("Tarif enregistré"); recharger(); }
  };
  const ajouter = async () => {
    if (!nouveau.trim()) return;
    const { data, error } = await supabase.from("ia_tarifs").insert({ model: nouveau.trim() }).select("model");
    if (error || !data?.length) toast.error("Ajout impossible"); else { setNouveau(""); recharger(); }
  };
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader><TableRow><TableHead>Modèle</TableHead><TableHead>€ / M tokens entrée</TableHead><TableHead>€ / M tokens sortie</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{tarifs.map((t) => {
          const e = edits[t.model] ?? { in: t.prix_entree_eur_par_million?.toString() ?? "", out: t.prix_sortie_eur_par_million?.toString() ?? "" };
          return (
            <TableRow key={t.model}>
              <TableCell>{t.model}</TableCell>
              <TableCell><Input value={e.in} placeholder="tarif manquant" onChange={(x) => setEdits({ ...edits, [t.model]: { ...e, in: x.target.value } })} /></TableCell>
              <TableCell><Input value={e.out} placeholder="tarif manquant" onChange={(x) => setEdits({ ...edits, [t.model]: { ...e, out: x.target.value } })} /></TableCell>
              <TableCell><Button size="sm" onClick={() => save(t.model)}>Enregistrer</Button></TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table>
      <div className="flex gap-2 max-w-md"><Input placeholder="Nouveau modèle" value={nouveau} onChange={(e) => setNouveau(e.target.value)} /><Button onClick={ajouter}>Ajouter</Button></div>
    </div>
  );
}

export default function TestIA() {
  const [tarifs, setTarifs] = useState<IaTarif[]>([]);
  const charger = () => supabase.from("ia_tarifs").select("*").order("model").then(({ data }) => setTarifs((data ?? []) as IaTarif[]));
  useEffect(() => { charger(); }, []);
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-serif text-2xl">Test IA</h1>
      <Tabs defaultValue="test">
        <TabsList><TabsTrigger value="test">Nouveau test</TabsTrigger><TabsTrigger value="resultats">Résultats</TabsTrigger><TabsTrigger value="tarifs">Tarifs</TabsTrigger></TabsList>
        <TabsContent value="test"><OngletTest tarifs={tarifs} /></TabsContent>
        <TabsContent value="resultats"><OngletResultats tarifs={tarifs} /></TabsContent>
        <TabsContent value="tarifs"><OngletTarifs tarifs={tarifs} recharger={charger} /></TabsContent>
      </Tabs>
    </div>
  );
}
