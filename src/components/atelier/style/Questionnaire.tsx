import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AMBIANCES, APLATS_AMBIANCE, BUDGETS, CADRES, CEREMONIES, FORMALITE, MATIERES, NB_INVITES, PASTILLES, type ProfilMariage,
} from "@/lib/notreStyle";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const TITRES = [
  "Quelle est la date de votre mariage ?", "Où aura lieu votre mariage ?", "Combien d'invités attendez-vous ?",
  "Quel est votre budget global ?", "Quel type de cérémonie ?", "Quelle ambiance vous ressemble ?",
  "Dans quel cadre ?", "Vos couleurs", "Matières et détails", "Votre mariage sera plutôt…",
];
const AIDES = [
  "Une date précise ou seulement le mois.", "Une ville, un département ou une région.", "Une estimation suffit.",
  "Tout compris : lieu, traiteur, tenues, prestataires.", "Plusieurs choix possibles.", "3 choix au maximum.",
  "Le décor que vous imaginez.", "Touchez une pastille une fois pour l'aimer, deux fois pour l'éviter.", "Autant que vous voulez.", "",
];

type Patch = Partial<Omit<ProfilMariage, "user_id">>;
type Lieu = { libelle: string; type: "ville" | "departement" | "region"; code: string; detail?: string };

