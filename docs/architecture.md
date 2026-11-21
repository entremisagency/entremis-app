# Comment le code est rangé

Une seule page (`index.html`) qui charge des scripts dans un ordre précis. Pas de framework, pas d'étape de construction : chaque fichier ajoute un module à `window` (par exemple `window.ENTREMIS_LEADS`), et `app.js`, chargé en dernier, assemble le tout.

## Le cadre

| Fichier | Rôle |
|---|---|
| `data.js` | Les données d'exemple de la maquette (`window.ENTREMIS_DATA`). En ligne, `live.js` les remplace par les vraies. |
| `cloud.js` | Le branchement à Supabase : écran de connexion, compte connecté, collections partagées, vraie date et vraie heure en ligne. Allumé sur le site publié ou avec `?cloud=1`. |
| `app.js` | Le routeur (adresses en `#page`), le cadre (menu, onglets, bandeau « Vue client »), l'espace client, les outils partagés (`window.EM`). |
| `tokens.css` / `app.css` | Les jetons de design, puis les composants. Le passage au téléphone se fait par requête de conteneur sur `#root`. |

## Les données

**Une collection = une liste partagée.** `ENTREMIS_OPS.makeStore(nom, exemples)` crée une liste qui :
- en ligne : lit et écrit la table `docs` de Supabase (une ligne par élément, rangée par `collection`), en temps réel ;
- dans la maquette : garde la liste dans le navigateur (`localStorage`), en partant des exemples.

Chaque liste a `.list`, `.put(ligne)`, `.remove(id)` et `.init(rendu)`.

**Qui voit quoi** (règles dans `supabase/schema.sql`) :
- l'équipe lit et écrit tout ;
- un client lit seulement les lignes qui portent son identifiant dans `client_id` ;
- un client écrit seulement : `results`, `avis`, `dispos`, `referrals`, `prep` (avec son `client_id`) ;
- tout compte lit `scripts` et `sectors` ;
- `private_docs` : ce qui n'appartient qu'à une personne (ses connexions IA, MCP, bots).

**Mettre `client_id` sur une ligne la rend visible par ce client.** `cloud.js` le fait tout seul pour un lead donné à un client (`to`). Pour le reste, on l'écrit dans la ligne.

| Collection | Contenu | Écrite par |
|---|---|---|
| `leads` | les demandes des particuliers | équipe, page de demande (`nouveau_lead`) |
| `rdv` | les rendez-vous placés (`client_id`) | équipe |
| `clients` | les clients installateurs (objectif, durée, suivi) | équipe |
| `prospects` | les installateurs à signer | équipe |
| `site-requests` | les demandes du formulaire du site vitrine | site (`demande_site`) |
| `tasks`, `chat`, `calls`, `documents` | tâches, discussions, appels, devis et factures | équipe |
| `results`, `avis`, `dispos`, `referrals`, `prep` | ce que le client renseigne | client et équipe |
| `costs`, `marketing`, `reglages` | dépenses, chiffres du mois, réglages communs | équipe |

**`live.js`, les vraies données.** En ligne, il réécrit à chaque affichage les tableaux de `data.js` (`team.clients`, `team.pipeline`, `team.weekly`, `team.goals`, `team.revenue`…) à partir de la base. Toutes les pages lisent donc les vraies données sans le savoir. Il porte aussi les formulaires « nouveau client », « nouveau prospect », « placer un rendez-vous », « dépense », « chiffres du mois », et les alertes.

## Les pages

| Fichier | Pages |
|---|---|
| `team.js` | Mon portail, Tâches, Clients, Prospection, Avancement, Notifications ; vibrations (`haptic`) |
| `ops.js` | Finances, Appels, Marketing, page « Plus » ; `makeStore` |
| `leads.js` | Leads (donner à un client, écarter, reprendre) |
| `growth.js` | Poste d'appel, Rendez-vous, Zones, Santé, Propositions, Études de cas, Marge, Conformité (RGPD) |
| `fiche.js` | La fiche d'un client ou d'un prospect |
| `access.js` | Accès clients et comptes de l'équipe (fonctions de la base `creer_acces_client`, `creer_compte_equipe`…) |
| `settings.js` | Réglages (profil, mot de passe, espace, alertes, apparence, connexions) |
| `client-plus.js` | Côté client : résultats de visite, disponibilités, parrainage, avis |
| `gen.js` | Devis et factures en vrai PDF (jsPDF), partage |
| `chat.js`, `scripts.js`, `process.js`, `sectors.js`, `metrics.js`, `calc.js`, `guide.js`, `search.js`, `pickers.js`, `gcal.js` | Discussions, scripts de visite, processus, métiers et parcours, chiffres, calculateur, guide, recherche (⌘K), sélecteurs de date, Google Agenda |
| `machine.js` | La machine à leads (documents de Gianni) : niveau et facturation d'un lead, facture du mois d'un client (prix par lead, plafond), page client « Leads et facture » avec contestation sous 7 jours (collection `contests`), fiche d'appel d'un prospect, simulateur de rentabilité (Marketing › Calcul), chiffres de la semaine (Chiffres) |
| `pilotage.js` | Les 8 étapes par client et le tournage (collection `flow`, lisible par le client), les pubs Meta et leurs règles d'arrêt (`ads`), les risques (30 % du CA, fins d'engagement), les documents de travail de l'équipe (`refs`), la sauvegarde sur le Drive commun (`backups`, droit Google « drive ») |
| `legal.js` | Les documents juridiques à remplir (contrat, droit à l'image, SEPA, rétractation, RGPD, CGV…), PDF avec le logo ; coordonnées d'Entremis et historique dans `actes` (équipe seulement) |
| `crm.js` | Le CRM (#contacts) : clients et prospects ensemble, recherche, vues, tri, prochaine action et étiquettes (`crm`), actions groupées, import/export CSV, doublons ; glisser-déposer du pipeline |
| `help.js` | Le petit « i » à côté du titre de chaque page, avec le texte de chaque page |
| `update.js` | La mise à jour toute seule : compare le numéro ?v= de la page en ligne (outils/version.sh) au sien ; recharge au retour sur l'app si rien n'est en cours, sinon bandeau « Mettre à jour ». Ne pas oublier `sh outils/version.sh` avant chaque envoi |

## Ajouter une page

1. Une fonction `view(S)` qui renvoie le HTML (dans le module qui s'en rapproche le plus).
2. Le nom de la page dans le routeur de `app.js` (`parse()` et la chaîne de rendu `render()`), dans le menu (`renderChrome`), dans la page « Plus » (`ops.js`) et dans la recherche (`search.js`).
3. Les clics : un attribut `data-…` sur le bouton, traité dans `onClick` du module (branché dans l'écouteur de `app.js`).
4. Les textes : voir CONTRIBUER.md. Le style : uniquement les jetons de `tokens.css`.

## Les pièges connus

- **Un champ de formulaire nommé `id`** masque l'identifiant du formulaire (`form.id` renvoie le champ). Ne pas l'utiliser.
- **`<html>` porte `data-zone`** (l'espace affiché) : un sélecteur `closest("[data-zone]")` l'attrape. Toujours vérifier qu'on n'a pas attrapé `document.documentElement`.
- **Les navigateurs gardent les fichiers 10 minutes** : changer la version avant chaque envoi (`sh outils/version.sh`).
