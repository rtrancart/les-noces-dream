/**
 * JSON-LD builders for LesNoces.net (Phase 9).
 *
 * Pure functions that return schema.org-compliant objects. All URLs are
 * resolved to absolute via `resolveAbsoluteUrl()`. Conditional emission is
 * implemented inside each builder: callers pass the raw data, the builder
 * decides whether/how to emit properties.
 *
 * Render via the <JsonLd> component (uses react-helmet-async so Vercel's
 * prerenderer captures the script tag into the static HTML).
 */

import { resolveAbsoluteUrl } from "./seo";

const SITE_NAME = "LesNoces.net";
const SITE_URL = "https://lesnoces.net";

/* ───────────────────────── Category → @type heuristic ───────────────────── */

/**
 * Catégories mères dont les fiches désignent un établissement physique avec
 * adresse publique → `LocalBusiness`. Toute autre catégorie tombe sur
 * `ProfessionalService` (défaut sûr, n'exige pas d'adresse).
 *
 * Liste arrêtée à partir de l'audit base (parent_id IS NULL, est_active=true).
 */
export const LOCAL_BUSINESS_SLUGS = new Set<string>([
  "lieux-de-reception",
  "hebergements",
  "caviste-domaine-viticole",
]);

export interface ProviderAddressInput {
  ville?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
}

/** Adresse exploitable = ville réelle ET (rue OU code postal). */
export function hasUsableAddress(p: ProviderAddressInput): boolean {
  const ville = (p.ville ?? "").trim();
  if (!ville || ville === "À compléter") return false;
  const adresse = (p.adresse ?? "").trim();
  const cp = (p.code_postal ?? "").trim();
  return Boolean(adresse || cp);
}

/**
 * Choisit `LocalBusiness` uniquement si :
 *   - le slug mère est dans la whitelist
 *   - ET la fiche a une adresse réellement exploitable
 * Sinon retombe sur `ProfessionalService` (jamais d'erreur Google sur address vide).
 */
export function pickProviderType(
  slugMere: string | null | undefined,
  presta: ProviderAddressInput,
): "LocalBusiness" | "ProfessionalService" {
  if (!slugMere) return "ProfessionalService";
  if (!LOCAL_BUSINESS_SLUGS.has(slugMere)) return "ProfessionalService";
  return hasUsableAddress(presta) ? "LocalBusiness" : "ProfessionalService";
}

/* ───────────────────────── Price range formatting ──────────────────────── */

/** Format `priceRange` schema.org. Retourne null si aucun prix renseigné. */
export function formatPriceRange(
  prixDepart: number | null | undefined,
  prixMax: number | null | undefined,
): string | null {
  const min = typeof prixDepart === "number" && prixDepart > 0 ? prixDepart : null;
  const max = typeof prixMax === "number" && prixMax > 0 ? prixMax : null;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `€${min}–€${max}`;
  if (min != null) return `À partir de €${min}`;
  return `Jusqu'à €${max}`;
}

