
- Les inscriptions en libre-service passent uniquement par la fonction `inscription` (Turnstile vérifié côté serveur, inscription directe coupée dans l’authentification) — empêche les robots de créer des comptes via l’API ; le secret TURNSTILE_DESACTIVE=true coupe la vérification sans republier.
