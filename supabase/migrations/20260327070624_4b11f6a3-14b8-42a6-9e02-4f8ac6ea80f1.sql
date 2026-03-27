
-- Remove prestataires referencing the old test category
DELETE FROM prestataires WHERE categorie_mere_id = 'ea2f6006-f428-4924-a676-bf437bff859d' OR categorie_fille_id = 'ea2f6006-f428-4924-a676-bf437bff859d';

-- Delete champs_categories referencing old categories
DELETE FROM champs_categories WHERE categorie_id IN (SELECT id FROM categories);

-- Delete existing test categories
DELETE FROM categories;

-- Insert parent categories
INSERT INTO categories (nom, slug, ordre_affichage, est_active) VALUES
('Lieux de réception', 'lieux-de-reception', 1, true),
('Traiteur & Gastronomie', 'traiteur-gastronomie', 2, true),
('Photographe / Vidéaste', 'photographe-videaste', 3, true),
('Fleuriste', 'fleuriste', 4, true),
('Décoration', 'decoration', 5, true),
('Musicien & DJ', 'musicien-dj', 6, true),
('Wedding planner', 'wedding-planner', 7, true),
('Vêtements mariage', 'vetements-mariage', 8, true),
('Beauté', 'beaute', 9, true),
('Animation', 'animation', 10, true),
('Transport & Véhicules', 'transport-vehicules', 11, true),
('Hébergements', 'hebergements', 12, true),
('Location de matériel', 'location-de-materiel', 13, true),
('Bijoux de mariage', 'bijoux-de-mariage', 14, true),
('Faire-parts', 'faire-parts', 15, true),
('Officiant de cérémonie', 'officiant-de-ceremonie', 16, true),
('Barmen', 'barmen', 17, true),
('Caviste / Domaine viticole', 'caviste-domaine-viticole', 18, true),
('Artificier', 'artificier', 19, true),
('Agents de sécurité', 'agents-de-securite', 20, true),
('Service de ménage', 'service-de-menage', 21, true),
('Nounous et Animatrice enfants', 'nounous-et-animatrice-enfants', 22, true);

-- Insert child categories
INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Châteaux', 'lieux-de-reception-chateaux', id, 1, true FROM categories WHERE slug = 'lieux-de-reception'
UNION ALL SELECT 'Manoirs / lieux atypiques', 'lieux-de-reception-manoirs-lieux-atypiques', id, 2, true FROM categories WHERE slug = 'lieux-de-reception';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Pâtissier', 'traiteur-gastronomie-patissier', id, 1, true FROM categories WHERE slug = 'traiteur-gastronomie'
UNION ALL SELECT 'Restaurant / Traiteur', 'traiteur-gastronomie-restaurant-traiteur', id, 2, true FROM categories WHERE slug = 'traiteur-gastronomie'
UNION ALL SELECT 'Wedding Cake', 'traiteur-gastronomie-wedding-cake', id, 3, true FROM categories WHERE slug = 'traiteur-gastronomie';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Photographe', 'photographe-videaste-photographe', id, 1, true FROM categories WHERE slug = 'photographe-videaste'
UNION ALL SELECT 'Vidéaste', 'photographe-videaste-videaste', id, 2, true FROM categories WHERE slug = 'photographe-videaste';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Robes de mariées', 'vetements-mariage-robes-de-mariees', id, 1, true FROM categories WHERE slug = 'vetements-mariage'
UNION ALL SELECT 'Costume', 'vetements-mariage-costume', id, 2, true FROM categories WHERE slug = 'vetements-mariage'
UNION ALL SELECT 'Accessoires', 'vetements-mariage-accessoires', id, 3, true FROM categories WHERE slug = 'vetements-mariage'
UNION ALL SELECT 'Lingerie', 'vetements-mariage-lingerie', id, 4, true FROM categories WHERE slug = 'vetements-mariage';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Coiffure', 'beaute-coiffure', id, 1, true FROM categories WHERE slug = 'beaute'
UNION ALL SELECT 'Institut De Beauté / Maquillage', 'beaute-institut-de-beaute-maquillage', id, 2, true FROM categories WHERE slug = 'beaute';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Animateur', 'animation-animateur', id, 1, true FROM categories WHERE slug = 'animation'
UNION ALL SELECT 'Magicien & illusioniste', 'animation-magicien-illusioniste', id, 2, true FROM categories WHERE slug = 'animation';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Hélicoptères, Calèches, Autres', 'transport-vehicules-helicopteres-caleches-autres', id, 1, true FROM categories WHERE slug = 'transport-vehicules'
UNION ALL SELECT 'Taxi', 'transport-vehicules-taxi', id, 2, true FROM categories WHERE slug = 'transport-vehicules'
UNION ALL SELECT 'Voiture de luxe / de collection', 'transport-vehicules-voiture-de-luxe-de-collection', id, 3, true FROM categories WHERE slug = 'transport-vehicules';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Chambre d''hôtes', 'hebergements-chambre-dhotes', id, 1, true FROM categories WHERE slug = 'hebergements'
UNION ALL SELECT 'Gîte', 'hebergements-gite', id, 2, true FROM categories WHERE slug = 'hebergements'
UNION ALL SELECT 'Hôtel', 'hebergements-hotel', id, 3, true FROM categories WHERE slug = 'hebergements';

INSERT INTO categories (nom, slug, parent_id, ordre_affichage, est_active)
SELECT 'Mobilier et autres', 'location-de-materiel-mobilier-et-autres', id, 1, true FROM categories WHERE slug = 'location-de-materiel'
UNION ALL SELECT 'Son & Lumière', 'location-de-materiel-son-lumiere', id, 2, true FROM categories WHERE slug = 'location-de-materiel';