/* ───────────────────────── Sitewide builders ───────────────────────────── */

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og-default.jpg`,
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "fr-FR",
  };
}

/* ───────────────────────── BreadcrumbList ──────────────────────────────── */

export interface BreadcrumbItem {
  name: string;
  /** Path (e.g. "/prestataires/lieux-de-reception") or absolute URL. */
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: resolveAbsoluteUrl(it.url),
    })),
  };
}

/* ───────────────────────── Provider profile ────────────────────────────── */

export interface ProviderJsonLdInput {
  slug: string;
  slugMere: string;
  nom_commercial: string;
  description_courte?: string | null;
  description?: string | null;
  photo_principale_url?: string | null;
  ville?: string | null;
  region?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telephone?: string | null;
  site_web?: string | null;
  prix_depart?: number | null;
  prix_max?: number | null;
  note_moyenne?: number | null;
  nombre_avis?: number | null;
  updated_at?: string | null;
  zones_intervention?: string[] | null;
}

export interface ProviderReviewInput {
  note_globale: number;
  commentaire: string;
  titre?: string | null;
  created_at: string;
  author?: string | null;
}

export function buildProviderJsonLd(
  presta: ProviderJsonLdInput,
  reviews: ProviderReviewInput[] = [],
) {
  const type = pickProviderType(presta.slugMere, presta);
  const url = resolveAbsoluteUrl(`/prestataire/${presta.slug}`);

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: presta.nom_commercial,
    url,
  };

  if (presta.photo_principale_url) {
    out.image = resolveAbsoluteUrl(presta.photo_principale_url);
  }
  const desc = presta.description_courte || presta.description;
  if (desc) out.description = desc;
  if (presta.telephone) out.telephone = presta.telephone;
  if (presta.site_web) {
    out.sameAs = [
      presta.site_web.startsWith("http") ? presta.site_web : `https://${presta.site_web}`,
    ];
  }
  if (presta.region) out.areaServed = presta.region;
  if (presta.updated_at) out.dateModified = presta.updated_at;

  const price = formatPriceRange(presta.prix_depart, presta.prix_max);
  if (price) out.priceRange = price;

  // Address uniquement si LocalBusiness retenu (donc adresse exploitable).
  if (type === "LocalBusiness") {
    const address: Record<string, string> = {
      "@type": "PostalAddress",
      addressCountry: "FR",
    };
    if (presta.adresse?.trim()) address.streetAddress = presta.adresse.trim();
    if (presta.code_postal?.trim()) address.postalCode = presta.code_postal.trim();
    if (presta.ville?.trim()) address.addressLocality = presta.ville.trim();
    if (presta.region?.trim()) address.addressRegion = presta.region.trim();
    out.address = address;

    if (typeof presta.latitude === "number" && typeof presta.longitude === "number") {
      out.geo = {
        "@type": "GeoCoordinates",
        latitude: presta.latitude,
        longitude: presta.longitude,
      };
    }
  }

  if (
    typeof presta.note_moyenne === "number" &&
    typeof presta.nombre_avis === "number" &&
    presta.nombre_avis > 0
  ) {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(presta.note_moyenne.toFixed(1)),
      reviewCount: presta.nombre_avis,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const latestReviews = reviews.slice(0, 3);
  if (latestReviews.length > 0) {
    out.review = latestReviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.note_globale,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.author || "Client vérifié" },
      datePublished: r.created_at,
      ...(r.titre ? { name: r.titre } : {}),
      reviewBody: r.commentaire,
    }));
  }

  return out;
}

/* ───────────────────────── Category list (CollectionPage) ──────────────── */

export interface CategoryListItem {
  name: string;
  slug: string;
  position: number;
}

export function buildCategoryListJsonLd(opts: {
  name: string;
  description: string;
  canonicalPath: string;
  items: CategoryListItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: resolveAbsoluteUrl(opts.canonicalPath),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it) => ({
        "@type": "ListItem",
        position: it.position,
        url: resolveAbsoluteUrl(`/prestataire/${it.slug}`),
        name: it.name,
      })),
    },
  };
}

/* ───────────────────────── Region page (split) ─────────────────────────── */

export function buildRegionWebPageJsonLd(opts: {
  nomRegion: string;
  slugRegion: string;
  description: string;
  noteMoyenne?: number;
  nbAvis?: number;
}) {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Mariage en ${opts.nomRegion}`,
    url: resolveAbsoluteUrl(`/mariage/${opts.slugRegion}`),
    description: opts.description,
    about: {
      "@type": "Place",
      name: opts.nomRegion,
      areaServed: opts.nomRegion,
    },
  };
  if (
    typeof opts.noteMoyenne === "number" &&
    typeof opts.nbAvis === "number" &&
    opts.nbAvis > 0 &&
    opts.noteMoyenne > 0
  ) {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(opts.noteMoyenne.toFixed(1)),
      reviewCount: opts.nbAvis,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return out;
}

export function buildFaqPageJsonLd(faq: { question: string; reponse: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.reponse.replace(/\*\*/g, ""),
      },
    })),
  };
}

/* ───────────────────────── Blog (Article + list) ───────────────────────── */

export interface ArticleJsonLdInput {
  titre: string;
  slug: string;
  extrait?: string | null;
  image_couverture_url?: string | null;
  publie_le?: string | null;
  updated_at?: string | null;
  authorName: string;
}

export function buildArticleJsonLd(a: ArticleJsonLdInput) {
  const url = resolveAbsoluteUrl(`/blog/${a.slug}`);
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titre,
    mainEntityOfPage: url,
    url,
    author: { "@type": "Person", name: a.authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og-default.jpg`,
      },
    },
  };
  if (a.extrait) out.description = a.extrait;
  if (a.image_couverture_url) out.image = resolveAbsoluteUrl(a.image_couverture_url);
  if (a.publie_le) out.datePublished = a.publie_le;
  if (a.updated_at) out.dateModified = a.updated_at;
  return out;
}

