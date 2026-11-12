# Étape 5 de l'Atelier IA : le Planning

Aucun appel IA, aucun quota, aucun cron, aucun lien Brevo. Toute la logique de génération vit dans la base (déclencheurs), l'interface ne fait que lire et cocher.

## Constat préalable
Les 14 catégories prestataire citées existent toutes à l'identique dans le catalogue. Des sous-catégories plus précises existent aussi (Vidéaste, Robes de mariées, Costume, Wedding Cake, Coiffure). Je garde vos valeurs telles quelles ; on pourra affiner plus tard dans le back-office (le champ est libre).

## 1. Base de données (migration 0021, détail plus bas)
- `modeles_retroplanning` : vos 38 tâches, lisibles par les couples connectés, modifiables par les admins.
- `taches_couple` : les tâches de chaque couple (RLS : le couple seul). Pas de suppression des tâches issues d'un modèle (on masque), suppression possible des tâches personnelles.
- Une fonction `synchroniser_taches_couple(user_id)` fait tout le travail, appelée :
  - après enregistrement du profil quand la date, le mois/année ou les types de cérémonie changent ;
  - après ajout ou modification d'un modèle par un admin (pour tous les couples dont le mariage est dans le futur).
- Règles appliquées par cette fonction :
  - date de référence = date exacte, sinon le 15 du mois choisi ;
  - échéance = date − mois_avant (mois entiers + reste en jours, ex. 0,25 = 7 jours, 0,5 = 15 jours, −1 = 1 mois après) ;
  - « civile » s'applique à tous les couples (la tâche mairie apparaît pour tout le monde) ; « religieuse » et « laïque » seulement si cochées dans le profil ;
  - tâche devenue hors sujet : masquée si non cochée, jamais supprimée, conservée si cochée ; redevenue pertinente : réaffichée ;
  - changement de date : seules les tâches non faites issues d'un modèle sont recalculées, et seulement si le couple n'a pas modifié l'échéance à la main (drapeau `echeance_modifiee`). Tâches cochées et personnelles intactes ;
  - modèle désactivé par un admin : ses tâches non cochées sont masquées.

## 2. Onglet Planning (/atelier/planning, écran 6 de la maquette)
- Barre de progression : faites / actives (non masquées).
- Sections : « À rattraper » (non faites, échéance passée, triées priorité puis échéance d'origine, facultatives repliées dans « N tâches facultatives »), puis frise par mois jusqu'au mariage, puis « Après le mariage ». Les tâches cochées restent à leur place, barrées.
- Chaque tâche : case à cocher, titre, description dépliable, échéance modifiable (sélecteur de date), menu « … » avec Masquer (et Supprimer pour une tâche perso), lien « Tâches masquées (N) » pour les réafficher.
- « Trouver un prestataire » : ouvre l'assistant avec le message propre au modèle (nouveau champ « message pour l'assistant », vos 17 phrases initiales, modifiable dans le back-office), ex. « Nous cherchons un photographe pour notre mariage. »
- « Ouvrir » : Notre style → /atelier/style ; Livret → onglet Livret (encore « Bientôt disponible »).
- « Ajouter une tâche » : titre, date, catégorie (liste des catégories existantes).
- Mariage passé : seule la section « Après le mariage » s'affiche, avec un lien « Voir tout le planning » pour consulter le reste (À rattraper masquée).
- Sans date de mariage : message « Indiquez la date de votre mariage pour obtenir votre planning » + lien vers le questionnaire (étape date).

## 3. Accueil de l'Atelier
Module Planning activé, barre de progression et bloc « À faire ce mois-ci » : 3 tâches maximum, d'abord « À rattraper » puis celles du mois, cochables directement.

## 4. Back-office « Modèles de planning » (/admin/modeles-planning)
Liste triée par ordre, ajout, modification (tous les champs), activation/désactivation, monter/descendre. Chaque enregistrement journalisé dans logs_admin. Pas de suppression (désactivation seulement, pour ne pas casser les tâches des couples).

