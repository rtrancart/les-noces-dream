import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Shield,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { useTracking } from "@/hooks/useTracking";
import { regionNomToSlug } from "@/lib/regions";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";
import { buildProviderJsonLd, buildBreadcrumbJsonLd } from "@/lib/jsonld";

export type Prestataire = {
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
  updated_at: string | null;
  statut?: string | null;
};

export type Categorie = { id: string; nom: string; slug: string };

export type Avis = {
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

export type ChampCategorie = { label: string; cle: string; type_champ: string };

function formatPrice(prix: number | null) {
  if (!prix) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(prix);
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  pre_inscrit: "Pré-inscrit",
  a_completer: "À compléter",
  en_attente: "En attente",
  a_corriger: "À corriger",
  validee: "Validée",
  actif: "Publié",
  suspendu: "Suspendu",
  resilie_expire: "Résilié",
  archive: "Archivé",
};

interface Props {
  presta: Prestataire;
  catMere: Categorie | null;
  catFille: Categorie | null;
  avis: Avis[];
  champsCategorie: ChampCategorie[];
  similaires: ProviderCardData[];
  previewMode?: boolean;
  onAvisRefetch?: () => void;
}

/**
 * Rendu unique de la fiche prestataire. Utilisé à la fois par la page publique
 * (`FichePrestataire`) et par la page de prévisualisation (`FichePrestatairePreview`)
 * afin que toute évolution du visuel se répercute automatiquement sur la preview.
 *
 * En `previewMode` :
 *  - `SeoHead` en `noindex`, pas de JSON-LD.
 *  - Aucune émission d'événements analytics (affichage_telephone…).
 *  - Bandeau d'avertissement en tête.
 *  - CTA d'action publique (favori, devis, sticky mobile, similaires) masqués.
 */
export default function FichePrestataireView({
  presta,
  catMere,
  catFille,
  avis,
  champsCategorie,
  similaires,
  previewMode = false,
  onAvisRefetch,
}: Props) {
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [devisOpen, setDevisOpen] = useState(false);
  const { trackRevealPhone } = useTracking();

  const revealPhone = () => {
    setPhoneRevealed(true);
    if (!previewMode) {
      trackEvent("affichage_telephone", { slug: presta.slug }, presta.id);
      trackRevealPhone(presta.slug);
    }
  };

  const champsSpec = presta.champs_specifiques as Record<string, unknown> | null;
  const statutLabel = presta.statut ? STATUT_LABELS[presta.statut] ?? presta.statut : null;

  return (
    <div className="pb-24 md:pb-8">
      <SeoHead
        title={
          previewMode
            ? `Prévisualisation — ${presta.nom_commercial} | LesNoces.net`
            : `${presta.nom_commercial} — ${catMere?.nom ?? "Prestataire de mariage"} à ${presta.ville} | LesNoces.net`
        }
        description={
          presta.description_courte ??
          `Découvrez ${presta.nom_commercial}, ${catMere?.nom ?? "prestataire"} à ${presta.ville}. Avis, photos, tarifs et demande de devis sur LesNoces.net.`
        }
        canonicalUrl={
          previewMode
            ? `/prestataire/${presta.slug}/preview`
            : `/prestataire/${presta.slug}`
        }
        imageUrl={presta.photo_principale_url ?? undefined}
        noindex={previewMode}
      />
      {!previewMode && (
        <JsonLd
          schema={[
            buildProviderJsonLd(
              {
                slug: presta.slug,
                slugMere: catMere?.slug ?? "",
                nom_commercial: presta.nom_commercial,
                description_courte: presta.description_courte,
                description: presta.description,
                photo_principale_url: presta.photo_principale_url,
                ville: presta.ville,
                region: presta.region,
                adresse: presta.adresse,
                code_postal: presta.code_postal,
                latitude: presta.latitude,
                longitude: presta.longitude,
                telephone: presta.telephone,
                site_web: presta.site_web,
                prix_depart: presta.prix_depart,
                prix_max: presta.prix_max,
                note_moyenne: presta.note_moyenne,
                nombre_avis: presta.nombre_avis,
                updated_at: presta.updated_at,
                zones_intervention: presta.zones_intervention,
              },
              avis.map((a) => ({
                note_globale: a.note_globale,
                commentaire: a.commentaire,
                titre: a.titre,
                created_at: a.created_at,
              })),
            ),
            buildBreadcrumbJsonLd([
              { name: "Accueil", url: "/" },
              ...(catMere
                ? [{ name: catMere.nom, url: `/prestataires/${catMere.slug}` }]
                : []),
              { name: presta.nom_commercial, url: `/prestataire/${presta.slug}` },
            ]),
          ]}
        />
      )}

      {previewMode && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 text-sm text-amber-900">
            <Eye className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Prévisualisation</span>
              <span className="text-amber-800">
                {" "}— cette fiche n'est pas visible du public
                {statutLabel ? ` (statut : ${statutLabel})` : ""}.
              </span>
            </div>
          </div>
        </div>
      )}

      <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto">
        <Link to="/" className="hover:text-foreground shrink-0">Accueil</Link>
        <ChevronRight size={14} />
        {catMere && (
          <>
            <Link to={`/prestataires/${catMere.slug}`} className="hover:text-foreground shrink-0">
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
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-sans text-or-riche cursor-help">
                          <Shield size={14} className="shrink-0" aria-hidden />
                          <span>Prestataire validé par LesNoces.net</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                        Ce prestataire a été sélectionné et validé manuellement
                        par l'équipe éditoriale LesNoces. Seuls les
                        professionnels du mariage haut de gamme sont référencés
                        sur notre plateforme.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {!previewMode && (
                  <FavoriButton
                    prestataireId={presta.id}
                    size="md"
                    stopPropagation={false}
                  />
                )}
              </div>

              {/* Location · rating · price on one line */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>
                    {presta.ville},{" "}
                    {(() => {
                      const slug = regionNomToSlug(presta.region);
                      return slug ? (
                        <Link to={`/mariage/${slug}`} className="hover:text-or-riche hover:underline">
                          {presta.region}
                        </Link>
                      ) : (
                        <span>{presta.region}</span>
                      );
                    })()}
                  </span>
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

            {/* Tags */}
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
              onAvisAdded={onAvisRefetch ?? (() => {})}
            />
          </div>

          {/* Sidebar desktop */}
          <aside className="hidden md:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto space-y-4">
              {!previewMode && (
                <FicheDevisSidebar
                  prestataireId={presta.id}
                  prestataireName={presta.nom_commercial}
                />
              )}

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

        {/* Similaires — masqués en preview pour éviter des fetches inutiles
            et ne pas polluer l'aperçu avec des fiches réellement publiées. */}
        {!previewMode && similaires.length > 0 && (
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

      {/* Sticky mobile CTA — désactivé en preview */}
      {!previewMode && (
        <FicheStickyMobileCTA
          telephone={presta.telephone}
          prestataireId={presta.id}
          onDevisClick={() => setDevisOpen(true)}
        />
      )}

      {/* Devis dialog — désactivé en preview */}
      {!previewMode && (
        <FicheDevisDialog
          open={devisOpen}
          onOpenChange={setDevisOpen}
          prestataireId={presta.id}
          prestataireName={presta.nom_commercial}
        />
      )}
    </div>
  );
}

export { STATUT_LABELS };
