# Contribuer à l'app Entremis

Pour Gianni, Richard, ou toute personne qui modifie l'app. Marc relit et valide avant la mise en ligne.

## 1. Avoir accès (une seule fois)

1. Marc t'ajoute au dépôt : *Settings › Collaborators › Add people*.
2. Tu acceptes l'invitation reçue par e-mail.
3. Tu ajoutes ta clé SSH à ton compte GitHub (*Settings › SSH and GPG keys*), puis :

```bash
git clone git@github.com:entremisagency/entremis-app.git
```

Dans le dossier du dépôt, règle ton nom et ton adresse pour ce dépôt seulement :

```bash
git config user.name "Ton nom"
```

```bash
git config user.email "ton-adresse@exemple.fr"
```

## 2. Faire une modification

1. **Partir de la dernière version** :

```bash
git switch main
```

```bash
git pull
```

2. **Créer une branche**, avec un nom court qui dit ce que tu fais (`correction-agenda`, `page-devis`, `texte-accueil`) :

```bash
git switch -c correction-agenda
```

3. **Modifier, puis tester** en local (voir la liste plus bas).
4. **Changer le numéro de version des fichiers**, sinon les navigateurs gardent l'ancienne version jusqu'à 10 minutes :

```bash
sh outils/version.sh
```

5. **Enregistrer** avec un message court en français, qui dit ce qui change :

```bash
git add -A
```

```bash
git commit -m "Agenda : le rendez-vous du jour s'affiche en premier"
```

6. **Envoyer la branche** :

```bash
git push -u origin correction-agenda
```

7. Sur GitHub, ouvrir la **pull request** proposée (bouton vert *Compare & pull request*). Le modèle te demande ce qui change et comment tu l'as testé. Marc relit, puis fusionne : c'est en ligne une minute après.

Une vérification automatique tourne sur chaque pull request (onglet *Checks*) : elle refuse le code qui ne se lit pas et toute clé secrète. Si elle est rouge, regarde le message, corrige, puis renvoie.

## 3. Avant d'ouvrir la pull request

- [ ] L'app s'ouvre sans erreur dans la console du navigateur.
- [ ] Testé en maquette (`http://localhost:4322`) et, si ça touche aux données, avec `?cloud=1`.
- [ ] Regardé sur ordinateur et sur téléphone (390 px de large), côté agence et côté client si ça le concerne.
- [ ] Aucune valeur en dur : les couleurs, tailles et écarts viennent de `tokens.css`.
- [ ] Aucune clé, aucun mot de passe, aucune donnée réelle de client dans le code.
- [ ] Numéro de version changé (`sh outils/version.sh`).
- [ ] Si la base change (`supabase/schema.sql`) : le SQL à coller est dans la description de la pull request. Marc le colle dans Supabase **avant** de fusionner.

## 4. Les textes de l'app

En français, phrases courtes, sans jargon. Pas de point d'exclamation, pas de « révolutionnaire » ni de « boostez », pas de chiffre qu'on ne peut pas prouver. Un titre dit ce que fait la page, et pour qui.

## 5. Si quelque chose casse en ligne

La version précédente est toujours là : sur GitHub, ouvrir la pull request fusionnée, puis cliquer sur **Revert**. Cela crée une pull request qui annule la modification ; une fois fusionnée, l'ancienne version est en ligne une minute plus tard.