export function buildBlogIndexJsonLd(items: { titre: string; slug: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    url: resolveAbsoluteUrl("/blog"),
    name: `${SITE_NAME} — Le Journal`,
    blogPost: items.slice(0, 10).map((a, i) => ({
      "@type": "BlogPosting",
      position: i + 1,
      headline: a.titre,
      url: resolveAbsoluteUrl(`/blog/${a.slug}`),
    })),
  };
}

/* ───────────────────────── Homepage category ItemList ──────────────────── */

export function buildHomeCategoriesJsonLd(
  items: { nom: string; slug: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catégories de prestataires mariage",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: resolveAbsoluteUrl(`/prestataires/${c.slug}`),
      name: c.nom,
    })),
  };
}

/* ───────────────────────── Category FAQ (GEO) ──────────────────────────── */

/**
 * FAQ contextualisées par catégorie mère, pour enrichir les pages
 * /prestataires/<slug>. Le nom de la catégorie est injecté via `{cat}` /
 * `{catLower}`. Si une catégorie n'a pas d'entrée, on n'émet PAS de FAQPage
 * (mieux vaut pas de FAQ qu'une FAQ générique — signal GEO faible).
 */
const CATEGORY_FAQ_MAP: Record<
  string,
  { question: string; reponse: string }[]
