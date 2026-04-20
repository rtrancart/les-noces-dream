import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Shield,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import FavoriButton from "@/components/favoris/FavoriButton";
import FicheGalerie from "@/components/fiche/FicheGalerie";
import FicheAvis from "@/components/fiche/FicheAvis";
import FicheDevisDialog from "@/components/fiche/FicheDevisDialog";
import FicheDevisSidebar from "@/components/fiche/FicheDevisSidebar";
import FicheCarte from "@/components/fiche/FicheCarte";
import FicheStickyMobileCTA from "@/components/fiche/FicheStickyMobileCTA";
import { getCondensedZoneNames } from "@/lib/zonesIntervention";
import ProviderCard, { type ProviderCardData } from "@/components/search/ProviderCard";
import { trackEvent } from "@/lib/analytics";
import { useTrackVisitePrestataire } from "@/hooks/useHistoriqueNavigation";

type Prestataire = {
  id: string;
  nom_commercial: string;
  slug: string;
  description: string | null;
  description_courte: string | null;
  ville: string;
  region: string;
  code_postal: string | null;
  adresse: string | null;
  telephone: string | null;
  email_contact: string | null;
  site_web: string | null;
  photo_principale_url: string | null;
  urls_galerie: string[] | null;
  video_url: string | null;
  note_moyenne: number | null;
  nombre_avis: number | null;
  note_qualite_prestation: number | null;
  note_professionnalisme: number | null;
  note_rapport_qualite_prix: number | null;
  note_flexibilite: number | null;
  prix_depart: number | null;
  prix_max: number | null;
  est_premium: boolean | null;
  est_verifie: boolean | null;
  latitude: number | null;
  longitude: number | null;
  categorie_mere_id: string;
  categorie_fille_id: string | null;
  champs_specifiques: Record<string, unknown> | null;
  zones_intervention: string[] | null;
  tags: string[] | null;
  user_id: string | null;
};

type Categorie = { id: string; nom: string; slug: string };
type Avis = {
  id: string;
  note_globale: number;
  note_qualite_presta: number;
  note_professionnalisme: number;
  note_rapport_qualite_prix: number;
  note_flexibilite: number;
  commentaire: string;
  titre: string | null;
  created_at: string;
  reponse_prestataire: string | null;
};

function formatPrice(prix: number | null) {
  if (!prix) return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(prix);
}

