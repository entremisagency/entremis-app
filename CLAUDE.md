# Consignes pour Claude (et tout assistant de code) dans ce dépôt

L'app d'Entremis. Les personnes qui la modifient (Marc, Gianni, Richard) ne sont pas forcément développeurs : réponds en français, en phrases courtes, sans jargon, la réponse d'abord. Dis franchement ce que tu n'as pas pu vérifier.

## À lire avant de toucher au code
- `README.md` (lancer l'app, les règles), `CONTRIBUER.md` (branche, pull request, tests), `docs/architecture.md` (la carte du code, les données, les pièges connus).
- La base : `supabase/schema.sql` et `supabase/LISEZMOI.md`.

## Règles
1. **Jamais de clé secrète dans le code** : dépôt public. Seule la clé « publishable » Supabase y est (`cloud.js`, `demande.html`).
2. **La sécurité est dans la base** (règles RLS de `supabase/schema.sql`), jamais seulement dans la page. Une nouvelle donnée visible par un client porte son `client_id`.
3. **Pas de valeur en dur** dans l'interface : couleurs, tailles, écarts, rayons viennent de `tokens.css`. Réutilise les composants existants (`.card`, `.btn`, `.field`, `.sheet`, `.state`, `fsel`).
4. **Une branche et une pull request**, jamais d'envoi direct sur `main` (tout ce qui arrive sur `main` est en ligne une minute après).
5. **Avant d'envoyer** : `sh outils/version.sh`, puis vérifier dans le navigateur (maquette, et `?cloud=1` si ça touche aux données), sur ordinateur et téléphone (390 px). Ne dis pas qu'un écran marche sans l'avoir vu.
6. **Textes** : pas de point d'exclamation, pas de « révolutionnaire » ni « boostez », pas de chiffre invérifiable. Un titre dit ce que fait la page et pour qui.
7. **Ce qu'on ne veut jamais voir** : dégradés violet-bleu, lueurs et halos, texte en dégradé, emojis dans les titres, badges « New ✨ », étiquettes EN CAPITALES ESPACÉES. Une seule chose vive par écran.
8. **Si `supabase/schema.sql` change**, donne le SQL à coller dans la pull request : Marc le lance dans Supabase avant de fusionner. Les fonctions qui touchent aux comptes refusent tout appel qui ne vient pas de l'équipe (`is_team()`).
9. Commits en français, courts, qui disent ce qui change.