function Carte({ choisi, onClick, children, className }: { choisi: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={choisi}
      className={cn("relative rounded-2xl border bg-card text-left transition-all", choisi ? "border-atelier-or ring-2 ring-atelier-or/40" : "border-atelier-filet hover:border-atelier-or/50", className)}>
      {children}
      <span className={cn("absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center border", choisi ? "bg-atelier-or border-atelier-or text-primary-foreground" : "bg-card/80 border-atelier-filet")}>
        {choisi && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function ChoixLieu({ valeur, onChoisir }: { valeur: string | null; onChoisir: (l: Lieu) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Lieu[]>([]);
  const [zones, setZones] = useState<{ type: string; label: string; zone_value: string; dept_code: string | null; parent_region_label: string | null }[]>([]);
  useEffect(() => {
    supabase.from("zones_reference").select("type, label, zone_value, dept_code, parent_region_label").in("type", ["region", "departement", "dom"])
      .then(({ data }) => setZones(data ?? []));
  }, []);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes([]); return; }
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const locaux: Lieu[] = zones.filter((z) => norm(z.label).includes(norm(t)) || z.dept_code === t).slice(0, 5).map((z) => z.type === "region"
      ? { libelle: z.label, type: "region", code: z.zone_value, detail: "Région" }
      : { libelle: z.label, type: "departement", code: z.dept_code!, detail: `Département ${z.dept_code}` });
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(t)}&type=municipality&limit=5`, { signal: ctrl.signal });
        const j = await r.json();
        const villes: Lieu[] = (j.features ?? []).map((f: { properties: { city: string; postcode: string; context: string } }) =>
          ({ libelle: f.properties.city, type: "ville", code: f.properties.postcode, detail: f.properties.context }));
        setRes([...locaux, ...villes]);
      } catch { setRes(locaux); }
    }, 250);
    setRes(locaux);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [q, zones]);
  return (
    <div className="space-y-3">
      {valeur && <p className="inline-flex items-center gap-2 rounded-full bg-atelier-lin px-4 py-2 font-sans text-sm"><MapPin className="h-4 w-4 text-atelier-or" />{valeur}</p>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vannes, Morbihan, Bretagne…" className="pl-9 h-12 rounded-xl bg-card" />
      </div>
      <div className="space-y-1.5">
        {res.map((l) => (
          <button key={`${l.type}-${l.code}-${l.libelle}`} type="button" onClick={() => { onChoisir(l); setQ(""); setRes([]); }}
            className="w-full text-left rounded-xl border border-atelier-filet bg-card px-4 py-3 hover:border-atelier-or/60">
            <span className="font-sans text-sm font-medium text-foreground">{l.libelle}</span>
            {l.detail && <span className="block font-sans text-xs text-muted-foreground">{l.detail}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Questionnaire({ profil, onFermer, onTermine, etapeInitiale = 0 }: { profil: ProfilMariage | null; onFermer: () => void; onTermine: () => void; etapeInitiale?: number }) {
  const { user } = useAuth();
  const [p, setP] = useState<Patch>(profil ?? {});
  const [etape, setEtape] = useState(etapeInitiale);
  const [modeDate, setModeDate] = useState<"jour" | "mois">(profil?.date_mois && !profil?.date_mariage ? "mois" : "jour");
  const [enregistrement, setEnregistrement] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout>>();

  const sauver = async (patch: Patch, attendre = false) => {
    setP((x) => ({ ...x, ...patch }));
    const envoi = async () => {
      setEnregistrement(true);
      const { data, error } = await supabase.from("profils_mariage").upsert({ user_id: user!.id, ...patch }, { onConflict: "user_id" }).select("departements, region");
      setEnregistrement(false);
      if (error || !data?.length) { toast.error("Votre réponse n'a pas pu être enregistrée."); return; }
      setP((x) => ({ ...x, departements: data[0].departements, region: data[0].region }));
    };
    clearTimeout(minuteur.current);
    if (attendre) minuteur.current = setTimeout(envoi, 600); else await envoi();
  };
  const basculer = (cle: "types_ceremonie" | "ambiances" | "matieres", v: string, max?: number) => {
    const l = (p[cle] as string[] | undefined) ?? [];
    if (l.includes(v)) return sauver({ [cle]: l.filter((x) => x !== v) });
    if (max && l.length >= max) { toast(`${max} choix au maximum : retirez-en un d'abord.`); return; }
    return sauver({ [cle]: [...l, v] });
  };
  const pastille = (id: string) => {
    const a = p.couleurs_aimees ?? [], e = p.couleurs_evitees ?? [];
    if (a.includes(id)) return sauver({ couleurs_aimees: a.filter((x) => x !== id), couleurs_evitees: [...e, id] });
    if (e.includes(id)) return sauver({ couleurs_evitees: e.filter((x) => x !== id) });
    return sauver({ couleurs_aimees: [...a, id] });
  };

  const annees = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i);
  const derniere = etape === 9;
  const terminer = async () => {
    clearTimeout(minuteur.current);
    await sauver({ description_libre: (p.description_libre ?? "").trim().slice(0, 300) || null, questionnaire_termine_le: new Date().toISOString() });
    onTermine();
  };

  return (
    <div className="fixed inset-0 z-50 bg-atelier-fond flex flex-col">
      <header className="shrink-0 h-14 px-4 flex items-center justify-between border-b border-atelier-filet bg-atelier-fond">
        <button type="button" onClick={onFermer} className="inline-flex items-center gap-1 font-serif text-lg text-foreground"><ChevronLeft className="h-5 w-5" />Notre style</button>
        <span className="flex items-center gap-3">
          {enregistrement && <Loader2 className="h-4 w-4 animate-spin text-atelier-or" aria-label="Enregistrement" />}
          <button type="button" onClick={onFermer} className="font-sans text-sm font-semibold text-atelier-or">Plus tard</button>
        </span>
      </header>
      <div className="shrink-0 px-4 pt-3 max-w-2xl w-full mx-auto">
        <div className="flex gap-1.5" aria-label={`Question ${etape + 1} sur 10`}>
          {TITRES.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= etape ? "bg-atelier-or" : "bg-atelier-lin")} />)}
        </div>
      </div>
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">Question {etape + 1} / 10</p>
            <h1 className="font-serif text-3xl text-foreground mt-1">{TITRES[etape]}</h1>
            {AIDES[etape] && <p className="font-sans text-sm text-muted-foreground mt-1">{AIDES[etape]}</p>}
          </div>

          {etape === 0 && (
            <div className="space-y-4">
              <div className="inline-flex rounded-full bg-atelier-lin p-1">
                {(["jour", "mois"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setModeDate(m)}
                    className={cn("rounded-full px-4 py-2 font-sans text-sm", modeDate === m ? "bg-card shadow-sm font-semibold" : "text-muted-foreground")}>
                    {m === "jour" ? "Date précise" : "Mois et année"}
                  </button>
                ))}
              </div>
              {modeDate === "jour" ? (
                <Input type="date" value={p.date_mariage ?? ""} min={new Date().toISOString().slice(0, 10)} className="h-12 rounded-xl bg-card max-w-xs"
                  onChange={(e) => sauver({ date_mariage: e.target.value || null, date_mois: e.target.value ? Number(e.target.value.slice(5, 7)) : null, date_annee: e.target.value ? Number(e.target.value.slice(0, 4)) : null })} />
              ) : (
                <div className="flex gap-3">
                  <select className="h-12 rounded-xl border border-input bg-card px-3 font-sans text-sm" value={p.date_mois ?? ""} aria-label="Mois"
                    onChange={(e) => sauver({ date_mariage: null, date_mois: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Mois</option>{MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select className="h-12 rounded-xl border border-input bg-card px-3 font-sans text-sm" value={p.date_annee ?? ""} aria-label="Année"
                    onChange={(e) => sauver({ date_mariage: null, date_annee: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Année</option>{annees.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {etape === 1 && (
            <ChoixLieu valeur={p.lieu_libelle ?? null} onChoisir={(l) => sauver({ lieu_libelle: l.libelle, lieu_type: l.type, lieu_code: l.code })} />
          )}

          {(etape === 2 || etape === 3) && (
            <div className="grid gap-2.5">
              {(etape === 2 ? NB_INVITES : BUDGETS).map((o) => {
                const cle = etape === 2 ? "nb_invites" : "budget_fourchette";
                return (
                  <Carte key={o.id} choisi={p[cle] === o.id} onClick={() => sauver({ [cle]: p[cle] === o.id ? null : o.id })} className="px-4 py-4">
                    <span className="font-sans text-base text-foreground">{o.label}</span>
                  </Carte>
                );
              })}
            </div>
          )}

          {etape === 4 && (
            <div className="grid gap-2.5">
              {CEREMONIES.map((c) => (
                <Carte key={c.id} choisi={(p.types_ceremonie ?? []).includes(c.id)} onClick={() => basculer("types_ceremonie", c.id)} className="px-4 py-4">
                  <span className="font-sans text-base text-foreground">{c.label}</span>
                </Carte>
              ))}
            </div>
          )}

          {etape === 5 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMBIANCES.map((a) => {
                const [c1, c2, c3] = APLATS_AMBIANCE[a];
                return (
                  <Carte key={a} choisi={(p.ambiances ?? []).includes(a)} onClick={() => basculer("ambiances", a, 3)} className="overflow-hidden">
                    <svg viewBox="0 0 120 70" className="block w-full h-20" aria-hidden>
                      <rect width="120" height="70" fill={c1} /><circle cx="88" cy="22" r="12" fill={c2} /><path d="M0 52 Q40 34 70 50 T120 46 V70 H0 Z" fill={c3} />
                    </svg>
                    <span className="block px-3 py-2.5 font-sans text-sm font-medium text-foreground">{a}</span>
                  </Carte>
                );
              })}
            </div>
          )}

          {etape === 6 && (
            <div className="grid grid-cols-2 gap-2.5">
              {CADRES.map((c) => (
                <Carte key={c} choisi={p.cadre === c} onClick={() => sauver({ cadre: p.cadre === c ? null : c })} className="px-4 py-4">
                  <span className="font-sans text-base text-foreground">{c}</span>
                </Carte>
              ))}
            </div>
          )}

          {etape === 7 && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {PASTILLES.map((c) => {
                  const aime = (p.couleurs_aimees ?? []).includes(c.id), evite = (p.couleurs_evitees ?? []).includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => pastille(c.id)} className="flex flex-col items-center gap-1.5"
                      aria-label={`${c.label} : ${aime ? "aimée" : evite ? "à éviter" : "neutre"}`}>
                      <span className={cn("relative h-12 w-12 rounded-full border grid place-items-center", aime ? "ring-2 ring-offset-2 ring-atelier-or border-transparent" : "border-atelier-filet")} style={{ background: c.hex }}>
                        {aime && <Check className="h-5 w-5 text-white drop-shadow" />}
                        {evite && <span className="absolute inset-0 rounded-full bg-background/40 grid place-items-center"><span className="block h-0.5 w-10 rotate-45 bg-destructive" /></span>}
                      </span>
                      <span className={cn("font-sans text-[11px] text-center leading-tight", evite ? "text-destructive line-through" : "text-foreground")}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="font-sans text-sm text-muted-foreground">
                Aimées : {(p.couleurs_aimees ?? []).map((i) => PASTILLES.find((x) => x.id === i)?.label).join(", ") || "aucune"} ·
                À éviter : {(p.couleurs_evitees ?? []).map((i) => PASTILLES.find((x) => x.id === i)?.label).join(", ") || "aucune"}
              </p>
            </div>
          )}

          {etape === 8 && (
            <div className="flex flex-wrap gap-2">
              {MATIERES.map((m) => {
                const c = (p.matieres ?? []).includes(m);
                return (
                  <button key={m} type="button" onClick={() => basculer("matieres", m)} aria-pressed={c}
                    className={cn("rounded-full border px-4 py-2.5 font-sans text-sm", c ? "border-atelier-or bg-atelier-lin font-semibold" : "border-atelier-filet bg-card")}>
                    {c && <Check className="inline h-3.5 w-3.5 mr-1 text-atelier-or" />}{m}
                  </button>
                );
              })}
            </div>
          )}

          {etape === 9 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-atelier-filet bg-card p-5 space-y-4">
                <p className="font-serif text-xl text-center text-foreground">{FORMALITE[p.formalite ?? 3]}</p>
                <Slider min={1} max={5} step={1} value={[p.formalite ?? 3]} onValueChange={([v]) => sauver({ formalite: v }, true)} aria-label="Niveau de formalité" />
                <div className="flex justify-between font-sans text-xs text-muted-foreground"><span>Décontracté</span><span>Très habillé</span></div>
              </div>
              <div className="space-y-2">
                <label htmlFor="desc" className="font-serif text-xl text-foreground">Décrivez votre mariage en une phrase <span className="font-sans text-sm text-muted-foreground">(facultatif)</span></label>
                <Textarea id="desc" maxLength={300} rows={3} value={p.description_libre ?? ""} className="rounded-xl bg-card"
                  placeholder="Une grande fête simple entre amis, dans le jardin de nos parents…"
                  onChange={(e) => sauver({ description_libre: e.target.value }, true)} />
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="shrink-0 border-t border-atelier-filet bg-atelier-fond px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button variant="outline" className="rounded-full flex-1 h-12" disabled={etape === 0} onClick={() => setEtape((e) => e - 1)}>Précédent</Button>
          {derniere
            ? <Button className="rounded-full flex-[1.4] h-12 bg-atelier-or hover:bg-atelier-or/90" onClick={terminer}>Découvrir notre charte</Button>
            : <Button className="rounded-full flex-1 h-12 bg-atelier-or hover:bg-atelier-or/90" onClick={() => setEtape((e) => e + 1)}>Continuer</Button>}
        </div>
      </footer>
    </div>
  );
}
