import { Link } from "react-router-dom";
import { Star, MapPin } from "lucide-react";

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

export default function ProviderCard({ provider }: { provider: ProviderCardData }) {
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
              src={provider.photo_principale_url}
              alt={provider.nom_commercial}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
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
              <span className="font-sans text-xs font-semibold text-sauge">Premium</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-1">
          <h3 className="font-sans text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {provider.nom_commercial}
          </h3>
          <div className="flex items-center gap-1 text-muted-foreground mb-2">
            <MapPin size={12} />
            <span className="font-sans text-xs">{provider.ville}{provider.region ? `, ${provider.region}` : ""}</span>
          </div>
          {provider.description_courte && (
            <p className="font-sans text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-3">
              {provider.description_courte}
            </p>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-1">
              <Star className="text-primary fill-primary" size={14} />
              <span className="font-sans text-sm font-semibold text-foreground">
                {provider.note_moyenne ? provider.note_moyenne.toFixed(1) : "–"}
              </span>
              {provider.nombre_avis != null && provider.nombre_avis > 0 && (
                <span className="font-sans text-xs text-muted-foreground">({provider.nombre_avis})</span>
              )}
            </div>
            {provider.prix_depart && (
              <span className="font-sans text-lg font-semibold text-foreground">
                {formatPrice(provider.prix_depart)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
