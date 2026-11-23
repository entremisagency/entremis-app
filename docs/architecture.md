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
| `supabase/functions/sms` | Le code SMS de la page de demande : envoi (Brevo), vérification, puis entrée dans Leads marquée « numéro vérifié ». Un lead `verified: false` n'est pas facturé sauf décision de l'équipe. Factures du mois : `machine.js` (autoInvoices, brouillons le 1er) |
| `bilan.js` | Le bilan de la semaine de chaque client : carte sur la fiche (envoi Gmail avec PDF, copier, PDF), « Votre semaine » sur l'accueil client, rappel du lundi ; envois notés dans `bilans` |
| `sign.js` | La signature en ligne : « Envoyer à signer » depuis Documents juridiques, page client « Documents à signer » (nom, « Lu et approuvé », signature dessinée), enregistrée par la fonction de base `signer_document` ; PDF signé pour l'équipe. Collection `signatures` (portant le client_id) |
| `videos.js` | Les vidéos des pubs : lien (Drive, WeTransfer…), client, nom standard, accroche, texte, quand, qui poste, vérifications France Rénov' / RGE / montants. Prête avec un posteur : tâche créée ; en ligne : ajoutée aux pubs du client (`ads`). Collection `videos` |
| `studio.js` | Le Studio contenu : recherches prêtes dans la bibliothèque publicitaire Meta et pubs repérées (`veille`), scripts selon le brief de Gianni avec les mots interdits signalés (`scripts-video`, accroches ajoutées : `accroches`), matrice accroches × corps × appels à l'action. « Envoyer au montage » crée la fiche dans `videos`. « Faire valider par le client » copie le script dans `validations` (avec le client_id : le client le voit et répond). Onglet « Ce qui marche » : coût par lead par accroche, corps et appel à l'action, à partir des pubs (`ads`) |
| `tournage.js` | Les tournages : page équipe « Tournages » (date, heure, lieu, équipe, ce que le client a préparé, scripts validés ; tâche pour l'équipe du jour, lien Google Agenda) et page client « Votre tournage » (date, à préparer, scripts à valider). Données dans `flow` (champ shoot) |
| `setter.js` | La conversation WhatsApp de l'assistant sur la fiche du lead : collée depuis WhatsApp ou envoyée par Claude (`noter_conversation_setter`), avec le résultat (qualifié, pas qualifié, sans réponse). Collection `setter` (équipe seulement) |

## Ajouter une page

1. Une fonction `view(S)` qui renvoie le HTML (dans le module qui s'en rapproche le plus).
2. Le nom de la page dans le routeur de `app.js` (`parse()` et la chaîne de rendu `render()`), dans le menu (`renderChrome`), dans la page « Plus » (`ops.js`) et dans la recherche (`search.js`).
3. Les clics : un attribut `data-…` sur le bouton, traité dans `onClick` du module (branché dans l'écouteur de `app.js`).
4. Les textes : voir CONTRIBUER.md. Le style : uniquement les jetons de `tokens.css`.

## Les pièges connus

- **Un champ de formulaire nommé `id`** masque l'identifiant du formulaire (`form.id` renvoie le champ). Ne pas l'utiliser.
- **`<html>` porte `data-zone`** (l'espace affiché) : un sélecteur `closest("[data-zone]")` l'attrape. Toujours vérifier qu'on n'a pas attrapé `document.documentElement`.
- **Les navigateurs gardent les fichiers 10 minutes** : changer la version avant chaque envoi (`sh outils/version.sh`).

### Ajouts du 23 novembre 2026 (soir)
- `mois.js` : le compte rendu du mois d'un client en PDF (leads, niveaux, chantiers signés, facture, pub Meta dépensée, vidéos qui marchent, engagement). Fiche client (équipe : PDF ou envoi Gmail, noté dans `comptes-rendus`) et « Leads et facture » (client : PDF).
- Le lead garde le nom de sa pub (`ad`) : lien de la pub `?source=Facebook&client=ID&pub={{ad.name}}`, lu par `demande.html`, passé à `nouveau_lead` (paramètre `p_pub`) directement ou par la fonction `sms`. Le Studio compte ces leads tout seuls.
- `supabase/functions/meta-sync` : chaque nuit (pg_cron `entremis-meta`) ou sur le bouton « Mettre à jour depuis Meta », reprend la dépense du mois (`meta.spend`) et chaque pub (`ads`, avec client_id) des comptes reliés. Jeton : secret `META_TOKEN`. Sans jeton, elle répond `{disabled:true}`.
