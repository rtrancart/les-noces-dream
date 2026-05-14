-- ============================================================================
-- LesNoces.net — Seed des pages SEO régionales
-- Table cible : pages_regions_mariage
-- Généré le 2026-05-14
-- ----------------------------------------------------------------------------
-- 13 régions. Île-de-France est publiée (est_publiee=true) ; les autres sont
-- en brouillon (est_publiee=false) pour permettre une publication progressive.
--
-- Champs JSONB :
--   - specificites : [{ titre, texte, couleur_accent }]
--   - conseils     : [{ numero, titre, texte }]
--   - faq          : [{ question, reponse }]
--
-- Idempotent : ON CONFLICT (slug_region) DO UPDATE met à jour le contenu sans
-- toucher aux clés étrangères ni à l'historique.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1. Île-de-France
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'ile-de-france',
  'Île-de-France',
  'Châteaux classés, hôtels particuliers et domaines aux portes de Paris — la région capitale offre un écrin d''exception pour les plus belles unions. Avec la plus forte densité de traiteurs étoilés en France et plus de soixante châteaux disponibles à la privatisation, l''Île-de-France est la région de tous les possibles.',
  '[{"titre":"Châteaux & domaines d''exception","texte":"Plus de soixante châteaux classés accessibles à moins d''une heure de Paris, des bords de Seine aux clairières de Seine-et-Marne, en passant par les domaines historiques des Yvelines.","couleur_accent":"#A57D27"},{"titre":"Traiteurs étoilés & gastronomes","texte":"La plus forte densité de traiteurs haut de gamme en France, avec une offre gastronomique sans équivalent en Europe et plusieurs chefs étoilés accessibles en prestation.","couleur_accent":"#8E4A49"},{"titre":"Accessibilité internationale","texte":"Idéal pour des invités venant du monde entier — CDG et Orly à trente minutes des principaux lieux, TGV depuis toutes les régions françaises, Eurostar depuis Londres et Bruxelles.","couleur_accent":"#2D4356"},{"titre":"Saison étendue dix mois sur douze","texte":"Grâce aux nombreux lieux couverts (orangeries, salons, châteaux chauffés), les mariages sont possibles de mars à décembre, contrairement à beaucoup d''autres régions plus saisonnières.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Réservez douze à dix-huit mois à l''avance","texte":"Les lieux de prestige en Île-de-France affichent complet jusqu''à vingt-quatre mois pour les samedis de juin à septembre. Commencez les visites dès vos fiançailles, et bloquez la date avant tout le reste."},{"numero":"02","titre":"Anticipez la logistique transport","texte":"Pour les domaines hors Paris (Vexin, Seine-et-Marne, vallée de Chevreuse), prévoyez des navettes depuis les gares TGV ou aéroports. De nombreux lieux imposent des horaires de fin de soirée stricts entre vingt-trois heures et une heure du matin pour limiter les nuisances aux riverains."},{"numero":"03","titre":"Budget : comptez quinze à quatre-vingt mille euros","texte":"Les lieux classés seuls coûtent huit à vingt-cinq mille euros pour une journée. Le poste traiteur représente environ quarante pour cent du budget total. Bâtissez votre plan financier dès la sélection du lieu pour éviter les arbitrages douloureux."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Île-de-France ?","reponse":"Le budget moyen d''un mariage haut de gamme en Île-de-France est de trente-deux mille euros selon les données LesNoces 2025. La fourchette va de quinze mille euros pour un mariage intimiste à quatre-vingt mille euros pour un château avec deux cents invités."},{"question":"Quelle est la meilleure saison pour se marier en Île-de-France ?","reponse":"Juin et septembre concentrent à eux seuls la majorité des mariages franciliens. Mai et octobre offrent un bon compromis : météo favorable et tarifs des lieux quinze à vingt pour cent inférieurs aux mois de pointe."},{"question":"Combien de temps à l''avance réserver son lieu en Île-de-France ?","reponse":"Douze à dix-huit mois minimum pour les lieux prisés. Les châteaux classés affichent complet vingt-quatre mois à l''avance sur les samedis de juin et septembre. Pour les lieux les plus exclusifs, il faut souvent envisager deux ans d''anticipation."},{"question":"Comment LesNoces sélectionne-t-il ses prestataires en Île-de-France ?","reponse":"Chaque prestataire est validé manuellement par l''équipe LesNoces avant publication : vérification des références, visite ou dégustation pour les traiteurs, contrôle du portfolio pour les photographes. Aucune fiche n''apparaît sur la marketplace sans avoir franchi cette étape."}]'::jsonb,
  'L''Île-de-France réunit la plus forte densité de prestataires de mariage haut de gamme en France, validés manuellement par LesNoces sur huit départements. Le budget moyen d''un mariage dans la région est de trente-deux mille euros, avec des lieux de réception entre deux mille et vingt-cinq mille euros et un traiteur à cent quarante-cinq euros par personne en moyenne. Les meilleures périodes sont juin et septembre, à réserver douze à dix-huit mois à l''avance. La région offre plus de soixante châteaux disponibles à la privatisation et la plus forte concentration de traiteurs étoilés du pays. Tous les prestataires sont validés manuellement par l''équipe LesNoces avant publication.',
  'Organiser un mariage en Île-de-France, c''est composer avec une équation rare : la plus grande concentration de prestataires haut de gamme du pays, des lieux d''exception à moins d''une heure de la capitale, et une demande qui sature les meilleures dates dix-huit mois avant l''événement. Cette page rassemble ce qu''il faut savoir avant de commencer.

**Les lieux : huit départements, autant d''atmosphères**

L''Île-de-France ne se résume pas à Paris. Chaque département offre un univers distinct. La Seine-et-Marne concentre la plus grande densité de châteaux franciliens — des domaines XVIIᵉ-XVIIIᵉ siècles avec hébergement sur place, parcs à la française, et capacités jusqu''à trois cents convives. Les Yvelines proposent des propriétés équestres et des domaines en lisière de forêt royale, particulièrement prisés pour les mariages champêtres-chic. L''Essonne et la vallée de Chevreuse séduisent les couples qui veulent du caractère sans s''éloigner — moulins reconvertis, fermes-châteaux, abbayes restaurées. Le Val-d''Oise, autour du Vexin, est devenu en quelques années le bon plan des mariés exigeants : qualité architecturale équivalente à la Seine-et-Marne, tarifs vingt pour cent inférieurs.

Paris intra-muros, c''est une autre logique : hôtels particuliers du Marais et du VIIIᵉ, salons de palaces (Bristol, Crillon, Ritz), péniches sur la Seine, rooftops avec vue Tour Eiffel. Comptez en moyenne le double du tarif d''un château équivalent en grande couronne, pour une expérience plus urbaine, souvent plus courte (couvre-feu sonore parisien à vingt-deux heures).

**Saison et calendrier de réservation**

La saison utile va de mai à octobre, avec un pic absolu en juin (45 % des mariages annuels) et septembre (25 %). Mai et octobre, sous-estimés, offrent une lumière exceptionnelle, des tarifs minorés de quinze à vingt pour cent, et une disponibilité réelle des meilleurs prestataires. Mars, avril et novembre sont possibles dans les lieux entièrement couverts (orangeries, châteaux chauffés) — c''est la saison des mariages au feu de cheminée. Décembre se prête aux mariages intimistes en intérieur, avec des décors hivernaux qui ont leur propre élégance.

Le calendrier de réservation est tendu : les samedis de juin et septembre dans les châteaux de référence partent entre dix-huit et vingt-quatre mois à l''avance. Les vendredis et dimanches sont en moyenne vingt-cinq pour cent moins chers, et beaucoup plus disponibles. Si vous êtes flexibles sur le jour, vous pouvez gagner six mois de délai et plusieurs milliers d''euros.

**Gastronomie : un avantage régional unique**

L''Île-de-France abrite plus de cinquante restaurants étoilés, et beaucoup de leurs chefs ont une activité traiteur ou prestation à domicile. Cela permet d''avoir une cuisine d''un niveau introuvable dans la plupart des autres régions, même pour des réceptions hors Paris. Le poste traiteur reste cependant le plus lourd : comptez cent vingt à cent quatre-vingts euros par personne pour un service complet (cocktail, dîner assis, vin, café, mignardises), et jusqu''à deux cent cinquante euros pour les maisons étoilées. Les vins de Bourgogne et Champagne sont les standards locaux ; les vignobles d''Île-de-France (Suresnes, Argenteuil, Montmartre) restent confidentiels mais ajoutent une touche locale appréciée.

**Logistique : ne sous-estimez pas le transport**

Pour les domaines en grande couronne, le transport des invités est un poste budgétaire à part entière. Une navette pour quatre-vingts invités depuis Paris coûte entre huit cents et mille cinq cents euros aller-retour. Les hébergements sur place sont fortement valorisés — un domaine avec vingt chambres permet d''héberger les proches et de prolonger la soirée. Pour les invités venant de l''étranger, privilégiez les lieux à moins de quarante-cinq minutes de Roissy ou Orly : c''est un argument décisif pour des invités américains, britanniques ou suisses.

**Style et tendances déco**

L''esthétique francilienne assume une filiation directe avec la mode et le design contemporain. La tendance dominante est un minimalisme haut de gamme — peu d''éléments, mais chacun irréprochable : nappage immaculé, vaisselle dessinée, verrerie soufflée, menus typographiés. À l''opposé de cette sobriété, les scénographies florales spectaculaires — arches monumentales, plafonds suspendus de fleurs, chemins de table opulents — sont une signature parisienne que les fleuristes de la région exécutent à un niveau rare. Côté lieux, les rooftops avec vue sur les toits de Paris ou la Tour Eiffel se sont imposés ces dernières années comme une alternative urbaine aux châteaux de grande couronne, prisés pour les cocktails et les cérémonies laïques en fin de journée. Les robes sont volontiers modernes, coupées par des créateurs ou des maisons de couture, loin du romantisme traditionnel. Enfin, l''animation artistique — performeurs, musiciens classiques, installations lumineuses, scénographie son et lumière — fait partie du vocabulaire francilien : le mariage parisien se pense comme un véritable événement, jusque dans sa dramaturgie.

**L''esprit d''un mariage francilien**

Un mariage en Île-de-France a sa signature : sobriété élégante, exigence sur les détails, mix entre patrimoine et modernité. Les couples qui choisissent cette région recherchent rarement le pittoresque — ils cherchent une qualité d''exécution sans concession, une scénographie maîtrisée, une cuisine au niveau. C''est aussi la région où le rôle du wedding planner est le plus structurant, parce que la coordination de prestataires multiples (lieu, traiteur, fleuriste, photographe, vidéaste, DJ, hôtesse, hébergement, navettes) atteint vite un niveau de complexité qui dépasse une organisation amateure. Les soixante prestataires environ référencés par LesNoces sur la région ont tous été visités ou rencontrés en personne — c''est ce niveau de filtrage qui distingue une marketplace curatée d''un annuaire généraliste.',
  32000,
  15000,
  80000,
  'Mai, juin, septembre',
  '12 à 18 mois',
  'Mariage en Île-de-France — Prestataires & Conseils | LesNoces.net',
  'Trouvez les meilleurs prestataires de mariage en Île-de-France. Châteaux, traiteurs étoilés, photographes — professionnels validés par LesNoces sur huit départements.',
  true
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 2. Provence-Alpes-Côte d'Azur
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'provence-alpes-cote-d-azur',
  'Provence-Alpes-Côte d''Azur',
  'Mas en pierre, lavandes à perte de vue, lumière dorée de Provence et mer Méditerranée en toile de fond — la région PACA est la destination mariage par excellence en France. Entre les Alpilles, le Luberon, les Calanques et la Côte d''Azur, chaque lieu raconte une histoire unique.',
  '[{"titre":"Mas, bastides & domaines viticoles","texte":"Des mas centenaires du Luberon aux bastides des Alpilles, en passant par les domaines viticoles de Bandol et Cassis, le choix de lieux est exceptionnel et chaque sous-région a son identité propre.","couleur_accent":"#A57D27"},{"titre":"Lumière et décors naturels uniques","texte":"La lumière provençale, les champs de lavande en juin-juillet, les garrigues parfumées et les ocres du Luberon créent des décors photographiques incomparables — chaque album est différent.","couleur_accent":"#8E4A49"},{"titre":"Art de vivre méditerranéen","texte":"Traiteurs spécialisés en cuisine provençale et méditerranéenne, vins locaux d''exception, marchés de producteurs — une gastronomie authentique et raffinée qui fait partie du décor.","couleur_accent":"#2D4356"},{"titre":"Destinations iconiques variées","texte":"Aix-en-Provence, Avignon, Nice, Marseille, Gordes, Les Baux-de-Provence — chaque ville offre une atmosphère et des prestataires distincts, à choisir selon l''esprit du mariage.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Évitez juillet-août pour la chaleur","texte":"Les températures dépassent souvent trente-cinq degrés en plein été, et beaucoup de prestataires sont saturés par le tourisme. Privilégiez avril-juin ou septembre-octobre pour le confort de vos invités, et des prix vingt à trente pour cent plus bas."},{"numero":"02","titre":"Prévoyez l''hébergement à l''avance","texte":"La PACA est la région touristique la plus fréquentée de France. Les hôtels et gîtes sont complets dès le printemps pour les week-ends de juin. Bloquez l''hébergement de vos invités avant même de confirmer le lieu, ou choisissez un domaine avec hébergement intégré."},{"numero":"03","titre":"Intégrez les contraintes du mistral","texte":"Le mistral peut souffler fort même au printemps — jusqu''à quatre-vingts kilomètres heure pendant trois à cinq jours d''affilée. Prévoyez systématiquement une option repli en intérieur pour les cérémonies en plein air, et vérifiez que votre lieu dispose d''un espace couvert de capacité équivalente."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Provence-Alpes-Côte d''Azur ?","reponse":"Le budget moyen d''un mariage en PACA est de vingt-huit mille euros selon les données LesNoces 2025. La fourchette va de douze mille euros pour un mariage champêtre à soixante-quinze mille euros pour un mas luxueux avec vue mer ou un domaine prestigieux du Luberon."},{"question":"Quelle est la meilleure période pour se marier en Provence ?","reponse":"Avril, mai, juin et septembre sont idéaux : lumière magnifique, lavandes en fleur en juin, températures agréables entre vingt et vingt-huit degrés. Évitez juillet-août, où la chaleur et l''affluence touristique dégradent l''expérience."},{"question":"Combien de temps à l''avance réserver un mas ou un domaine en PACA ?","reponse":"Douze à vingt-quatre mois minimum pour les mas et bastides prisés. Les domaines viticoles des Alpilles et du Luberon sont souvent complets dix-huit mois à l''avance pour les samedis de printemps. Pour les lieux les plus exclusifs, deux ans d''anticipation est devenu la norme."},{"question":"Peut-on organiser un mariage en extérieur toute l''année en Provence ?","reponse":"Non. Le mistral et les pluies d''automne imposent une solution de repli en intérieur systématique. Les lieux dotés d''une salle de réception couverte de capacité équivalente à l''espace extérieur sont à privilégier sans exception."}]'::jsonb,
  'La Provence-Alpes-Côte d''Azur compte parmi les destinations mariage les plus prisées de France, avec des prestataires haut de gamme validés par LesNoces sur l''ensemble du territoire. Le budget moyen d''un mariage en PACA est de vingt-huit mille euros, avec une fourchette de douze à soixante-quinze mille euros. Les meilleures périodes sont avril, mai, juin et septembre, à réserver douze à vingt-quatre mois à l''avance. La région offre une diversité de lieux incomparable : mas provençaux, bastides, domaines viticoles, villas avec vue mer. Tous les prestataires LesNoces sont validés manuellement avant publication.',
  'Se marier en Provence ou sur la Côte d''Azur, c''est rejoindre l''imaginaire collectif du mariage à la française — celui que les magazines anglo-saxons et les couples étrangers viennent chercher chaque été. Mais derrière la carte postale, l''organisation d''un mariage en PACA obéit à des règles précises, particulièrement strictes sur deux points : la saisonnalité et le climat.

**Comprendre les cinq Provence**

La région PACA n''est pas un bloc homogène. Le Luberon (Vaucluse) — Gordes, Bonnieux, Roussillon — propose des mas restaurés en pierre dorée, des paysages d''oliveraies et de vignes, une intimité préservée. C''est l''esprit "Peter Mayle", celui des couples qui veulent un mariage de trois jours en immersion. Les Alpilles (Bouches-du-Rhône) — Saint-Rémy, Eygalières, Les Baux — concentrent les domaines viticoles les plus prestigieux et les bastides aristocratiques, à trente minutes d''Avignon. Le pays d''Aix offre les bastides XVIIIᵉ-XIXᵉ siècles, plus proches de l''aéroport de Marseille, idéales pour les invités internationaux. La Côte d''Azur (Cannes, Nice, Saint-Jean-Cap-Ferrat) joue la carte de la villa Belle Époque avec vue mer, à des budgets sensiblement supérieurs. Et le Var (Lorgues, Bandol, presqu''île de Saint-Tropez) propose un compromis entre arrière-pays provençal et accès mer, avec une scène viticole AOP très active.

**Choisir sa fenêtre de tir**

La saison utile en PACA s''étend de fin avril à mi-octobre, avec deux interdits absolus : juillet et août. Pourquoi ? D''abord la chaleur — trente-cinq à quarante degrés à l''ombre régulièrement, ce qui rend les cérémonies en extérieur insupportables et compromet la conservation des fleurs, du buffet, du gâteau. Ensuite l''affluence touristique : les meilleurs traiteurs sont saturés par leur clientèle estivale (yachts, villas privées), les routes sont engorgées, l''hébergement des invités devient un casse-tête et coûte le double. Les couples avisés visent mai-juin (lavande, températures parfaites, lumière) ou septembre (vendanges, ambiance dorée). Octobre reste possible mais le risque de pluie augmente fortement après le quinze.

**Le mistral, ce paramètre qu''on oublie**

Le mistral souffle deux cents jours par an dans la vallée du Rhône, parfois jusqu''à quatre-vingts ou cent kilomètres heure pendant trois à cinq jours d''affilée. C''est le paramètre que les couples parisiens ou étrangers sous-estiment systématiquement. Concrètement : il rend une cérémonie en extérieur impossible (cheveux, voiles, décor floral, sono), il abîme les dressages de table, il refroidit nettement les températures du soir. La bonne pratique : choisir un lieu doté d''une salle couverte de capacité équivalente à l''espace extérieur, vérifier l''orientation des bâtiments (un mas orienté nord-sud est protégé), et prévoir des plaids légers pour la soirée même en juin.

