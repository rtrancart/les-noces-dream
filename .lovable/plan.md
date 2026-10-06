# Réactivation de Cloudflare Turnstile : inscription uniquement

## 1. État des lieux (constaté dans le code, rien n'a été modifié)

**Ce qui existe déjà**
- Un composant de contrôle anti-robot réutilisable, branché sur la clé de site publique. Si la clé est absente, il ne s'affiche pas et le contrôle est ignoré.
- **Page Connexion** : contrôle affiché, bouton grisé tant qu'il n'est pas validé, jeton envoyé au service de connexion.
- **Page Inscription** (mariés et prestataires, même formulaire) : même logique, jeton envoyé avec l'inscription.
- **Mot de passe oublié, Paramètres (vérification du mot de passe actuel), activation des prestataires migrés** : aucun jeton envoyé.
- **Vérification côté serveur** : aucune. Aucune fonction ne lit TURNSTILE_SECRET_KEY, et la protection anti-robot intégrée au service de connexion n'est pas activée. Aujourd'hui le contrôle est donc purement visuel : un robot qui appelle directement l'inscription n'est pas bloqué.

**Ce qui avait provoqué le blocage (27/09)**
- Le bouton « Se connecter » attendait le jeton anti-robot, mais la clé de site n'était configurée nulle part : le contrôle affichait « vérification indisponible » et le bouton restait grisé pour tout le monde.
- Correctif appliqué à ce moment-là : sans clé, le contrôle disparaît et la connexion et l'inscription fonctionnent sans protection. La clé n'a jamais été ajoutée depuis, donc le contrôle est inactif partout aujourd'hui (aperçu et site en ligne).

## 2. Approche retenue

**La protection anti-robot intégrée au service de connexion ne convient pas.** Elle s'applique d'un bloc à la connexion, au mot de passe oublié, aux codes par email et à l'inscription. Elle bloquerait donc la connexion, le reset et la vérification du mot de passe dans Paramètres, ce qui sort du périmètre voulu. On ne l'active pas.

**À la place, l'inscription passe par une fonction serveur qui vérifie le jeton :**
1. Le formulaire Inscription envoie email, mot de passe, prénom, nom, rôle, consentement et jeton à une nouvelle fonction « inscription ».
2. La fonction vérifie le jeton auprès de Cloudflare avec TURNSTILE_SECRET_KEY. Si le jeton est invalide : refus, message clair, contrôle relancé.
3. Si le jeton est valide, la fonction crée le compte non confirmé avec les mêmes informations qu'aujourd'hui (rôle, consentement marketing, nom commercial). Les mécanismes actuels s'appliquent sans changement : création du profil, de la fiche prestataire, synchro Brevo.
4. La fonction envoie l'email de confirmation habituel. Le parcours et la redirection après confirmation restent identiques.
5. **L'inscription publique directe est coupée** dans les réglages de l'authentification : un robot ne peut plus créer de compte sans passer par la fonction. La connexion, le reset, les liens magiques et la création de comptes par l'admin ou par l'invitation ne dépendent pas de ce réglage : ils continuent de fonctionner.

**Point à savoir :** le formulaire Inscription sert aussi aux prestataires. Une fois l'inscription publique coupée, l'inscription prestataire doit elle aussi passer par la fonction, sinon elle serait bloquée. Les deux rôles auront donc le contrôle anti-robot. C'est le seul ajout par rapport au périmètre « client seulement ».

**On retire le contrôle de la page Connexion** (plus de jeton, bouton jamais grisé par le contrôle). Mot de passe oublié, Paramètres et activation des migrés restent intacts.

## 2bis. Réponses aux quatre précisions
- **Google ou autre fournisseur** : aucun. Le site ne propose que l'email et le mot de passe : il n'y a aucun bouton Google ni autre fournisseur dans le code. Couper l'inscription publique ne bloque donc aucun autre parcours. Si Google est ajouté un jour, il faudra revoir ce réglage.
- **Limite par IP** : stockée dans une petite table en base, `inscriptions_tentatives`, avec l'IP sous forme d'empreinte et la date. Règle : 5 tentatives par IP et par heure. Seule la fonction serveur peut lire et écrire cette table. Les lignes de plus de 24 h sont purgées par la tâche de nuit.
- **Mot de passe** : le formulaire et la page de nouveau mot de passe exigent 6 caractères. La fonction applique donc aussi 6 caractères, et non 8, pour rester identique. Je vérifierai le réglage de l'authentification avant de coder. Le contrôle des mots de passe piratés reste actif.
- **Email de confirmation** : créer le compte depuis la fonction n'envoie pas d'email automatiquement. La fonction enverra donc elle-même l'email, avec le même gabarit « Confirmez votre adresse email », le même expéditeur (notify.lesnoces.net) et le même canal d'envoi qu'aujourd'hui. Le lien est fourni par l'authentification, avec la même durée de validité. Test prévu : comparer l'email reçu avec l'email actuel.