> = {
  "lieux-de-reception": [
    {
      question: "Comment choisir son lieu de réception de mariage ?",
      reponse:
        "Définissez d'abord la capacité (nombre d'invités), la région et la saison souhaitée. Visitez plusieurs lieux, vérifiez l'hébergement sur place, les contraintes horaires (musique, fin de soirée) et le traiteur (imposé ou libre). Réservez 12 à 18 mois à l'avance pour un mariage en haute saison.",
    },
    {
      question: "Quel budget prévoir pour un lieu de réception de mariage ?",
      reponse:
        "En France, la location d'un lieu de réception haut de gamme varie généralement entre 4 000 € et 15 000 € pour un mariage de 100 invités, hors traiteur. Les châteaux et domaines exclusifs en Île-de-France ou en Provence dépassent fréquemment 10 000 €.",
    },
    {
      question: "Combien de temps à l'avance réserver un lieu de mariage ?",
      reponse:
        "Pour les samedis de mai à septembre, comptez 12 à 18 mois d'avance pour les lieux prisés. Hors saison ou en semaine, 6 à 9 mois suffisent généralement.",
    },
  ],
  photographes: [
    {
      question: "Comment choisir son photographe de mariage ?",
      reponse:
        "Examinez plusieurs reportages complets (pas seulement le best-of), vérifiez la cohérence du style sur la durée d'une journée, et rencontrez le photographe pour valider le feeling. Confirmez les livrables (nombre de photos retouchées, délai, droits d'usage) avant signature.",
    },
    {
      question: "Quel budget prévoir pour un photographe de mariage haut de gamme ?",
      reponse:
        "Un photographe de mariage professionnel en France facture généralement entre 1 800 € et 4 500 € pour une journée complète. Le haut de gamme (reportage longue durée, second photographe, album) dépasse souvent 5 000 €.",
    },
    {
      question:
        "Quelle est la différence entre un photographe et un vidéaste de mariage ?",
      reponse:
        "Le photographe livre des images fixes (reportage, portraits), le vidéaste un film monté (teaser, film long, son synchronisé). Les deux métiers sont complémentaires et nécessitent du matériel et un savoir-faire distincts. Privilégiez deux professionnels spécialisés plutôt qu'un seul couvrant les deux.",
    },
  ],
  videastes: [
    {
      question: "Pourquoi faire appel à un vidéaste pour son mariage ?",
      reponse:
        "Le film de mariage capture le mouvement, la voix, la musique — des dimensions que la photo ne restitue pas. Un teaser court (2-3 min) se partage facilement, un film long (15-30 min) reste un souvenir intime.",
    },
    {
      question: "Quel budget prévoir pour un vidéaste de mariage ?",
      reponse:
        "Un vidéaste de mariage professionnel facture entre 1 500 € et 4 000 € pour une couverture journée. Les prestations premium (drone, double caméra, montage long) montent à 5 000 € et plus.",
    },
    {
      question: "Faut-il choisir le même prestataire pour photo et vidéo ?",
      reponse:
        "Pas nécessairement. Photographe et vidéaste sont deux métiers distincts. Privilégiez deux spécialistes qui savent travailler ensemble plutôt qu'un généraliste, sauf si un studio propose une équipe dédiée par métier.",
    },
  ],
  traiteurs: [
    {
      question: "Comment choisir son traiteur de mariage ?",
      reponse:
        "Demandez une dégustation avant signature, vérifiez les options de menu (cocktail, dîner, brunch lendemain), le matériel inclus (vaisselle, mobilier, personnel) et la flexibilité sur les régimes spécifiques (végétarien, allergies, casher, halal).",
    },
    {
      question: "Quel budget prévoir pour un traiteur de mariage ?",
      reponse:
        "En France, comptez entre 90 € et 180 € par invité pour une prestation traiteur complète haut de gamme (cocktail, dîner, vin, service). Le très haut de gamme (chef étoilé, produits d'exception) dépasse 250 € par invité.",
    },
    {
      question: "Combien de temps à l'avance réserver un traiteur ?",
      reponse:
        "Réservez votre traiteur 9 à 12 mois avant le mariage, idéalement juste après le lieu de réception. Les traiteurs reconnus sont complets très tôt sur les samedis de haute saison.",
    },
  ],
  fleuristes: [
    {
      question: "Quel budget prévoir pour un fleuriste de mariage ?",
      reponse:
        "Un fleuriste de mariage facture généralement entre 1 200 € et 4 000 € pour une décoration florale complète (bouquet de la mariée, boutonnières, centres de table, cérémonie). Les compositions haut de gamme (arches florales, plafonds suspendus) dépassent 6 000 €.",
    },
    {
      question: "Quand contacter son fleuriste mariage ?",
      reponse:
        "Contactez votre fleuriste 6 à 9 mois avant le mariage, après avoir validé le lieu et la palette de couleurs. Une visite du lieu avec le fleuriste permet d'affiner les volumes et les implantations.",
    },
    {
      question: "Quelles fleurs choisir selon la saison de mariage ?",
      reponse:
        "Privilégiez les fleurs de saison pour la fraîcheur et le budget : pivoines et lilas au printemps, dahlias et roses anglaises en été, dahlias et chrysanthèmes en automne, hellébores et anémones en hiver. Votre fleuriste vous orientera selon la palette souhaitée.",
    },
  ],
  "wedding-planners": [
    {
      question: "À quoi sert un wedding planner ?",
      reponse:
        "Un wedding planner coordonne l'organisation complète du mariage : recherche et négociation des prestataires, gestion du planning, suivi budgétaire, coordination le jour J. Il représente vos intérêts et vous fait gagner un temps considérable.",
    },
    {
      question: "Quel budget prévoir pour un wedding planner ?",
      reponse:
        "Les wedding planners facturent soit au forfait (3 000 € à 10 000 € selon le niveau de prestation), soit en pourcentage du budget mariage (10 à 15 %). La coordination jour J seule est facturée 1 500 € à 3 500 €.",
    },
    {
      question: "Quand engager un wedding planner ?",
      reponse:
        "Engagez votre wedding planner dès le début du projet, idéalement 12 à 18 mois avant le mariage, pour bénéficier de ses recommandations sur le lieu et les prestataires clés. Pour une simple coordination jour J, 3 à 6 mois avant suffisent.",
    },
  ],
  "orchestres-dj": [
    {
      question: "Comment choisir entre un DJ et un orchestre pour son mariage ?",
      reponse:
        "Un DJ offre une grande variété musicale et un budget maîtrisé. Un orchestre apporte une dimension live et théâtrale forte. De nombreux couples combinent les deux : orchestre/groupe pour le cocktail ou le dîner, DJ pour la soirée dansante.",
    },
    {
      question: "Quel budget prévoir pour un DJ de mariage ?",
      reponse:
        "Un DJ professionnel de mariage facture entre 900 € et 2 500 € pour une soirée (matériel son et lumière inclus). Les DJ très demandés ou avec scénographie importante dépassent 3 000 €.",
    },
    {
      question: "Quel budget prévoir pour un orchestre de mariage ?",
      reponse:
        "Un groupe live (3 à 6 musiciens) pour un mariage coûte entre 2 500 € et 6 000 €. Les orchestres haut de gamme (chanteurs, big band, scénographie) montent au-delà de 8 000 €.",
    },
  ],
  decoration: [
    {
      question: "Quel budget prévoir pour la décoration de mariage ?",
      reponse:
        "Une décoratrice de mariage facture entre 1 500 € et 5 000 € pour une scénographie complète (cérémonie, cocktail, dîner, soirée). Le très haut de gamme (mobilier sur mesure, installations XXL) dépasse 10 000 €.",
    },
    {
      question: "Décoratrice ou wedding planner, quelle différence ?",
      reponse:
        "La décoratrice conçoit et installe l'univers visuel du mariage. Le wedding planner orchestre l'ensemble de l'organisation. Les deux métiers sont complémentaires et travaillent souvent en binôme.",
    },
  ],
  "faire-part-papeterie": [
    {
      question: "Quel budget prévoir pour les faire-part de mariage ?",
      reponse:
        "Comptez entre 4 € et 12 € par faire-part haut de gamme (papier texturé, impression letterpress ou dorure, enveloppe doublée). Une suite complète (save-the-date, faire-part, menus, plan de table, livret de messe) représente 800 € à 2 500 € pour 100 invités.",
    },
    {
      question: "Quand envoyer ses faire-part de mariage ?",
      reponse:
        "Envoyez les save-the-date 8 à 12 mois avant le mariage, et les faire-part définitifs 3 à 4 mois avant la date (5 à 6 mois pour un mariage à l'étranger).",
    },
  ],
  "coiffure-maquillage": [
    {
      question: "Quand faire son essai coiffure et maquillage mariage ?",
      reponse:
        "Programmez votre essai coiffure et maquillage 2 à 3 mois avant le mariage, idéalement avec la coiffe ou les accessoires finaux. Photographiez le rendu en lumière naturelle pour valider sereinement.",
    },
    {
      question: "Quel budget prévoir pour la coiffure et le maquillage mariée ?",
      reponse:
        "Comptez entre 250 € et 600 € pour la coiffure et le maquillage de la mariée le jour J (essai inclus). Les prestataires haut de gamme avec déplacement et retouches dépassent 800 €.",
    },
  ],
  "voyages-de-noces": [
    {
      question: "Quand réserver son voyage de noces ?",
      reponse:
        "Réservez votre voyage de noces 6 à 12 mois à l'avance, surtout pour les destinations lointaines en haute saison. Cela laisse le temps de comparer les agences spécialisées et d'optimiser le rapport qualité/prix.",
    },
    {
      question: "Pourquoi passer par une agence pour son voyage de noces ?",
      reponse:
        "Une agence spécialisée voyage de noces sécurise la logistique (vols, transferts, hôtels haut de gamme), négocie les surclassements honeymoon et apporte une assistance 24/7 sur place — précieuse en cas d'imprévu.",
    },
  ],
};

export function buildCategoryFaqJsonLd(
  slugMere: string | null | undefined,
  categoryName: string,
): Record<string, unknown> | null {
  if (!slugMere) return null;
  const tpl = CATEGORY_FAQ_MAP[slugMere];
  if (!tpl || tpl.length === 0) return null;
  const cat = categoryName || "ce métier";
  const catLower = cat.toLowerCase();
  return buildFaqPageJsonLd(
    tpl.map((q) => ({
      question: q.question
        .replace(/\{cat\}/g, cat)
        .replace(/\{catLower\}/g, catLower),
      reponse: q.reponse
        .replace(/\{cat\}/g, cat)
        .replace(/\{catLower\}/g, catLower),
    })),
  );
}