**Gastronomie : un terroir cohérent**

L''avantage d''un mariage en PACA, c''est la cohérence du terroir avec le décor. Les traiteurs locaux ont une vraie identité — cuisine méditerranéenne, accents italiens et nord-africains, place importante des produits de la mer (Marseille, Bandol). Comptez quatre-vingt-dix à cent soixante euros par personne pour un service traiteur complet. Les vins locaux (Bandol, Cassis, Châteauneuf-du-Pape, Côtes-de-Provence rosés) sont les standards, souvent inclus dans les formules des domaines viticoles qui font lieu et traiteur. Le marché aux fleurs d''Hyères, les producteurs de lavande de Sault, les huiles d''olive AOP de la vallée des Baux sont autant de signatures locales à intégrer.

**Logistique et hébergement**

L''aéroport de Marseille-Provence, à proximité d''Aix et des Alpilles, est le plus pratique pour les invités internationaux. Avignon-TGV est le hub naturel pour les invités français — deux heures quarante depuis Paris. Pour les domaines isolés du Luberon ou du Var, prévoyez impérativement des navettes : la conduite locale en soirée est difficile, et beaucoup de routes ne sont pas éclairées. Les domaines avec hébergement intégré (vingt à cinquante chambres) sont devenus la norme pour les mariages haut de gamme — ils résolvent l''hébergement, simplifient les navettes et permettent un week-end de trois jours, ce qui correspond à l''usage anglo-saxon de plus en plus adopté en France.

**Style et tendances déco**

L''esthétique provençale repose sur une palette devenue iconique : blanc cassé, terracotta, beige sable, vert olive — des teintes empruntées au paysage lui-même, à la pierre, à la terre cuite et au feuillage des oliviers. La grammaire décorative privilégie les longues tables conviviales en bois brut, dressées sans nappe, ponctuées de compositions de fleurs méditerranéennes et d''herbes aromatiques : lavande, romarin, immortelle, eucalyptus, branches d''olivier. Le moment-clé reste la réception au coucher du soleil, quand la lumière dorée enveloppe les tablées et que les guirlandes lumineuses s''allument dans les arbres. Côté animation, la Provence a fait de la gastronomie un spectacle : bars à cocktails signature, ateliers culinaires en direct, stands de producteurs, dégustations d''huiles d''olive ou de rosés locaux — autant d''expériences immersives qui prolongent le repas et ancrent le mariage dans le terroir. C''est une esthétique de la simplicité travaillée, que les prestataires de la région maîtrisent sans tomber dans le cliché.

**L''esprit d''un mariage provençal**

Un mariage en PACA réussi joue sur la simplicité travaillée — du bois brut, des fleurs des champs (lavande, romarin, oliviers en pot), une table en bois sans nappe, de la vaisselle vintage. C''est l''inverse du faste francilien. L''esthétique dominante est celle du "slow wedding" : repas en plein air à la tombée du jour, lumières filantes dans les oliviers, fin de soirée au feu de bois. Les prestataires locaux ont intégré cette grammaire visuelle et savent l''exécuter sans tomber dans le cliché.',
  28000,
  12000,
  75000,
  'Avril, mai, juin, septembre',
  '12 à 24 mois',
  'Mariage en Provence-Alpes-Côte d''Azur — Prestataires & Conseils | LesNoces.net',
  'Organisez un mariage de rêve en PACA. Mas provençaux, domaines viticoles, vue mer — découvrez nos prestataires validés en Provence et sur la Côte d''Azur.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 3. Nouvelle-Aquitaine
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'nouvelle-aquitaine',
  'Nouvelle-Aquitaine',
  'Entre les vignobles de Bordeaux, les plages de l''Atlantique, les forêts des Landes et les Pyrénées en toile de fond, la Nouvelle-Aquitaine est la plus grande région de France et l''une des plus belles pour un mariage. Un art de vivre raffiné, des vins d''exception et des paysages à couper le souffle.',
  '[{"titre":"Vignobles & châteaux bordelais","texte":"Le Médoc, Saint-Émilion et Pomerol offrent des châteaux viticoles d''exception pour un mariage avec accord mets-vins inégalé et une architecture remarquable, souvent classée monument historique.","couleur_accent":"#A57D27"},{"titre":"Diversité des paysages","texte":"Océan Atlantique, forêt des Landes, Dordogne préhistorique, Pays Basque esprit surf — la région offre une palette de décors naturels unique en France, à choisir selon l''esprit recherché.","couleur_accent":"#8E4A49"},{"titre":"Gastronomie & vins de renom","texte":"Bordeaux, Bergerac, Cahors, Jurançon — les vins locaux et la gastronomie du Sud-Ouest (foie gras, truffes, huîtres du Bassin d''Arcachon, agneau de Pauillac) sont un atout différenciant majeur.","couleur_accent":"#2D4356"},{"titre":"Prix plus accessibles que Paris","texte":"À qualité équivalente, les lieux et traiteurs de Nouvelle-Aquitaine coûtent trente à quarante pour cent moins cher qu''en Île-de-France, pour un résultat souvent plus authentique et personnel.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Réservez dès dix mois à l''avance","texte":"Les châteaux du Médoc et de Saint-Émilion sont très demandés de mai à octobre. Dix à quatorze mois à l''avance suffisent généralement, sauf pour les domaines les plus prestigieux et les grands crus classés qui imposent dix-huit mois minimum."},{"numero":"02","titre":"Anticipez les week-ends de vendanges","texte":"Septembre et octobre sont magnifiques mais coïncident avec les vendanges dans les châteaux viticoles. Certains domaines refusent les mariages durant cette période (deuxième quinzaine de septembre et première d''octobre) pour ne pas perturber les équipes — vérifiez systématiquement avant de signer."},{"numero":"03","titre":"Profitez des prestataires locaux","texte":"La région regorge d''artisans d''exception : producteurs d''huîtres d''Arcachon, vignerons indépendants, fromagers des Pyrénées, charcutiers basques. Intégrez-les dans votre cocktail ou votre buffet pour une expérience cent pour cent terroir et des économies substantielles."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Nouvelle-Aquitaine ?","reponse":"Le budget moyen est de vingt-deux mille euros selon les données LesNoces. La fourchette va de neuf mille euros pour un mariage champêtre dans les Landes à cinquante-cinq mille euros pour un château du Médoc avec cent cinquante invités et accord avec un grand cru."},{"question":"Peut-on se marier dans un château viticole en Nouvelle-Aquitaine ?","reponse":"Oui, c''est l''une des spécialités de la région. Plusieurs châteaux des appellations Saint-Émilion, Pomerol et Médoc proposent des formules mariage incluant la dégustation et la visite des chais. Comptez huit à vingt mille euros pour la location du lieu seul, hors restauration et vins."},{"question":"Quelle est la meilleure période pour se marier en Nouvelle-Aquitaine ?","reponse":"Mai, juin et septembre sont idéaux. Octobre peut être très beau mais les journées raccourcissent et la météo se dégrade après le quinze. Évitez juillet-août sur la côte atlantique : foule touristique, prix élevés à Arcachon et Biarritz, disponibilité réduite des prestataires."},{"question":"Les prestataires du Pays Basque sont-ils référencés sur LesNoces ?","reponse":"Oui — LesNoces référence des prestataires dans toute la Nouvelle-Aquitaine, y compris Bayonne, Biarritz, Saint-Jean-de-Luz et l''ensemble du Pays Basque français, qui a son identité propre (architecture rouge et blanche, gastronomie basque, musique chorale)."}]'::jsonb,
  'La Nouvelle-Aquitaine propose une offre mariage d''exception entre vignobles bordelais, plages atlantiques et Pyrénées. Le budget moyen d''un mariage dans la région est de vingt-deux mille euros selon LesNoces, avec une fourchette de neuf à cinquante-cinq mille euros. Les meilleures périodes sont mai, juin, septembre et octobre, à réserver dix à quatorze mois à l''avance. La région se distingue par ses châteaux viticoles de Saint-Émilion et du Médoc, sa gastronomie Sud-Ouest et ses prix trente à quarante pour cent plus accessibles qu''en Île-de-France. Tous les prestataires sont validés manuellement par LesNoces.',
  'La Nouvelle-Aquitaine est, en surface, la plus grande région française — autant qu''un petit pays. Cette étendue se traduit par une diversité de cadres de mariage que peu de régions peuvent égaler : le tout-vignoble bordelais d''un côté, l''Atlantique sauvage et le surf de l''autre, la Dordogne médiévale au centre, les Pyrénées et le Pays Basque au sud. Pour les couples qui ont une idée précise du décor recherché, c''est probablement la région qui offre le plus large éventail de réponses.

**Cinq territoires, cinq esprits**

La Gironde est le poids lourd : les vignobles du Médoc, de Saint-Émilion, de Pomerol et des Graves concentrent la plus haute densité de châteaux viticoles privatisables en France. Beaucoup sont des grands crus classés ouverts à la commercialisation événementielle — un cadre architectural exceptionnel doublé d''une cohérence terroir parfaite (vous servez le vin du domaine où vous vous mariez). La Dordogne propose une autre Nouvelle-Aquitaine : bastides médiévales, châteaux Renaissance dans la vallée de la Dordogne, manoirs en pierre dorée du Périgord noir. Les budgets y sont sensiblement plus accessibles que dans le Bordelais. Les Landes, c''est la nature : pinèdes immenses, plages atlantiques sauvages, domaines forestiers et lieux contemporains au cœur des bois — un cadre idéal pour les couples qui veulent du bois, du sable et du minimalisme scandinave. Le Pays Basque, autour de Biarritz et Saint-Jean-de-Luz, joue la carte de l''Atlantique chic : villas Belle Époque, fronton de pelote, gastronomie basque, ambiance "old money". Et enfin l''arrière-pays Lot-et-Garonne et Charente offre les meilleures bonnes affaires de la région : manoirs, fermes restaurées, domaines équestres à des tarifs trente à quarante pour cent inférieurs au Bordelais.

**Le calendrier viticole**

La spécificité de la Nouvelle-Aquitaine, c''est que la saison des mariages se télescope avec la saison des vendanges dans les zones viticoles. De fin août à mi-octobre, les châteaux les plus prestigieux sont mobilisés sur la récolte et refusent les mariages — ou les acceptent avec des conditions strictes (pas d''accès aux chais, équipe technique mobilisée). Pour les couples qui rêvent d''un mariage "en vendanges", certains domaines de second cru du Médoc ou du Libournais offrent l''expérience : déambulation dans les rangs de vigne au moment de la cueillette, ambiance dorée des feuillages, soirée dans les chais en activité. C''est rare, magique, mais à anticiper deux ans à l''avance.

**Saison et météo**

L''avantage climatique de la région : un climat doux, peu de jours de pluie en saison, peu de vent violent (sauf bord atlantique). De mai à octobre, vous pouvez raisonnablement organiser une cérémonie en extérieur sans angoisse météo, avec une simple précaution de repli. Juillet-août sont possibles mais ce sont les mois où la côte atlantique sature de touristes — réservez les hébergements pour vos invités au moins six mois à l''avance, ou choisissez l''arrière-pays. Septembre est probablement le mois optimal de la région : températures parfaites (vingt-trois degrés en moyenne), lumière dorée, vendanges, beaucoup moins de monde.

**Gastronomie : un terrain d''exception**

Le Sud-Ouest est sans doute le terroir gastronomique le plus riche de France en variété — foie gras, magret, confit, agneau de Pauillac, huîtres d''Arcachon, fromages des Pyrénées (brebis ossau-iraty), pruneaux d''Agen, vins de Bordeaux et de Bergerac. Les traiteurs locaux exploitent ce terrain avec des menus qui peuvent légitimement rivaliser avec n''importe quelle table étoilée parisienne, à des tarifs inférieurs : comptez quatre-vingts à cent quarante euros par personne pour un service complet. La cohérence terroir avec le décor (mariage dans un château bordelais avec son propre vin, son producteur d''huîtres voisin) est un argument que les invités retiennent durablement.

**Logistique : prévoyez les distances**

La taille de la région impose un calcul logistique. Bordeaux dispose d''un aéroport international et d''une gare TGV à deux heures de Paris — idéal pour les invités. Mais un mariage en Dordogne intérieure ou dans les Landes peut imposer deux heures de voiture supplémentaires. Pour le Pays Basque, l''aéroport de Biarritz et la gare de Bayonne sont les hubs naturels. Si vos invités viennent de l''étranger, restez dans un rayon de soixante kilomètres autour d''un de ces trois points d''accès.

**Style et tendances déco**

Le style néo-aquitain se décline selon le décor. Sur le littoral — Bassin d''Arcachon, côte landaise, plages basques — la tendance est au bohème chic sophistiqué : cérémonies pieds dans le sable, arches en bois flotté, décoration naturelle de pampa, de fleurs séchées et de lin lavé, palette de sable, d''écru et de bleu délavé. Le Bassin d''Arcachon, avec ses cabanes ostréicoles et la dune du Pilat en toile de fond, s''est imposé en quelques années comme une destination de mariage à part entière. Dans le Bordelais viticole, le registre est plus classique — élégance des chais, art de la table soigné, accords mets-vins mis en scène. Le Pays basque, lui, cultive une ambiance résolument festive : grands week-ends de mariage, musique live, bandas et chœurs basques, gastronomie généreuse et tablées qui s''étirent tard dans la nuit. C''est une région où le style suit le paysage, et où les prestataires savent passer du raffinement viticole à la décontraction balnéaire.

**L''esprit d''un mariage néo-aquitain**

Le mariage de la région se caractérise par une certaine décontraction élégante — plus de "art de vivre" que de "savoir-vivre", plus de table conviviale que de protocole. Les invités mangent bien, boivent bien, et restent. Les mariages de deux ou trois jours sont devenus la norme dans les châteaux qui offrent l''hébergement, avec souvent un brunch champêtre le lendemain. C''est l''esprit "vacances avec les gens qu''on aime", très éloigné du protocole francilien et plus proche de l''idée anglo-saxonne du destination wedding.',
  22000,
  9000,
  55000,
  'Mai, juin, septembre, octobre',
  '10 à 14 mois',
  'Mariage en Nouvelle-Aquitaine — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Nouvelle-Aquitaine. Châteaux bordelais, domaines viticoles, plages atlantiques — prestataires validés par LesNoces en Gironde, Dordogne et Pays Basque.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 4. Auvergne-Rhône-Alpes
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'auvergne-rhone-alpes',
  'Auvergne-Rhône-Alpes',
  'Des Alpes enneigées aux volcans d''Auvergne, en passant par Lyon la gastronomique et les vallées du Rhône et de la Saône, la région Auvergne-Rhône-Alpes offre une diversité de décors saisissante pour un mariage inoubliable. Deuxième région économique de France, elle dispose d''une offre prestataires très complète.',
  '[{"titre":"Décors alpins & lacustres","texte":"Annecy, le Mont-Blanc, les lacs de Savoie, Megève — les paysages de montagne offrent des cadres époustouflants pour des mariages d''exception en altitude, avec un effet visuel difficile à reproduire ailleurs.","couleur_accent":"#2D4356"},{"titre":"Lyon, capitale gastronomique","texte":"Lyon concentre la plus forte densité de chefs étoilés en province. La ville offre des bouchons traditionnels, des restaurants étoilés, et des espaces de réception de caractère dans ses traboules, hôtels particuliers et rooftops.","couleur_accent":"#A57D27"},{"titre":"Volcans & nature d''Auvergne","texte":"Les paysages volcaniques du Puy-de-Dôme, les lacs de cratère et les fermes auberges auvergnates proposent des lieux de mariage authentiques et préservés, à des tarifs bien inférieurs aux pôles alpins.","couleur_accent":"#8E4A49"},{"titre":"Vignobles & domaines viticoles","texte":"Côtes du Rhône, Beaujolais, Saint-Joseph, Crozes-Hermitage, Condrieu — les domaines viticoles de la vallée du Rhône sont des lieux de mariage de plus en plus prisés, avec une cohérence terroir-table forte.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Choisissez d''abord le bon territoire","texte":"La région est immense et hétérogène — définissez d''abord le style de mariage souhaité : urbain chic à Lyon, montagne romantique en Savoie, nature volcanique en Auvergne, vignoble rhodanien. Chaque territoire a ses prestataires spécialisés et ses contraintes propres."},{"numero":"02","titre":"Mariages en altitude : attention à la météo","texte":"Pour un mariage en montagne (Chamonix, Annecy, Val d''Isère, Megève), prévoyez systématiquement une solution de repli — orage de fin d''après-midi en juillet-août, brouillard matinal, refroidissement rapide à la tombée du jour. La météo en altitude est imprévisible même en juillet."},{"numero":"03","titre":"Profitez de l''offre hôtelière exceptionnelle","texte":"Lyon, Annecy et Grenoble disposent d''hôtels de luxe pouvant héberger vos invités. Bloquez les chambres en même temps que le lieu de réception, particulièrement pour les week-ends de juin-septembre où les hôtels lyonnais sont saturés par le tourisme d''affaires."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Auvergne-Rhône-Alpes ?","reponse":"Le budget moyen est de vingt-quatre mille euros selon les données LesNoces. La fourchette va de dix mille euros pour une ferme auberge en Auvergne à soixante mille euros pour un domaine avec vue sur le Mont-Blanc ou un hôtel particulier lyonnais."},{"question":"Peut-on se marier en montagne dans la région ?","reponse":"Oui — Annecy, Chamonix, Megève et les stations de Savoie proposent des lieux de mariage exceptionnels avec vue panoramique. Prévoyez un budget hébergement plus important (les hôtels haut de gamme y sont coûteux) et une assurance annulation intempéries pour les cérémonies en extérieur."},{"question":"Lyon est-elle une bonne ville pour un mariage ?","reponse":"Absolument — Lyon est la capitale gastronomique de la France et propose des espaces de réception uniques : traboules du Vieux-Lyon, hôtels particuliers de la presqu''île, rooftops avec vue sur les deux fleuves, espaces industriels reconvertis sur les berges du Rhône."},{"question":"Quelle est la meilleure saison pour un mariage en Auvergne-Rhône-Alpes ?","reponse":"Juin et septembre pour Lyon et la plaine du Rhône. Juillet pour la montagne (neige fondue, fleurs alpines, températures supportables en altitude). L''Auvergne est agréable de mai à octobre avec des étés moins chauds qu''en Provence — un avantage souvent oublié."}]'::jsonb,
  'Auvergne-Rhône-Alpes offre une diversité de cadres mariage unique : paysages alpins autour d''Annecy et Chamonix, gastronomie lyonnaise reconnue mondialement, volcans et lacs d''Auvergne, vignobles de la vallée du Rhône. Le budget moyen d''un mariage dans la région est de vingt-quatre mille euros selon LesNoces, de dix à soixante mille euros. Les meilleures périodes sont juin, juillet en altitude et septembre, à réserver dix à quatorze mois à l''avance. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Auvergne-Rhône-Alpes est, après l''Île-de-France, la deuxième région économique du pays. Cette puissance se traduit par une densité de prestataires haut de gamme particulièrement forte, mais aussi par une grande hétérogénéité géographique : on ne se marie pas de la même façon à Lyon, à Annecy ou dans le Cantal. Choisir son territoire est la première décision à prendre.