## 3. Retour arrière immédiat

Deux interrupteurs, du plus léger au plus complet :
- **Interrupteur A (sans republier)** : un réglage serveur `TURNSTILE_DESACTIVE=true`. Quand il est actif, la fonction accepte l'inscription sans vérifier le jeton, et le formulaire n'exige plus le contrôle. Les inscriptions continuent donc de fonctionner, simplement sans protection. Je peux l'activer sur simple demande, en moins d'une minute.
- **Interrupteur B (retour complet)** : réactiver l'inscription publique directe et republier la version précédente du formulaire.

La connexion ne dépend plus du tout de Turnstile, donc le blocage du 27/09 ne peut pas se reproduire.

## 4. Tests sur l'aperçu, avant publication
1. **Inscription client** avec une adresse de test : contrôle validé, compte créé, email de confirmation reçu, rôle et consentement corrects. Puis suppression du compte de test.
2. **Inscription avec un faux jeton** (appel direct à la fonction) : refusée.
3. **Appel direct à l'inscription publique** sans passer par le formulaire : refusé.
4. **Connexion** d'un compte existant : aucun contrôle, connexion réussie.
5. **Mot de passe oublié** : email de réinitialisation envoyé.
6. **Activation d'un prestataire migré** par lien : session ouverte, aucun contrôle.
7. **Interrupteur A** : activé, inscription acceptée sans jeton ; puis désactivé.

## 5. Ce que vous devrez faire de votre côté
- Dans Cloudflare Turnstile, déclarer les domaines : lesnoces.net, www.lesnoces.net, les-noces.lovable.app, le domaine d'aperçu Lovable et localhost.
- Sur Vercel, ajouter `VITE_TURNSTILE_SITE_KEY = 0x4AAAAAAFPd39OfotSu2iy4`, puis redéployer. La clé de site est publique : je l'ajoute aussi dans le code comme valeur par défaut, pour que l'aperçu fonctionne.

## Détails techniques
- Nouvelle fonction `supabase/functions/inscription/index.ts`. Données validées avec Zod (email, mot de passe d'au moins 6 caractères, rôle client ou prestataire, champs optionnels).
- Vérification par POST sur `challenges.cloudflare.com/turnstile/v0/siteverify` avec `secret`, `response` et `remoteip`.
- Création du compte via `admin.generateLink({ type: "signup", email, password, options: { data, redirectTo } })`, avec les mêmes métadonnées qu'aujourd'hui pour que les triggers restent inchangés. Le lien est envoyé avec le gabarit d'email de confirmation existant. Une adresse déjà utilisée renvoie le même message qu'aujourd'hui.
- Limite par IP : table `inscriptions_tentatives` (ip_hash, created_at). Règles d'accès actives sans aucune autorisation publique, accès réservé à la fonction serveur. La purge est ajoutée à la tâche de nuit.
- Email : rendu du gabarit partagé `signup.tsx`, puis envoi par le même client d'envoi Lovable que la fonction d'email d'authentification, avec le lien de confirmation fourni par l'authentification.
- `Inscription.tsx` : remplacer `supabase.auth.signUp` par `supabase.functions.invoke("inscription")`. `Connexion.tsx` : retirer le widget et le `captchaToken`.
- Le formulaire lit l'interrupteur via une petite réponse de la fonction (GET de configuration), ce qui évite de republier pour l'activer.
- Réglage de l'authentification : `disable_signup = true`. Les appels avec la clé de service (`createUser`, `generateLink`) restent autorisés.
- Règle consignée dans AGENTS.md : les inscriptions passent uniquement par la fonction serveur.
