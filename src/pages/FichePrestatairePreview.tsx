import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import FichePrestataireView, {
  type Prestataire,
  type Categorie,
  type Avis,
  type ChampCategorie,
} from "@/components/fiche/FichePrestataireView";

type FetchState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "ok"; presta: Prestataire };

/**
 * Prévisualisation de fiche — accessible à l'admin (n'importe quelle fiche)
 * et au prestataire (uniquement la sienne). L'accès à la fiche non publiée
 * passe exclusivement par la RPC sécurisée `get_prestataire_preview` /
 * `get_prestataire_preview_by_id` : la vue `prestataires_public_all` est
 * inaccessible en direct.
 *
 * Points d'entrée :
 *  - /prestataire/:slug/preview     → RPC par slug (cas nominal)
 *  - /prestataire/id/:id/preview    → RPC par id (fiche sans slug, liens admin)
 */
export default function FichePrestatairePreview() {
  const params = useParams<{ slug?: string; id?: string }>();
  const { session, isLoading: authLoading } = useAuth();

  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [catMere, setCatMere] = useState<Categorie | null>(null);
  const [catFille, setCatFille] = useState<Categorie | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [champsCategorie, setChampsCategorie] = useState<ChampCategorie[]>([]);

  const fetchData = useCallback(async () => {
    if (authLoading) return;
    if (!session) {
      setState({ kind: "forbidden" });
      return;
    }
    setState({ kind: "loading" });

    // Adressage par slug ou par id — les deux RPCs appliquent le même contrôle
    // d'accès (admin | super_admin | propriétaire).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = params.id
      ? await client.rpc("get_prestataire_preview_by_id", { p_id: params.id })
      : await client.rpc("get_prestataire_preview", { p_slug: params.slug ?? "" });

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("forbidden") || msg.includes("not_authenticated") || error.code === "42501") {
        setState({ kind: "forbidden" });
      } else {
        setState({ kind: "not_found" });
      }
      return;
    }

    const row: Prestataire | null = Array.isArray(data) ? (data[0] as Prestataire) : null;
    if (!row) {
      setState({ kind: "not_found" });
      return;
    }

    setState({ kind: "ok", presta: row });

    const [catMereRes, catFilleRes, avisRes, champsRes] = await Promise.all([
      row.categorie_mere_id
        ? supabase.from("categories").select("id, nom, slug").eq("id", row.categorie_mere_id).single()
        : Promise.resolve({ data: null }),
      row.categorie_fille_id
        ? supabase.from("categories").select("id, nom, slug").eq("id", row.categorie_fille_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("avis")
        .select("id, note_globale, note_qualite_presta, note_professionnalisme, note_rapport_qualite_prix, note_flexibilite, commentaire, titre, created_at, reponse_prestataire")
        .eq("prestataire_id", row.id)
        .eq("statut", "valide")
        .order("created_at", { ascending: false }),
      row.categorie_mere_id
        ? supabase
            .from("champs_categories")
            .select("label, cle, type_champ")
            .eq("categorie_id", row.categorie_mere_id)
            .eq("visible_public", true)
            .order("ordre_affichage")
        : Promise.resolve({ data: [] }),
    ]);

    setCatMere((catMereRes.data as Categorie | null) ?? null);
    setCatFille((catFilleRes.data as Categorie | null) ?? null);
    setAvis((avisRes.data ?? []) as Avis[]);
    setChampsCategorie((champsRes.data ?? []) as ChampCategorie[]);
  }, [authLoading, session, params.slug, params.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (authLoading || state.kind === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-[16/9] rounded-xl" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (state.kind === "forbidden") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
        <h1 className="font-serif text-2xl mb-2">Accès refusé</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Vous n'avez pas les droits nécessaires pour prévisualiser cette fiche.
        </p>
        <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-2xl mb-4">Fiche introuvable</h1>
        <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
      </div>
    );
  }

  return (
    <FichePrestataireView
      presta={state.presta}
      catMere={catMere}
      catFille={catFille}
      avis={avis}
      champsCategorie={champsCategorie}
      similaires={[]}
      previewMode
      onAvisRefetch={fetchData}
    />
  );
}