**Quatre univers distincts dans une seule région**

Lyon et sa métropole concentrent une offre urbaine haut de gamme rare en province. Les hôtels particuliers de la presqu''île, les terrasses de Fourvière, les berges du Rhône réaménagées, les espaces industriels reconvertis dans le neuvième et le septième arrondissement permettent des mariages urbains de très haut niveau. L''avantage décisif : la concentration de chefs étoilés et d''écoles de cuisine fait de Lyon la ville française où l''on mange peut-être le mieux pour un mariage, à un niveau de prix inférieur à Paris.

La Savoie et la Haute-Savoie (Annecy, Megève, Chamonix, Val d''Isère, Yvoire) jouent la carte du décor de montagne. Le lac d''Annecy avec le massif des Aravis en arrière-plan reste l''une des trois images les plus diffusées du mariage français à l''international. Les chalets-hôtels de Megève et les domaines d''altitude proposent des prestations très haut de gamme — comptez quarante à soixante pour cent de plus qu''un équivalent en plaine. La saison utile y est plus courte : mi-juin à mi-septembre pour les cérémonies en extérieur, avec un pic en juillet quand les alpages sont fleuris.

L''Auvergne (Puy-de-Dôme, Cantal, Allier, Haute-Loire) reste le secret le mieux gardé de la région. Volcans endormis, lacs de cratère, fermes auberges avec hébergement, châteaux médiévaux à des tarifs bien inférieurs aux pôles alpins. Pour les couples sensibles à l''authenticité et à la nature, c''est probablement la meilleure équation qualité-prix de France.

La vallée du Rhône et l''Ardèche concentrent les domaines viticoles — Saint-Joseph, Crozes-Hermitage, Condrieu, Côte-Rôtie au nord ; Châteauneuf-du-Pape et Gigondas plus au sud (techniquement en PACA, mais souvent inclus dans la culture rhodanienne). Le Beaujolais, à trente minutes au nord de Lyon, est devenu en cinq ans une destination mariage à part entière, avec ses châteaux en pierre dorée et ses crus (Morgon, Fleurie, Brouilly).

**Saison : un calendrier à deux vitesses**

L''Auvergne-Rhône-Alpes a la particularité d''avoir une saison utile très différente selon l''altitude. En plaine (Lyon, vallée du Rhône, Auvergne basse), la saison s''étend d''avril à octobre, avec un pic d''été en juillet-août où Lyon peut atteindre trente-cinq à trente-huit degrés. En altitude (au-dessus de mille mètres), la saison se concentre sur juillet-août : les autres mois, le risque de neige précoce ou tardive, de gel matinal, de brouillard prolongé est trop important pour planifier un événement en extérieur. Septembre est généralement le meilleur mois pour la plaine (chaleur retombée, vignobles colorés, vendanges du Beaujolais et du Rhône).

**Gastronomie lyonnaise : un argument différenciant**

Lyon est la seule grande ville française qui peut prétendre à un titre culinaire mondial. Cette densité bénéficie à toute la région : les écoles forment chaque année des centaines de jeunes chefs qui s''installent ensuite à Annecy, à Chambéry, à Clermont. Les traiteurs locaux ont un niveau d''exécution rarement égalé ailleurs en province, et les fournisseurs (volailles de Bresse, charcuterie de Lyon, fromages comté et beaufort, fruits de la Drôme) sont d''une qualité exceptionnelle. Comptez quatre-vingts à cent cinquante euros par personne pour un service complet — c''est le meilleur rapport qualité-prix de la gastronomie de mariage en France.

**Logistique et accessibilité**

L''aéroport Lyon-Saint-Exupéry et la gare TGV Part-Dieu placent Lyon à deux heures de Paris et à proximité de toute la moitié sud de la France. C''est un avantage logistique majeur pour les mariages avec invités venant de plusieurs régions. Pour les mariages en montagne, comptez deux heures supplémentaires de route depuis Lyon vers les massifs (sauf Annecy, à quarante-cinq minutes). Pour l''Auvergne, l''aéroport de Clermont-Ferrand-Auvergne et la gare TGV de Saint-Étienne sont les hubs naturels — Clermont est à trois heures trente de Paris en TGV direct.

**Style et tendances déco**

Dans une région partagée entre montagne, ville et vignoble, l''esthétique se décline — mais une tendance commune s''impose : le luxe naturel. La décoration contemporaine y domine — lignes épurées, matières nobles et brutes (bois, pierre, laine, cuir), palette de gris, de vert sapin, de blanc et de bois clair, en cohérence avec les décors alpins. Les mariages de montagne assument cette grammaire : chalets haut de gamme, cérémonies face aux sommets, scénographie minimale qui laisse le panorama dominer. L''approche écoresponsable est particulièrement marquée dans la région : fleurs locales et de saison, circuits courts pour le traiteur, location plutôt qu''achat de mobilier, limitation des déchets — une exigence que les couples comme les prestataires intègrent de plus en plus. Enfin, la tendance est aux expériences intimistes et privatives : des lieux confidentiels réunissant les proches sur plusieurs jours, loin de la logique du grand mariage spectacle. C''est une esthétique sobre, exigeante et ancrée dans son environnement.

**L''esprit d''un mariage AURA**

La région porte une forme de pragmatisme bourgeois — qualité de service, sérieux, exigence sur l''exécution, sans le tape-à-l''œil parisien ou la décontraction provençale. Les mariages lyonnais sont souvent élégants et sobres ; les mariages alpins jouent la carte du dépaysement et du sport (cérémonie en altitude, photos sur les sommets) ; les mariages auvergnats privilégient l''authenticité et la chaleur humaine. C''est probablement la région française la plus polyvalente — vous pouvez y composer presque n''importe quel type de mariage selon le sous-territoire choisi.',
  24000,
  10000,
  60000,
  'Juin, juillet (altitude), septembre',
  '10 à 14 mois',
  'Mariage en Auvergne-Rhône-Alpes — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Auvergne-Rhône-Alpes. Lyon, Annecy, Chamonix, volcans d''Auvergne — prestataires validés par LesNoces dans la région.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 5. Occitanie
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'occitanie',
  'Occitanie',
  'Entre la Méditerranée et les Pyrénées, entre Toulouse la rose et Montpellier la moderne, l''Occitanie déroule ses vignobles languedociens, ses bastides médiévales et ses plages de sable fin. Une région au caractère fort, à la gastronomie généreuse et aux paysages d''une beauté sauvage.',
  '[{"titre":"Bastides médiévales & cités cathares","texte":"Carcassonne, Albi, Minerve, Cordes-sur-Ciel — les cités médiévales d''Occitanie offrent des décors historiques uniques en Europe pour une cérémonie de caractère, avec des architectures inscrites à l''UNESCO.","couleur_accent":"#8E4A49"},{"titre":"Vignobles languedociens","texte":"Le Languedoc est la plus grande région viticole de France. Ses domaines proposent des lieux de mariage authentiques avec des vins de plus en plus reconnus internationalement, à des tarifs très accessibles.","couleur_accent":"#A57D27"},{"titre":"Camargue & nature sauvage","texte":"Les marais de Camargue, les Cévennes et les Pyrénées offrent des paysages préservés pour des mariages nature et aventure loin des sentiers battus, avec une faune et une flore uniques.","couleur_accent":"#5F6F52"},{"titre":"Gastronomie du Sud","texte":"Cassoulet, foie gras gascon, fromages des Pyrénées, fruits de mer de Méditerranée, vins du Languedoc — la gastronomie occitane est généreuse et festive, idéale pour un banquet de mariage mémorable.","couleur_accent":"#2D4356"}]'::jsonb,
  '[{"numero":"01","titre":"Privilégiez les saisons intermédiaires","texte":"Avril-juin et septembre-octobre sont idéaux : chaleur agréable, pas de foule touristique estivale, prix plus accessibles. L''été (juillet-août) est souvent trop chaud pour une fête en extérieur — trente-cinq degrés et plus dans les plaines audoises et héraultaises."},{"numero":"02","titre":"Attention aux vents régionaux","texte":"La tramontane en Languedoc et le vent d''autan près de Toulouse peuvent être violents — soixante à quatre-vingts kilomètres heure, plusieurs jours d''affilée. Vérifiez que votre lieu dispose d''une protection naturelle ou d''un espace couvert de repli équivalent."},{"numero":"03","titre":"Explorez au-delà de Toulouse et Montpellier","texte":"La région regorge de perles cachées — l''Hérault, l''Aveyron, le Gers et les Hautes-Pyrénées proposent des domaines et fermes auberges d''exception à des tarifs très compétitifs, souvent vingt à trente pour cent inférieurs aux pôles urbains."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Occitanie ?","reponse":"Le budget moyen est de vingt-deux mille euros selon les données LesNoces. La fourchette va de neuf mille euros pour un mas languedocien intimiste à cinquante-cinq mille euros pour un château cathare rénové avec hébergement sur place."},{"question":"Peut-on organiser un mariage dans la Cité de Carcassonne ?","reponse":"Non — la Cité médiévale classée est un site protégé qui ne se privatise pas pour les mariages privés. En revanche, plusieurs domaines et châteaux autour de Carcassonne proposent des mariages avec vue sur la Cité, pour un décor médiéval spectaculaire."},{"question":"Quelle est la meilleure période pour se marier en Occitanie ?","reponse":"Mai, juin et septembre sont parfaits. Avril peut encore être frais mais la végétation est belle et les tarifs sont bas. Évitez juillet-août dans les plaines audoises et héraultaises (chaleur excessive), sauf en altitude dans les Pyrénées où l''été reste praticable."},{"question":"Y a-t-il des prestataires de mariage dans le Gers et l''Aveyron ?","reponse":"Oui — LesNoces référence des prestataires dans toute l''Occitanie, y compris les territoires ruraux du Gers, de l''Aveyron, de la Lozère et des Hautes-Pyrénées, souvent moins connus mais offrant d''excellents rapports qualité-prix."}]'::jsonb,
  'L''Occitanie propose une offre mariage entre bastides médiévales, vignobles languedociens, Camargue et Pyrénées. Le budget moyen d''un mariage dans la région est de vingt-deux mille euros selon LesNoces, de neuf à cinquante-cinq mille euros. Les meilleures périodes sont avril, mai, juin, septembre et octobre, à réserver dix à quatorze mois à l''avance. La région se distingue par ses cités médiévales (Carcassonne, Albi), ses domaines viticoles languedociens et sa gastronomie généreuse du Sud. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'L''Occitanie, née de la fusion du Languedoc-Roussillon et de Midi-Pyrénées, est devenue la deuxième plus grande région de France. Elle réunit deux mondes que tout oppose : à l''est, le Languedoc méditerranéen, viticole et historique ; à l''ouest, Toulouse et le Sud-Ouest pyrénéen, plus rural, plus gascon. Un mariage en Occitanie commence par choisir entre ces deux univers — et entre les deux, des perles intermédiaires comme les Cévennes, l''Aveyron ou le Gers.

**Le Languedoc viticole, premier vignoble d''Europe**

Le Languedoc-Roussillon est, en surface, le plus grand vignoble du monde. Cette densité se traduit par des centaines de domaines viticoles privatisables — des plus modestes aux plus prestigieux (Château de Pennautier, Mas de Daumas Gassac, Domaine de Baronarques). Les tarifs y restent particulièrement accessibles : un domaine viticole avec capacité de cent vingt invités, vignobles en toile de fond et hébergement intégré se négocie entre quatre et huit mille euros pour le week-end, soit moitié moins qu''un équivalent bordelais. La qualité des vins a fait un bond spectaculaire en vingt ans : les AOP Faugères, Pic-Saint-Loup, Pézenas, Minervois la Livinière atteignent aujourd''hui un niveau international. C''est une vraie alternative aux mariages bordelais pour les couples sensibles au terroir.

**Toulouse et le Sud-Ouest**

Toulouse, la ville rose, est la quatrième ville de France et son aéroport international (Blagnac) en fait un hub d''accès pratique. La ville elle-même propose des lieux atypiques : hôtels particuliers du centre historique, péniches sur la Garonne, espaces contemporains des bords de Garonne, châteaux à proximité immédiate (Lasserre, Larra). L''arrière-pays toulousain — Gers, Tarn-et-Garonne, Haute-Garonne rurale — concentre les meilleurs rapports qualité-prix de la région : châteaux et fermes-châteaux à des tarifs trente pour cent inférieurs au Bordelais voisin, avec une qualité architecturale équivalente.

**Les cités médiévales : un patrimoine unique en Europe**

L''Occitanie concentre les plus belles cités médiévales préservées d''Europe : Carcassonne (UNESCO), Albi (UNESCO), Cordes-sur-Ciel, Minerve, Lagrasse, Saint-Cirq-Lapopie. Aucune ne peut être privatisée pour un mariage privé (statut de monument), mais beaucoup de domaines, château et abbayes les bordent et permettent des cérémonies avec ces silhouettes médiévales en arrière-plan. C''est particulièrement spectaculaire à Carcassonne, où plusieurs propriétés viticoles à dix minutes de la Cité offrent ce panorama unique.

**Saison et climat : composer avec les extrêmes**

L''Occitanie a deux climats radicalement différents. Le littoral méditerranéen (Hérault, Aude, Gard) connaît des étés brûlants — trente-cinq à quarante degrés en juillet-août, secs, avec un vent (tramontane) qui peut souffler trois à cinq jours d''affilée à quatre-vingts kilomètres heure. La fenêtre utile en plaine se concentre sur avril-juin et septembre-octobre. L''arrière-pays et le piémont pyrénéen (Aveyron, Gers, Hautes-Pyrénées) sont plus tempérés et permettent des mariages tout l''été. La Camargue, marécageuse, a une saison de moustiques qui peut compliquer les cérémonies en extérieur de juin à août — un point que les couples non locaux découvrent souvent trop tard.

**Gastronomie : générosité du Sud**

La gastronomie occitane est, comme le Sud-Ouest aquitain voisin, une cuisine de terroir riche : cassoulet (Castelnaudary, Toulouse, Carcassonne), foie gras gersois, magret, fromages des Pyrénées et de l''Aveyron (roquefort, laguiole), huîtres et coquillages de l''étang de Thau, fruits de la vallée de l''Hérault. Les traiteurs locaux pratiquent des tarifs très accessibles — soixante-dix à cent vingt euros par personne pour un service complet, soit trente à quarante pour cent en dessous des standards franciliens. Les vins du Languedoc accompagnent naturellement la table, avec des accords mets-vins parfaitement maîtrisés par les domaines viticoles.

**Logistique : trois portes d''entrée**

L''Occitanie est immense (plus de soixante-douze mille kilomètres carrés) et nécessite de choisir une porte d''entrée pour vos invités. Toulouse-Blagnac dessert le Sud-Ouest et les Pyrénées. Montpellier-Méditerranée couvre le littoral et l''arrière-pays héraultais et gardois. La gare TGV de Nîmes ou Montpellier place le littoral à trois heures de Paris ; Toulouse à quatre heures dix par TGV direct. Pour les territoires intérieurs (Aveyron, Lozère, Cévennes), comptez deux à trois heures de route supplémentaires — c''est à prendre en compte dans le choix du lieu si vos invités viennent de loin.

**Style et tendances déco**

L''esthétique occitane est solaire et organique. La tendance forte est un bohème moderne assumé : décoration naturelle, matériaux bruts (bois, pierre, terre cuite, osier), fleurs séchées et compositions texturées — herbes de garrigue, graminées, immortelles, chardons — dans une palette chaude de terracotta, d''ocre, de moutarde et de blanc cassé. L''ambiance recherchée est celle de la dolce vita méridionale : tablées en plein air sous les platanes ou les pergolas, vaisselle dépareillée, nappes en lin froissé, lumière du Sud. Les bâtisses en pierre, les bastides médiévales et les domaines viticoles offrent un cadre déjà texturé que la décoration vient prolonger plutôt que recouvrir. Les célébrations s''étirent volontiers sur plusieurs jours — brunchs champêtres, soirées festives, repas partagés — dans un esprit convivial qui privilégie l''expérience à la mise en scène. C''est une région où le style assume sa générosité et sa chaleur, sans recherche de perfection lisse.

**L''esprit d''un mariage occitan**