## 5. Tests à vous montrer (compte couple de test uniquement)
1. Mariage dans 14 mois, laïque : pas de « Contacter la paroisse », « Choisir l'officiant » présent, mairie présente.
2. Mariage dans 5 mois, religieuse : les tâches de 6 à 12 mois sont dans « À rattraper », paroisse présente.
3. Date +2 mois : échéances décalées de 2 mois, une tâche cochée et une tâche perso inchangées (vérifié dans la base avant/après).
4. « Trouver un prestataire » sur « Réserver le photographe » : assistant ouvert, message prérempli.
5. Admin ajoute un modèle : il apparaît chez le couple test.
6. Tests automatiques sur le calcul d'échéance et le tri « À rattraper ».
7. Captures 390 px et ordinateur dans les documents.

## Détails techniques

```sql
CREATE TABLE public.modeles_retroplanning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL, description text,
  categorie text NOT NULL,
  mois_avant numeric(5,2) NOT NULL,
  priorite smallint NOT NULL DEFAULT 2 CHECK (priorite BETWEEN 1 AND 3),
  types_ceremonie text[] NOT NULL DEFAULT '{}'
    CHECK (types_ceremonie <@ ARRAY['civile','religieuse','laique']),
  categorie_prestataire text,
  message_assistant text,
  lien_module text CHECK (lien_module IN ('style','livret')),
  actif boolean NOT NULL DEFAULT true,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.modeles_retroplanning TO authenticated;
GRANT ALL ON public.modeles_retroplanning TO service_role;
GRANT INSERT, UPDATE ON public.modeles_retroplanning TO authenticated;
ALTER TABLE public.modeles_retroplanning ENABLE ROW LEVEL SECURITY;
-- SELECT : authenticated ; INSERT/UPDATE : has_role admin ou super_admin.

CREATE TABLE public.taches_couple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modele_id uuid REFERENCES public.modeles_retroplanning(id),
  titre text NOT NULL CHECK (length(titre) <= 200), description text,
  categorie text NOT NULL, date_echeance date NOT NULL,
  echeance_origine date,          -- pour le tri « À rattraper »
  echeance_modifiee boolean NOT NULL DEFAULT false,
  priorite smallint NOT NULL DEFAULT 2,
  faite boolean NOT NULL DEFAULT false, faite_le timestamptz,
  masquee boolean NOT NULL DEFAULT false,
  masquee_auto boolean NOT NULL DEFAULT false, -- masquée par la synchro, pas par le couple
  perso boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modele_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taches_couple TO authenticated;
GRANT ALL ON public.taches_couple TO service_role;
ALTER TABLE public.taches_couple ENABLE ROW LEVEL SECURITY;
-- SELECT/UPDATE : user_id = auth.uid() ; INSERT : user_id = auth.uid() AND perso AND modele_id IS NULL ;
-- DELETE : user_id = auth.uid() AND perso.
-- Trigger BEFORE UPDATE : le couple ne peut modifier que faite, masquee, date_echeance (→ echeance_modifiee=true),
--   et titre/description/categorie si perso ; faite_le posé/effacé automatiquement ; updated_at.

-- synchroniser_taches_couple(_uid) SECURITY DEFINER : INSERT ... ON CONFLICT (user_id, modele_id),
--   recalcul des échéances, masquage/réaffichage auto (masquee_auto), EXECUTE révoqué à anon/authenticated.
-- Triggers : AFTER INSERT/UPDATE OF date_mariage,date_mois,date_annee,types_ceremonie ON profils_mariage ;
--   AFTER INSERT/UPDATE ON modeles_retroplanning (boucle sur les couples à mariage futur).
-- Seed des 38 modèles (ordre = position dans votre tableau) dans la même migration.
```

- Frontend : `src/lib/planning.ts` (sections, tri, regroupement par mois, fonctions pures testées), `src/pages/atelier/AtelierPlanning.tsx`, composants `src/components/atelier/planning/`, `src/pages/admin/AdminModelesPlanning.tsx` + entrée de menu admin, route `planning` à la place de « Bientôt disponible ».
- Questionnaire : prop d'ouverture directe à l'étape date pour le lien « Indiquez la date ».
- AGENTS.md : règle « les tâches issues des modèles ne sont créées/recalculées que par la synchro en base ».
