> Ancien carnet de la maquette (19 novembre 2026), gardé pour mémoire. Pour le fonctionnement actuel, voir le README et docs/architecture.md.

# Entremis — la webapp (maquette cliquable)

Mise à jour du 19 novembre 2026. Données d'exemple, sauf les tâches de la version publiée (voir plus bas).

- Lien privé : https://claude.ai/artifact/8eyZT1Z9ta2Mk8Qz7Te4Fu (à partager depuis le menu « Partager » de la page pour que Richard et Gianni l'ouvrent).
- En local : `python3 -m http.server 4322` dans ce dossier, puis `http://localhost:4322`. `artifact.html` = `index.html` sans l'enveloppe `<html>/<head>/<body>`, régénéré à chaque publication.
- Captures : `captures/` (ordi 1440 px, téléphone 390 px). `f*` = espace fondateurs, `c*` = espace client.

## Deux espaces
- **Fondateurs** (Marc, Richard, Gianni) : `#equipe` mon portail · `#taches` tâches partagées · `#clients` campagnes des installateurs · `#pipeline` nouveaux clients à signer · `#avancement` · `#notifications` · `#reglages` (espace, « c'est moi », notifications).
- **Client** (un installateur, ex. Solaria Habitat) : `#accueil` · `#agenda` · `#rdv-<id>` fiche + signaler une absence · `#comptes` demandes · `#messages` / `#message-<id>`.
- Axe métier (Marc) : des rendez-vous qualifiés pour les artisans et installateurs qui travaillent chez les particuliers (pompes à chaleur, photovoltaïque, isolation, climatisation, plomberie, serrurerie et portes blindées). Une seule offre : pas de recrutement, pas de candidats (retiré partout le 19 nov.).

## Fichiers
- `tokens.css` : partie 1 = copie exacte des jetons du site (bleu électrique, clair uniquement) ; partie 2 = jetons de l'app (densité, agenda, couleurs d'état vives, iOS).
- `app.css` : composants. Le passage mobile se fait par requête de conteneur sur `#root` (≤ 800 px).
- `data.js` : données d'exemple (une campagne client + bloc `team`).
- `app.js` : cadre, espace client, routeur. `team.js` : espace fondateurs, tâches, notifications.

## Décisions de Marc
- Clair uniquement, palette électrique unique, titres en semi-gras.
- Couleurs d'état vives (vert, orange, rouge fluo) seulement pour dire un état ; le texte reste foncé pour être lisible.
- Téléphone façon iOS : grands titres, barre d'onglets avec nom sous l'icône, feuille qui monte du bas, glisser une tâche (droite = terminer, gauche = supprimer).
- Vibrations sur terminer / supprimer / confirmer : marche sur Android, pas sur iPhone (Safari ne le permet pas).

## Pilotage (ops.js)
- `#finances` : devis et factures (collection partagée `documents`, fichier PDF ou image joint via `assets`), à encaisser, en retard, chiffre d'affaires par mois, charges du mois (exemple).
- `#appels` : journal d'appels partagé (collection `calls`), résultat, durée, note, filtre par personne.
- `#marketing` : référencement (visites, positions) et publicités (budget, demandes, coût par demande). Données d'exemple, non branchées à Google ou Meta.
- `#plus` : toutes les sections, pour la barre d'onglets du téléphone.
- `#pipeline` s'appelle maintenant « Prospection » dans le menu.