Le mariage en Occitanie a une couleur particulière — chaleur méridionale, convivialité, table généreuse, soirée qui s''éternise. C''est moins protocolaire qu''en Île-de-France, moins "marketé" qu''en Provence, plus authentique souvent qu''en Côte d''Azur. Les couples qui choisissent l''Occitanie cherchent généralement un mariage qui respire le terroir, qui assume sa générosité gastronomique, et qui se déroule sur deux ou trois jours avec un esprit "vacances entre amis". C''est une région qui se prête particulièrement bien aux mariages d''expatriés français revenant au pays, ou aux couples mixtes franco-internationaux séduits par l''authenticité du Sud profond.',
  22000,
  9000,
  55000,
  'Avril, mai, juin, septembre, octobre',
  '10 à 14 mois',
  'Mariage en Occitanie — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Occitanie. Toulouse, Montpellier, Carcassonne, Camargue — prestataires validés par LesNoces dans la région.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 6. Hauts-de-France
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'hauts-de-france',
  'Hauts-de-France',
  'Châteaux flamands, fermes-châteaux picards, beffrois classés UNESCO et côte d''Opale sauvage — les Hauts-de-France réservent bien des surprises aux couples en quête d''un mariage authentique et abordable, à seulement une heure de Paris et trente minutes de Bruxelles.',
  '[{"titre":"Châteaux & fermes-châteaux","texte":"La région concentre de nombreux châteaux restaurés et fermes-châteaux à des tarifs bien inférieurs à l''Île-de-France voisine, pour une qualité architecturale souvent remarquable.","couleur_accent":"#A57D27"},{"titre":"Proximité Paris & Belgique","texte":"À une heure de Paris en TGV et trente minutes de Bruxelles, la région est idéale pour des mariages avec invités mixtes franco-belges ou franco-britanniques via l''Eurostar (Calais à deux heures de Londres).","couleur_accent":"#2D4356"},{"titre":"Côte d''Opale & paysages nordiques","texte":"Les falaises de la côte d''Opale, les dunes de la Slack et les caps Gris-Nez et Blanc-Nez offrent des paysages maritimes sauvages pour des photos de mariage inoubliables.","couleur_accent":"#5F6F52"},{"titre":"Budget plus accessible","texte":"Les prestataires des Hauts-de-France sont en moyenne vingt-cinq à trente-cinq pour cent moins chers qu''en Île-de-France pour une qualité souvent équivalente — un avantage non négligeable pour optimiser son budget.","couleur_accent":"#8E4A49"}]'::jsonb,
  '[{"numero":"01","titre":"Choisissez la saison estivale","texte":"Le nord de la France peut être pluvieux au printemps et à l''automne. Privilégiez juin, juillet et août pour maximiser les chances de beau temps, avec en moyenne vingt à vingt-cinq degrés. Prévoyez toujours une tente ou un espace couvert pour les cérémonies en extérieur."},{"numero":"02","titre":"Profitez de la proximité avec les fleuristes belges","texte":"La Belgique, accessible en trente minutes, est réputée pour ses fleuristes d''exception à des prix souvent inférieurs aux fleuristes parisiens. Plusieurs mariés des Hauts-de-France font appel à des créateurs flamands pour leur scénographie florale."},{"numero":"03","titre":"Explorez les fermes-châteaux de l''Oise","texte":"L''Oise propose des fermes-châteaux magnifiquement restaurées, souvent moins connues que les châteaux de l''Île-de-France voisine mais tout aussi élégantes, avec hébergement sur place et tarifs raisonnables — un département encore sous-coté."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage dans les Hauts-de-France ?","reponse":"Le budget moyen est de dix-neuf mille euros selon LesNoces, soit vingt-cinq à trente-cinq pour cent de moins qu''en Île-de-France. La fourchette va de huit mille euros pour une ferme authentique à quarante-huit mille euros pour un château classé avec hébergement."},{"question":"Quelle est la météo pour un mariage dans le Nord en été ?","reponse":"Juin, juillet et août offrent en moyenne vingt à vingt-cinq degrés avec des journées ensoleillées. La région est plus humide que le sud de la France — une tente ou un espace couvert reste indispensable en sauvegarde, même au cœur de l''été."},{"question":"Y a-t-il de beaux lieux de mariage dans le Pas-de-Calais ?","reponse":"Oui — la côte d''Opale entre Boulogne-sur-Mer et Le Touquet propose des lieux avec vue mer spectaculaire. L''arrière-pays flamand cache de nombreux châteaux et fermes-châteaux restaurés, particulièrement autour de Saint-Omer et d''Hesdin."},{"question":"Est-il possible d''organiser un mariage franco-belge dans les Hauts-de-France ?","reponse":"Absolument — la région est idéalement placée pour accueillir des invités des deux pays. Les prestataires locaux ont l''habitude des mariages mixtes et beaucoup parlent le néerlandais ou le flamand, particulièrement dans le Nord et le Pas-de-Calais frontaliers."}]'::jsonb,
  'Les Hauts-de-France proposent une offre mariage entre châteaux flamands, fermes-châteaux picards et côte d''Opale sauvage. Le budget moyen est de dix-neuf mille euros selon LesNoces, de huit à quarante-huit mille euros, soit vingt-cinq à trente-cinq pour cent moins cher qu''en Île-de-France. La région est idéale pour des invités franco-belges ou franco-britanniques — à une heure de Paris et trente minutes de Bruxelles. Les meilleures périodes sont juin, juillet et août. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Les Hauts-de-France souffrent encore d''une image qui ne leur rend pas justice — climat réputé difficile, paysages industriels supposés, distance perçue plus grande qu''en réalité. C''est précisément cet écart entre perception et réalité qui en fait aujourd''hui une des régions les plus intéressantes pour les couples qui veulent un mariage de caractère à budget maîtrisé. La région est à une heure de Paris en TGV, accueille certains des plus beaux châteaux flamands d''Europe, et propose des prestataires d''un niveau souvent comparable à l''Île-de-France pour trente pour cent de moins.

**Quatre territoires, quatre signatures**

L''Oise est probablement la meilleure surprise de la région pour les mariés franciliens. À quarante-cinq minutes de Paris-Nord, le département concentre des châteaux et fermes-châteaux d''une qualité équivalente à la Seine-et-Marne, à des tarifs inférieurs de vingt à trente pour cent. Chantilly, Senlis, Compiègne — des noms familiers, avec une offre d''hébergement et de réception qui rivalise avec les meilleures adresses franciliennes. C''est le département où la déconnexion entre prix et qualité est la plus marquée.

Le Nord, autour de Lille, propose un autre univers : châteaux flamands en brique rouge, demeures bourgeoises de la ceinture lilloise, fermes-châteaux du Westhoek. L''influence flamande se ressent dans l''architecture, la gastronomie et même les fleuristes locaux qui travaillent souvent avec des partenaires belges. C''est aussi le département où l''accent franco-belge est le plus marqué pour les mariages mixtes — particulièrement important si une partie de votre famille vient de Belgique.

Le Pas-de-Calais offre la côte d''Opale, un littoral sauvage classé Grand Site de France entre Boulogne-sur-Mer et Le Touquet. Les falaises du Cap Blanc-Nez et du Cap Gris-Nez, les dunes de la Slack, les villes balnéaires Belle Époque (Le Touquet, Hardelot) en font une alternative française aux mariages bord de mer du Sud — avec un esprit différent, plus brut, plus septentrional. L''arrière-pays cache aussi quelques perles : Saint-Omer, Hesdin, la forêt d''Hardelot.

La Somme et l''Aisne, plus rurales, proposent des manoirs picards, des fermes restaurées et des prix encore inférieurs aux autres départements de la région. C''est le terrain de chasse des couples qui cherchent un budget mariage entre dix et quinze mille euros sans sacrifier la qualité du lieu.

**Saison et météo : composer avec la réputation**

La météo des Hauts-de-France est souvent surévaluée comme problème. En réalité, juin-juillet-août offrent des températures moyennes de vingt à vingt-cinq degrés et des taux de précipitations comparables ou inférieurs à ceux de Paris. La différence n''est pas la pluie — c''est plutôt l''humidité ambiante et la luminosité moins intense que dans le Sud. La règle absolue : prévoir une tente ou un espace couvert pour toute cérémonie en extérieur, sans exception, même en plein été. Les bons traiteurs et loueurs de tentes locaux sont équipés pour gérer une bascule en moins de deux heures si la météo change.

Mai et septembre sont possibles mais plus aléatoires météorologiquement. Avril et octobre sont à réserver aux mariages tout intérieur. La saison sèche utile est plus courte qu''au sud — environ quatre mois — ce qui concentre la demande sur cette période.

**Gastronomie : un nord plus généreux qu''on ne le pense**

La cuisine des Hauts-de-France a longtemps été caricaturée mais connaît un vrai renouveau. Le Nord est aujourd''hui une scène gastronomique active avec plusieurs établissements étoilés à Lille, à la Madeleine, à Roubaix. Les produits locaux remarquables sont nombreux : poissons et coquillages du littoral, charcuterie d''Arras et de l''Avesnois, fromages du Nord (maroilles, mimolette du Nord), bières artisanales d''une qualité européenne. Le champagne, produit dans l''Aisne du Sud, est techniquement un produit régional. Comptez soixante-dix à cent dix euros par personne pour un service traiteur complet — l''un des meilleurs rapports qualité-prix de France.

**Logistique : un avantage géographique sous-exploité**

La position des Hauts-de-France est probablement son atout le moins valorisé. Une heure de Paris en TGV, trente minutes de Bruxelles, deux heures de Londres via l''Eurostar, soixante minutes d''Amsterdam en Thalys. Aucune autre région française n''est à ce point au cœur d''un quadrilatère Paris-Bruxelles-Londres-Amsterdam. Pour les couples avec des invités belges, britanniques ou néerlandais, c''est une économie logistique et un avantage diplomatique de premier plan. Les châteaux de l''Oise ou de la Somme sont à deux heures de route maximum pour quatre-vingt-cinq pour cent de la population du Benelux, du Royaume-Uni du sud et de Paris.

**Style et tendances déco**

Le style des Hauts-de-France oscille entre élégance classique et inspiration littorale. Dans les terres — Oise, Somme, arrière-pays du Nord — les châteaux et fermes-châteaux appellent une décoration soignée et chaleureuse : art de la table classique, compositions florales généreuses, palette douce de blanc, de vert et de tons poudrés. Sur la Côte d''Opale, le registre se fait plus naturel : tons de sable, de gris perle et de bleu, matières brutes, décoration épurée qui compose avec les grands paysages de dunes et de falaises. La proximité de la Belgique est un atout décoratif concret — les fleuristes belges, réputés dans toute l''Europe, interviennent régulièrement côté français. C''est une région encore discrète sur la carte du mariage, où les couples trouvent des lieux de caractère à des budgets contenus, et où le style privilégie la sincérité chaleureuse à la mise en scène spectaculaire.

**L''esprit d''un mariage nordiste**

La région se vit avec une convivialité distinctive — sens de l''accueil très marqué, chaleur humaine compensant la météo, table généreuse, soirée qui se prolonge. Les mariages dans le Nord ont une réputation justifiée de durer longtemps et de bien manger. Pour les couples parisiens lassés du paraître francilien, l''authenticité et la générosité nordiste sont souvent une révélation. C''est aussi une région où vous obtenez du temps de service et d''attention de la part des prestataires — moins de saturation que dans les régions touristiques, donc une vraie qualité d''écoute et de personnalisation.',
  19000,
  8000,
  48000,
  'Juin, juillet, août, septembre',
  '8 à 12 mois',
  'Mariage en Hauts-de-France — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Hauts-de-France. Châteaux flamands, fermes-châteaux, côte d''Opale — prestataires validés par LesNoces dans le Nord, Pas-de-Calais, Somme et Oise.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 7. Bretagne
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'bretagne',
  'Bretagne',
  'Manoirs en granit, côtes déchiquetées, phares romantiques et menhirs mystérieux — la Bretagne offre un cadre de mariage absolument unique en France. La région bretonne mêle authenticité celtique, gastronomie iodée et douceur de vivre pour des mariages inoubliables au bord de l''Atlantique.',
  '[{"titre":"Manoirs & châteaux bretons","texte":"La Bretagne compte plus de mille cinq cents manoirs, dont beaucoup sont disponibles pour des mariages privatifs. Architecture en granit, jardins à la française et intérieurs chargés d''histoire, souvent à des tarifs très accessibles.","couleur_accent":"#2D4356"},{"titre":"Cadres maritimes uniques","texte":"Belle-Île-en-Mer, le Golfe du Morbihan, la côte de Granit Rose, la Presqu''île de Crozon — des paysages maritimes sauvages et romantiques incomparables pour les photos de mariage et les cérémonies en plein air.","couleur_accent":"#A57D27"},{"titre":"Gastronomie iodée d''exception","texte":"Huîtres de Cancale, homards bleus, langoustines, ormeaux, sarrasin pour les galettes, beurre demi-sel de Plougastel — la gastronomie bretonne est festive, généreuse et inoubliable pour un repas de mariage.","couleur_accent":"#8E4A49"},{"titre":"Authenticité & caractère celtique","texte":"La Bretagne a une identité culturelle forte qui transparaît dans ses lieux, sa musique (fest-noz, biniou), ses artisans. Un mariage en Bretagne a une âme particulière que peu d''autres régions peuvent offrir.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Prévoyez toujours un plan pluie","texte":"La Bretagne reçoit en moyenne plus de précipitations que le reste de la France. Même en juillet, il peut pleuvoir d''un coup. Un manoir avec grande salle intérieure ou une tente de qualité est indispensable pour les cérémonies en extérieur — non négociable."},{"numero":"02","titre":"Réservez tôt pour les îles","texte":"Belle-Île, Groix ou l''île d''Arz dans le Morbihan sont des destinations mariage très prisées. Les capacités d''hébergement sont limitées sur les îles, le transport par bateau impose des contraintes (météo, horaires) — réservez douze à dix-huit mois à l''avance."},{"numero":"03","titre":"Intégrez les artisans locaux","texte":"Paludiers de Guérande pour le sel, ostréiculteurs de Cancale, crêperies traditionnelles, sonneurs de cornemuse, brodeurs de coiffes — les artisans bretons apportent une touche unique et mémorable à votre mariage et soutiennent l''économie locale."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Bretagne ?","reponse":"Le budget moyen est de dix-huit mille euros selon les données LesNoces. La fourchette va de huit mille euros pour une ferme bretonne authentique à quarante-cinq mille euros pour un manoir privatisé sur la côte avec hébergement pour les invités."},{"question":"Peut-on se marier sur une île bretonne ?","reponse":"Oui — Belle-Île-en-Mer, Groix et les îles du Morbihan proposent des lieux de mariage uniques. Attention aux contraintes logistiques : transport par bateau parfois compromis par la météo, hébergement limité, réservation douze à dix-huit mois minimum, plan B continental conseillé."},{"question":"La météo est-elle fiable pour un mariage en Bretagne en été ?","reponse":"Juillet et août offrent les meilleures chances de beau temps (quinze à vingt-cinq degrés) mais la pluie reste possible à tout moment, parfois sous forme d''averses brèves. Un plan B en intérieur est indispensable. Mai-juin et septembre peuvent aussi être très beaux avec moins de fréquentation touristique."},{"question":"Y a-t-il des prestataires bretons spécialisés dans la musique celtique ?","reponse":"Oui — la Bretagne dispose d''une scène musicale celtique vivante et professionnelle. LesNoces référence des groupes de fest-noz, sonneurs de biniou, harpistes celtiques et chorales bretonnes pour animer votre cérémonie ou votre soirée avec une touche identitaire forte."}]'::jsonb,
  'La Bretagne offre des cadres de mariage uniques entre manoirs en granit, côtes déchiquetées et gastronomie iodée. Le budget moyen d''un mariage en Bretagne est de dix-huit mille euros selon LesNoces, de huit à quarante-cinq mille euros. Les meilleures périodes sont mai, juin, juillet et août — un plan pluie est toujours nécessaire. La région se distingue par ses mille cinq cents manoirs disponibles à la location, ses îles romantiques (Belle-Île, Morbihan) et son identité culturelle celtique forte. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Se marier en Bretagne, c''est faire un choix identitaire avant d''être un choix logistique. Aucune autre région française n''a une culture aussi singulière, une scène musicale aussi vivante, un caractère aussi affirmé. C''est la région la moins "neutre" de France pour un mariage — soit elle vous parle, soit elle ne vous parle pas. Pour les couples qui ont des racines bretonnes ou simplement une attirance pour l''Atlantique sauvage et l''esprit celtique, c''est probablement le territoire le plus émotionnellement chargé pour célébrer son union.

**Quatre départements, quatre Bretagnes**

L''Ille-et-Vilaine est la Bretagne accessible — Rennes à une heure trente de Paris en TGV, Saint-Malo et la côte d''Émeraude facilement reliés. Le département concentre des manoirs et châteaux à des tarifs raisonnables, particulièrement autour du pays de Fougères, du pays de Vitré et de la forêt de Brocéliande. C''est le département le plus pratique pour les couples avec invités franciliens.

Le Morbihan est probablement la zone la plus prisée pour les mariages depuis dix ans. Le Golfe du Morbihan, avec ses îles (Île aux Moines, Île d''Arz), Vannes médiévale, la presqu''île de Quiberon, Carnac et ses alignements de menhirs — c''est une concentration de paysages exceptionnels rare en France. Belle-Île-en-Mer, plus au large, est l''expérience ultime du mariage breton mais impose une logistique lourde (bateau ou avion). Les domaines avec accès direct au Golfe ou aux îles atteignent des budgets supérieurs à la moyenne régionale.

Les Côtes-d''Armor offrent la côte de Granit Rose, un littoral unique au monde par sa géologie rose. Perros-Guirec, Ploumanac''h, l''archipel des Sept-Îles — un terrain rêvé pour les photos de mariage. L''arrière-pays (Côtes-d''Armor centrale, environs de Guingamp) propose des manoirs et fermes à des tarifs très accessibles.

Le Finistère est la Bretagne la plus authentique et la plus sauvage. Quimper, Brest, la presqu''île de Crozon, la pointe du Raz, l''île d''Ouessant — pour les couples qui veulent du dépaysement maximal, c''est le département de choix. C''est aussi le plus éloigné de Paris (quatre heures trente en TGV) et le plus exposé aux intempéries — un point à intégrer dans la décision.

**Saison et météo : la grande question**

La météo bretonne est une réalité, mais elle est moins défavorable que sa réputation. La région reçoit en moyenne huit cents à mille millimètres de précipitations par an — moins que beaucoup de zones montagneuses. La différence n''est pas la quantité, c''est la fréquence et l''imprévisibilité : il peut pleuvoir cinq minutes puis faire beau pendant trois heures, plusieurs fois dans la même journée. La règle absolue : tout événement breton en extérieur doit avoir un plan B couvert à moins de cinq minutes. Les meilleurs lieux bretons l''ont intégré et proposent systématiquement une salle de capacité équivalente à l''espace extérieur.

La saison utile s''étend de mai à septembre, avec un cœur en juillet-août où la fréquentation touristique est maximale et les prix les plus élevés. Juin et septembre sont les meilleurs compromis : météo souvent stable, tarifs raisonnables, prestataires disponibles. Les hivers sont doux mais peu propices aux cérémonies en extérieur — réservez-les pour des mariages en intérieur dans un manoir, devant une grande cheminée.