export default function FichePrestataire() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [presta, setPresta] = useState<Prestataire | null>(null);
  const [catMere, setCatMere] = useState<Categorie | null>(null);
  const [catFille, setCatFille] = useState<Categorie | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [champsCategorie, setChampsCategorie] = useState<{ label: string; cle: string; type_champ: string }[]>([]);
  const [similaires, setSimilaires] = useState<ProviderCardData[]>([]);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [devisOpen, setDevisOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useTrackVisitePrestataire(presta?.id);

  const fetchData = async () => {
    if (!slug) return;
    setLoading(true);

    const { data: p, error } = await supabase
      .from("prestataires")
      .select("*")
      .eq("slug", slug)
      .eq("statut", "actif")
      .single();

    if (error || !p) {
      setLoading(false);
      return;
    }

    setPresta(p as unknown as Prestataire);

    // Parallel fetches
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
        .from("prestataires")
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
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  // Track vue_profil
  useEffect(() => {
    if (presta) {
      trackEvent("vue_profil", { slug: presta.slug }, presta.id);
    }
  }, [presta?.id]);

  // SEO
  useEffect(() => {
    if (presta) {
      document.title = `${presta.nom_commercial} — ${catMere?.nom ?? ""} à ${presta.ville} | LesNoces.net`;
    }
  }, [presta, catMere]);

  const revealPhone = () => {
    if (!presta) return;
    setPhoneRevealed(true);
    trackEvent("affichage_telephone", { slug: presta.slug }, presta.id);
  };

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

  const champsSpec = presta.champs_specifiques as Record<string, unknown> | null;

  return (
    <div className="pb-24 md:pb-8">
      {/* Breadcrumb */}
      <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto">
        <Link to="/" className="hover:text-foreground shrink-0">Accueil</Link>
        <ChevronRight size={14} />
        {catMere && (
          <>
            <Link to={`/recherche?categorie=${catMere.id}`} className="hover:text-foreground shrink-0">
              {catMere.nom}
            </Link>
            <ChevronRight size={14} />
          </>
        )}
        <span className="text-foreground font-medium truncate">{presta.nom_commercial}</span>
      </nav>

      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Header info */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
                    {presta.nom_commercial}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {catFille && (
                      <Badge variant="secondary" className="font-sans">{catFille.nom}</Badge>
                    )}
                    {!catFille && catMere && (
                      <Badge variant="secondary" className="font-sans">{catMere.nom}</Badge>
                    )}
                    {presta.est_premium && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-sans">Premium</Badge>
                    )}
                    {presta.est_verifie && (
                      <Badge variant="outline" className="gap-1 font-sans">
                        <Shield size={12} /> Vérifié
                      </Badge>
                    )}
                  </div>
                  </div>
                  <FavoriButton
                    prestataireId={presta.id}
                    size="md"
                    stopPropagation={false}
                  />
                </div>

              {/* Location · rating · price on one line */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>{presta.ville}, {presta.region}</span>
                </div>
                {presta.note_moyenne != null && presta.nombre_avis != null && presta.nombre_avis > 0 && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <a href="#avis" className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Star size={14} className="text-primary fill-primary" />
                      <span className="font-medium text-foreground">{presta.note_moyenne.toFixed(1)}</span>
                      <span>({presta.nombre_avis} avis)</span>
                    </a>
                  </>
                )}
                {(presta.prix_depart || presta.prix_max) && (
                  <span className="text-muted-foreground/40">·</span>
                )}
                {presta.prix_depart && presta.prix_max ? (
                  <span>
                    Entre <span className="font-semibold text-foreground">{formatPrice(presta.prix_depart)}</span> et <span className="font-semibold text-foreground">{formatPrice(presta.prix_max)}</span>
                  </span>
                ) : presta.prix_depart ? (
                  <span>
                    Dès <span className="font-semibold text-foreground">{formatPrice(presta.prix_depart)}</span>
                  </span>
                ) : null}
              </div>

              {/* Zones d'intervention */}
              {(() => {
                const zones = presta.zones_intervention ?? [];
                if (zones.length === 0) return null;
                const cp = presta.code_postal ?? "";
                const deptFromCp = cp.startsWith("20") 
                  ? (parseInt(cp) >= 20200 ? "2B" : "2A") 
                  : cp.slice(0, 2);
                if (zones.length === 1 && zones[0] === deptFromCp) return null;
                const condensed = getCondensedZoneNames(zones);
                if (condensed.length === 0) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <p className="font-sans text-xs font-medium text-accent mb-1.5">
                      Zones d'intervention
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {condensed.map((name) => (
                        <Badge key={name} className="text-xs font-sans bg-accent/10 text-accent border-accent/20 hover:bg-accent/15">{name}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Galerie */}
            <FicheGalerie
              photoUrl={presta.photo_principale_url}
              galerie={presta.urls_galerie ?? []}
              nom={presta.nom_commercial}
            />

            <Separator />

            {/* Description */}
            {presta.description && (
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                  À propos
                </h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {presta.description}
                </p>
              </div>
            )}

            {/* Champs spécifiques */}
            {champsCategorie.length > 0 && champsSpec && (
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                  Services & Prestations
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {champsCategorie.map((ch) => {
                    const val = champsSpec[ch.cle];
                    if (val == null || val === "" || val === false) return null;
                    return (
                      <div key={ch.cle} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground">{ch.label} :</span>
                        <span className="font-medium text-foreground">
                          {typeof val === "boolean" ? "Oui" : String(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags / FAQ */}
            {presta.tags && presta.tags.length > 0 && (
              <div>
                <h3 className="font-sans text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Spécialités
                </h3>
                <div className="flex flex-wrap gap-2">
                  {presta.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="font-sans">{t}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Carte */}
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                Localisation
              </h2>
              <FicheCarte
                latitude={presta.latitude}
                longitude={presta.longitude}
                ville={presta.ville}
                region={presta.region}
              />
            </div>

            <Separator />

            {/* Avis */}
            <FicheAvis
              avis={avis}
              prestataire={presta}
              onAvisAdded={fetchData}
            />
          </div>

          {/* Sidebar desktop */}
          <aside className="hidden md:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto space-y-4">
              <FicheDevisSidebar
                prestataireId={presta.id}
                prestataireName={presta.nom_commercial}
              />

              {/* Téléphone */}
              {presta.telephone && (
                <div>
                  {phoneRevealed ? (
                    <a
                      href={`tel:${presta.telephone.replace(/\s/g, "")}`}
                      className="flex items-center justify-center gap-2 w-full border border-border rounded-lg px-4 py-3 text-sm font-medium hover:bg-secondary/30 transition-colors"
                    >
                      <Phone size={16} />
                      {presta.telephone}
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={revealPhone}
                    >
                      <Eye size={16} />
                      Voir le téléphone
                    </Button>
                  )}
                </div>
              )}

              {/* Site web */}
              {presta.site_web && (
                <a
                  href={presta.site_web.startsWith("http") ? presta.site_web : `https://${presta.site_web}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border border-border rounded-lg px-4 py-3 text-sm font-medium hover:bg-secondary/30 transition-colors"
                >
                  <Globe size={16} />
                  Site web
                </a>
              )}
            </div>
          </aside>
        </div>

        {/* Similaires */}
        {similaires.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
              Prestataires similaires
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {similaires.map((s) => (
                <ProviderCard key={s.id} provider={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky mobile CTA */}
      <FicheStickyMobileCTA
        telephone={presta.telephone}
        prestataireId={presta.id}
        onDevisClick={() => setDevisOpen(true)}
      />

      {/* Devis dialog */}
      <FicheDevisDialog
        open={devisOpen}
        onOpenChange={setDevisOpen}
        prestataireId={presta.id}
        prestataireName={presta.nom_commercial}
      />
    </div>
  );
}
