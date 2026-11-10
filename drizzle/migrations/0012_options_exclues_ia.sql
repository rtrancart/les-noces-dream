ALTER TABLE public.champs_categories ADD COLUMN IF NOT EXISTS options_exclues_ia text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.champs_categories.options_exclues_ia IS 'Options de ce champ jamais envoyées à Claude dans le vocabulaire tags_ia.';
UPDATE public.champs_categories SET options_exclues_ia = ARRAY['Fait appel à un fleuriste'] WHERE cle = 'type_de_fleurs_travaillees';