## Google Agenda (gcal.js)
- Passe par le connecteur « Google Calendar » de claude.ai (capacité `mcp`, outils `list_events` et `create_event`). Chacun utilise son propre agenda et ses propres identifiants.
- « Mon agenda Google » dans Mon portail : bouton « Relier mon Google Agenda » (le premier clic fait apparaître la demande d'autorisation), puis les 7 prochains jours, rafraîchis toutes les 5 minutes.
- « Ajouter à mon Google Agenda » : sur une tâche datée (icône calendrier), dans le formulaire de nouvelle tâche (case à cocher) et sur la fiche d'un rendez-vous. Un clic = un événement, jamais rejoué tout seul.
- Chaque code d'erreur du connecteur a son message (non relié, connexion expirée, autorisation refusée, Google ne répond pas…).
- Photos de profil : capacité `assets` (envoi ouvert aux personnes qui peuvent utiliser la page) + collection `profiles`.

## Ce qui est réel, ce qui ne l'est pas
- **Tâches** : dans la page publiée, elles sont dans la base partagée (collection `tasks`) : les trois fondateurs voient la même liste. Elle démarre vide. En local, ce sont les tâches d'exemple, gardées dans le navigateur.
- Réglages de notifications et « c'est moi » : gardés sur l'appareil.
- Non branché : envois e-mail/SMS, recherche, export, « Mes créneaux ». Étapes des nouveaux clients et absences signalées : non enregistrées.

## Ajouts du 19 novembre 2026 (soir)
- leads.js : page Leads (fondateurs). Diagramme de flux sources → étape → client, file « À attribuer » avec client proposé (même métier, même zone), reprise et écart avec confirmation. Carte « Leads à attribuer » sur Mon portail. Côté client, la page Demandes montre la source de chaque demande.
- gen.js : générateur de devis et factures (#generer). Aperçu en direct, enregistrement dans Finances (brouillon, avec ses lignes), PDF fait dans le navigateur (jsPDF depuis cdnjs). Coordonnées d'Entremis (SIRET, adresse, TVA, IBAN) À COMPLÉTER dans ME en haut du fichier.
- calc.js : Marketing › Calculateur (budget → rendez-vous, ou objectif → budget, coût d'un rendez-vous, marge, seuil de rentabilité).
- Chargement : disque de traits qui tourne (EM.loader). Ouverture sur téléphone : le logo se dessine (une fois par visite).
- Étapes en blocs reliés (EM.nodeFlow) : « Comment ça marche » côté client, « Comment on lance un nouveau client » sur Clients.
- Anneau de traits (EM.tickRing) : objectif de campagne du client, objectifs du mois.
- Menu fondateurs : Mon espace / Clients / Trouver des clients / Pilotage. Icônes redessinées en traits arrondis (--icon-stroke).
- Chiffres rendus cohérents entre pages (1 090 leads ce mois-ci partout, 312 demandes pour Solaria).
- search.js : recherche ⌘K / Ctrl K (clients, prospects, leads, tâches, documents, pages ; côté client rendez-vous, demandes, messages). Loupe dans l'en-tête sur téléphone.
- Menu : groupes repliables (mémorisés dans le navigateur). Leads : panneau de détail à droite (en bas sur téléphone), Échap pour fermer.
- États en fluo (19 nov.) : vert #3CF58D (Qualifié, coches), orange #FFC233 (Remplacement, absence), texte #03140A ; « Nouveau » en bleu d'action plein. Jetons --color-fluo-ok / --color-fluo-wait / --color-on-fluo, mêmes valeurs que le site.
- Règle de Marc (19 nov.) : les lignes d'une liste ou d'un tableau ne se collent jamais. Chaque ligne est une tuile blanche séparée (--tile-gap, --tile-pad-x/y), plus de trait entre les lignes. À respecter sur tout nouvel écran.
- Passe téléphone (19 nov.) : 16 px entre deux cartes partout (24 px sous le titre), notes des en-têtes de carte sous le titre, Chiffres en 2 colonnes, boutons gris visibles dans les tuiles, page Plus sans cadre.
- guide.js : #guide (fondateurs) et #aide (client), liens dans le menu, la page Plus, les Réglages et le bloc « Comment ça marche » de l'accueil client.
- Passe design (20 nov.) : valeurs en dur passées en jetons, barres de progression en couleur pleine (plus de dégradé), Chiffres sans tuile seule sur sa ligne (grands écrans).
- process.js : #processus, marches à suivre en blocs reliés, modifiables (collection « process »). Filtres en menus déroulants (EM.fsel). « Fondateurs » renommé « Agence » à l'écran.
- Statuts (20 nov.) : pastilles pleines, texte blanc partout (Marc). Vert #0B8049, orange #B86200, rouge #E0294B, bleu d'action, gris #647A8D ; contraste du blanc ≥ 4,1. Le fluo n'est plus utilisé dans les pastilles (illisible avec du blanc), seulement pour les coches validées.
- 20 nov. : éditeur de script en étapes (plus de texte « # / - » à taper), « · » remplacé par « – » partout, noms d'entreprise en majuscules, barre de gauche défilable.
- 20 nov. : création rapide de devis/factures au téléphone, fenêtres de saisie en fond blanc net, pièce jointe propre, chiffres gras plus gros, fiche de tâche (clic sur une tâche ou une ligne du journal), choix de la personne en pastilles.
- Boutons (20 nov.) : un seul système en fin d'app.css (jetons --btn-*). Variantes .btn-primary, .btn-ghost (secondaire), .btn-outline (contour, auto dans les cartes), .btn-quiet, .link, .btn-danger ; tailles .btn-xs (28), normal (32), .btn-lg (36), texte 13 px. Inspiré du composant envoyé par Marc, refait en CSS (pas de React).


## 20 novembre 2026 (suite)

- **Discussions internes** (`chat.js`, route `#discussions`, espace agence) : un fil « Toute l'équipe » et un fil par client, collection partagée « chat ». Carte « Discussion interne » sur la fiche client. Pas de `<form>` (la fiche est déjà un formulaire) : envoi au bouton ou avec Entrée. « Non lu » gardé dans chaque navigateur.
- **Secteurs et parcours** (`sectors.js`, route `#secteurs`) : trois façons de livrer (`rdv`, `direct`, `devis`) qui donnent les mots, les 4 questions et la garantie. Liste de départ dans le code, ajouts et changements dans la collection « sectors » (un métier retiré = `removed: true`). La façon de livrer d'un client peut être forcée sur sa fiche (champ `parcours`, collection « accounts »). Utilisé par : l'espace client (`clientParcours()` dans `app.js`), le panneau d'un lead, la fiche, les cartes de la page Clients.
- **Cartes des campagnes** (page Clients) : `ENTREMIS_SECTORS.campSection(S, table)`, filtres Rythme / Métier / Vue (cartes ou liste).
- **Style AgentOps** : Inter Tight, chiffres fins ; le nombre entier en noir, seuls l'unité et le dénominateur en gris (`softNums` dans `app.js`) ; gris neutres, `.scope-blue` pour la carte bleue. Règles dans `DESIGN-v1-avant-nouvelle-direction.md` (la loi de la webapp).
- **Générateur au téléphone** : bascule Remplir / Aperçu, étiquettes Qté et Prix HT, total par ligne, barre fixe en bas (total TTC, PDF, Enregistrer ; le bouton est hors du formulaire, relié par `form="gen-form"`). Tuiles « Nouveau devis / Nouvelle facture » sur Plus et Mon portail (téléphone).
- **Abréviations** quand la place manque : RDV, interv., PAC, « auj. », « J17/21 ». Page Chiffres en tuiles étiquetées sur téléphone.

- **Un devis ou une facture ouvert** (`gen.js`, `docPanel`) : clic sur une ligne de Finances, sur l'historique d'une fiche, ou sur « Relancer » dans une notification. Le PDF est fabriqué par jsPDF (ou c'est le fichier déposé), puis dessiné par PDF.js 3.11.174 (cdnjs) avec `intent: "print"` : sinon le dessin attend l'affichage de l'écran et ne finit jamais quand la page est cachée. Partager (téléphone, Web Share avec le fichier), E-mail (`mailto:`), SMS (`sms:…?&body=`), WhatsApp (`wa.me`), PDF, Copier. Garde-fou : 15 s, puis l'aperçu de secours.
- **Notifications** : chaque notification a un bouton d'action (`act` : `href`, `doc` ou `task`), qui la marque aussi comme lue.
- **Icônes de fichiers** : `EM.fileIcon(typeOuNomDeFichier, "fic-sm"|"fic-lg")`.
- **Dates et heures** (`pickers.js`) : après chaque affichage, chaque `input[type=date|time]` devient une pastille ; le vrai champ reste (caché) et reçoit les événements `input` et `change`. Tâches : heure facultative (`time`), envoyée à Google Agenda comme un créneau de 30 minutes.
- **Demandes** (espace client) : clic sur une ligne → panneau (projet, les 4 points vérifiés avec les réponses du rendez-vous, signaux, étapes).
- **Centre de réglages** (`settings.js`, route `#reglages`) : profil, espace, notifications, apparence (police Inter Tight ou Outfit, gardée dans le navigateur), connexions (agence), données et sécurité, aide. Connexions : rangées par personne (`entremis-app-connect-<qui>`), aucune clé demandée ni gardée ; le vrai branchement viendra avec Supabase (un compte par personne, clés côté serveur) et GitHub.


## 20 novembre 2026 (« fais tout » : ce qui fait grandir la boîte)

- **Espace client** (`client-plus.js`) : résultat de chaque visite sur la page du rendez-vous (Signé + montant, Devis envoyé, Pas intéressé ; collection « results ») ; rappels au particulier (SMS la veille 18 h et le matin 8 h, à brancher) ; carte « visites à renseigner » sur l'Accueil ; pages `#resultats` (chiffres + avis de fin de campagne, collection « avis »), `#dispos` (créneaux, plafond par semaine, congés ; « dispos »), `#parrainage` (« referrals »), `#menu` (« Plus » du client sur téléphone). Onglets client sur téléphone : Accueil, Agenda, Demandes, Résultats, Plus.
- **Espace agence** (`growth.js`) : `#appel` (poste d'appel : met à jour le lead et note l'appel), `#rendez-vous`, `#zones` (signale les zones prises par deux clients), `#sante`, `#propositions` (PDF par jsPDF, « € » espacé à cause de la police intégrée), `#etudes`, `#marge` (pub = budget pub de Finances réparti selon les demandes), `#conformite`. Morceaux ajoutés : motifs de rejet (Leads), visuels et pages métier + ville (Marketing), onglet Aides, contrats et trésorerie (Finances), objectifs (Avancement), demandes du site et parrainages (Prospection), bouton « € » Proposition sur chaque prospect.
- Menu agence : Mon espace, Production (Poste d'appel, Leads, Rendez-vous, Zones), Clients (Clients, Santé et suivi, Scripts, Secteurs), Trouver des clients (Prospection, Propositions, Études de cas, Appels, Marketing), Pilotage (Chiffres, Avancement, Finances, Marge, Conformité).
- Nouvelles collections partagées : results, avis, dispos, referrals, zones, proposals, cases, erasures, seo-pages, contracts, goals, site-requests.
