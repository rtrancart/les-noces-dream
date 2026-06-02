-- Add contenu column to pages_contenu
ALTER TABLE public.pages_contenu ADD COLUMN IF NOT EXISTS contenu text;

-- Insert CGU page
INSERT INTO public.pages_contenu (slug, titre, meta_title, meta_description, est_publiee, contenu)
VALUES (
  'cgu',
  'Conditions Générales d''Utilisation et de Vente',
  'CGU / CGV — LesNoces.net',
  'Conditions générales d''utilisation et de vente de la plateforme LesNoces.net, mise en relation entre futurs mariés et prestataires haut de gamme.',
  true,
$md$# Conditions Générales d'Utilisation et de Vente (CGU/CGV)

## 1. Présentation du site

Le site LesNoces.net (ci-après « le Site ») est une plateforme dédiée à la mise en relation entre particuliers (futurs mariés, organisateurs d'événements privés) et prestataires haut de gamme spécialisés dans l'univers du mariage et des réceptions d'exception.

Le Site est édité par :

- **Forme juridique :** SARL
- **Dénomination sociale :** Lesnoces.net
- **Adresse du siège social :** 74 Launay Guen 22210 PLEMET
- **Capital social :** 2000 €
- **Numéro SIRET / RCS :** 93993179600014
- **Adresse e-mail de contact :** contact@lesnoces.net

---

## 2. Objet

Les présentes Conditions Générales ont pour objet de définir les modalités d'accès et d'utilisation du Site, ainsi que les conditions applicables aux services proposés par LesNoces.net.

Toute utilisation du Site implique l'acceptation pleine et entière des présentes CGU/CGV.

---

## 3. Accès au site

Le Site est librement accessible et gratuit pour tous les internautes.

La consultation des profils de prestataires est possible sans création de compte. Toutefois, certaines fonctionnalités nécessitent la création d'un compte utilisateur, notamment :

- L'ajout de prestataires en favoris
- L'enregistrement de préférences

LesNoces.net se réserve le droit de suspendre, limiter ou interrompre l'accès au Site à tout moment, notamment pour des opérations de maintenance.

---

## 4. Création de compte

La création d'un compte est facultative pour la navigation, mais obligatoire pour accéder à certaines fonctionnalités.

L'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription. Il est seul responsable de la confidentialité de ses identifiants et de l'utilisation de son compte.

LesNoces.net se réserve le droit de refuser ou de supprimer tout compte ne respectant pas les présentes conditions.

---

## 5. Services proposés

LesNoces.net propose notamment :

- La consultation gratuite de profils de prestataires haut de gamme
- La mise en relation entre internautes et prestataires
- La création de comptes utilisateurs
- L'ajout de prestataires en favoris
- Des services de visibilité destinés aux prestataires (le cas échéant)

LesNoces.net agit exclusivement en qualité d'intermédiaire et n'intervient pas dans la conclusion des contrats entre internautes et prestataires.

### 5.1 Obligations des prestataires

Les prestataires référencés sur LesNoces.net s'engagent à :

- Fournir des informations exactes, sincères et à jour
- Répondre aux demandes dans des délais raisonnables
- Offrir des prestations conformes à leur positionnement haut de gamme
- Respecter la charte de qualité LesNoces.net
- Adopter un comportement professionnel, loyal et respectueux

En cas de manquement, LesNoces.net se réserve le droit de suspendre ou supprimer le compte du prestataire, sans préavis ni indemnité.

---

## 6. Conditions financières

Certains services peuvent être proposés à titre payant (abonnements, options de mise en avant, commissions, etc.).

Les prix sont indiqués en euros (€), toutes taxes comprises (TTC), sauf mention contraire. LesNoces.net se réserve le droit de modifier ses tarifs à tout moment.

---

## 7. Paiement

Le paiement s'effectue via les moyens sécurisés proposés sur le Site.

Toute commande est ferme et définitive, sauf dispositions légales contraires.

---

## 8. Droit de rétractation

Conformément à la législation en vigueur, les utilisateurs consommateurs disposent d'un délai de rétractation de 14 jours, sauf exceptions prévues par la loi (services personnalisés, prestations déjà exécutées, etc.).

---

## 9. Obligations des utilisateurs

Les utilisateurs s'engagent à :

- Utiliser le Site de manière conforme à la loi et aux présentes conditions
- Ne pas diffuser de contenus illicites, frauduleux ou diffamatoires
- Respecter les droits des autres utilisateurs et des prestataires

Tout manquement pourra entraîner la suspension ou la suppression du compte.

---

## 10. Responsabilité

LesNoces.net agit exclusivement en tant qu'intermédiaire de mise en relation.

À ce titre, LesNoces.net ne saurait être tenu responsable :

- De la qualité ou de l'exécution des prestations réalisées par les prestataires
- Des relations contractuelles conclues entre les utilisateurs et les prestataires

Toutefois, à titre facultatif, LesNoces.net pourra proposer une médiation amiable en cas de litige, sans que cela n'engage sa responsabilité.

---

## 11. Propriété intellectuelle

L'ensemble des contenus présents sur le Site (textes, images, logos, graphismes, etc.) est protégé par le droit de la propriété intellectuelle.

Toute reproduction ou exploitation non autorisée est strictement interdite.

---

## 12. Données personnelles

Les données personnelles sont traitées conformément à la réglementation en vigueur (RGPD).

Les utilisateurs disposent d'un droit d'accès, de rectification, d'opposition et de suppression de leurs données en contactant : contact@lesnoces.net.

---

## 13. Cookies

Le Site peut utiliser des cookies afin d'améliorer l'expérience utilisateur.

L'utilisateur peut configurer son navigateur pour refuser tout ou partie des cookies.

---

## 14. Résiliation

L'utilisateur peut supprimer son compte à tout moment.

LesNoces.net se réserve le droit de résilier un compte en cas de non-respect des présentes conditions.

---

## 15. Modification des conditions

LesNoces.net se réserve le droit de modifier les présentes CGU/CGV à tout moment.

Les nouvelles conditions entrent en vigueur dès leur mise en ligne.

---

## 16. Droit applicable et juridiction compétente

Les présentes conditions sont régies par le droit français.

En cas de litige, et à défaut de résolution amiable, les tribunaux compétents seront ceux du ressort du siège social de l'éditeur.
$md$
)
ON CONFLICT (slug) DO UPDATE SET
  titre = EXCLUDED.titre,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  est_publiee = EXCLUDED.est_publiee,
  contenu = EXCLUDED.contenu,
  updated_at = now();

-- Insert Mentions légales page
INSERT INTO public.pages_contenu (slug, titre, meta_title, meta_description, est_publiee, contenu)
VALUES (
  'mentions-legales',
  'Mentions légales',
  'Mentions légales — LesNoces.net',
  'Mentions légales de la plateforme LesNoces.net : éditeur, hébergeur, directeur de la publication et informations légales.',
  true,
$md$# Mentions légales

## 1. Éditeur du site

Le site Lesnoces.net est édité par :

- **Dénomination sociale :** Lesnoces.net
- **Forme juridique :** Société à Responsabilité Limitée (SARL)
- **Capital social :** 2000 euros
- **Adresse du siège social :** 74 Launay Guen 22210 PLEMET
- **Numéro SIRET :** 93993179600014
- **Numéro RCS :** Saint Brieuc
- **Numéro de TVA intracommunautaire :** FR65939931796
- **Adresse e-mail :** contact@chateaulaunayguen.com
- **Téléphone :** 02 96 01 00 17

---

## 2. Directeur de la publication

Le directeur de la publication est :

**Cornec Nathalie**, en qualité de gérante de la société.

---

## 3. Hébergement du site

Le site est hébergé par :

- **Nom de l'hébergeur :** OVH
- **Adresse :** 74 Launay Guen 22210 PLEMET
- **Téléphone :** 02 96 01 00 17
- **Site web :** https://lovable.dev

---

## 4. Accès au site

Le site est accessible à tout moment, sauf interruption pour maintenance ou cas de force majeure.

L'éditeur ne saurait être tenu responsable en cas d'indisponibilité du site.

---

## 5. Propriété intellectuelle

L'ensemble des contenus présents sur le site Lesnoces.net (textes, images, graphismes, logo, vidéos, etc.) est protégé par le droit de la propriété intellectuelle.

Toute reproduction, représentation, modification, publication ou adaptation, totale ou partielle, est interdite sans autorisation écrite préalable.

---

## 6. Données personnelles

Les données personnelles collectées sur le site sont traitées conformément à la réglementation en vigueur, notamment le Règlement Général sur la Protection des Données (RGPD).

Les informations collectées sont utilisées uniquement dans le cadre des services proposés par Lesnoces.net.

Les utilisateurs disposent des droits suivants :

- Droit d'accès
- Droit de rectification
- Droit de suppression
- Droit d'opposition

Ces droits peuvent être exercés en contactant : contact@lesnoces.net

---

## 7. Cookies

Le site peut utiliser des cookies afin d'améliorer l'expérience utilisateur et réaliser des statistiques de navigation.

L'utilisateur peut configurer son navigateur pour refuser tout ou partie des cookies.

---

## 8. Responsabilité

Lesnoces.net met tout en œuvre pour fournir des informations fiables.

Toutefois, l'éditeur ne garantit pas l'exactitude, la complétude ou l'actualité des informations diffusées.

Le site Lesnoces.net agit en qualité de plateforme de mise en relation.

À ce titre, il ne saurait être tenu responsable :

- Des informations fournies par les prestataires
- De la qualité des prestations réalisées
- Des relations contractuelles entre utilisateurs et prestataires

---

## 9. Droit applicable

Les présentes mentions légales sont régies par le droit français.

En cas de litige, les tribunaux compétents seront ceux du ressort du siège social de l'éditeur.
$md$
)
ON CONFLICT (slug) DO UPDATE SET
  titre = EXCLUDED.titre,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  est_publiee = EXCLUDED.est_publiee,
  contenu = EXCLUDED.contenu,
  updated_at = now();