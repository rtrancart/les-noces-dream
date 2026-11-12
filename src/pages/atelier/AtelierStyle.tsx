import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Questionnaire from "@/components/atelier/style/Questionnaire";
import CharteCouple from "@/components/atelier/style/CharteCouple";
import Monogrammes from "@/components/atelier/style/Monogrammes";
import Inspirations from "@/components/atelier/style/Inspirations";
import { useInfosCouple } from "@/components/atelier/useInfosCouple";
import {
  BUDGETS, FORMALITE, NB_INVITES, PASTILLES, CEREMONIES, ErreurStyle, genererCharte, lireQuotasStyle,
  type CharteMariage, type PhotoInspiration, type Police, type ProfilMariage,
} from "@/lib/notreStyle";
import type { Ornement } from "@/lib/monogramme";

const SOUS_ONGLETS = [{ id: "charte", label: "Charte" }, { id: "monogramme", label: "Monogramme" }, { id: "inspirations", label: "Inspirations" }, { id: "profil", label: "Nos réponses" }] as const;
type SousOnglet = typeof SOUS_ONGLETS[number]["id"];
const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];

export default function AtelierStyle() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const infos = useInfosCouple();
  const [onglet, setOnglet] = useState<SousOnglet>("charte");
  const [questionnaire, setQuestionnaire] = useState<boolean | null>(null);
  const [generation, setGeneration] = useState(false);

  const cle = ["atelier-style", user?.id];
  const { data, isLoading } = useQuery({
    queryKey: cle, enabled: !!user,
    queryFn: async () => {
      const [pm, ch, po, or, ph] = await Promise.all([
        supabase.from("profils_mariage").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("chartes_mariage").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("bibliotheque_polices").select("nom, categorie, usage, fichier_ttf, par_defaut").order("nom"),
        supabase.from("ornements_monogramme").select("id, nom, ambiances").order("ordre"),
        supabase.from("photos_inspiration").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);
      return {
        profil: pm.data as unknown as ProfilMariage | null, chartes: (ch.data ?? []) as unknown as CharteMariage[],
        polices: (po.data ?? []) as Police[], ornements: (or.data ?? []) as Ornement[], photos: (ph.data ?? []) as unknown as PhotoInspiration[],
      };
    },
  });
  const { data: quotas, refetch: relireQuotas } = useQuery({ queryKey: ["atelier-quotas-style", user?.id], enabled: !!user, queryFn: lireQuotasStyle });
  const recharger = () => { qc.invalidateQueries({ queryKey: cle }); qc.invalidateQueries({ queryKey: ["atelier-infos"] }); };

  useEffect(() => { if (data && questionnaire === null) setQuestionnaire(!data.profil?.questionnaire_termine_le); }, [data, questionnaire]);

  const charte = data?.chartes.find((c) => c.active) ?? null;
  const generer = async () => {
    setGeneration(true);
    try { await genererCharte(); setOnglet("charte"); recharger(); }
    catch (e) { toast.error(e instanceof ErreurStyle ? e.message : "La charte n'a pas pu être créée."); }
    finally { setGeneration(false); relireQuotas(); }
  };

  const p = data?.profil;
  const dateCourte = useMemo(() => {
    if (p?.date_mariage) { const [a, m, j] = p.date_mariage.split("-"); return `${j} · ${m} · ${a}`; }
    if (p?.date_mois && p?.date_annee) return `${MOIS[p.date_mois - 1]} ${p.date_annee}`;
    return null;
  }, [p]);

  if (isLoading || !data) return <div className="p-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-atelier-or" /></div>;

  if (questionnaire) {
    return <Questionnaire profil={data.profil} onFermer={() => { setQuestionnaire(false); recharger(); }}
      onTermine={() => { setQuestionnaire(false); recharger(); if (!charte) generer(); }} />;
  }

  const prenom = profile?.prenom?.trim() || "Vos noces";
  const lignes: [string, string][] = p ? ([
    ["Date", infos.dateTexte?.split(" · ")[0] ?? ""],
    ["Lieu", p.lieu_libelle ? `${p.lieu_libelle}${p.departements.length ? ` (${p.departements.length > 4 ? `${p.departements.length} départements` : p.departements.join(", ")})` : ""}` : ""],
    ["Invités", NB_INVITES.find((x) => x.id === p.nb_invites)?.label ?? ""],
    ["Budget", BUDGETS.find((x) => x.id === p.budget_fourchette)?.label ?? ""],
    ["Cérémonie", p.types_ceremonie.map((c) => CEREMONIES.find((x) => x.id === c)?.label).join(", ")],
    ["Ambiances", p.ambiances.join(", ")], ["Cadre", p.cadre ?? ""],
    ["Couleurs aimées", p.couleurs_aimees.map((i) => PASTILLES.find((x) => x.id === i)?.label).join(", ")],
    ["Couleurs à éviter", p.couleurs_evitees.map((i) => PASTILLES.find((x) => x.id === i)?.label).join(", ")],
    ["Matières", p.matieres.join(", ")], ["Formalité", p.formalite ? FORMALITE[p.formalite] : ""], ["En une phrase", p.description_libre ?? ""],
  ] as [string, string][]).filter(([, v]) => v) : [];

  return (
    <div className="px-4 py-5 lg:px-12 lg:py-10 max-w-4xl space-y-5">
      <div>
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">L'Atelier</p>
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mt-1">Notre style</h1>
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0" role="tablist">
        {SOUS_ONGLETS.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}
            className={cn("shrink-0 rounded-full px-4 py-2 font-sans text-sm", onglet === o.id ? "bg-atelier-or text-primary-foreground font-semibold" : "bg-card border border-atelier-filet text-foreground")}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "charte" && (
        <CharteCouple charte={charte} historique={data.chartes} polices={data.polices} photos={data.photos} prenom={prenom}
          dateLieu={infos.dateTexte} restants={quotas?.charte ?? null} generation={generation} onGenerer={generer} onChange={recharger} />
      )}
      {onglet === "monogramme" && (charte
        ? <Monogrammes charte={charte} polices={data.polices} ornements={data.ornements} ambiances={p?.ambiances ?? []}
            initialesDefaut={[prenom.charAt(0).toUpperCase() || "A", ""]} dateCourte={dateCourte} onChange={recharger} />
        : <p className="rounded-2xl border border-atelier-filet bg-card p-6 font-sans text-sm text-muted-foreground">Créez d'abord votre charte : le monogramme reprend ses couleurs.</p>)}
      {onglet === "inspirations" && <Inspirations photos={data.photos} restants={quotas?.vision ?? null} onChange={() => { recharger(); relireQuotas(); }} />}
      {onglet === "profil" && (
        <div className="rounded-2xl border border-atelier-filet bg-card p-5 space-y-4">
          {lignes.length === 0 ? <p className="font-sans text-sm text-muted-foreground">Vous n'avez pas encore répondu au questionnaire.</p> : (
            <dl className="divide-y divide-atelier-filet/60">
              {lignes.map(([k, v]) => <div key={k} className="py-2 grid grid-cols-[8.5rem_1fr] gap-3 font-sans text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></div>)}
            </dl>
          )}
          <Button variant="outline" className="rounded-full gap-2" onClick={() => setQuestionnaire(true)}><Pencil className="h-4 w-4" />Modifier nos réponses</Button>
        </div>
      )}
    </div>
  );
}
