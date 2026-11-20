# Mettre la webapp Entremis en ligne avec Supabase

Écrit le 20 novembre 2026. À suivre dans l'ordre. Rien ici ne contient de clé.

## Ce que fait Supabase, et ce qu'il ne fait pas

- **Il fait :** la base de données, les comptes (un mot de passe par personne), les fichiers, et l'envoi d'e-mails (avec Resend).
- **Il ne fait pas :** afficher les pages du site. Sur son adresse par défaut, Supabase renvoie les pages HTML en texte brut (règle de sécurité écrite dans sa documentation). Les pages vont donc chez un hébergeur de pages (Vercel ou Netlify, gratuits), relié à GitHub.

## 1. D'abord, la sécurité (5 minutes)

La clé secrète Supabase et la clé Resend ont été écrites dans une conversation. Il faut les remplacer par des neuves :

- **Supabase** → Settings → API Keys → clé « secret » : en créer une nouvelle, puis supprimer l'ancienne.
- **Resend** → API Keys : en créer une nouvelle, puis supprimer l'ancienne.

La clé « publishable » (sb_publishable_…) peut rester : elle est faite pour aller dans l'app.

## 2. Créer la base (2 minutes)

Supabase → SQL Editor → New query → coller tout le fichier `schema.sql` → Run.

Ce que ça crée :
- les tables ;
- la règle « chacun ne voit que ce qu'il a le droit de voir » ;
- le temps réel ;
- l'espace pour les fichiers.

## 3. Les comptes de l'équipe

1. Supabase → Authentication → Users → **Invite user** : l'adresse de Marc, puis Richard, puis Gianni. Chacun reçoit un e-mail et choisit son mot de passe.
2. Ensuite, dans SQL Editor, lancer les trois lignes `insert into public.members …` de la fin de `schema.sql`, avec les vraies adresses.

## 4. L'envoi d'e-mails (Resend)

1. Resend → Domains : ajouter le domaine d'envoi (par exemple entremis.fr) et suivre ses instructions.
2. Supabase → Edge Functions → Secrets : ajouter `RESEND_API_KEY` (la clé neuve), `MAIL_FROM` (par exemple `Entremis <contact@entremis.fr>`) et `APP_ORIGIN` (l'adresse de la webapp).
3. Déployer la fonction `send-email`. Claude peut s'en charger si l'accès au projet est réglé.

## 5. Les pages : GitHub Pages (choix de Marc, 20 novembre 2026)

- Le code va sur un **nouveau compte GitHub Entremis**, que Marc crée (un compte par projet, jamais de mélange).
- Les pages sont servies par **GitHub Pages**, depuis ce dépôt. Ça marche tel quel : l'app n'a pas besoin d'être « construite ».
- À savoir : GitHub Pages est gratuit pour un dépôt public. Pour un dépôt privé, il faut l'offre payante de GitHub (Pro). Le code ne contient aucune clé secrète, mais un dépôt public laisse voir tout le code de l'app.
- Une adresse à soi (ex. app.entremis.fr) peut être branchée ensuite.

## 6. Ce que Claude fait ensuite

Brancher l'app sur Supabase :
- la connexion avec e-mail et mot de passe ;
- les données partagées en temps réel ;
- les fichiers ;
- les connexions IA et bots de chacun, rangées sur son compte ;
- l'envoi des devis avec le vrai PDF par e-mail.

Puis tester avec les trois comptes, sur ordinateur et téléphone.

## Ce qui reste interdit

- Mettre la clé secrète Supabase ou la clé Resend dans un fichier de l'app : n'importe quel visiteur pourrait la lire.
- Envoyer sur GitHub un fichier `.env` (il est exclu par `.gitignore`).
