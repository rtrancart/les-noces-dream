# Onglet admin « Connecteurs »

Déplacer les trois panneaux techniques (Brevo, Pennylane, Migration photos) hors du tableau de bord, vers une page dédiée accessible en bas du menu latéral admin.

## Ce qui change

- Le tableau de bord retrouve sa vocation : statistiques et activité uniquement.
- Nouvelle page « Connecteurs » avec un titre, une courte description, puis les trois blocs existants dans l'ordre : Brevo, Pennylane, Migration photos (marqué temporaire).
- Nouvelle entrée « Connecteurs » ajoutée tout en bas du menu latéral, sous le groupe « Contenu », avec une icône de type prise/plug.
- Accès réservé aux admins, comme le reste du back-office (route enfant de `/admin`).

## Détails techniques

- Créer `src/pages/admin/Connecteurs.tsx` qui rend `BrevoConnectionPanel`, `PennylaneConnectionPanel` et `MigratePhotosBatchPanel`.
- Retirer ces trois imports et rendus de `src/pages/admin/Dashboard.tsx` (lignes 15-17 et 136-140).
- Ajouter la route `connecteurs` dans le bloc `/admin` de `src/App.tsx`.
- Ajouter un troisième groupe de menu (label « Système ») dans `src/components/admin/AdminSidebar.tsx` avec l'item Connecteurs (`/admin/connecteurs`, icône `Plug`).
