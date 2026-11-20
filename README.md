# Entremis — l'app

L'app d'Entremis : l'agence (Marc, Richard, Gianni) y gère ses leads, ses clients installateurs, leurs rendez-vous, sa prospection et ses finances. Chaque client installateur y a son propre espace : ses rendez-vous, ses demandes, ses résultats.

- **L'app en ligne** : https://entremisagency.github.io/entremis-app/
- **La page de demande publique** (pour les particuliers, à mettre dans les pubs) : https://entremisagency.github.io/entremis-app/demande.html
- **La base** : Supabase, projet `cnhxrhyugghigkozfpde` (comptes, données, règles d'accès).

## En deux minutes

| Ce que tu veux faire | Où regarder |
|---|---|
| Proposer une modification | [CONTRIBUER.md](CONTRIBUER.md) |
| Comprendre comment le code est rangé | [docs/architecture.md](docs/architecture.md) |
| Toucher à la base (tables, règles, comptes) | [supabase/LISEZMOI.md](supabase/LISEZMOI.md) et [supabase/schema.sql](supabase/schema.sql) |
| Signaler un bug ou proposer une idée | l'onglet **Issues** du dépôt |

## Lancer l'app sur son ordinateur

Pas d'installation : c'est du HTML, du CSS et du JavaScript, sans étape de construction.

```bash
git clone git@github.com:entremisagency/entremis-app.git
cd entremis-app
python3 -m http.server 4322
```

Puis ouvrir http://localhost:4322.

- **Sur son ordinateur**, l'app tourne en **maquette** : des données d'exemple, gardées dans le navigateur. On peut tout casser sans risque.
- **Avec `?cloud=1`** à la fin de l'adresse (http://localhost:4322/?cloud=1), elle se branche sur la **vraie base** : il faut se connecter, et ce qu'on fait est réel. `?cloud=0` revient à la maquette.
- **Sur le site en ligne**, elle est toujours branchée sur la vraie base.

## Mise en ligne

Tout ce qui arrive sur la branche `main` est en ligne une minute plus tard (GitHub Pages). Personne n'envoie directement sur `main` : on passe par une branche et une demande de modification (*pull request*), relue par Marc. Voir [CONTRIBUER.md](CONTRIBUER.md).

## Les règles qui ne se discutent pas

1. **Aucune clé secrète dans le code.** Le dépôt est public. Seule la clé « publishable » de Supabase est dans `cloud.js` et `demande.html` : elle est faite pour ça. La clé secrète et la clé Resend restent dans Supabase.
2. **La sécurité est dans la base**, pas dans la page. Les règles d'accès (qui voit quoi) sont dans `supabase/schema.sql`. Un client ne reçoit que ses propres données, même s'il bidouille la page.
3. **Pas de valeur en dur** dans l'interface : couleurs, tailles, écarts et rayons viennent de `tokens.css`.
4. **On regarde l'écran avant de dire que c'est fini** : ordinateur et téléphone (390 px de large).

## Ce qu'il y a dans le dépôt

```
index.html            la page de l'app (charge tous les scripts, dans l'ordre)
demande.html          la page publique de demande (particuliers)
tokens.css, app.css   les jetons de design, puis les composants
*.js                  un fichier par partie de l'app (voir docs/architecture.md)
img/                  photo de connexion, image de partage, icônes
manifest.webmanifest  l'app installable (écran d'accueil du téléphone)
sw.js                 affiche les alertes sur l'appareil (rien en cache)
supabase/             la base : schéma, règles, test des droits, fonction d'envoi d'e-mails
docs/                 la carte du code, l'historique de la maquette
outils/version.sh     change le numéro de version des fichiers avant un envoi
```
