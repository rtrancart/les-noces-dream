# UTM sur les emails envoyés par la plateforme

Objectif : pouvoir mesurer dans vos statistiques ce que rapporte chaque email (visites, comptes activés, demandes de devis), en marquant automatiquement tous les liens des emails.

## Principe retenu

Un seul point d'ajout, au moment de l'envoi : tous les liens de l'email pointant vers le site reçoivent automatiquement les paramètres de suivi. Aucun modèle d'email à modifier un par un, aucun risque d'oubli lors de la création d'un futur email.

Règles appliquées :
- `utm_source=lesnoces_email` (identique partout)
- `utm_medium=email`
- `utm_campaign` = famille de l'email (voir tableau)
- `utm_content` = nom exact de l'email (permet de distinguer M-01 / M-02 / M-03…)
- Liens ignorés : `mailto:`, images, lien de désinscription, et **les emails d'authentification** (connexion, mot de passe oublié, changement d'email) — on ne touche pas aux liens contenant un jeton de sécurité.
- Un paramètre déjà présent dans le lien n'est jamais écrasé.

## Liste des emails et UTM proposés

### Cycle de vie prestataire (invitation / activation)
| Email | utm_campaign | utm_content |
|---|---|---|
| Invitation prestataire (magic link) | `presta_onboarding` | `invitation_prestataire` |
| Relance découverte J+7 | `presta_onboarding` | `relance_decouverte_j7` |
| Dernier contact tunnel A | `presta_onboarding` | `dernier_contact_tunnel_a` |

### Campagne de reprise du parc migré (chaîne M)
| Email | utm_campaign | utm_content |
|---|---|---|
| M-01 Réactivation | `migration_2026` | `m01_reactivation` |
| M-02 Relance activation 1 | `migration_2026` | `m02_relance` |
| M-03 Relance activation 2 | `migration_2026` | `m03_relance` |
| M-04 Dernière relance | `migration_2026` | `m04_relance` |
| M-05 Charte non signée | `migration_2026` | `m05_charte` |

### Charte qualité
| Email | utm_campaign | utm_content |
|---|---|---|
| Relance signature de la Charte | `charte` | `relance_signature_charte` |
| Nouvelle version de la Charte | `charte` | `nouvelle_version_charte` |
| Suspension (exemption expirée) | `charte` | `suspension_exemption_expiree` |

### Fiche prestataire
| Email | utm_campaign | utm_content |
|---|---|---|
| Nouvelle soumission de fiche (admin) | `moderation` | `nouvelle_soumission_fiche` |
| Validation / publication de la fiche | `moderation` | `validation_publication_fiche` |
| Demande de réactivation (admin) | `moderation` | `demande_reactivation` |

### Messagerie / demandes de devis
| Email | utm_campaign | utm_content |
|---|---|---|
| Nouveau contact → prestataire (avec compte) | `messagerie` | `nouveau_contact_presta` |
| Nouveau contact → prestataire (sans compte) | `messagerie` | `nouveau_contact_presta_sans_compte` |
| Réponse → couple (avec compte) | `messagerie` | `reponse_client_avec_compte` |
| Réponse → couple (sans compte) | `messagerie` | `reponse_client_sans_compte` |
| Réponse → prestataire | `messagerie` | `reponse_presta` |

### Abonnement / impayés
| Email | utm_campaign | utm_content |
|---|---|---|
| Premier échec de paiement | `facturation` | `impaye_premier_echec` |
| Rappel intermédiaire J+7 | `facturation` | `impaye_rappel_intermediaire` |
| Suspension pour impayé | `facturation` | `impaye_suspension` |

### Emails d'authentification (exclus volontairement)
Confirmation d'inscription, lien de connexion, réinitialisation de mot de passe, invitation, changement d'email, ré-authentification : liens à jeton, laissés intacts.

## Détails techniques

- Ajout d'un utilitaire partagé (`_shared/utm.ts`) : `addUtm(url, { campaign, content })` — ne marque que les URL du domaine public (`PUBLIC_SITE_URL`), préserve les paramètres existants, laisse passer `mailto:` et les autres domaines.
- Table de correspondance `templateName → { campaign, content }` dans le même fichier, avec repli : `campaign = 'transactionnel'`, `content = templateName`.
- Application dans `send-transactional-email` après le rendu React Email : réécriture des `href` du HTML produit, en excluant le lien de désinscription. Cela couvre à la fois les liens passés en données (`magic_link`, `portail_url`, `lienConversation`…) et les liens en dur des modèles.
- `auth-email-hook` non modifié.
- Redéploiement de `send-transactional-email` après la modification.

## Vérifications

- Envoi de test d'un email de chaque famille vers une adresse de test, contrôle des liens marqués et du lien de désinscription non marqué.
- Contrôle qu'un lien déjà porteur d'un `utm_*` n'est pas dupliqué.
- Contrôle qu'un magic link marqué reste fonctionnel (activation de compte de test).
