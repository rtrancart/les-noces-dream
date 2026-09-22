import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CategorieEditorial from "@/components/seo/CategorieEditorial";
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  injecteNombre,
  metaDescriptionAuto,
  metaTitreAuto,
} from "@/lib/categorieLabels";

export interface FaqPaire {
  question: string;
  reponse: string;
}

export interface CategorieSeoForm {
  nom: string;
  nom_singulier: string;
  genre: string;
  seo_intro: string;
  seo_body: string;
  faq: FaqPaire[];
  meta_title: string;
  meta_description: string;
}

const labelCls = "font-sans text-xs uppercase tracking-wider text-muted-foreground";

function Compteur({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.length;
  const ok = n >= min && n <= max;
  return (
    <span
      className={`font-mono text-[11px] ${ok ? "text-muted-foreground" : "text-destructive"}`}
    >
      {n} / {max} caractères (cible {min}–{max})
    </span>
  );
}

/**
 * Bloc d'édition SEO/GEO d'une catégorie (mère ou fille) :
 * accords grammaticaux, réponse d'emblée, conseils markdown, FAQ, metas.
 */
export default function CategorieSeoFields({
  form,
  setForm,
  nbActifs,
  urlPublique,
  derniereModif,
}: {
  form: CategorieSeoForm;
  setForm: (f: CategorieSeoForm) => void;
  nbActifs: number | null;
  urlPublique: string | null;
  derniereModif: string | null;
}) {
  const [apercuIntro, setApercuIntro] = useState(false);
  const [apercuBody, setApercuBody] = useState(false);

  const nb = nbActifs ?? 0;
  const catLabel = {
    nom: form.nom,
    nom_singulier: form.nom_singulier,
    genre: form.genre,
  };
  const metaTitleAuto = metaTitreAuto(catLabel, "France");
  const metaDescAuto = metaDescriptionAuto(catLabel, nb, "France");
  const metaTitleEffectif = form.meta_title.trim() || metaTitleAuto;
  const metaDescEffectif = form.meta_description.trim()
    ? injecteNombre(form.meta_description, nb)
    : metaDescAuto;

  const majFaq = (faq: FaqPaire[]) => setForm({ ...form, faq });

  return (
    <div className="space-y-5 border-t border-border pt-5">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-or-riche">
        Contenu SEO &amp; GEO de la page
      </p>

      {/* Accords grammaticaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelCls}>Nom au singulier *</Label>
          <Input
            value={form.nom_singulier}
            onChange={(e) => setForm({ ...form, nom_singulier: e.target.value })}
            placeholder="ex : lieu de réception"
            className="font-sans"
          />
          <p className="font-sans text-[11px] text-muted-foreground/70">
            Utilisé dans le H1 : « Trouvez votre {form.nom_singulier || "…"} de mariage ».
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>Genre *</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm"
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
          >
            <option value="">— À renseigner —</option>
            <option value="masculin">Masculin</option>
            <option value="feminin">Féminin</option>
          </select>
          <p className="font-sans text-[11px] text-muted-foreground/70">
            Accorde les textes automatiques (« vérifiés » / « vérifiées »).
          </p>
        </div>
      </div>

      {/* Compteur */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="font-sans text-xs text-muted-foreground">
          Prestataires actifs dans cette catégorie :{" "}
          <span className="font-mono text-foreground">{nbActifs ?? "—"}</span> (lecture seule)
        </span>
      </div>

      {/* Réponse d'emblée */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className={labelCls}>Réponse d'emblée (sous le H1)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 font-sans text-xs"
            onClick={() => setApercuIntro((v) => !v)}
          >
            <Eye className="h-3.5 w-3.5" /> {apercuIntro ? "Éditer" : "Aperçu"}
          </Button>
        </div>
        {apercuIntro ? (
          <div className="rounded-md border border-border bg-secondary/40 p-4 font-sans text-sm whitespace-pre-line">
            {injecteNombre(form.seo_intro, nb) || "—"}
          </div>
        ) : (
          <Textarea
            value={form.seo_intro}
            onChange={(e) => setForm({ ...form, seo_intro: e.target.value })}
            rows={5}
            className="font-sans text-sm"
            placeholder="Utilisez {n} pour insérer le nombre réel de prestataires."
          />
        )}
        <p className="font-sans text-[11px] text-muted-foreground/70">
          Le jeton <code className="font-mono">{"{n}"}</code> est remplacé par le nombre réel.
        </p>
      </div>

      {/* Conseils markdown */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className={labelCls}>Conseils « Comment choisir » (markdown)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 font-sans text-xs"
            onClick={() => setApercuBody((v) => !v)}
          >
            <Eye className="h-3.5 w-3.5" /> {apercuBody ? "Éditer" : "Aperçu"}
          </Button>
        </div>
        {apercuBody ? (
          <div className="rounded-md border border-border bg-card p-4">
            {form.seo_body ? <CategorieEditorial source={form.seo_body} /> : "—"}
          </div>
        ) : (
          <Textarea
            value={form.seo_body}
            onChange={(e) => setForm({ ...form, seo_body: e.target.value })}
            rows={12}
            className="font-mono text-xs"
            placeholder={"### Capacité\nDéfinissez le nombre d'invités assis…"}
          />
        )}
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        <Label className={labelCls}>Questions fréquentes</Label>
        {form.faq.length === 0 && (
          <p className="font-sans text-xs text-muted-foreground">
            Aucune question — la section et son balisage FAQ ne seront pas affichés.
          </p>
        )}
        {form.faq.map((q, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">#{i + 1}</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...form.faq];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    majFaq(next);
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === form.faq.length - 1}
                  onClick={() => {
                    const next = [...form.faq];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    majFaq(next);
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => majFaq(form.faq.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Input
              value={q.question}
              onChange={(e) => {
                const next = [...form.faq];
                next[i] = { ...next[i], question: e.target.value };
                majFaq(next);
              }}
              placeholder="Question"
              className="font-sans text-sm"
            />
            <Textarea
              value={q.reponse}
              onChange={(e) => {
                const next = [...form.faq];
                next[i] = { ...next[i], reponse: e.target.value };
                majFaq(next);
              }}
              rows={3}
              placeholder="Réponse"
              className="font-sans text-sm"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 font-sans text-xs"
          onClick={() => majFaq([...form.faq, { question: "", reponse: "" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une question
        </Button>
      </div>

      {/* Metas + aperçu SERP */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className={labelCls}>Titre pour les moteurs (meta title)</Label>
          <Input
            value={form.meta_title}
            onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
            placeholder={metaTitleAuto}
            className="font-sans text-sm"
          />
          <Compteur value={metaTitleEffectif} min={30} max={60} />
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>Description pour les moteurs</Label>
          <Textarea
            value={form.meta_description}
            onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
            rows={3}
            placeholder={metaDescAuto}
            className="font-sans text-sm"
          />
          <Compteur value={metaDescEffectif} min={150} max={160} />
          <p className="font-sans text-[11px] text-muted-foreground/70">
            Champ vidé = retour au texte automatique.
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Aperçu Google
          </p>
          {urlPublique && (
            <p className="font-sans text-xs text-muted-foreground">lesnoces.net{urlPublique}</p>
          )}
          <p className="font-sans text-[#1a0dab] text-base leading-snug">{metaTitleEffectif}</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">{metaDescEffectif}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-muted-foreground">
        {urlPublique && (
          <a
            href={urlPublique}
            target="_blank"
            rel="noreferrer"
            className="text-or-riche hover:underline"
          >
            Voir la page
          </a>
        )}
        {derniereModif && (
          <span>
            Dernière modification :{" "}
            {new Date(derniereModif).toLocaleString("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
