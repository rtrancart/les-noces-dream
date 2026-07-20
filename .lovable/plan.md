## Objectif

Remplacer les trois blocs de la coquille email commune (`supabase/functions/_shared/email-shell.ts`) par les nouvelles versions fournies : header sur fond champagne, footer avec mention transactionnelle, signature Nathalie avec pastille ronde.

## Changements

**1. Header (fond champagne #C9AF78)**
- Remplacement du bloc actuel (fond abysse) par la version champagne avec logo centré + baseline en petites capitales + barre de navigation à 3 liens séparés par losanges.
- URL du lien « Trouver un prestataire » : `${SITE_URL}/recherche` (au lieu de `/prestataires`).
- Liens rendus dynamiques via `SITE_URL` (lu depuis `PUBLIC_SITE_URL`) pour cohérence avec le durcissement récent — pas de `lesnoces.net` codé en dur.

**2. Footer (fond abysse #0F141E)**
- Structure conservée, ajout de la ligne « Email transactionnel lié à votre activité sur LesNoces.net. » sous la mention marketplace.
- Padding et interligne alignés sur le HTML fourni (34px 40px 30px, line-height 1.7/1.8).

**3. Signature Nathalie**
- Remplacement de la pastille CSS `<div>N</div>` par un `<img>` circulaire (`border-radius:50%`) 56×56.
- Suppression des blocs email/téléphone et wordmark bas de signature (non présents dans le HTML fourni) — ces coordonnées restent dans le footer commun, plus de redondance.
- Signature « equipe » : inchangée (le HTML fourni couvre uniquement Nathalie).

## Assets images

Le HTML fourni référence deux nouveaux fichiers absents du bucket `email-assets/brand` :
- `logo-ring-gold.png` (header)
- `signature-n-nathalie.png` (signature)

Approche pour éviter des images cassées à l'envoi :
- Ajout de deux nouvelles clés dans `brand-assets.ts` (`ringGold`, `signatureNathalie`) pointant vers `${BASE}/logo-ring-gold.png` et `${BASE}/signature-n-nathalie.png`.
- Vous uploadez ensuite ces deux PNG dans le bucket Storage `email-assets/brand` (même endroit que les logos existants). Tant qu'ils ne sont pas uploadés, les images seront cassées dans l'inbox — je le signalerai clairement à la fin du build.
- Alternative si vous préférez : je peux fallback sur `wordmarkAbysse` (déjà en storage) pour le header et garder la pastille CSS « N » pour la signature. À me dire.

## Fichiers modifiés

- `supabase/functions/_shared/email-shell.ts` — réécriture des fonctions `headerBlock()`, `footerBlock()`, et de la branche `nathalie` de `signatureBlock()`.
- `supabase/functions/_shared/transactional-email-templates/brand-assets.ts` — ajout des 2 nouvelles clés.

## Vérification

- Déploiement de `send-transactional-email` et `admin-email-textes` (la coquille est utilisée par les deux).
- Aperçu depuis l'onglet Emails du back-office (l'iframe combine `shellHead` + corps + `shellFoot`) pour valider visuellement les 3 blocs sur un template au hasard.

## Hors scope

- Signature « equipe » (non fournie) : reste identique.
- Aucune modification des corps de templates ni des textes en DB.
