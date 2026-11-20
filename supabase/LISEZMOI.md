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

Sans service d'e-mail à nous, Supabase n'envoie ses e-mails (invitation, mot de passe oublié) qu'aux membres de l'équipe Supabase, et 2 par heure au plus. Une invitation à Richard ou à Gianni ne partirait donc pas. On crée les comptes sans e-mail :

1. Supabase → Authentication → Users → **Add user** → **Create new user** (et non « Send invitation »).
2. L'adresse, un mot de passe provisoire, et « Auto Confirm User » coché. Pour Marc, Richard et Gianni.
3. Marc donne lui-même leur mot de passe provisoire à Richard et Gianni (de vive voix ou par SMS).
4. Dans SQL Editor, lancer les trois lignes `insert into public.members …` de la fin de `schema.sql`, avec les vraies adresses.
5. Chacun se connecte sur le site, puis Réglages → Profil → Mot de passe → **Changer** pour choisir le sien.

Plus tard, un compte client : même chose, puis la ligne « compte client » de la fin de `schema.sql` (rôle `client` et l'identifiant du client, par exemple `thermo`). Ce compte n'ouvre que l'espace de son entreprise, jamais celui de l'agence, et la base ne lui envoie que ses propres données.

« Mot de passe oublié » ne marchera pour tout le monde qu'avec un service d'e-mail à nous (Resend, une fois un nom de domaine vérifié, branché dans Supabase → Authentication → Emails → SMTP).

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
