import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { trackEvent } from "@/lib/analytics";
import { useTracking } from "@/hooks/useTracking";
import { useTrackVisitePrestataire } from "@/hooks/useHistoriqueNavigation";
import FichePrestataireView, {
  type Prestataire,
  type Categorie,
  type Avis,
  type ChampCategorie,
} from "@/components/fiche/FichePrestataireView";
import type { ProviderCardData } from "@/components/search/ProviderCard";

/**
 * Page publique de la fiche prestataire. Charge une fiche `statut='actif'`
 * via `prestataires_public`, puis délègue tout le rendu à `FichePrestataireView`
 * — le même composant est utilisé pour la prévisualisation (cf.
 * `FichePrestatairePreview`) afin d'éviter toute divergence visuelle.
 */
export default function FichePrestataire() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [presta, setPresta] = useState<Prestataire | null>(null);
  const [catMere, setCatMere] = useState<Categorie | null>(null);
  const [catFille, setCatFille] = useState<Categorie | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [champsCategorie, setChampsCategorie] = useState<ChampCategorie[]>([]);
  const [similaires, setSimilaires] = useState<ProviderCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const { trackViewItem } = useTracking();

  useTrackVisitePrestataire(presta?.id);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);

    const { data: p, error } = await supabase
      .from("prestataires_public")
      .select("*")
      .eq("slug", slug)
      .eq("statut", "actif")
      .single();

    if (error || !p) {
      setLoading(false);
      return;
    }

    setPresta(p as unknown as Prestataire);

    const [catMereRes, catFilleRes, avisRes, champsRes, simRes] = await Promise.all([
      supabase.from("categories").select("id, nom, slug").eq("id", p.categorie_mere_id).single(),
      p.categorie_fille_id
        ? supabase.from("categories").select("id, nom, slug").eq("id", p.categorie_fille_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("avis")
        .select("id, note_globale, note_qualite_presta, note_professionnalisme, note_rapport_qualite_prix, note_flexibilite, commentaire, titre, created_at, reponse_prestataire")
        .eq("prestataire_id", p.id)
        .eq("statut", "valide")
        .order("created_at", { ascending: false }),
      supabase
        .from("champs_categories")
        .select("label, cle, type_champ")
        .eq("categorie_id", p.categorie_mere_id)
        .eq("visible_public", true)
        .order("ordre_affichage"),
      supabase
        .from("prestataires_public")
        .select("id, nom_commercial, slug, description_courte, ville, region, photo_principale_url, note_moyenne, nombre_avis, prix_depart, est_premium")
        .eq("categorie_mere_id", p.categorie_mere_id)
        .eq("statut", "actif")
        .neq("id", p.id)
        .limit(4),
    ]);

    setCatMere(catMereRes.data);
    setCatFille(catFilleRes.data as Categorie | null);
    setAvis((avisRes.data ?? []) as Avis[]);
    setChampsCategorie(champsRes.data ?? []);
    setSimilaires((simRes.data ?? []) as ProviderCardData[]);

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData, user?.id]);

  // Track vue_profil
  useEffect(() => {
    if (presta) {
      trackEvent("vue_profil", { slug: presta.slug }, presta.id);
      trackViewItem(presta.slug, catMere?.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presta?.id, catMere?.slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-[16/9] rounded-xl" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!presta) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-2xl mb-4">Prestataire introuvable</h1>
        <Link to="/recherche" className="text-primary hover:underline">
          Retour à la recherche
        </Link>
      </div>
    );
  }

  return (
    <FichePrestataireView
      presta={presta}
      catMere={catMere}
      catFille={catFille}
      avis={avis}
      champsCategorie={champsCategorie}
      similaires={similaires}
      onAvisRefetch={fetchData}
    />
  );
}
