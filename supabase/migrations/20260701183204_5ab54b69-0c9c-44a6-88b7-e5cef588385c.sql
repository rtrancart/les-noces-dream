ALTER TABLE public.prestataires
ADD COLUMN representant_prenom text,
ADD COLUMN representant_nom text;

COMMENT ON COLUMN public.prestataires.representant_prenom IS 'Prénom du représentant légal / contact signataire (personne physique), distinct du nom commercial.';
COMMENT ON COLUMN public.prestataires.representant_nom IS 'Nom de famille du représentant légal / contact signataire (personne physique), distinct du nom commercial.';