**Gastronomie : un terroir maritime unique**

La cuisine bretonne est l''une des plus reconnaissables de France — fruits de mer en abondance (huîtres de Cancale, palourdes de l''Élorn, ormeaux, langoustines de Loctudy, homard bleu), poissons frais quotidiens, beurre demi-sel de Plougastel, fleur de sel de Guérande, far breton, kouign-amann, cidres et chouchen. Les traiteurs locaux ont une carte spécifique qui exploite ces produits — un repas de mariage breton peut légitimement consister en un plateau de fruits de mer monumental en cocktail, un plat principal autour du homard ou du turbot, et un assortiment de pâtisseries régionales. Comptez soixante-dix à cent vingt euros par personne pour un service complet — l''un des meilleurs rapports qualité-prix gastronomique de France si vous aimez le terroir maritime.

**Logistique et accessibilité**

Rennes, à une heure trente de Paris-Montparnasse par TGV, est la porte d''entrée naturelle de la région. Brest et Quimper sont plus éloignés (quatre heures et quatre heures vingt). Pour les invités venant de l''étranger, l''aéroport de Rennes propose des liaisons européennes ; sinon transit par Paris. Pour les îles (Belle-Île, Bréhat, Ouessant), prévoyez la logistique bateau dès le choix de la date — les liaisons sont fréquentes en été mais soumises à la météo, et la capacité de transport pour cent invités impose souvent de privatiser un service.

**Style et tendances déco**

L''esthétique bretonne puise directement dans le littoral. La palette dominante — bleu profond, vert sauge, blanc, sable, gris perle — reprend les teintes de la mer, du granit et des ciels changeants de l''Atlantique. La grammaire décorative est épurée, presque sobre : peu d''artifices, des matières naturelles (lin, jute, bois, céramique), des compositions florales discrètes qui laissent le paysage parler. Les lumières naturelles, omniprésentes et mouvantes, sont la vraie scénographie d''un mariage breton — les photographes de la région en ont fait leur signature. Les couples qui choisissent la Bretagne recherchent rarement le spectaculaire : ils veulent une décoration qui s''efface devant l''émotion et devant le décor — manoirs de granit, côtes déchiquetées, phares à l''horizon. C''est une élégance retenue, à l''image de la région, que partagent les prestataires bretons référencés par LesNoces : le beau sans ostentation.

**L''esprit d''un mariage breton**

Le mariage en Bretagne porte une signature culturelle forte que les autres régions n''ont pas. La musique celtique en fin de soirée — un sonneur de cornemuse, un duo de bombarde et biniou, un fest-noz qui se met en place spontanément — crée une ambiance unique qui marque durablement les invités. Les Bretons sont fiers de leur région et beaucoup de couples intègrent des éléments identitaires : drapeau Gwenn-ha-Du, costumes traditionnels (coiffes brodées) pour certains anciens, gwenrann (gâteau breton) en pièce montée, chanson en breton pour l''ouverture du bal. Pour les couples non bretons d''origine, c''est l''occasion de découvrir une culture régionale vivante ; pour les couples bretons, c''est souvent le mariage de leurs rêves — celui qui marie l''amour à l''identité.',
  18000,
  8000,
  45000,
  'Mai, juin, juillet, août',
  '8 à 12 mois',
  'Mariage en Bretagne — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Bretagne. Manoirs, côtes sauvages, phares — prestataires validés par LesNoces dans le Finistère, Morbihan, Côtes-d''Armor et Ille-et-Vilaine.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 8. Normandie
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'normandie',
  'Normandie',
  'Châteaux normands, colombages d''Honfleur, falaises d''Étretat, bocage verdoyant et vergers en fleur — la Normandie est une région de carte postale pour les couples en quête d''un mariage chargé de romantisme et d''histoire, à seulement deux heures de Paris.',
  '[{"titre":"Manoirs & fermes normandes","texte":"La Normandie regorge de manoirs à colombages et de corps de ferme restaurés, idéaux pour des mariages intimes dans un cadre authentique et très photogénique, avec souvent un hébergement intégré.","couleur_accent":"#A57D27"},{"titre":"Côte d''Albâtre & falaises spectaculaires","texte":"Étretat, Fécamp, Dieppe — les falaises blanches de la côte normande offrent des panoramas époustouflants pour des cérémonies en plein air ou des photos de mariage iconiques.","couleur_accent":"#2D4356"},{"titre":"Gastronomie normande généreuse","texte":"Camembert, livarot, pont-l''évêque, calvados, cidre, crème fraîche, agneau de pré-salé, coquilles Saint-Jacques — la gastronomie normande est riche et festive, parfaite pour un repas de mariage convivial.","couleur_accent":"#8E4A49"},{"titre":"Proximité de Paris","texte":"À deux heures de Paris en train depuis Rouen ou Caen, et une heure quarante d''Honfleur, la Normandie est facilement accessible pour des invités parisiens tout en offrant un dépaysement total dans la verdure normande.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Surveillez la météo de près","texte":"La Normandie est réputée pour ses changements météo rapides — il peut faire un soleil radieux le matin et pleuvoir à seize heures. Un mariage en extérieur nécessite toujours une solution de repli. Les manoirs avec grande salle et jardin clos sont les configurations idéales."},{"numero":"02","titre":"Profitez des vergers en fleur au printemps","texte":"Avril et mai sont magnifiques en Normandie avec les pommiers en fleur dans tout le bocage. C''est la période idéale pour des mariages bucoliques dans les fermes et vergers normands, et l''occasion d''intégrer un cidre fermier dans votre cocktail."},{"numero":"03","titre":"Intégrez le calvados dans votre mariage","texte":"Le calvados, cidre et poiré normands sont les boissons emblématiques de la région. Faites appel à un cidrier ou producteur local pour un bar à cocktails normand authentique — un atout différenciant pour vos invités urbains qui découvriront un autre terroir."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Normandie ?","reponse":"Le budget moyen est de dix-neuf mille euros selon les données LesNoces. La fourchette va de huit mille euros pour une ferme normande authentique à quarante-huit mille euros pour un château classé avec parc et hébergement sur place."},{"question":"Peut-on se marier près des falaises d''Étretat ?","reponse":"Oui — plusieurs domaines et manoirs autour d''Étretat proposent des mariages avec vue sur les falaises de la côte d''Albâtre. La cérémonie en plein air sur les hauteurs d''Étretat est possible mais nécessite une autorisation municipale, à demander six mois à l''avance."},{"question":"Quelle est la meilleure saison pour se marier en Normandie ?","reponse":"Juin, juillet et août offrent les meilleures conditions météo (vingt à vingt-cinq degrés). Avril-mai est beau (floraison des pommiers, paysages verts) mais plus frais et plus humide. Septembre peut être très agréable avec les couleurs d''automne sur le bocage."},{"question":"Y a-t-il des prestataires dans le Mont-Saint-Michel et la Manche ?","reponse":"Oui — LesNoces référence des prestataires dans toute la Normandie, y compris la Manche, le Cotentin et les environs du Mont-Saint-Michel, une destination mariage de plus en plus prisée pour sa silhouette unique au monde."}]'::jsonb,
  'La Normandie propose des cadres de mariage entre manoirs à colombages, falaises d''Étretat et bocage verdoyant. Le budget moyen d''un mariage en Normandie est de dix-neuf mille euros selon LesNoces, de huit à quarante-huit mille euros. Les meilleures périodes sont juin, juillet, août et septembre, à réserver huit à douze mois à l''avance. La région se distingue par ses fermes normandes authentiques, sa gastronomie riche (camembert, calvados, cidre) et sa proximité de Paris (deux heures en train). Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'La Normandie est probablement la région française la mieux placée pour le mariage week-end de proximité depuis Paris. À deux heures de la capitale, elle offre un vrai dépaysement — paysages bocagers, manoirs à colombages, falaises et littoral — sans imposer la logistique d''un mariage destination. C''est aussi une région qui pratique des tarifs raisonnables, avec un excellent rapport qualité-prix sur les lieux comme sur les prestataires.

**Cinq départements, deux Normandies**

La Haute-Normandie historique (Seine-Maritime, Eure) offre la Normandie la plus accessible depuis Paris. Rouen est à une heure dix par train, la côte d''Albâtre à deux heures. Le département concentre des châteaux historiques (Bénédictins de Fécamp, abbayes en pierre blanche, manoirs Renaissance) et la spectaculaire côte d''Albâtre avec Étretat comme star incontestée. L''Eure, plus rural, propose des prix très accessibles dans le pays d''Auge et la vallée de la Risle.

La Basse-Normandie (Calvados, Manche, Orne) est la Normandie carte postale. Le Calvados concentre l''image classique — Honfleur et ses colombages, Deauville-Trouville et le casino, le pays d''Auge avec ses manoirs à pans de bois, la côte fleurie de Cabourg à Houlgate. C''est aussi le département où la densité de très beaux lieux de mariage est la plus forte — manoirs à colombages, fermes-cidre restaurées, hôtels Belle Époque. Les tarifs y sont plus élevés que dans le reste de la Normandie, particulièrement autour de Deauville.

La Manche et l''Orne sont les départements à explorer pour les couples qui cherchent l''authenticité et les meilleurs rapports qualité-prix. Le Cotentin offre une côte sauvage rappelant la Bretagne, des manoirs et fermes restaurées à des tarifs trente pour cent inférieurs au Calvados voisin. Le Mont-Saint-Michel, à la frontière, est une destination mariage en pleine ascension — plusieurs domaines à proximité immédiate proposent des mariages avec la silhouette monumentale en arrière-plan.

**Saison et climat normand**

La météo normande mérite une explication précise. La région reçoit régulièrement des précipitations mais en quantité modérée — sept cents à mille millimètres par an, comparable à la moyenne nationale. Ce qui caractérise la Normandie, c''est plutôt la variabilité dans la journée. Le matin peut être brumeux, l''après-midi ensoleillé, le soir pluvieux, puis l''arc-en-ciel à dix-huit heures. Cette variabilité oblige à prévoir un plan B couvert pour tout événement en extérieur, mais elle offre aussi des lumières exceptionnelles très prisées des photographes.

La saison utile s''étend de mai à septembre. Juin et septembre sont les meilleurs mois (températures de dix-huit à vingt-deux degrés, journées longues, faible affluence touristique hors littoral). Juillet et août sont possibles mais saturent les hébergements de la côte. Avril et mai bénéficient de la floraison des pommiers — quatre semaines magiques pour des photos uniques dans le bocage en fleur.

**Gastronomie : richesse et générosité**

La gastronomie normande est dense, beurrée, gourmande — l''opposé exact de la cuisine méditerranéenne. Les produits-phares sont nombreux et tous d''exception : camembert, livarot, pont-l''évêque et neufchâtel pour les fromages ; beurre d''Isigny AOP ; crème normande ; coquilles Saint-Jacques de Port-en-Bessin ; agneau de pré-salé de la baie du Mont-Saint-Michel ; pommes et poires fermières pour le cidre, le poiré et le calvados. Un repas de mariage normand se construit naturellement autour d''un plateau de fromages d''exception, d''un plat de viande ou poisson avec sauce à la crème, d''un trou normand (calvados entre deux plats), et d''un dessert aux pommes ou aux poires.

Comptez soixante-dix à cent vingt euros par personne pour un service traiteur complet. Le cidre et le poiré peuvent légitimement remplacer le champagne pour le cocktail — une signature locale particulièrement appréciée des invités étrangers.

**Logistique : la proximité comme avantage**

La proximité avec Paris est l''argument principal. Rouen est à une heure dix de Paris-Saint-Lazare, Caen à deux heures, Cherbourg à trois heures. La grande majorité des lieux de mariage sont à moins de deux heures de route depuis Paris, ce qui permet des week-ends de mariage où les invités viennent de la capitale sans s''arracher au quotidien. Pour les invités internationaux, l''aéroport de Roissy reste la porte d''entrée principale, avec une liaison routière fluide.

**Style et tendances déco**

Le style normand cultive une élégance naturelle aux fortes inspirations anglaises — héritage d''une longue proximité culturelle avec l''Angleterre toute proche. La palette joue les couleurs douces : blanc, crème, vert tendre, bleu ardoise, rose ancien, en harmonie avec le bocage et les jardins. La décoration florale s''inspire des jardins romantiques anglais : roses, hortensias, pivoines, feuillages abondants, compositions un peu sauvages plutôt que strictes. Les manoirs à colombages, avec leur cheminée monumentale et leurs pommiers en fleur au printemps, composent une scénographie naturelle qui demande peu d''ajouts. Les haras normands — domaines équestres aux longues allées et écuries de prestige — sont devenus des lieux de réception très recherchés, apportant une élégance hippique particulière. C''est une esthétique de l''authenticité raffinée : moins sophistiquée que le faste francilien, mais d''une justesse que les couples en quête d''un mariage champêtre-chic à l''anglaise viennent spécifiquement chercher en Normandie.

**L''esprit d''un mariage normand**

Le mariage en Normandie a un esprit familial et chaleureux qui le distingue. Moins exubérant qu''un mariage breton, moins sophistiqué qu''un mariage francilien, plus authentique qu''un mariage côte d''Azur — il s''inscrit dans une tradition rurale française très spécifique. Les manoirs à colombages avec leur cheminée monumentale, leur grange-réception et leurs pommiers en jardin créent une scénographie naturelle qui ne demande presque rien aux fleuristes et décorateurs. C''est une région qui se prête particulièrement aux mariages champêtres-chic à budget maîtrisé, et aux couples qui aiment l''idée d''un weekend en famille élargie dans un cadre verdoyant et préservé.',
  19000,
  8000,
  48000,
  'Juin, juillet, août, septembre',
  '8 à 12 mois',
  'Mariage en Normandie — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Normandie. Manoirs normands, côte d''Albâtre, falaises d''Étretat — prestataires validés par LesNoces en Seine-Maritime, Calvados et Manche.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 9. Pays de la Loire
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'pays-de-la-loire',
  'Pays de la Loire',
  'La Loire royale, ses châteaux Renaissance et ses vignobles (Muscadet, Anjou, Saumur) font des Pays de la Loire une destination mariage d''une élégance intemporelle. Entre Nantes la dynamique, la douceur angevine et les plages de Vendée, la région offre une variété de cadres pour tous les styles de mariage.',
  '[{"titre":"Châteaux de la Loire Renaissance","texte":"Plusieurs châteaux Renaissance et domaines historiques sont accessibles dans le Maine-et-Loire et la Loire-Atlantique, offrant des cadres royaux à des tarifs souvent inférieurs au Centre-Val de Loire voisin.","couleur_accent":"#A57D27"},{"titre":"Vignobles & vins de Loire","texte":"Muscadet, Anjou, Saumur, Layon — les vins de Loire sont parmi les plus élégants de France. Les domaines viticoles proposent des mariages avec dégustation et visite des caves troglodytes du Saumurois.","couleur_accent":"#8E4A49"},{"titre":"Nantes & villes dynamiques","texte":"Nantes, Le Mans et Angers proposent des espaces de réception urbains modernes et des traiteurs innovants, pour des mariages contemporains dans des lieux de caractère et une scène culinaire en plein renouveau.","couleur_accent":"#2D4356"},{"titre":"Plages de Vendée & littoral atlantique","texte":"Les Sables-d''Olonne, Noirmoutier, l''île de Ré (accessible depuis la Vendée) — la côte vendéenne propose des mariages bord de mer avec des plages de sable blanc et un climat plus doux que la Bretagne voisine.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Profitez des caves troglodytes saumuroises","texte":"Le Saumurois est creusé de caves troglodytes utilisées pour l''élevage des vins de Champigny et de Saumur. Certaines se prêtent à des dîners de mariage exceptionnels — fraîches naturellement en été (douze à quatorze degrés), atmosphère unique, scénographie déjà spectaculaire."},{"numero":"02","titre":"Réservez huit à douze mois à l''avance","texte":"La région est moins tendue que l''Île-de-France ou la Provence. Huit à douze mois suffisent généralement, sauf pour les domaines châtelains les plus prestigieux du Val de Loire classé UNESCO qui demandent quatorze à dix-huit mois."},{"numero":"03","titre":"Intégrez une dégustation de vins locaux","texte":"Proposez à vos invités une dégustation guidée de vins de Loire lors du cocktail — Muscadet sur lie, Anjou rouge, Saumur-Champigny, Coteaux du Layon. Les vignerons locaux proposent des animations conviviales à des tarifs très accessibles et apportent une vraie touche culturelle."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Pays de la Loire ?","reponse":"Le budget moyen est de vingt mille euros selon LesNoces. La fourchette va de huit mille euros pour une ferme vendéenne authentique à cinquante mille euros pour un château Renaissance privatisé avec hébergement sur le domaine et accord avec un domaine viticole local."},{"question":"Peut-on se marier dans un château du Val de Loire ?","reponse":"Oui — plusieurs propriétés du Val de Loire classé UNESCO proposent des locations pour mariages privés. Comptez cinq à quinze mille euros pour la location du lieu seul. Les plus beaux châteaux Renaissance sont souvent en Indre-et-Loire (région Centre-Val de Loire voisine), mais le Maine-et-Loire offre de très belles alternatives."},{"question":"Y a-t-il des lieux de mariage en bord de mer en Vendée ?","reponse":"Oui — la Vendée propose des domaines et salles de réception avec vue sur l''océan Atlantique, notamment autour des Sables-d''Olonne, de Saint-Jean-de-Monts et de l''île de Noirmoutier, avec un climat plus doux et ensoleillé que la Bretagne voisine."},{"question":"Nantes est-elle une bonne ville pour un mariage ?","reponse":"Absolument — Nantes est une ville en plein renouveau culturel avec des espaces de réception atypiques (hangars rénovés sur l''île de Nantes, anciennes usines transformées, château des Ducs de Bretagne) et une scène traiteurs et fleuristes très dynamique."}]'::jsonb,
  'Les Pays de la Loire offrent une offre mariage entre châteaux Renaissance du Val de Loire, vignobles de Muscadet et Saumur, et plages de Vendée. Le budget moyen d''un mariage dans la région est de vingt mille euros selon LesNoces, de huit à cinquante mille euros. Les meilleures périodes sont mai, juin, septembre et octobre. La région se distingue par ses caves troglodytes saumuroises, ses domaines viticoles et la diversité de ses territoires (Loire, Vendée, Nantes). Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Les Pays de la Loire occupent une place particulière dans la géographie du mariage français — souvent oublié au profit du Centre-Val de Loire voisin pour ses châteaux, ou de la Bretagne voisine pour son atlantique. C''est pourtant une région stratégique pour les couples qui cherchent un compromis : l''élégance des châteaux Renaissance sans les tarifs touraine, la côte atlantique sans les contraintes bretonnes, des prix raisonnables et une accessibilité TGV directe.

