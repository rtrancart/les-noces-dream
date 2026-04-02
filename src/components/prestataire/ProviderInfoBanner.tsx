import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface ProviderInfoBannerProps {
  prestataire: Tables<"prestataires">;
  categoryName?: string;
}

export function ProviderInfoBanner({ prestataire, categoryName }: ProviderInfoBannerProps) {
  // Profile completion
  const profileFields = {
    hasName: !!prestataire.nom_commercial,
    hasCategory: !!prestataire.categorie_mere_id,
    hasLocation: !!prestataire.ville,
    hasDescription: !!prestataire.description,
    hasShortDesc: !!prestataire.description_courte,
    hasPhoto: !!prestataire.photo_principale_url,
    hasGallery: (prestataire.urls_galerie?.length ?? 0) > 0,
    hasPhone: !!prestataire.telephone,
    hasEmail: !!prestataire.email_contact,
    hasWebsite: !!prestataire.site_web,
    hasPriceMin: prestataire.prix_depart != null,
  };

  const completedFields = Object.values(profileFields).filter(Boolean).length;
  const totalFields = Object.keys(profileFields).length;
  const completionRate = Math.round((completedFields / totalFields) * 100);

  const missingFields = [
    { key: "hasShortDesc", label: "Description courte" },
    { key: "hasDescription", label: "Description détaillée" },
    { key: "hasPhoto", label: "Photo principale" },
    { key: "hasGallery", label: "Galerie photos" },
    { key: "hasPhone", label: "Numéro de téléphone" },
    { key: "hasEmail", label: "Email de contact" },
    { key: "hasWebsite", label: "Site web" },
    { key: "hasPriceMin", label: "Tarif de départ" },
  ].filter((f) => !profileFields[f.key as keyof typeof profileFields]);

  const statusLabels: Record<string, string> = {
    actif: "Actif",
    brouillon: "Brouillon",
    en_attente: "En attente",
    a_corriger: "À corriger",
    suspendu: "Suspendu",
    archive: "Archivé",
  };

  const circumference = 2 * Math.PI * 28;

  return (
    <div className="bg-secondary rounded-lg shadow-sm px-6 py-5 md:px-8 md:py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Provider info */}
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="font-serif text-xl md:text-2xl text-foreground">
              {prestataire.nom_commercial}
            </h1>
            {prestataire.est_premium && (
              <span className="px-3 py-0.5 bg-sauge text-white rounded-sm font-sans text-xs uppercase tracking-wide">
                Premium
              </span>
            )}
          </div>
          <p className="font-sans text-sm text-foreground/70">
            {categoryName && <>{categoryName} · </>}
            {prestataire.ville}, {prestataire.region}
          </p>
          <Badge
            className="mt-2"
            variant={prestataire.statut === "actif" ? "default" : "secondary"}
          >
            {statusLabels[prestataire.statut] ?? prestataire.statut}
          </Badge>
        </div>

        {/* Right: Profile completion */}
        <div className="relative group">
          <div className="flex items-center gap-4 cursor-pointer">
            <div className="text-right hidden sm:block">
              <div className="font-serif text-2xl text-foreground">{completionRate}%</div>
              <p className="font-sans text-xs text-muted-foreground">Profil complété</p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="transform -rotate-90 w-16 h-16">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="hsl(var(--foreground) / 0.15)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={`${circumference * (1 - completionRate / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="text-primary" size={20} />
              </div>
            </div>
          </div>

          {/* Hover tooltip */}
          {missingFields.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-lg shadow-xl p-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-primary" size={18} />
                <h4 className="font-sans font-semibold text-foreground text-sm">
                  Champs manquants
                </h4>
              </div>
              <div className="space-y-1.5">
                {missingFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-2 text-sm">
                    <X className="text-destructive flex-shrink-0" size={14} />
                    <span className="font-sans text-muted-foreground">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
