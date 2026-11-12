import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RetoursAtelier } from "@/components/admin/RetoursAtelier";

const db = supabase as any;
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const moisParis = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const jourParis = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(d);

type Log = { created_at: string; usage: string; model: string; user_id: string | null; tokens_entree: number | null; tokens_sortie: number | null; cout_eur: number | null; statut: string };
type Prompt = { id: string; usage: string; version: number; titre: string; contenu: string; max_tokens: number; format_json: boolean; actif: boolean };

export default function CoutsIA() {
  const [reg, setReg] = useState<Record<string, any>>({});
  const [budgetMois, setBudgetMois] = useState<any>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [brouillons, setBrouillons] = useState<Record<string, Partial<Prompt>>>({});
  const mois = moisParis();

  const charger = async () => {
    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const [r, b, l, q, p] = await Promise.all([
      db.from("ia_reglages").select("cle, valeur"),
      db.from("ia_budget_mois").select("*").eq("mois", mois).maybeSingle(),
      db.from("ia_logs").select("created_at, usage, model, user_id, tokens_entree, tokens_sortie, cout_eur, statut").gte("created_at", depuis).order("created_at", { ascending: false }).limit(10000),
      db.from("ia_quotas").select("*"),
      db.from("prompts_ia").select("*").order("usage").order("version", { ascending: false }),
    ]);
    setReg(Object.fromEntries((r.data ?? []).map((x: any) => [x.cle, x.valeur])));
    setBudgetMois(b.data);
    setLogs(l.data ?? []);
    setQuotas(q.data ?? []);
    setPrompts(p.data ?? []);
    const ids = [...new Set([...(l.data ?? []).map((x: Log) => x.user_id), ...(q.data ?? []).map((x: any) => x.user_id)].filter(Boolean))];
    if (ids.length) {
      const { data } = await db.from("profiles").select("id, email").in("id", ids.slice(0, 500));
      setEmails(new Map((data ?? []).map((x: any) => [x.id, x.email])));
    }
  };
  useEffect(() => { charger(); }, []);

  const budget = Number(reg.budget_mensuel_eur ?? 0);
  const seuils = reg.budget_seuils_pct ?? { alerte: 80, degrade: 100, bloque: 120 };
  const qd = reg.quotas_defaut ?? {};
  const total = Number(budgetMois?.total_eur ?? 0);
  const pct = budget > 0 ? (total / budget) * 100 : 0;
  const mode = pct >= seuils.bloque && !budgetMois?.suspension_levee_le ? "Suspendu" : pct >= seuils.degrade ? "Dégradé" : "Normal";

  const stats = useMemo(() => {
    const auj = jourParis(new Date());
    const parJour = new Map<string, number>(), parUsage = new Map<string, number>(), parModele = new Map<string, number>(), parCouple = new Map<string, number>();
    let coutJour = 0, tokensJour = 0, sansCout = 0;
    for (const l of logs) {
      const c = Number(l.cout_eur ?? 0);
      if (l.cout_eur == null) sansCout++;
      const j = jourParis(new Date(l.created_at));
      parJour.set(j, (parJour.get(j) ?? 0) + c);
      parUsage.set(l.usage, (parUsage.get(l.usage) ?? 0) + c);
      parModele.set(l.model, (parModele.get(l.model) ?? 0) + c);
      if (l.user_id && !(emails.get(l.user_id) ?? "").toLowerCase().endsWith("@lesnoces.test")) parCouple.set(l.user_id, (parCouple.get(l.user_id) ?? 0) + c);
      if (j === auj) { coutJour += c; tokensJour += (l.tokens_entree ?? 0) + (l.tokens_sortie ?? 0); }
    }
    const couples = [...parCouple.entries()].sort((a, b) => b[1] - a[1]);
    const moyen = couples.length ? couples.reduce((s, [, c]) => s + c, 0) / couples.length : 0;
    return { coutJour, tokensJour, sansCout, parJour: [...parJour.entries()].sort().reverse(), parUsage: [...parUsage.entries()], parModele: [...parModele.entries()], top: couples.slice(0, 20), moyen, nbCouples: couples.length };
  }, [logs, emails]);

  const atteints = quotas.filter((q) => {
    const today = jourParis(new Date());
    return (q.jour === today && (q.assistant_jour >= (qd.assistant_par_jour ?? 0) + q.bonus_assistant || q.filtres_jour >= (qd.filtres_par_jour ?? 0) + q.bonus_filtres))
      || q.livret_total >= (qd.livret_total ?? 0) + q.bonus_livret || q.charte_total >= (qd.charte_total ?? 0) + q.bonus_charte || q.vision_total >= (qd.vision_total ?? 0) + q.bonus_vision;
  });

  const majReglage = async (cle: string, valeur: unknown) => {
    const { data, error } = await db.from("ia_reglages").update({ valeur, updated_at: new Date().toISOString() }).eq("cle", cle).select();
    if (error || !data?.length) return toast.error("Échec de l'enregistrement");
    toast.success("Enregistré"); charger();
  };
  const bonus = async (q: any, champ: string, n: number) => {
    const { data, error } = await db.from("ia_quotas").update({ [champ]: q[champ] + n }).eq("user_id", q.user_id).select();
    if (error || !data?.length) return toast.error("Échec"); toast.success(`+${n} accordé`); charger();
  };
  const leverSuspension = async () => {
    const { data, error } = await db.from("ia_budget_mois").update({ suspension_levee_le: new Date().toISOString() }).eq("mois", mois).select();
    if (error || !data?.length) return toast.error("Échec"); toast.success("Suspension levée pour ce mois"); charger();
  };
  const nouvelleVersion = async (p: Prompt) => {
    const b = { ...p, ...brouillons[p.id] };
    const max = Math.max(...prompts.filter((x) => x.usage === p.usage).map((x) => x.version));
    if (b.actif) {
      const { error: e1 } = await db.from("prompts_ia").update({ actif: false }).eq("usage", p.usage).eq("actif", true);
      if (e1) return toast.error(e1.message);
    }
    const { data, error } = await db.from("prompts_ia").insert({ usage: p.usage, version: max + 1, titre: b.titre, contenu: b.contenu, max_tokens: b.max_tokens, format_json: b.format_json, actif: b.actif }).select();
    if (error || !data?.length) return toast.error(error?.message ?? "Échec");
    toast.success(`Version ${max + 1} créée`); setBrouillons((s) => ({ ...s, [p.id]: {} })); charger();
  };
  const activer = async (p: Prompt) => {
    await db.from("prompts_ia").update({ actif: false }).eq("usage", p.usage).eq("actif", true);
    const { data, error } = await db.from("prompts_ia").update({ actif: true }).eq("id", p.id).select();
    if (error || !data?.length) return toast.error("Échec"); toast.success(`Version ${p.version} active`); charger();
  };

  const derniersPrompts = Object.values(prompts.reduce((acc, p) => { (acc[p.usage] ??= []).push(p); return acc; }, {} as Record<string, Prompt[]>));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-serif text-2xl">Coûts IA</h1>
      <Tabs defaultValue="couts">
        <TabsList><TabsTrigger value="couts">Coûts et réglages</TabsTrigger><TabsTrigger value="retours">Retours Atelier</TabsTrigger></TabsList>
        <TabsContent value="retours" className="mt-4"><RetoursAtelier /></TabsContent>
        <TabsContent value="couts" className="mt-4 space-y-6">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Budget {mois}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur(total)} <span className="text-sm text-muted-foreground">/ {eur(budget)}</span></p>
            <div className="mt-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)} %</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Mode</CardTitle></CardHeader>
          <CardContent><Badge variant={mode === "Normal" ? "secondary" : "destructive"}>{mode}</Badge>
            {pct >= seuils.bloque && !budgetMois?.suspension_levee_le && <Button size="sm" className="mt-2 block" onClick={leverSuspension}>Lever la suspension</Button>}
            {budgetMois?.alerte_envoyee_le && <p className="mt-2 text-xs text-muted-foreground">Alerte envoyée le {new Date(budgetMois.alerte_envoyee_le).toLocaleString("fr-FR")}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Aujourd'hui</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur(stats.coutJour)}</p><p className="text-xs text-muted-foreground">{stats.tokensJour.toLocaleString("fr-FR")} tokens</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Coût moyen par couple (30 j)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur(stats.moyen)}</p><p className="text-xs text-muted-foreground">{stats.nbCouples} utilisateurs</p></CardContent></Card>
      </div>
      {stats.sansCout > 0 && <p className="text-sm text-destructive">{stats.sansCout} appel(s) sur 30 jours sans coût calculé (tarif manquant).</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">30 derniers jours</CardTitle></CardHeader><CardContent className="max-h-72 overflow-auto">
          <Table><TableBody>{stats.parJour.map(([j, c]) => <TableRow key={j}><TableCell>{j}</TableCell><TableCell className="text-right">{eur(c)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Par usage</CardTitle></CardHeader><CardContent>
          <Table><TableBody>{stats.parUsage.map(([u, c]) => <TableRow key={u}><TableCell>{u}</TableCell><TableCell className="text-right">{eur(c)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Par modèle</CardTitle></CardHeader><CardContent>
          <Table><TableBody>{stats.parModele.map(([m, c]) => <TableRow key={m}><TableCell>{m}</TableCell><TableCell className="text-right">{eur(c)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-base">20 plus gros consommateurs (30 j)</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Compte</TableHead><TableHead className="text-right">Coût</TableHead></TableRow></TableHeader>
          <TableBody>{stats.top.map(([id, c]) => <TableRow key={id}><TableCell>{emails.get(id) ?? id}</TableCell><TableCell className="text-right">{eur(c)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Couples ayant atteint un quota</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        {atteints.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> :
        <Table><TableHeader><TableRow><TableHead>Compte</TableHead><TableHead>Assistant (jour)</TableHead><TableHead>Livret</TableHead><TableHead>Charte</TableHead><TableHead>Bonus</TableHead></TableRow></TableHeader>
          <TableBody>{atteints.map((q) => <TableRow key={q.user_id}>
            <TableCell>{emails.get(q.user_id) ?? q.user_id}</TableCell>
            <TableCell>{q.assistant_jour} / {(qd.assistant_par_jour ?? 0) + q.bonus_assistant}</TableCell>
            <TableCell>{q.livret_total} / {(qd.livret_total ?? 0) + q.bonus_livret}</TableCell>
            <TableCell>{q.charte_total} / {(qd.charte_total ?? 0) + q.bonus_charte}</TableCell>
            <TableCell className="space-x-1 whitespace-nowrap"><Button size="sm" variant="outline" onClick={() => bonus(q, "bonus_assistant", 20)}>+20 messages</Button><Button size="sm" variant="outline" onClick={() => bonus(q, "bonus_livret", 2)}>+2 livrets</Button><Button size="sm" variant="outline" onClick={() => bonus(q, "bonus_charte", 3)}>+3 chartes</Button></TableCell>
          </TableRow>)}</TableBody></Table>}</CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Réglages</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <Reglage label="Budget mensuel (€)" valeur={String(budget)} onSave={(v) => majReglage("budget_mensuel_eur", Number(v.replace(",", ".")))} />
        <Reglage label="Email d'alerte budget" valeur={String(reg.email_alerte_budget ?? "")} onSave={(v) => majReglage("email_alerte_budget", v.trim())} />
        <Reglage label="Seuils % (alerte, dégradé, suspension)" valeur={`${seuils.alerte}, ${seuils.degrade}, ${seuils.bloque}`}
          onSave={(v) => { const [a, d, b] = v.split(",").map((x) => Number(x.trim())); if ([a, d, b].some(isNaN)) return toast.error("Trois nombres attendus"); majReglage("budget_seuils_pct", { alerte: a, degrade: d, bloque: b }); }} />
        <Reglage label="Quotas par couple (JSON)" valeur={JSON.stringify(qd)}
          onSave={(v) => { try { majReglage("quotas_defaut", JSON.parse(v)); } catch { toast.error("JSON invalide"); } }} />
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Prompts</CardTitle></CardHeader><CardContent className="space-y-6">
        {derniersPrompts.map((liste) => { const p = liste[0]; const b = { ...p, ...brouillons[p.id] }; const set = (k: keyof Prompt, v: any) => setBrouillons((s) => ({ ...s, [p.id]: { ...s[p.id], [k]: v } }));
          return <div key={p.usage} className="space-y-2 border-b pb-4">
            <div className="flex flex-wrap items-center gap-2"><strong>{p.usage}</strong>
              {liste.map((v) => <Badge key={v.id} variant={v.actif ? "default" : "outline"} className="cursor-pointer" onClick={() => !v.actif && activer(v)}>v{v.version}{v.actif ? " active" : ""}</Badge>)}</div>
            <Input value={b.titre} onChange={(e) => set("titre", e.target.value)} />
            <Textarea rows={8} value={b.contenu} onChange={(e) => set("contenu", e.target.value)} />
            <div className="flex flex-wrap items-center gap-4">
              <Label className="flex items-center gap-2">Max tokens <Input type="number" className="w-24" value={b.max_tokens} onChange={(e) => set("max_tokens", Number(e.target.value))} /></Label>
              <Label className="flex items-center gap-2"><Switch checked={b.format_json} onCheckedChange={(v) => set("format_json", v)} /> JSON</Label>
              <Label className="flex items-center gap-2"><Switch checked={b.actif} onCheckedChange={(v) => set("actif", v)} /> Active</Label>
              <Button size="sm" onClick={() => nouvelleVersion(p)}>Enregistrer comme nouvelle version</Button>
            </div></div>; })}
      </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Reglage({ label, valeur, onSave }: { label: string; valeur: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  return <div className="space-y-1"><Label>{label}</Label><div className="flex gap-2"><Input value={v} onChange={(e) => setV(e.target.value)} /><Button size="sm" onClick={() => onSave(v)}>OK</Button></div></div>;
}
