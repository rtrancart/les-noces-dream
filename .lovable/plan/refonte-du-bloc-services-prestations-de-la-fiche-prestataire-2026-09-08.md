# Refonte du bloc « Services & Prestations » de la fiche prestataire

Direction retenue : **résumé + accordéons**, mobile first, sans bandeau de chiffres clés.

## Ce que verra le visiteur

- Un titre « Services & Prestations ».
- Sur mobile : une liste de blocs dépliables, le premier ouvert par défaut, avec en-tête à pastille ronde + icône + aperçu + chevron. Sur desktop : les mêmes blocs sont affichés comme des sections toujours ouvertes, sans chevron.
- À l'intérieur :
  - les cases à cocher deviennent des lignes à pastille : **oui** (pastille dorée claire + coche) et **non** (pastille grise + tiret, texte atténué et mention « Non ») — les « non » sont désormais affichés ;
  - les listes à choix unique deviennent des lignes intitulé / valeur séparées par un filet fin ;
  - les choix multiples deviennent des puces arrondies ;
  - les champs texte libres restent en paragraphe.
- En bas de section : un bouton pleine largeur « Demander un devis » (il ouvre la fenêtre de devis déjà existante) et la ligne « Réponse habituelle sous 24 h ». Masqué en prévisualisation, comme les autres actions.
- Un champ non renseigné ne s'affiche pas ; un bloc entièrement vide n'est pas rendu.

## Les cinq blocs

Les intitulés enregistrés en base sont par métier. Ils seront redistribués vers cinq blocs fixes, dans cet ordre :

1. **La prestation** — champs du métier (listes, choix multiples, textes).
2. **Inclus & options** — les cases à cocher du métier (oui puis non).
3. **Livraison** — champs dont l'intitulé porte sur les délais, la remise des fichiers, les supports ou les formats.
4. **Organisation** — le groupe « Profil & prestation » (zone, expérience, disponibilité, langues…).
5. **Conditions & garanties** — le groupe « Conditions commerciales » (acompte, échéancier, annulation, paiement).

La répartition est calculée à l'affichage, sans modification de la base ni de l'espace prestataire.

## Détails techniques

- Nouveau composant `src/components/fiche/ServicesPrestations.tsx` : props `champsCategorie`, `champsSpecifiques`, `categorie`, `ville`, `onDevis`, `previewMode`. Utilise l'`Accordion` shadcn en `type="multiple"`.
- Nouveau module `src/lib/servicesPrestations.ts` : types `Field` / `FieldGroup`, mapping `booleen → boolean`, `liste|date|nombre → select`, `multi_choix → multi`, `texte → text`, plus la fonction de répartition dans les cinq blocs (règles sur `groupe` puis sur des mots-clés de `cle`/`label` pour « Livraison ») et la génération des aperçus d'en-tête.
- Tests unitaires Vitest sur `servicesPrestations.ts` : répartition, exclusion des champs vides, conservation des booléens `false`, aperçus.
- `FichePrestataireView.tsx` : remplacement du bloc actuel (lignes ~439-505) par le nouveau composant ; le calcul `groupesChamps` est déplacé dans le module et cesse de filtrer les booléens `false`.
- Aucun jeu de données en dur : tout vient de `champs_categories` (`visible_public = true`) et de `prestataires.champs_specifiques`.
- Design : ombre douce `0 4px 24px -4px hsl(42 62% 40% / .08)` ajoutée comme `shadow-soft` dans `tailwind.config.ts`. Les couleurs restent celles des jetons existants (or, rosé, bleu nuit) — pas de nouvelle palette dans `index.css`, la charte actuelle correspond déjà. Icônes lucide-react, cibles tactiles ≥ 52 px, lisible dès 360 px.

## Hors périmètre

- Pas de bandeau « chiffres clés ».
- Pas de valeur « en option » : les cases restent oui/non, sans changement du référentiel.
- Aucune modification de l'espace prestataire ni de la base de données.
