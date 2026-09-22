import { Link } from "react-router-dom";
import { Star, MapPin } from "lucide-react";
import FavoriButton from "@/components/favoris/FavoriButton";
import { regionNomToSlug } from "@/lib/regions";
import { getImageUrl } from "@/lib/images";

export interface ProviderCardData {
  id: string;
  nom_commercial: string;
  slug: string;
  description_courte: string | null;
  ville: string;
  region: string;
  photo_principale_url: string | null;
  note_moyenne: number | null;
  nombre_avis: number | null;
  prix_depart: number | null;
  est_premium: boolean;
}

function formatPrice(prix: number | null) {
  if (!prix) return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(prix);
}

export default function ProviderCard({
  provider,
  /** Libellé de catégorie au singulier, utilisé dans l'alt de l'image (SEO). */
  categorieLabel,
}: {
  provider: ProviderCardData;
  categorieLabel?: string | null;
}) {
  const nbAvis = provider.nombre_avis ?? 0;
  const aDesAvis = nbAvis > 0 && provider.note_moyenne != null;
  const altPhoto = [
    provider.nom_commercial,
    categorieLabel ? `${categorieLabel}${provider.ville ? ` à ${provider.ville}` : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      to={`/prestataire/${provider.slug}`}
      className="group block"
    >
      <div className="rounded-xl hover:shadow-elevated transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl mb-3">
          {provider.photo_principale_url ? (
            <img
              src={getImageUrl(provider.photo_principale_url, "thumb")}
              alt={altPhoto}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
              <svg className="w-16 h-16 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="m3 16 5-5c.928-.893 2.072-.893 3 0l5 5" />
                <path d="m14 14 1-1c.928-.893 2.072-.893 3 0l3 3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
              </svg>
            </div>
          )}
          {provider.est_premium && (
            <div className="absolute top-3 left-3 px-3 py-1 bg-card rounded-full shadow-soft">
              <span className="font-sans text-xs font-semibold text-or-riche">Premium</span>
            </div>
          )}
          <FavoriButton
            prestataireId={provider.id}
            className="absolute top-3 right-3"
          />
        </div>

        {/* Info */}
        <div className="px-1">
          <h3 className="font-sans text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {provider.nom_commercial}
          </h3>
          <div className="flex items-center gap-1 text-muted-foreground mb-2">
            <MapPin size={12} />
            <span className="font-sans text-xs">
              {provider.ville}
              {provider.region ? (
                <>
                  {", "}
                  {(() => {
                    const slug = regionNomToSlug(provider.region);
                    return slug ? (
                      <Link
                        to={`/mariage/${slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-or-riche hover:underline"
                      >
                        {provider.region}
                      </Link>
                    ) : (
                      <span>{provider.region}</span>
                    );
                  })()}
                </>
              ) : null}
            </span>
          </div>
          {provider.description_courte && (
            <p className="font-sans text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-3">
              {provider.description_courte}
            </p>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            {aDesAvis ? (
              <div className="flex items-center gap-1">
                <Star className="text-primary fill-primary" size={14} />
                <span className="font-sans text-sm font-semibold text-foreground">
                  {provider.note_moyenne!.toFixed(1)}
                </span>
                <span className="font-sans text-xs text-muted-foreground">
                  ({nbAvis} avis)
                </span>
              </div>
            ) : (
              <span className="font-sans text-[11px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                Nouveau sur LesNoces.net
              </span>
            )}
            {provider.prix_depart && (
              <span className="font-sans text-lg font-semibold text-foreground">
                {formatPrice(provider.prix_depart)}
              </span>
            )}
          </div>
          <span className="mt-3 inline-block font-sans text-sm font-semibold text-primary group-hover:underline">
            Voir la fiche
          </span>
        </div>
      </div>
    </Link>
  );
}