**Cinq départements, trois identités**

La Loire-Atlantique, autour de Nantes, est aujourd''hui la zone la plus dynamique de la région. Nantes en deux décennies est devenue une ville de référence pour les mariages urbains contemporains — île de Nantes avec ses friches industrielles reconverties, château des Ducs de Bretagne, hangars sur les quais, restaurants étoilés et bistrots branchés. C''est probablement la ville française qui a le mieux réussi sa réinvention urbaine, avec une scène créative qui se ressent dans l''offre mariage. Le pays nantais offre aussi le vignoble du Muscadet, à trente minutes du centre-ville, avec des domaines viticoles privatisables à des tarifs très accessibles.

Le Maine-et-Loire, autour d''Angers et Saumur, est la partie historique et viticole de la région. Angers est une ville d''une douceur particulière — climat le plus tempéré de France selon une étude souvent citée, ardoise et tuffeau, jardins, château d''Angers. Le Saumurois concentre une spécificité unique : les caves troglodytes, creusées dans le tuffeau et utilisées depuis des siècles pour l''élevage des vins. Certaines accueillent aujourd''hui des mariages dans une scénographie qui ne ressemble à rien d''autre en France — atmosphère fraîche et stable toute l''année, dépaysement immédiat. C''est aussi le département des châteaux Renaissance et médiévaux le long de la Loire — Brézé, Brissac, Le Plessis-Bourré.

La Vendée propose un univers radicalement différent — atlantique chic à la française. Les Sables-d''Olonne, Saint-Jean-de-Monts, Noirmoutier offrent des plages de sable blanc, un climat plus ensoleillé et plus chaud que la Bretagne voisine, des domaines en bord de mer ou en arrière-pays bocager. Le sud Vendée, autour du Marais Poitevin (Venise verte), propose des cadres aquatiques uniques.

Mayenne et Sarthe sont les départements ruraux à explorer pour les budgets serrés — manoirs, fermes-châteaux et domaines à des tarifs très compétitifs, à seulement une heure de Paris en TGV (Le Mans).

**Saison et climat : la douceur ligérienne**

Le Val de Loire bénéficie d''un microclimat tempéré dû au fleuve, avec des températures globalement douces toute l''année. La saison utile s''étend de mai à octobre, avec un confort climatique souvent supérieur aux régions voisines : moins chaud que l''Aquitaine en été, moins humide que la Bretagne, moins pluvieux que la Normandie. Juin et septembre sont les mois optimaux, avec des températures autour de vingt-deux à vingt-cinq degrés et une lumière dorée caractéristique du fleuve. Octobre offre un défi photographique exceptionnel avec les vignobles aux couleurs d''automne. Sur la côte vendéenne, l''ensoleillement est l''un des plus élevés de la façade atlantique française — un argument concret pour un mariage bord de mer plus ensoleillé qu''en Bretagne.

**Gastronomie : entre fleuve et océan**

La gastronomie de la région est une cuisine de fleuve et de littoral — sandre, brochet et anguille de Loire, fruits de mer et coquillages de la côte vendéenne, beurre blanc nantais, rillauds d''Anjou, gâche vendéenne, fouace, fromages locaux comme le crémet d''Anjou ou le caillé de brebis. Les vins de Loire couvrent toute la palette : Muscadet sur lie (l''un des meilleurs accords mondialement reconnus avec les fruits de mer), Anjou rouge et rosé, Saumur-Champigny, Coteaux du Layon (liquoreux d''exception pour le dessert), Sancerre à proximité (techniquement Centre). Comptez soixante-dix à cent vingt euros par personne pour un service traiteur complet.

**Logistique : un avantage TGV**

Nantes est à deux heures dix de Paris-Montparnasse par TGV direct. Angers à une heure trente, Le Mans à cinquante-cinq minutes. C''est l''une des régions françaises les mieux desservies par le rail à grande vitesse depuis Paris. L''aéroport de Nantes-Atlantique propose des liaisons européennes pour les invités internationaux. Pour la Vendée, comptez quatre-vingt-dix minutes de route depuis Nantes ou La Rochelle (gare TGV).

**Style et tendances déco**

Le style ligérien atlantique se décline selon deux décors. Dans l''intérieur — châteaux Renaissance, manoirs en tuffeau, caves troglodytes, vignobles de Loire — l''esthétique est élégante et romantique : pastels, art de la table soigné, décoration florale classique, scénographie qui reprend les codes des châteaux. Sur le littoral vendéen, le registre bascule vers le bord de mer : palette de blanc, de bleu et de sable, matières naturelles, décoration plus légère et lumineuse. Nantes et les villes de la région apportent une troisième voie, plus contemporaine — lieux atypiques, design actuel, esprit urbain. Les caves troglodytes du Saumurois offrent un cadre particulièrement singulier, minéral et intime, que les couples mettent en valeur par un éclairage travaillé. C''est une région qui permet de composer un mariage très classique ou résolument moderne selon le lieu choisi — une polyvalence stylistique que peu de régions offrent.

**L''esprit d''un mariage ligérien**

Le mariage en Pays de la Loire est probablement le plus "français classique" qui soit — ni provençal lumineux, ni breton identitaire, ni parisien sophistiqué, mais une élégance ligérienne discrète, un goût du beau sans ostentation, une table qui marie le fleuve et la mer. C''est une région qui se prête particulièrement bien aux mariages traditionnels élégants, aux couples qui veulent du caractère sans flamboyance, et aux mariages avec invités issus de plusieurs régions françaises (la centralité géographique est un atout). Les couples qui cherchent l''authenticité du Val de Loire à des tarifs raisonnables, sans aller jusqu''aux châteaux ultra-prisés d''Indre-et-Loire, trouvent ici l''équation idéale.',
  20000,
  8000,
  50000,
  'Mai, juin, septembre, octobre',
  '8 à 12 mois',
  'Mariage en Pays de la Loire — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Pays de la Loire. Châteaux de la Loire, vignobles, plages de Vendée — prestataires validés par LesNoces en Loire-Atlantique, Maine-et-Loire et Vendée.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 10. Grand Est
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'grand-est',
  'Grand Est',
  'Entre la Champagne et ses vignobles pétillants, l''Alsace et ses villages à colombages, et les Vosges avec ses châteaux médiévaux, le Grand Est est une région aux multiples visages pour un mariage. Strasbourg, Reims et Colmar offrent des cadres architecturaux exceptionnels, tandis que le vignoble alsacien propose des domaines de caractère unique.',
  '[{"titre":"Vignobles champenois & caves de prestige","texte":"Reims et Épernay sont au cœur du vignoble champagne. Certaines Maisons de Champagne proposent des mariages dans leurs caves classées UNESCO, pour une célébration littéralement pétillante et unique au monde.","couleur_accent":"#A57D27"},{"titre":"Villages alsaciens à colombages","texte":"Eguisheim, Riquewihr, Colmar — les villages alsaciens sont parmi les plus beaux d''Europe. Les winstubs et fermes alsaciennes proposent des mariages au cœur d''un décor de conte de fées allemand-français.","couleur_accent":"#8E4A49"},{"titre":"Châteaux médiévaux des Vosges","texte":"Le Haut-Koenigsbourg, le château du Fleckenstein et de nombreuses ruines et châteaux restaurés des Vosges offrent des cadres médiévaux spectaculaires pour des mariages de caractère historique.","couleur_accent":"#2D4356"},{"titre":"Strasbourg & grandes villes","texte":"Strasbourg, capitale européenne, propose des espaces de réception de standing dans son centre historique classé UNESCO, avec des traiteurs aux influences franco-allemandes uniques en France.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Profitez des caves de Champagne","texte":"Plusieurs Maisons de Champagne (Moët & Chandon, Veuve Clicquot, Taittinger, Ruinart) organisent des visites privées et proposent des partenariats avec des lieux de mariage locaux. Un accord de principe en amont peut débloquer des tarifs préférentiels et des bouteilles d''exception."},{"numero":"02","titre":"Réservez tôt pour l''Alsace en été","texte":"L''Alsace est très touristique en juillet-août. Les domaines viticoles alsaciens et les gîtes de charme dans les villages à colombages sont complets très tôt — réservez dix à quatorze mois à l''avance pour les meilleurs emplacements de la Route des Vins."},{"numero":"03","titre":"Intégrez les traditions alsaciennes","texte":"Le mariage alsacien a ses traditions : bretzel offert aux mariés, musique de fanfare, cigogne porte-bonheur, kougelhopf en pièce montée. Les prestataires locaux vous aideront à intégrer ces éléments culturels pour un mariage authentique."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage dans le Grand Est ?","reponse":"Le budget moyen est de vingt mille euros selon LesNoces. La fourchette va de huit mille euros pour une ferme alsacienne authentique à cinquante mille euros pour un domaine viticole champenois avec hébergement et accord champagne inclus."},{"question":"Peut-on se marier dans une cave de Champagne ?","reponse":"Certaines Maisons de Champagne proposent des formules privatisation pour mariages VIP. Les caves classées UNESCO d''Épernay et Reims sont des lieux uniques au monde. Comptez un budget premium (à partir de vingt mille euros pour la seule location) et une réservation dix-huit mois minimum."},{"question":"Quelle est la meilleure période pour un mariage en Alsace ?","reponse":"Juin, juillet et août sont les plus sûrs côté météo (vingt-deux à vingt-huit degrés en moyenne). Septembre est très beau (vendanges, vignobles colorés en jaune-rouge). Décembre avec les marchés de Noël alsaciens est une option originale et mémorable pour les mariages d''hiver."},{"question":"Y a-t-il des lieux de mariage en Lorraine ?","reponse":"Oui — Nancy et sa place Stanislas classée UNESCO, les stations thermales de la Meuse (Plombières, Vittel) et les châteaux lorrains proposent des cadres de mariage originaux encore peu connus, à des tarifs très compétitifs."}]'::jsonb,
  'Le Grand Est propose une offre mariage unique entre caves de Champagne classées UNESCO, villages alsaciens à colombages et châteaux médiévaux des Vosges. Le budget moyen d''un mariage dans la région est de vingt mille euros selon LesNoces, de huit à cinquante mille euros. Les meilleures périodes sont juin, juillet, août et septembre. La région se distingue par ses Maisons de Champagne (Reims, Épernay), ses villages alsaciens (Colmar, Eguisheim) et la capitale européenne Strasbourg. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Le Grand Est est une région de fusion administrative (Alsace + Champagne-Ardenne + Lorraine) qui réunit en réalité trois univers culturels distincts. Aucune autre région française n''offre une telle disparité de cadres de mariage entre ses sous-territoires — et c''est précisément cette diversité qui en fait une des régions les plus intéressantes pour les couples cherchant un mariage hors des sentiers battus.

**Trois sous-régions, trois mariages**

La Champagne (Marne, Ardennes, Aube, Haute-Marne) est la signature mondiale de la région. Reims, Épernay, Aÿ, Hautvillers — ces noms évoquent immédiatement le vin de fête le plus célèbre au monde. Plusieurs Maisons de Champagne acceptent les mariages dans leurs caves classées UNESCO (creusées dans la craie sur des dizaines de kilomètres), parfois jusqu''à trente mètres sous terre. C''est une expérience unique : votre dîner se déroule entre les bouteilles qui vieillissent depuis des décennies, dans une atmosphère stable à douze degrés toute l''année. Les Maisons de premier plan (Moët, Veuve Clicquot, Taittinger, Ruinart) acceptent quelques mariages par an avec des budgets de prestige ; d''autres Maisons moyennes et grands vignerons indépendants offrent des alternatives plus accessibles. Les vignobles eux-mêmes, classés UNESCO, offrent des panoramas exceptionnels pour les cérémonies en extérieur.

L''Alsace (Bas-Rhin, Haut-Rhin) est la France la moins française — architecture germanique, dialecte vivant, traditions culinaires spécifiques, identité culturelle marquée. Les villages à colombages de la Route des Vins (Eguisheim, Riquewihr, Kaysersberg, Ribeauvillé) sont parmi les plus beaux d''Europe et plusieurs ont été classés "plus beau village de France". Les domaines viticoles alsaciens proposent des mariages dans une scénographie de conte de fées : maisons à pans de bois roses et bleues, vignobles vallonnés, châteaux médiévaux en arrière-plan, gastronomie franco-allemande unique. Strasbourg, capitale européenne, ajoute une dimension urbaine internationale avec ses palais européens, son centre historique UNESCO (la Petite France), et sa scène gastronomique étoilée.

La Lorraine (Meurthe-et-Moselle, Meuse, Moselle, Vosges) est la grande oubliée de la région — à tort. Nancy possède l''une des plus belles places monumentales d''Europe (place Stanislas, UNESCO), entourée de palais XVIIIᵉ siècle où l''on peut louer salons et galeries pour des mariages d''un raffinement rare. Les stations thermales lorraines (Plombières, Vittel, Contrexéville) offrent des hôtels Belle Époque avec capacité de réception, à des tarifs sensiblement inférieurs à l''Alsace voisine. Les châteaux médiévaux des Vosges et le massif vosgien lui-même proposent des cadres alpins-sans-Alpes à seulement deux heures de Paris.

**Saison et climat**

Le Grand Est a un climat continental marqué, avec des étés chauds et des hivers froids — plus de contraste qu''à l''Atlantique. La saison utile pour les mariages en extérieur s''étend de mai à septembre, avec un pic en juin-juillet où l''Alsace et la Champagne sont les plus belles. Septembre est exceptionnel pendant les vendanges — les vignobles passent au jaune et au rouge, l''ambiance des villages alsaciens devient particulièrement chaleureuse, les températures sont parfaites (vingt à vingt-cinq degrés en journée). La fenêtre Marchés de Noël (fin novembre à fin décembre) offre une option de mariage hivernal absolument unique pour les couples non bridés par les contraintes habituelles — décor sapins illuminés, gastronomie d''hiver, vin chaud en cocktail, ambiance féerique.

**Gastronomie : un terroir bicéphale**

La gastronomie du Grand Est est probablement la plus diversifiée de France — coq au riesling, choucroute, baeckeoffe, tarte flambée, kougelhopf, foie gras alsacien, gâteau au pommes en Alsace ; quiche lorraine, mirabelle, dragées de Verdun, fromages de Munster et Bleu des Causses en Lorraine ; et bien sûr le champagne dans toute la région. Les traiteurs locaux proposent souvent des menus à thématique alsacienne ou champenoise selon la zone — un choix qui surprend agréablement les invités venant d''autres régions. Comptez soixante-quinze à cent trente euros par personne pour un service complet. L''accord champagne (Maison de référence ou champagne du vigneron local) est un standard incontournable.

**Logistique : un quadrant européen**

La position géographique du Grand Est est stratégique pour les mariages internationaux. Strasbourg est à deux heures vingt de Paris en TGV mais aussi à deux heures de Munich et trois heures et demie de Zurich par autoroute. Reims est à quarante-cinq minutes de Paris en TGV. La Lorraine est à proximité du Luxembourg, de la Belgique et de l''Allemagne. Pour les couples avec une partie allemande ou luxembourgeoise de la famille, le Grand Est offre des solutions logistiques optimales et des prestataires bilingues. L''aéroport de Strasbourg propose des liaisons européennes ; Bâle-Mulhouse-Fribourg (frontière trinationale) offre des connexions internationales.

**Style et tendances déco**

Le style du Grand Est puise dans un patrimoine décoratif d''une grande richesse. En Champagne, l''esthétique est naturellement raffinée et pétillante : le champagne lui-même structure la réception, l''art de la table est élégant, les caves de prestige offrent un décor minéral spectaculaire. En Alsace, les villages à colombages et leur ornementation colorée inspirent une décoration chaleureuse et identitaire — fleurs généreuses, palette vive, traditions assumées. Les châteaux médiévaux des Vosges appellent un registre plus romantique et historique. La tendance commune à la région est l''attachement aux savoir-faire locaux et aux traditions : un mariage dans le Grand Est intègre volontiers des éléments régionaux sans renoncer à l''élégance. C''est une esthétique qui assume son enracinement, portée par des prestataires fiers de leur terroir et validés un à un par LesNoces.

**L''esprit d''un mariage Grand Est**

