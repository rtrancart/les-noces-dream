import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ScrollText } from "lucide-react";
import SeoHead from "@/components/SeoHead";
import PublicLayout from "@/components/layout/PublicLayout";

interface ChartVersion {
  id: string;
  numero_version: string;
  titre: string;
  contenu_html: string;
  entree_en_vigueur_le: string;
  archivee_le: string | null;
}

/**
 * /charte-qualite — page publique. Affiche la version active par défaut.
 * Sélecteur de version permet de consulter l'historique (versions archivées).
 */
export default function CharteQualite() {
  const [versions, setVersions] = useState<ChartVersion[]>([]);
  const [current, setCurrent] = useState<ChartVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chartes_versions")
        .select("id, numero_version, titre, contenu_html, entree_en_vigueur_le, archivee_le")
        .order("entree_en_vigueur_le", { ascending: false });

      const list = (data ?? []) as ChartVersion[];
      setVersions(list);

      const requested = params.get("version");
      const selected = requested
        ? list.find((v) => v.numero_version === requested)
        : list.find((v) => !v.archivee_le);
      setCurrent(selected ?? list[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const handleChange = (numero: string) => {
    const v = versions.find((x) => x.numero_version === numero);
    if (v) {
      setCurrent(v);
      const next = new URLSearchParams(params);
      if (v.archivee_le) next.set("version", numero);
      else next.delete("version");
      setParams(next, { replace: true });
    }
  };

  const seoTitle = current
    ? `Charte Qualité v${current.numero_version} | LesNoces.net`
    : "Charte Qualité | LesNoces.net";

  return (
    <>
      <SeoHead
        title={seoTitle}
        description="Charte Qualité des prestataires LesNoces.net : engagements de qualité, transparence et professionnalisme."
        canonicalUrl="/charte-qualite"
      />
      <div className="bg-background py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="text-center space-y-3">
            <ScrollText className="h-10 w-10 text-primary mx-auto" />
            <h1 className="font-serif text-4xl">{current?.titre ?? "Charte Qualité"}</h1>
            {current && (
              <p className="font-sans text-sm text-muted-foreground">
                Version {current.numero_version}{" "}
                {current.archivee_le ? "(archivée)" : "— en vigueur"} — depuis le{" "}
                {new Date(current.entree_en_vigueur_le).toLocaleDateString("fr-FR")}
              </p>
            )}
          </header>

          {versions.length > 1 && (
            <div className="flex justify-end">
              <Select value={current?.numero_version ?? ""} onValueChange={handleChange}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Choisir une version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.numero_version}>
                      v{v.numero_version} {v.archivee_le ? "(archivée)" : "(en vigueur)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Card className="p-6 md:p-10">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : current ? (
              <article
                className="prose prose-sm md:prose-base max-w-none font-sans"
                dangerouslySetInnerHTML={{ __html: current.contenu_html }}
              />
            ) : (
              <p className="text-center text-muted-foreground py-12">
                Aucune Charte publiée pour le moment.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
