import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Les 20 fiches de test validées (Atelier IA, étape 1b).
const FICHES_TEST = [
  "0927e594-6401-4045-8ede-7cbffaeffaf7", "0e6ed723-21e9-4d16-b1e1-a2728a01377d", "171e8b1c-0dbc-4961-9e50-b428fbb7bf64",
  "1ad90785-674c-4d7d-9849-b6f31cf1de77", "2f549078-7b5c-4e01-8455-b022322ac706", "30baba9e-0448-4962-a0f2-da0cb8263d21",
  "4fc7e06f-5486-4c0d-b3ef-8c4273550843", "5436be01-8ae1-445a-80dd-cd7260c89626", "5950ba2e-1a80-4ccc-b483-bcdc1e35bf86",
  "5a2458da-927f-40b5-9d85-5f14fe19422b", "61a5ac23-76ce-4c8d-8234-596d1f8224ae", "7fcfb99b-fd46-4693-9839-0a5dcd1507aa",
  "8ad8371a-ec3c-448c-ac4e-d227fd94b69e", "a17f3460-804f-418a-8ed3-20028a04cd82", "a8c6fa8f-fb5b-4938-be6e-47cd1a902dee",
  "b4bd03ca-3888-4cb2-a2ba-212722d83c2c", "bfaf6ca0-33b2-4cbe-b7d1-c3c42baa6337", "d137e08f-80f0-41ae-a76d-faa2918231c1",
  "ef640f95-a21a-4e8d-872b-54b638402eaf", "fc0bd070-c8d4-4e17-a0af-e31b4a0d716c",
];

type Resultat = {
  id: string; nom: string; categorie?: string; extrait?: string; tags_ia?: string[]; tags_rejetes?: unknown[];
  longueur_texte_vectorise?: number; tokens_claude?: [number, number]; tokens_embed?: number;
  duree_claude_ms?: number; duree_embed_ms?: number; sans_contenu?: boolean; erreur?: string; ignore?: string;
};

export default function AdminTagsIA() {
  const [chargement, setChargement] = useState(false);
  const [resultats, setResultats] = useState<Resultat[]>([]);

  const lancer = async () => {
    setChargement(true);
    try {
      const { data, error } = await supabase.functions.invoke("traiter-file-embeddings", { body: { test_ids: FICHES_TEST } });
      if (error) throw error;
      setResultats(data?.resultats ?? []);
      toast.success(`${data?.resultats?.length ?? 0} fiches traitées`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Étiquettes IA</h1>
          <p className="text-sm text-muted-foreground">Génération des étiquettes de style et des vecteurs sur les 20 fiches de test.</p>
        </div>
        <Button onClick={lancer} disabled={chargement}>
          {chargement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tester sur les 20 fiches
        </Button>
      </div>
      {resultats.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead><TableHead>Catégorie</TableHead><TableHead>Extrait</TableHead>
                <TableHead>Étiquettes IA</TableHead><TableHead>Texte vectorisé</TableHead><TableHead>Tokens</TableHead><TableHead>Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultats.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nom}</TableCell>
                  <TableCell className="text-sm">{r.categorie ?? "—"}</TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">{r.extrait || "—"}</TableCell>
                  <TableCell className="max-w-sm">
                    {r.erreur ? <span className="text-sm text-destructive">{r.erreur}</span>
                      : r.ignore ? <span className="text-sm text-muted-foreground">{r.ignore}</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {(r.tags_ia ?? []).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                          {r.sans_contenu && <span className="text-xs text-muted-foreground">Fiche sans contenu</span>}
                          {!!r.tags_rejetes?.length && <span className="w-full text-xs text-destructive">Rejetées : {r.tags_rejetes.join(", ")}</span>}
                        </div>
                      )}
                  </TableCell>
                  <TableCell className="text-sm">{r.longueur_texte_vectorise != null ? `${r.longueur_texte_vectorise} car.` : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.tokens_claude ? <>Claude {r.tokens_claude[0]} / {r.tokens_claude[1]}<br /></> : null}
                    {r.tokens_embed != null ? <>Embed {r.tokens_embed}</> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{(((r.duree_claude_ms ?? 0) + (r.duree_embed_ms ?? 0)) / 1000).toFixed(1)} s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