Le mariage dans le Grand Est porte presque toujours une touche transfrontalière — culturelle, gastronomique, parfois linguistique. C''est une région où l''on assume sa proximité avec l''Allemagne et la Suisse, où la table mêle saucisse et choucroute à des plats français classiques, où la musique de fanfare peut côtoyer un quatuor à cordes Mozart. Les mariages en Champagne ont une atmosphère plus protocolaire et viticole ; les mariages alsaciens sont plus joyeux et identitaires ; les mariages lorrains plus discrets et raffinés. Pour les couples qui aiment l''idée d''un mariage à signature culturelle forte, qui assume une identité régionale singulière, le Grand Est offre probablement les options les plus distinctives de France.',
  20000,
  8000,
  50000,
  'Juin, juillet, août, septembre',
  '8 à 12 mois',
  'Mariage dans le Grand Est — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage dans le Grand Est. Alsace, Champagne, Lorraine — prestataires validés par LesNoces à Strasbourg, Reims, Colmar et dans toute la région.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 11. Bourgogne-Franche-Comté
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'bourgogne-franche-comte',
  'Bourgogne-Franche-Comté',
  'La Bourgogne, c''est l''alliance parfaite entre les plus grands vins du monde, des paysages de vignobles classés UNESCO et une gastronomie réputée à l''international. Entre Dijon la ducale, Beaune la viticole et les montagnes du Jura, la région offre un cadre de mariage d''une élégance rare.',
  '[{"titre":"Domaines viticoles de la Côte d''Or","texte":"Gevrey-Chambertin, Nuits-Saint-Georges, Meursault, Puligny-Montrachet — les domaines de la Côte d''Or proposent des mariages avec dégustations des plus grands vins du monde dans des caves du XVe siècle classées UNESCO.","couleur_accent":"#A57D27"},{"titre":"Châteaux bourguignons","texte":"La Bourgogne compte de nombreux châteaux restaurés proposant des formules mariage complètes, souvent associés à un domaine viticole pour un accord lieu-vin parfait et une cohérence terroir maximale.","couleur_accent":"#8E4A49"},{"titre":"Gastronomie d''exception","texte":"Escargots, bœuf bourguignon, époisses, comté affiné, pain d''épices, kir — la gastronomie bourguignonne est reconnue mondialement. Dijon concentre des chefs étoilés et traiteurs d''excellence.","couleur_accent":"#2D4356"},{"titre":"Paysages des Cluniacs & du Jura","texte":"L''abbaye de Cluny, les reculées du Jura, les lacs de la Haute-Saône — la Franche-Comté offre des paysages naturels préservés pour des mariages nature loin des sentiers battus, à des tarifs très accessibles.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Mariez-vous en septembre pendant les vendanges","texte":"Septembre est la période idéale en Bourgogne : les vignes prennent leurs couleurs d''automne (jaune, ocre, rouge), les vendanges animent les domaines, et les températures sont parfaites (dix-huit à vingt-quatre degrés). Un spectacle naturel unique pour votre mariage."},{"numero":"02","titre":"Associez lieu et domaine viticole","texte":"De nombreux prestataires bourguignons proposent des formules clés en main associant la location d''un château et l''approvisionnement en vins du domaine voisin. Une cohérence lieu-terroir très appréciée des invités, et souvent plus économique qu''une approche séparée."},{"numero":"03","titre":"Explorez la Franche-Comté","texte":"Moins connue que la Bourgogne viticole, la Franche-Comté (Besançon, Belfort, les lacs du Jura, les villages du Doubs) propose des lieux de mariage originaux et préservés à des tarifs inférieurs de vingt à trente pour cent à la Côte d''Or voisine."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Bourgogne-Franche-Comté ?","reponse":"Le budget moyen est de vingt-deux mille euros selon LesNoces. La fourchette va de neuf mille euros pour une ferme jurassienne à cinquante-cinq mille euros pour un château de la Côte d''Or avec domaine viticole privatisé et grands vins inclus."},{"question":"Peut-on se marier dans un domaine viticole de la Côte d''Or ?","reponse":"Oui — plusieurs domaines de la Côte d''Or proposent des formules mariage privatif incluant la visite des caves, la dégustation et l''approvisionnement en vins. Comptez un budget premium (lieu seul à partir de huit mille euros) et réservez douze à dix-huit mois à l''avance."},{"question":"Quelle est la meilleure période pour un mariage en Bourgogne ?","reponse":"Juin est idéal (beau temps, vignes vertes, températures de vingt-deux à vingt-cinq degrés). Septembre pendant les vendanges est exceptionnel (couleurs, ambiance, températures parfaites). Juillet-août peut être très chaud dans les caves et compliqué pour la conservation des vins en service."},{"question":"Y a-t-il des prestataires dans le Jura et la Franche-Comté ?","reponse":"Oui — LesNoces référence des prestataires dans toute la région, incluant Besançon, Lons-le-Saunier, Pontarlier et les lacs du Jura. Les tarifs y sont généralement vingt à trente pour cent inférieurs à ceux de la Bourgogne viticole, pour une qualité souvent excellente."}]'::jsonb,
  'La Bourgogne-Franche-Comté propose une offre mariage d''exception entre domaines viticoles de la Côte d''Or classés UNESCO, châteaux bourguignons et gastronomie de renommée mondiale. Le budget moyen d''un mariage dans la région est de vingt-deux mille euros selon LesNoces, de neuf à cinquante-cinq mille euros. Les meilleures périodes sont juin, juillet et septembre (vendanges). La région se distingue par ses caves du XVe siècle, ses grands vins (Gevrey, Meursault, Puligny) et la diversité des paysages jurassiens. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'La Bourgogne est, dans l''imaginaire des amateurs de vin, le centre du monde — territoire des plus grands climats, des appellations communales et des grands crus mythiques. Pour un mariage, cela se traduit par une combinaison unique : des domaines viticoles d''un niveau historique inégalé, une gastronomie de référence mondiale, et des paysages classés au patrimoine de l''UNESCO depuis 2015. La région voisine — la Franche-Comté — apporte un contrepoint plus rural, plus accessible, qui élargit considérablement l''offre.

**La Côte d''Or, terre des grands climats**

La Côte d''Or concentre ce qui fait la mythologie viticole bourguignonne. De Dijon à Santenay sur cinquante kilomètres, c''est l''enchaînement le plus dense des grands crus mondiaux : Gevrey-Chambertin, Morey-Saint-Denis, Chambolle-Musigny, Vougeot, Vosne-Romanée, Nuits-Saint-Georges au nord (Côte de Nuits, principalement rouges) ; Aloxe-Corton, Beaune, Pommard, Volnay, Meursault, Puligny-Montrachet, Chassagne-Montrachet au sud (Côte de Beaune, blancs et rouges). Plusieurs domaines acceptent les mariages privés, généralement avec une exigence d''image forte et des tarifs prémium. Les caves voûtées du XVᵉ-XVIIᵉ siècle creusées dans la roche calcaire offrent des cadres de dîner uniques au monde, à atmosphère stable autour de douze degrés toute l''année.

L''argument terroir est ici à son apogée : se marier dans le domaine où est produit le vin que l''on sert au repas est une expérience que peu d''autres régions peuvent offrir avec ce niveau de prestige.

**Beaune, la capitale du vin**

Beaune, ville de vingt mille habitants au cœur de la Côte d''Or, est le centre commercial et culturel du vin de Bourgogne. Les Hospices de Beaune, le palais des Ducs de Bourgogne, les hôtels particuliers du XVIIIᵉ siècle proposent des espaces de réception remarquables. La ville concentre les meilleurs caves, négociants, et restaurants étoilés de la région. Pour un mariage urbain bourguignon, c''est l''option naturelle — élégance discrète, atmosphère vin et patrimoine, accessibilité immédiate à tous les domaines de la Côte.

**Au-delà de la Côte d''Or**

La Bourgogne ne se résume pas à la Côte d''Or. Le Mâconnais et le Beaujolais (techniquement Auvergne-Rhône-Alpes pour ce dernier) offrent des domaines à des tarifs sensiblement plus accessibles, avec une qualité viticole en pleine ascension. Cluny et son abbaye fondatrice de la chrétienté médiévale apportent une dimension historique unique — les bâtiments monastiques en pierre dorée du Mâconnais sont une signature régionale forte. Auxerre et le Chablisien au nord, avec leurs blancs de chardonnay minéraux, proposent un mariage à proximité immédiate de l''autoroute Paris-Beaune (deux heures de Paris).

**La Franche-Comté, alternative préservée**

La Franche-Comté apporte un autre univers — montagnes du Jura, forêts denses, lacs d''altitude, villages préservés. Le vignoble jurassien (Arbois, Château-Chalon) produit des vins atypiques — vin jaune, vin de paille, macvin — souvent méconnus mais d''une originalité remarquable. Les fermes-château du Doubs, les villages du Pays Horloger, le massif du Jura offrent des paysages alpins-sans-Alpes, à des tarifs très accessibles. C''est une zone qui se prête particulièrement aux mariages nature et aux couples qui cherchent l''authenticité montagnarde sans le ticket d''entrée savoyard.

**Saison et climat**

La Bourgogne a un climat continental — hivers froids, étés chauds. La saison utile pour les mariages s''étend de mai à octobre. Juin est le mois le plus stable (vingt-deux à vingt-six degrés, vignes en pleine pousse). Juillet-août sont parfois caniculaires avec des températures pouvant atteindre trente-six à trente-huit degrés, ce qui complique les cérémonies en extérieur et la conservation des vins. Septembre est probablement le mois optimal — vendanges, vignobles colorés, températures parfaites, ambiance générale dans les villages. Octobre offre des couleurs spectaculaires mais plus de risque météo.

**Gastronomie : un terroir reconnu mondialement**

La gastronomie bourguignonne fait partie du patrimoine culinaire mondial. Bœuf bourguignon, coq au vin, escargots à la bourguignonne, jambon persillé, gougères, époisses (fromage), comté affiné (de Franche-Comté), pain d''épices de Dijon, cassis pour le kir. Les traiteurs locaux exploitent ce terrain avec un niveau d''exécution exceptionnel. Le poste vin est le plus singulier — un mariage en Bourgogne avec accord vins offre une expérience que peu d''autres régions peuvent égaler : un grand cru blanc en cocktail, un Volnay ou Pommard en accompagnement du plat principal, un Coteaux du Layon ou un vin de paille au dessert. Comptez quatre-vingts à cent quarante euros par personne pour un service traiteur complet, hors vins.

**Logistique**

Dijon est à une heure trente de Paris-Lyon par TGV direct. Beaune à deux heures dix. Mâcon à une heure quarante. C''est l''une des régions les mieux desservies par le rail à grande vitesse. L''aéroport de Dijon-Bourgogne est limité aux vols intra-européens ; pour les invités internationaux, Lyon-Saint-Exupéry à deux heures de route est l''alternative principale. La centralité géographique du Grand Est et de la Bourgogne en fait un lieu de rendez-vous naturel pour des invités venant de Paris, du Sud-Est, de la Suisse et de l''Allemagne.

**Style et tendances déco**

L''esthétique bourguignonne est celle d''une élégance vigneronne — sobre, ancrée dans le terroir, sans démonstration. La palette s''inspire du vignoble : tons de pierre, de bordeaux profond, de doré automnal, d''écru. Dans les domaines viticoles de la Côte d''Or et les châteaux bourguignons, la grammaire décorative reprend les codes de l''art de vivre du vin : art de la table classique, accords mets-vins mis en scène, caves voûtées sublimées par l''éclairage, compositions florales en tons chauds. La gastronomie tient une place centrale dans la scénographie — un mariage bourguignon se pense souvent autour de la table et du vin avant la décoration. La Franche-Comté et le Jura apportent une note plus naturelle et montagnarde, avec des décors de forêt, de lac et de pierre. C''est une région où le style privilégie la justesse et le terroir à l''effet — une élégance discrète que les couples sensibles au vin et à la gastronomie viennent spécifiquement chercher.

**L''esprit d''un mariage bourguignon**

Le mariage en Bourgogne porte une signature précise : élégance discrète, exigence sur la table, importance majeure du vin et de l''accord mets-vins, ambiance conviviale mais cultivée. Les invités ressentent qu''ils participent à quelque chose qui dépasse le simple repas — il y a une dimension culturelle, presque rituelle. Pour les amateurs de vin, pour les couples avec une sensibilité gastronomique, pour ceux qui aiment l''idée d''un mariage où chaque plat et chaque vin a une histoire, la Bourgogne est probablement la région la plus aboutie de France. C''est aussi une région qui se prête bien aux mariages avec invités étrangers oenophiles — anglo-saxons, asiatiques, scandinaves — qui voient dans la Bourgogne une destination de pèlerinage.',
  22000,
  9000,
  55000,
  'Juin, juillet, septembre (vendanges)',
  '8 à 12 mois',
  'Mariage en Bourgogne-Franche-Comté — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Bourgogne. Domaines viticoles, châteaux de la Côte d''Or, gastronomie — prestataires validés par LesNoces en Bourgogne et Franche-Comté.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 12. Centre-Val de Loire
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'centre-val-de-loire',
  'Centre-Val de Loire',
  'Le Val de Loire classé au patrimoine mondial de l''UNESCO concentre la plus grande densité de châteaux Renaissance au monde. Chambord, Chenonceau, Amboise, Azay-le-Rideau — le Centre-Val de Loire est la région des rois de France et le cadre idéal pour un mariage royalement beau.',
  '[{"titre":"Châteaux Renaissance uniques au monde","texte":"Chambord, Chenonceau, Villandry, Cheverny — le Val de Loire concentre les plus beaux châteaux de la Renaissance française. Plusieurs domaines privés à l''architecture similaire proposent des mariages exclusifs et privatifs.","couleur_accent":"#A57D27"},{"titre":"Jardins à la française & potagers","texte":"Les jardins extraordinaires de Villandry, les parcs des châteaux privés et les jardins secrets de la Touraine créent des décors floraux incomparables pour les cérémonies en extérieur, particulièrement en mai-juin.","couleur_accent":"#5F6F52"},{"titre":"Vignobles de Touraine & Sancerre","texte":"Vouvray, Bourgueil, Chinon, Sancerre, Pouilly-Fumé — les vignobles du Val de Loire produisent des vins élégants et festifs. Les domaines viticoles proposent souvent des locations pour mariages, avec accord parfait avec la gastronomie locale.","couleur_accent":"#8E4A49"},{"titre":"Douceur du climat ligérien","texte":"Le Val de Loire bénéficie d''un micro-climat doux grâce au fleuve. Les températures sont agréables de mai à octobre, idéales pour les mariages en extérieur dans les parcs et jardins des châteaux.","couleur_accent":"#2D4356"}]'::jsonb,
  '[{"numero":"01","titre":"Choisissez un château privé, pas un monument","texte":"Les grands châteaux classés et gérés par l''État (Chambord, Chenonceau, Azay-le-Rideau, Villandry) ne peuvent pas être privatisés pour des mariages. Mais des dizaines de châteaux et manoirs privés de style identique le permettent, pour un résultat souvent plus intime et exclusif."},{"numero":"02","titre":"Profitez des jardins en mai-juin","texte":"Les roses, pivoines et jardins à la française du Val de Loire sont au sommet de leur beauté en mai et juin. C''est la période idéale pour des photos de mariage extraordinaires dans les parterres fleuris — un argument différenciant à anticiper."},{"numero":"03","titre":"Associez votre lieu à un vigneron local","texte":"Les vignerons de Vouvray, Chinon, Bourgueil ou Sancerre proposent des animations dégustation lors de votre cocktail. Un service traiteur associant foie gras de Touraine, fromage de chèvre AOP (Sainte-Maure, Selles-sur-Cher) et vins de Loire est une proposition gastronomique inoubliable."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Centre-Val de Loire ?","reponse":"Le budget moyen est de vingt-et-un mille euros selon LesNoces. La fourchette va de neuf mille euros pour un domaine rural de Sologne à cinquante-deux mille euros pour un château Renaissance privatisé avec parc, hébergement et accord mets-vins."},{"question":"Peut-on se marier dans un château de la Loire classé UNESCO ?","reponse":"Non pour les monuments nationaux (Chambord, Chenonceau, Azay-le-Rideau sont gérés par l''État ou par des fondations qui n''acceptent pas les mariages privés). Oui pour les nombreux châteaux et domaines privés de style Renaissance qui proposent des mariages exclusifs dans le Val de Loire — l''offre est riche et de très haut niveau."},{"question":"Quelle est la meilleure période pour un mariage dans les châteaux de la Loire ?","reponse":"Mai et juin sont exceptionnels (jardins en fleur, beau temps stable, températures de vingt-deux à vingt-cinq degrés). Juillet-août peut être chaud mais les soirées restent agréables grâce à la fraîcheur du fleuve. Septembre offre une belle lumière dorée sur les vignobles et coïncide avec les vendanges."},{"question":"Y a-t-il des prestataires dans le Loiret et le Cher ?","reponse":"Oui — LesNoces référence des prestataires dans toute la région, incluant Orléans, Blois, Tours, Bourges et les zones rurales de Sologne, Beauce et Berry. Les départements moins connus (Cher, Indre) offrent souvent les meilleurs rapports qualité-prix."}]'::jsonb,
  'Le Centre-Val de Loire est la région des châteaux de la Renaissance française, avec la plus forte densité de châteaux classés UNESCO au monde. Le budget moyen d''un mariage dans la région est de vingt-et-un mille euros selon LesNoces, de neuf à cinquante-deux mille euros. Les meilleures périodes sont mai, juin, juillet et septembre. La région se distingue par ses châteaux privés de style Renaissance, ses jardins à la française et ses vignobles (Vouvray, Chinon, Sancerre). Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Le Centre-Val de Loire occupe une place à part dans la cartographie du mariage français. C''est la région que les couples étrangers — américains, britanniques, asiatiques — viennent chercher en priorité quand ils choisissent la France comme destination de mariage. La densité de châteaux Renaissance, l''inscription UNESCO du Val de Loire entre Sully-sur-Loire et Chalonnes, la concentration de jardins à la française classés — tout concourt à faire de cette région un standard mondial du "wedding French castle".

**Le Val de Loire UNESCO : un patrimoine unique au monde**

Le Val de Loire entre Sully et Chalonnes-sur-Loire a été inscrit au patrimoine mondial de l''UNESCO en 2000 comme paysage culturel évolutif. Cette inscription reconnaît une concentration unique au monde de châteaux Renaissance, de villages historiques, de vignobles et de paysages fluviaux préservés. Pour un mariage, cela se traduit par un cadre légalement et culturellement protégé qui n''a pas d''équivalent international.

Les châteaux les plus iconiques (Chambord, Chenonceau, Azay-le-Rideau, Villandry, Amboise, Blois) ne peuvent pas être privatisés pour des mariages — ils sont gérés par le Centre des monuments nationaux ou par des fondations qui en font des sites de visite publique. C''est important à comprendre dès le début pour éviter les déceptions. Mais autour de ces monuments, plusieurs dizaines de châteaux et manoirs privés du même style architectural acceptent les mariages exclusifs. C''est souvent une meilleure option : intimité préservée, exclusivité totale, possibilité de personnaliser la scénographie, hébergement sur place.

**Les départements et leurs caractéristiques**

L''Indre-et-Loire (Touraine) concentre la plus haute densité de châteaux Renaissance privatisables, particulièrement autour de Tours, Amboise, Chinon et Loches. C''est le département le plus demandé et donc le plus tendu en disponibilités. Les tarifs y sont les plus élevés de la région.

Le Loir-et-Cher (Sologne, Blésois) offre un cadre légèrement moins prestigieux mais avec d''excellentes alternatives — domaines de chasse en Sologne, châteaux du Blaisois, manoirs en pierre de tuffeau. Les tarifs y sont plus accessibles.

Le Cher (Berry) et l''Indre proposent les meilleures bonnes affaires de la région — châteaux et manoirs à des tarifs trente à quarante pour cent inférieurs à la Touraine pour une qualité architecturale équivalente. C''est aussi le département de Sancerre, prestigieux vignoble de Loire.

Le Loiret et l''Eure-et-Loir offrent l''avantage de la proximité parisienne — Orléans est à une heure de Paris en TGV, Chartres à cinquante minutes. Les châteaux du nord de la région (Sully-sur-Loire, Maintenon, Châteaudun) sont idéaux pour les mariages franciliens cherchant un cadre exceptionnel sans s''éloigner.

**Saison et climat ligérien**

Le Val de Loire bénéficie d''un microclimat tempéré, l''un des plus doux de France à cette latitude. La fraîcheur du fleuve modère les chaleurs estivales, le climat océanique adouci par les terres adoucit l''hiver. La saison utile s''étend de fin avril à mi-octobre, avec un pic en mai-juin (jardins en pleine floraison, températures parfaites) et en septembre (vendanges, vignobles colorés). Juillet-août sont moins recommandés que dans le sud de la France — la chaleur peut être lourde dans les châteaux non climatisés et les jardins défleurissent. Mai est probablement le mois le plus magique pour un mariage en Val de Loire : pivoines, roses, glycines, lilas — tout fleurit en même temps.

**Gastronomie et vins de Loire**

La gastronomie de la région est délicate, fluviale, élégante — fromages de chèvre AOP (Sainte-Maure-de-Touraine, Selles-sur-Cher, Valençay, Crottin de Chavignol), rillons de Touraine, beuchelle, asperges et fraises de Sologne, gibier d''automne, fruits du verger. Les vins de Loire couvrent toute la palette — Vouvray (chenin blanc sec ou demi-sec d''exception), Chinon et Bourgueil (cabernets francs rouges), Saumur-Champigny (techniquement Pays de la Loire), Sancerre et Pouilly-Fumé (sauvignon blanc minéraux), Coteaux du Layon (liquoreux pour les desserts). C''est probablement la palette viticole la plus complète et accessible de France. Comptez quatre-vingts à cent vingt euros par personne pour un service traiteur complet.

**Logistique**

Le Val de Loire est exceptionnellement accessible depuis Paris. Orléans est à une heure en TER, Blois à une heure trente en TGV, Tours à une heure dix en TGV direct. C''est probablement la région française avec le meilleur rapport qualité-prix accessibilité-prestige pour un mariage parisien. L''aéroport de Tours est limité aux vols intra-européens ; pour les invités internationaux, Paris-Roissy à deux heures de route reste la porte d''entrée principale.

**Style et tendances déco**

Le style ligérien est celui du chic romantique à la française, dicté par cinq siècles d''architecture Renaissance. La palette privilégie les pastels — rose poudré, bleu ciel, vert tendre, ivoire — en écho aux jardins à la française et aux salons d''époque. L''art de la table y est particulièrement soigné : porcelaine, argenterie, cristal, chemins de table fleuris, menus calligraphiés — la scénographie reprend les codes des grandes maisons françaises. La décoration florale est raffinée et abondante sans être tapageuse : pivoines, roses anciennes, glycines, lilas, dahlias selon la saison, en compositions classiques. Les jardins à la française des châteaux offrent un décor déjà composé, que les fleuristes viennent simplement souligner. C''est une esthétique intemporelle, qui ne suit pas les modes : un mariage en Val de Loire ressemble autant à une célébration d''aujourd''hui qu''à une fête d''il y a un siècle — et c''est précisément ce que les couples, français comme étrangers, viennent y chercher.

**L''esprit d''un mariage en Val de Loire**

Le mariage dans les châteaux de la Loire porte une signature mondiale — c''est l''image que se font les anglo-saxons d''un mariage français de prestige : château Renaissance, jardins à la française, vins de Loire, gastronomie raffinée, ambiance courtoise. Pour les couples avec invités étrangers, c''est probablement la région qui parle le plus universellement à toutes les cultures. Pour les couples français, c''est l''élégance classique par excellence — sans le maniérisme parisien, sans l''exubérance provençale, sans l''identité forte d''une Bretagne ou d''une Alsace. Une élégance discrète, raffinée, intemporelle. C''est aussi une région qui se prête particulièrement aux mariages avec cérémonie laïque dans les jardins du château, suivie d''un dîner dans les salons d''époque et d''une soirée dans l''orangerie ou la salle de bal — la scénographie est déjà écrite par cinq siècles d''architecture.',
  21000,
  9000,
  52000,
  'Mai, juin, juillet, septembre',
  '8 à 14 mois',
  'Mariage en Centre-Val de Loire — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Centre-Val de Loire. Châteaux de la Loire, Chambord, Chenonceau — prestataires validés par LesNoces dans la région des châteaux de la Loire.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- 13. Corse
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO pages_regions_mariage (
  slug_region, nom_region, intro_editoriale,
  specificites, conseils, faq,
  citation_llm, contenu_seo_bas,
  budget_moyen, budget_min, budget_max,
  meilleure_periode, delai_reservation,
  meta_title, meta_description,
  est_publiee
) VALUES (
  'corse',
  'Corse',
  'Maquis parfumé, mer turquoise, montagnes sauvages et villages perchés — la Corse est l''île la plus belle de Méditerranée et une destination mariage d''exception pour les couples qui cherchent l''exotisme sans quitter la France. Entre le luxe de Porto-Vecchio et l''authenticité de la Haute-Corse, chaque mariage en Corse est unique.',
  '[{"titre":"Plages & mer turquoise","texte":"Palombaggia, Rondinara, Saleccia, Loto — les plages corses sont parmi les plus belles d''Europe. Les domaines avec accès privatif à une plage de sable blanc sont très prisés pour les mariages bord de mer.","couleur_accent":"#2D4356"},{"titre":"Villages perchés & nature sauvage","texte":"Bonifacio sur ses falaises de calcaire, Corte dans les gorges, Sartène la Corse des Corses — les villages perchés offrent des panoramas spectaculaires pour des cérémonies laïques en plein air, à des hauteurs souvent vertigineuses.","couleur_accent":"#8E4A49"},{"titre":"Gastronomie corse d''exception","texte":"Charcuterie AOP (lonzu, coppa, figatellu), fromages au lait cru (brocciu, niolu), vins de Patrimonio et Ajaccio, châtaignes, miel AOP — la gastronomie corse est intense, généreuse et très identitaire pour un repas de mariage inoubliable.","couleur_accent":"#A57D27"},{"titre":"Exclusivité & intimité garanties","texte":"La Corse impose une certaine logistique (avion ou bateau) qui sélectionne naturellement les invités les plus motivés. Un mariage en Corse a quelque chose d''exclusif et de fort symboliquement — c''est presque un engagement secondaire de la part des invités.","couleur_accent":"#5F6F52"}]'::jsonb,
  '[{"numero":"01","titre":"Évitez juillet-août en basse altitude","texte":"La Corse est extrêmement touristique en haute saison (trente à quarante degrés, routes encombrées, hébergements doublés voire triplés en prix). Privilégiez mai, juin ou septembre pour des températures parfaites (vingt-deux à vingt-sept degrés) et des prestataires plus disponibles."},{"numero":"02","titre":"Anticipez la logistique transport","texte":"Avion ou bateau sont les seules options pour atteindre la Corse. Bloquez les billets d''avion pour vos invités dès la réservation du lieu — les vols en juillet-août coûtent deux à trois fois plus cher qu''en juin ou septembre. Pour les bagages encombrants (robe, décor), prévoyez le bateau Marseille ou Toulon avec véhicule."},{"numero":"03","titre":"Choisissez un prestataire corse local","texte":"Les prestataires continentaux méconnaissent souvent les contraintes logistiques insulaires (rupture d''approvisionnement, distances effectives, vent dominant). Un traiteur, photographe et fleuriste corse local sera plus efficace, moins cher (pas de frais de transport vers l''île) et plus ancré dans la culture locale."}]'::jsonb,
  '[{"question":"Quel budget prévoir pour un mariage en Corse ?","reponse":"Le budget moyen est de vingt-six mille euros selon LesNoces. La fourchette va de douze mille euros pour un mariage intime dans un gîte de montagne à soixante-cinq mille euros pour un domaine privatisé avec plage et hébergement à Porto-Vecchio ou en Balagne."},{"question":"Quelle est la meilleure période pour se marier en Corse ?","reponse":"Mai, juin et septembre sont idéaux : mer à vingt-deux à vingt-cinq degrés, fleurs de maquis, pas de foule touristique, prestataires disponibles et billets d''avion quarante à soixante pour cent moins chers qu''en juillet-août. Octobre reste possible mais le risque météo augmente."},{"question":"Comment gérer la logistique pour un mariage en Corse avec des invités du continent ?","reponse":"Prévoyez minimum douze à dix-huit mois à l''avance pour bloquer les billets d''avion au meilleur prix. Certains domaines proposent de l''hébergement sur place (villas, gîtes) pour éviter les problèmes de navette. Pour quatre-vingts invités ou plus, envisagez un vol charter privé depuis Paris ou Lyon — souvent plus économique au global."},{"question":"Y a-t-il des prestataires de qualité en Haute-Corse (Bastia, Cap Corse) ?","reponse":"Oui — LesNoces référence des prestataires dans les deux départements corses. La Haute-Corse (Patrimonio, Saint-Florent, Cap Corse, Balagne) est moins fréquentée que la Corse-du-Sud mais offre des paysages et des vins exceptionnels, souvent à des tarifs plus accessibles."}]'::jsonb,
  'La Corse est une destination mariage d''exception — plages de sable blanc, maquis parfumé, villages perchés et gastronomie intense. Le budget moyen d''un mariage en Corse est de vingt-six mille euros selon LesNoces, de douze à soixante-cinq mille euros. Les meilleures périodes sont mai, juin, septembre et octobre, à réserver douze à dix-huit mois à l''avance pour anticiper la logistique transport (avion ou bateau). La Corse se distingue par son exclusivité naturelle, ses plages privatisables et sa gastronomie AOP unique. Tous les prestataires sont validés manuellement par LesNoces avant publication.',
  'Se marier en Corse, c''est faire un choix radical. C''est probablement la destination mariage la plus exigeante de France en termes de logistique, mais aussi la plus mémorable pour les invités. L''insularité est à la fois la contrainte principale et l''argument différenciant absolu — un mariage corse n''est jamais "un mariage de plus", c''est une expérience qui marque tous les participants, parfois pour des années.

**Deux départements, deux Corses**

La Corse-du-Sud (Ajaccio, Porto-Vecchio, Bonifacio, Propriano, Sartène) concentre l''image internationale de la Corse — plages de sable blanc, eaux turquoise, falaises calcaires de Bonifacio, villages génois préservés. C''est aussi la zone la plus touristique en haute saison, avec un afflux de yachts à Porto-Vecchio qui fait monter les prix à des niveaux similaires à Saint-Tropez en juillet-août. Hors saison, c''est une zone splendide et beaucoup plus accessible. Plusieurs domaines avec accès privatif à une plage (rare en France) y proposent des mariages avec cérémonie pieds dans le sable.

La Haute-Corse (Bastia, Saint-Florent, Calvi, Île-Rousse, Corte) est moins fréquentée et offre une expérience plus authentique. La Balagne, autour de Calvi et Île-Rousse, propose des villages perchés (Sant''Antonino, Pigna), des domaines viticoles AOP (Patrimonio, Cap Corse), des plages préservées (Saleccia, Lotu — accessibles seulement par bateau ou piste). Le Nebbio autour de Saint-Florent est devenu en dix ans une destination mariage haut de gamme avec plusieurs domaines viticoles privatisables. Corte, ancienne capitale et ville étudiante au cœur de l''île, offre un cadre montagnard unique avec les gorges de la Restonica.

**Saison et climat : un calendrier rigoureux**

La Corse a un climat méditerranéen marqué — étés très chauds et secs, hivers doux et pluvieux. La saison utile s''étend de mai à octobre, avec deux fenêtres optimales : mai-juin et septembre-octobre. Mai offre les premières floraisons du maquis (arbousier, myrte, lentisque), une mer encore tempérée mais déjà baignable, des températures de vingt-deux à vingt-cinq degrés. Juin est probablement le mois optimal — chaleur installée mais supportable, journées longues, peu de touristes (les locations balnéaires explosent à partir du 1er juillet). Septembre offre une mer à son maximum thermique (vingt-trois à vingt-six degrés), des températures clémentes en journée, des prestataires disponibles après la cohue estivale. Juillet et août sont à éviter sauf cas spécifique — la chaleur peut dépasser trente-cinq degrés, les routes sont saturées, les tarifs explosent.

**Logistique : le paramètre déterminant**

L''accessibilité est la grande question du mariage corse. L''île dispose de quatre aéroports (Ajaccio, Bastia, Calvi, Figari) avec des liaisons quotidiennes depuis Paris, Lyon, Marseille, Nice, et plusieurs villes européennes en été. Les ferries depuis Marseille, Toulon, Nice et l''Italie permettent de venir avec son véhicule — pratique pour transporter robe, décor floral, matériel de mariage. La règle pratique : pour quarante invités ou moins, l''avion individuel est la meilleure option. Au-dessus de quatre-vingts invités, un vol charter privé depuis Paris ou Lyon devient économiquement et logistiquement intéressant — comptez douze à dix-huit mille euros pour un charter complet, à diviser par le nombre d''invités, soit souvent moins cher que des billets individuels en pleine saison.

Réservez les vols et hébergements de vos invités au moins quatorze mois à l''avance. La haute saison touristique satureles disponibilités très rapidement. Privilégiez les lieux avec hébergement intégré (villas privatisables, domaines avec gîtes, hôtels-domaines) — c''est l''option la plus sereine, même si la plus coûteuse.

**Gastronomie corse : un terroir d''exception**

La gastronomie corse est l''une des plus identitaires de France et bénéficie d''un niveau exceptionnel de produits AOP. La charcuterie (lonzu, coppa, prisuttu, figatellu) est sans équivalent en Méditerranée — élevée en semi-liberté sur le maquis, séchée traditionnellement. Les fromages au lait cru (brocciu AOP, niolo, bastelicaccia) varient selon les microclimats de l''île. Les vins ont fait un bond qualitatif spectaculaire en vingt ans : Patrimonio, Cap Corse, Ajaccio, Figari, Porto-Vecchio produisent des vins de niveau international à base de cépages autochtones (niellucciu, sciaccarellu, vermentinu). Les châtaignes (Castagniccia), le miel AOP de Corse, l''huile d''olive AOP, les agrumes du Cap — la palette gastronomique est unique. Les traiteurs locaux proposent des menus très identitaires à des tarifs plus élevés que la moyenne nationale (la logistique insulaire renchérit les coûts) : comptez cent à cent soixante euros par personne pour un service complet.

**Hébergement : un poste budgétaire majeur**

L''hébergement est probablement le poste qui distingue le plus le mariage corse des autres régions. En haute saison, les hôtels haut de gamme et villas en location peuvent atteindre des tarifs prohibitifs. La bonne pratique : privilégier les domaines avec hébergement intégré, qui permettent de loger tous les invités sur place ou à proximité immédiate, et de transformer le mariage en week-end de trois ou quatre jours. C''est l''option qui maximise l''expérience pour les invités (ils découvrent vraiment l''île) et qui justifie l''investissement logistique.

**Style et tendances déco**

Le style corse est celui du luxe discret — un raffinement qui ne s''affiche pas, parce que le décor naturel se suffit à lui-même. Maquis parfumé, mer turquoise, falaises calcaires, villages génois : la Corse offre des décors naturels spectaculaires que la décoration vient seulement souligner. La palette est minérale et végétale — blanc, écru, sable, vert maquis, touches de bleu profond — déclinée en matières naturelles : lin, bois flotté, osier, céramique artisanale. Les compositions florales restent sobres et locales : myrte, arbouse, immortelle, branches d''olivier. La tendance forte est aux expériences intimistes et prolongées : les invités viennent pour plusieurs jours, le mariage se vit comme une parenthèse insulaire, et la mise en scène cède le pas à l''authenticité du lieu. C''est l''inverse exact du mariage démonstratif — un luxe qui se mesure à la rareté du cadre, à l''exclusivité de l''expérience et à l''intimité du moment, bien plus qu''à l''opulence de la décoration.

**L''esprit d''un mariage corse**

Un mariage en Corse est un événement à part. L''insularité crée une intimité forte — les invités qui viennent jusque-là savent qu''ils s''engagent dans une expérience, pas seulement dans une fête. Beaucoup viennent quatre ou cinq jours, transforment le mariage en mini-vacances, et garderont un souvenir marquant. La culture corse, son sens de la famille élargie et de l''hospitalité, sa gastronomie identitaire, ses paysages spectaculaires entre mer et montagne — tout concourt à créer une atmosphère que les autres régions méditerranéennes (Provence, Côte d''Azur) ne reproduisent pas exactement. Pour les couples qui assument le ticket logistique d''entrée, c''est probablement la destination la plus mémorable de France métropolitaine — un mariage que personne, parmi les invités, n''oubliera.',
  26000,
  12000,
  65000,
  'Mai, juin, septembre, octobre',
  '12 à 18 mois',
  'Mariage en Corse — Prestataires & Conseils | LesNoces.net',
  'Organisez votre mariage en Corse. Plages de sable blanc, maquis, villages corses — prestataires validés par LesNoces en Haute-Corse et Corse-du-Sud.',
  false
)
ON CONFLICT (slug_region) DO UPDATE SET
  nom_region        = EXCLUDED.nom_region,
  intro_editoriale  = EXCLUDED.intro_editoriale,
  specificites      = EXCLUDED.specificites,
  conseils          = EXCLUDED.conseils,
  faq               = EXCLUDED.faq,
  citation_llm      = EXCLUDED.citation_llm,
  contenu_seo_bas   = EXCLUDED.contenu_seo_bas,
  budget_moyen      = EXCLUDED.budget_moyen,
  budget_min        = EXCLUDED.budget_min,
  budget_max        = EXCLUDED.budget_max,
  meilleure_periode = EXCLUDED.meilleure_periode,
  delai_reservation = EXCLUDED.delai_reservation,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  est_publiee       = EXCLUDED.est_publiee,
  updated_at        = NOW();

-- ============================================================================
-- Fin du seed. Vérification :
--   SELECT slug_region, nom_region, est_publiee FROM pages_regions_mariage ORDER BY nom_region;
-- ============================================================================