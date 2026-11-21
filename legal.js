/* Entremis — les documents juridiques, prêts à remplir (Marc, 21 nov. 2026).
   On choisit un modèle et un client : les champs se remplissent avec ce que l'app sait déjà, l'aperçu suit à chaque frappe,
   puis « Télécharger le PDF ». Chaque document généré est gardé (collection « actes », équipe seulement).
   Ce sont des modèles de travail, pas un conseil juridique : à faire relire par un avocat ou un juriste avant le premier usage.
   Aucune coordonnée bancaire n'est saisie ici : l'IBAN du débiteur se remplit à la main, sur le papier, par le client. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  let ST = null; const ACTES = () => ST || (ST = OPS().makeStore("actes", () => []));
  const X = { tpl: null, cid: "", vals: {}, me: false };
  const today = () => window.ENTREMIS_DATA.today.iso;
  const fr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
  // Le client : ce que la fiche sait (adresse, SIRET, contact) + le contrat (prix, zone, pays)
  const cl = id => { const c = EM().allClients().find(x => x.id === id); if (!c) return null; const f = window.ENTREMIS_FICHE && window.ENTREMIS_FICHE.info(id) || {}; return Object.assign({}, f, c, { address: c.address || f.address || f.adresse || "", siret: c.siret || f.siret || "", email: c.email || f.email || "", contact: c.contact || f.contact || "" }); };

  // Les coordonnées d'Entremis, saisies une fois pour tous les modèles
  const ME_FIELDS = [["ent_nom", "Raison sociale", "Entremis"], ["ent_forme", "Forme et capital", "SAS au capital de … €"], ["ent_siege", "Siège social", ""], ["ent_siret", "SIRET", ""],
    ["ent_rcs", "RCS (ville)", ""], ["ent_tva", "N° de TVA intracommunautaire", ""], ["ent_rep", "Représentée par", ""], ["ent_qualite", "Qualité", "Président"], ["ent_mail", "E-mail", ""], ["ent_tel", "Téléphone", ""],
    ["ent_ics", "Identifiant créancier SEPA (ICS)", ""], ["ent_ville", "Ville (pour « Fait à »)", ""]];
  const me = () => Object.assign({}, ...ME_FIELDS.map(([k, , d]) => ({ [k]: d })), (ACTES().list.find(a => a.id === "me") || {}).vals || {});

  // Champs communs aux modèles « client »
  const C_FIELDS = [["cli_nom", "Client (raison sociale)", c => c ? c.name : ""], ["cli_rep", "Représenté par", c => c ? c.contact || "" : ""], ["cli_adresse", "Adresse du client", c => c ? c.address || "" : ""],
    ["cli_siret", "SIRET du client (ou n° d'entreprise)", c => c ? c.siret || "" : ""], ["cli_mail", "E-mail du client", c => c ? c.email || "" : ""]];
  const contract = c => c ? { prix: c.prixLead || 50, plafond: c.plafond || "", engagement: c.engagement || 3, zone: c.zoneCP || c.zone || "", pays: (window.ENTREMIS_MACHINE.PAYS[c.pays || "FR"]) } : { prix: 50, plafond: "", engagement: 3, zone: "", pays: "France" };

  /* Les modèles. Corps : [["h", titre], ["p", paragraphe], ["l", liste "a|b|c"], ["sign", "Partie A|Partie B"]]. {{clé}} = un champ. */
  const T = [
    { id: "image", group: "Tournage", name: "Autorisation de droit à l'image", what: "Pour chaque personne filmée : présentateur, technicien, client témoin.",
      fields: [["p_nom", "Nom et prénom de la personne filmée", ""], ["p_adresse", "Son adresse", ""], ["p_role", "Son rôle dans la vidéo", "client témoin"], ["install", "Installateur (pour qui sont les vidéos)", c => c ? c.name : ""],
        ["t_date", "Date du tournage", () => today(), "date"], ["t_lieu", "Lieu du tournage", ""], ["duree", "Durée d'utilisation (années)", "5"], ["territoire", "Territoire", "France et pays francophones"], ["contrepartie", "Contrepartie", "à titre gracieux"]],
      body: [["h", "Autorisation d'utilisation de l'image et de la voix"],
        ["p", "Je soussigné(e) {{p_nom}}, demeurant {{p_adresse}}, autorise {{ent_nom}} et {{install}} à me filmer, me photographier et enregistrer ma voix lors du tournage du {{t_date}} à {{t_lieu}}, en tant que {{p_role}}, et à utiliser ces images et enregistrements dans les conditions suivantes."],
        ["h", "1. Utilisations autorisées"], ["l", "Vidéos et photos de présentation et de promotion des services de {{install}}|Publicités sur les réseaux sociaux (Facebook, Instagram et autres), site internet, pages de contact|Montages, recadrages, sous-titres et versions courtes, sans dénaturer mes propos"],
        ["h", "2. Durée et territoire"], ["p", "Cette autorisation vaut pour {{duree}} ans à compter du tournage, sur le territoire suivant : {{territoire}}. Les contenus déjà publiés à la fin de cette durée peuvent rester en ligne sans nouvelle diffusion payante."],
        ["h", "3. Contrepartie"], ["p", "Cette autorisation est consentie {{contrepartie}}."],
        ["h", "4. Témoignage"], ["p", "Mes propos reflètent mon expérience réelle. Aucune parole ne me sera prêtée que je n'ai pas prononcée."],
        ["h", "5. Mes données et mes droits"], ["p", "Je peux demander à tout moment l'arrêt de nouvelles diffusions en écrivant à {{ent_mail}}. Mes données sont traitées conformément au RGPD : accès, rectification, effacement et opposition à la même adresse."],
        ["h", "6. Mineurs"], ["p", "Si la personne filmée est mineure, l'autorisation est signée par ses deux représentants légaux."],
        ["sign", "La personne filmée (« Lu et approuvé »)|Pour {{ent_nom}}"]] },
    { id: "acteur", group: "Tournage", name: "Contrat de prestation d'un acteur ou figurant", what: "Pour un comédien payé : rémunération, durée d'utilisation, cession.",
      fields: [["p_nom", "Nom de l'acteur", ""], ["p_adresse", "Son adresse", ""], ["p_statut", "Son statut", "auto-entrepreneur (SIRET : …)"], ["t_date", "Date du tournage", () => today(), "date"], ["t_lieu", "Lieu", ""], ["remu", "Rémunération (€ HT)", "300"], ["duree", "Durée d'utilisation (années)", "3"], ["install", "Installateur concerné", c => c ? c.name : ""]],
      body: [["h", "Contrat de prestation – tournage"],
        ["p", "Entre {{ent_nom}}, {{ent_forme}}, {{ent_siege}}, SIRET {{ent_siret}}, représentée par {{ent_rep}}, ci-après « Entremis », et {{p_nom}}, {{p_statut}}, demeurant {{p_adresse}}, ci-après « le Prestataire »."],
        ["h", "1. Objet"], ["p", "Le Prestataire joue un rôle dans les vidéos tournées le {{t_date}} à {{t_lieu}} pour la promotion de {{install}}."],
        ["h", "2. Rémunération"], ["p", "{{remu}} € HT pour la journée, sur facture du Prestataire, payée sous 30 jours. Elle couvre la prestation et la cession prévue à l'article 3."],
        ["h", "3. Cession des droits"], ["p", "Le Prestataire cède à Entremis, qui peut les transmettre à {{install}}, les droits d'utilisation de son image et de sa voix dans ces vidéos, pour {{duree}} ans, sur internet et les réseaux sociaux, en France et dans les pays francophones."],
        ["h", "4. Indépendance"], ["p", "Le Prestataire agit en indépendant. Il est responsable de ses déclarations sociales et fiscales."],
        ["sign", "Le Prestataire|Pour {{ent_nom}}"]] },
    { id: "prestation", group: "Clients", name: "Contrat de prestation (leads exclusifs)", what: "Le contrat de la machine à leads : prix par lead, zone, engagement, contestation, vidéos.",
      fields: C_FIELDS.concat([["prix", "Prix par lead vérifié (€ HT)", c => contract(c).prix], ["plafond", "Plafond mensuel (€ HT)", c => contract(c).plafond], ["engagement", "Engagement (mois)", c => contract(c).engagement], ["zone", "Zone exclusive (codes postaux)", c => contract(c).zone],
        ["budget", "Budget pub minimum (€ par jour)", "30"], ["rappel", "Délai de rappel des prospects (heures)", "24"], ["rachat", "Rachat du tournage si départ anticipé (€ HT)", c => c && window.ENTREMIS_PILOT ? window.ENTREMIS_PILOT.engagement(c.id).rachat : 2000], ["debut", "Date de début", () => today(), "date"]]),
      body: [["h", "Contrat de prestation de génération de leads exclusifs"],
        ["p", "Entre {{ent_nom}}, {{ent_forme}}, {{ent_siege}}, SIRET {{ent_siret}}, RCS {{ent_rcs}}, représentée par {{ent_rep}}, {{ent_qualite}}, ci-après « Entremis »,"],
        ["p", "et {{cli_nom}}, {{cli_adresse}}, SIRET {{cli_siret}}, représentée par {{cli_rep}}, ci-après « le Client »."],
        ["h", "1. Objet"], ["p", "Entremis tourne des vidéos chez le Client, gère ses campagnes publicitaires sur son propre compte Meta, qualifie les demandes des particuliers et lui transmet des leads exclusifs."],
        ["h", "2. Le lead facturé"], ["p", "Un lead est une demande d'un particulier dont le numéro de téléphone est vérifié par code SMS. Il est transmis au seul Client, jamais revendu. Trois niveaux, au même prix : rendez-vous pris, qualifié, vérifié."],
        ["p", "Ne sont pas facturés : les locataires, les adresses hors de la zone, les doublons sur 90 jours, les numéros non vérifiés."],
        ["h", "3. Prix et facturation"], ["p", "{{prix}} € HT par lead facturable. Facture le 1er de chaque mois avec le relevé détaillé, payable à 30 jours. Plafond mensuel : {{plafond}} € HT ; une fois atteint, les publicités sont mises en pause jusqu'au mois suivant."],
        ["h", "4. Contestation"], ["p", "Le Client peut contester un lead dans les 7 jours suivant sa transmission, depuis son espace, en indiquant le motif. Une contestation acceptée retire le lead de la facture."],
        ["h", "5. Exclusivité de zone"], ["p", "Entremis ne travaille avec aucun autre installateur sur la zone suivante : {{zone}}. L'exclusivité est maintenue tant que le Client tient un budget publicitaire d'au moins {{budget}} € par jour et rappelle ses prospects sous {{rappel}} heures. Un point est fait tous les 3 mois."],
        ["h", "6. Publicité"], ["p", "Les campagnes tournent sur le compte publicitaire du Client, qui paie directement Meta et voit chaque dépense. Entremis y accède comme partenaire et peut couper une publicité trop chère."],
        ["h", "7. Durée"], ["p", "Le contrat commence le {{debut}} pour {{engagement}} mois, puis se poursuit de mois en mois, résiliable avec un préavis d'un mois."],
        ["h", "8. Les vidéos"], ["p", "Les vidéos appartiennent au Client à la fin de l'engagement. En cas de départ avant cette date, le Client peut les racheter pour {{rachat}} € HT ; sinon elles restent la propriété d'Entremis."],
        ["h", "9. Conformité"], ["p", "Chaque vidéo porte la mention France Rénov' en vigueur et ne cite aucun montant d'aide. Aucun démarchage n'est fait : les particuliers viennent d'eux-mêmes. L'assistant WhatsApp se présente comme un assistant automatique."],
        ["h", "10. Données personnelles"], ["p", "Pour les données des prospects, Entremis agit comme sous-traitant du Client au sens de l'article 28 du RGPD. Les engagements figurent dans l'accord de sous-traitance annexé."],
        ["h", "11. Litiges"], ["p", "Droit français. À défaut d'accord amiable, tribunal de commerce du siège d'Entremis."],
        ["sign", "Pour le Client (« Lu et approuvé »)|Pour {{ent_nom}}"]] },
    { id: "sepa", group: "Paiement", name: "Mandat de prélèvement SEPA", what: "Le paiement automatique des factures (prélèvement chaque mois).",
      fields: C_FIELDS.concat([["rum", "Référence unique du mandat (RUM)", c => "ENT-" + (c ? c.id.toUpperCase().slice(0, 8) : "CLIENT") + "-" + today().replace(/-/g, "")], ["type", "Type de paiement", "Récurrent"]]),
      body: [["h", "Mandat de prélèvement SEPA"],
        ["p", "Référence unique du mandat : {{rum}}. Identifiant créancier SEPA : {{ent_ics}}."],
        ["p", "Créancier : {{ent_nom}}, {{ent_siege}}."],
        ["p", "En signant ce mandat, vous autorisez {{ent_nom}} à envoyer des instructions à votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément à ces instructions. Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions de votre convention. Pour un prélèvement entre professionnels (B2B), ce remboursement n'est pas prévu."],
        ["p", "Débiteur : {{cli_nom}}, {{cli_adresse}}."],
        ["p", "IBAN du débiteur (à remplir à la main) : ________________________________________"],
        ["p", "BIC : ______________"],
        ["p", "Type de paiement : {{type}}. Chaque prélèvement est annoncé au moins 5 jours avant sa date par la facture du mois."],
        ["sign", "Le débiteur, à ________, le ________|"]] },
    { id: "retractation", group: "Clients", name: "Formulaire de rétractation", what: "Pour un client de 5 salariés ou moins, contrat signé hors des locaux d'Entremis : 14 jours.",
      fields: C_FIELDS.concat([["contrat", "Contrat concerné", "Contrat de prestation de génération de leads exclusifs"], ["signe", "Signé le", () => today(), "date"]]),
      body: [["h", "Formulaire de rétractation"],
        ["p", "Ce formulaire concerne les professionnels qui emploient 5 salariés ou moins et qui ont signé hors des locaux d'Entremis, pour une prestation sans lien avec leur activité principale (article L221-3 du Code de la consommation). Ils disposent de 14 jours à compter de la signature pour se rétracter."],
        ["p", "À l'attention de {{ent_nom}}, {{ent_siege}}, {{ent_mail}} :"],
        ["p", "Je notifie par la présente ma rétractation du contrat suivant : {{contrat}}, signé le {{signe}}."],
        ["p", "Nom du client : {{cli_nom}}. Adresse : {{cli_adresse}}."],
        ["sign", "Signature du client|Date"]] },
    { id: "meta", group: "Clients", name: "Autorisation d'accès au compte publicitaire Meta", what: "Le client autorise Entremis à gérer ses pubs sur son compte.",
      fields: C_FIELDS.concat([["act", "Identifiant du compte publicitaire", c => { const m = c && window.ENTREMIS_LIVE && window.ENTREMIS_LIVE.META ? window.ENTREMIS_LIVE.META().list.find(x => x.id === c.id) : null; return m ? m.account || "" : ""; }], ["budget", "Budget mensuel maximum (€)", "1500"]]),
      body: [["h", "Autorisation de gestion du compte publicitaire"],
        ["p", "{{cli_nom}}, représentée par {{cli_rep}}, autorise {{ent_nom}} à accéder en tant que partenaire à son compte publicitaire Meta n° {{act}} pour créer, modifier, mettre en pause et suivre ses campagnes."],
        ["l", "Le Client reste seul propriétaire du compte et du moyen de paiement ; il paie directement Meta|Le budget mensuel ne dépasse pas {{budget}} € sans accord écrit du Client|Entremis ne modifie ni le moyen de paiement, ni les administrateurs du compte|Le Client peut retirer l'accès à tout moment depuis son Business Manager"],
        ["sign", "Pour le Client|Pour {{ent_nom}}"]] },
    { id: "rgpd", group: "Clients", name: "Accord de sous-traitance des données (RGPD)", what: "Entremis traite les données des prospects pour le compte de l'installateur (article 28).",
      fields: C_FIELDS.concat([["conservation", "Durée de conservation des leads (mois)", "36"]]),
      body: [["h", "Accord de sous-traitance de données personnelles"],
        ["p", "Entre {{cli_nom}}, responsable de traitement, et {{ent_nom}}, sous-traitant, en application de l'article 28 du RGPD."],
        ["h", "1. Objet"], ["p", "Recueil et qualification des demandes de particuliers intéressés par les services du responsable de traitement, et transmission de ces demandes."],
        ["h", "2. Données traitées"], ["p", "Nom, téléphone, e-mail, ville, code postal, projet, statut d'occupant, échanges avec l'assistant. Aucune donnée sensible."],
        ["h", "3. Engagements du sous-traitant"], ["l", "Ne traiter les données que sur instruction documentée du responsable|Garantir la confidentialité : accès limité à l'équipe Entremis, comptes personnels|Sécuriser les données : hébergement dans l'Union européenne, accès chiffrés|Aider le responsable à répondre aux demandes d'accès, de rectification et d'effacement|Signaler toute violation de données sous 48 heures|Supprimer ou rendre les données à la fin du contrat|Tenir à disposition les informations nécessaires pour démontrer le respect de ces obligations"],
        ["h", "4. Sous-traitants ultérieurs"], ["p", "Hébergement de la base (Supabase), messagerie (WhatsApp, SMS), publicité (Meta). Le responsable est informé de tout changement."],
        ["h", "5. Conservation"], ["p", "{{conservation}} mois après le dernier contact, puis suppression."],
        ["sign", "Le responsable de traitement|Le sous-traitant"]] },
    { id: "nda", group: "Partenaires", name: "Accord de confidentialité", what: "Avant de partager la méthode, les chiffres ou les fichiers avec un partenaire.",
      fields: [["part_nom", "Partenaire", ""], ["part_rep", "Représenté par", ""], ["part_adresse", "Adresse", ""], ["duree", "Durée (années)", "3"], ["objet", "Objet des échanges", "un projet de collaboration commerciale"]],
      body: [["h", "Accord de confidentialité"],
        ["p", "Entre {{ent_nom}}, représentée par {{ent_rep}}, et {{part_nom}}, {{part_adresse}}, représentée par {{part_rep}}."],
        ["p", "Dans le cadre de {{objet}}, chaque partie peut recevoir des informations confidentielles de l'autre : méthodes, prix, chiffres, fichiers de clients ou de prospects, contenus."],
        ["l", "Ne pas divulguer ces informations à un tiers sans accord écrit|Ne les utiliser que pour l'objet ci-dessus|Les rendre ou les détruire à la première demande|Ne pas démarcher les clients ou partenaires présentés par l'autre partie"],
        ["p", "Cet engagement vaut {{duree}} ans à compter de la signature. Droit français."],
        ["sign", "Pour {{part_nom}}|Pour {{ent_nom}}"]] },
    { id: "apporteur", group: "Partenaires", name: "Contrat d'apporteur d'affaires", what: "Pour un partenaire qui présente des installateurs (commission sur les clients signés).",
      fields: [["part_nom", "Apporteur", ""], ["part_rep", "Représenté par", ""], ["part_adresse", "Adresse", ""], ["part_siret", "SIRET", ""], ["commission", "Commission (% du chiffre d'affaires HT encaissé)", "10"], ["duree_com", "Pendant (mois par client)", "12"]],
      body: [["h", "Contrat d'apporteur d'affaires"],
        ["p", "Entre {{ent_nom}}, représentée par {{ent_rep}}, et {{part_nom}}, {{part_adresse}}, SIRET {{part_siret}}, représentée par {{part_rep}}, ci-après « l'Apporteur »."],
        ["h", "1. Mission"], ["p", "L'Apporteur présente à Entremis des installateurs susceptibles de devenir clients. Il n'a aucun pouvoir pour engager Entremis ni négocier en son nom."],
        ["h", "2. Commission"], ["p", "Pour chaque installateur présenté et signé, l'Apporteur perçoit {{commission}} % du chiffre d'affaires HT encaissé par Entremis auprès de ce client, pendant {{duree_com}} mois, sur facture trimestrielle."],
        ["h", "3. Présentation"], ["p", "Une présentation est valable si Entremis la confirme par écrit et que l'installateur n'était pas déjà en discussion avec elle."],
        ["h", "4. Durée"], ["p", "Un an, renouvelable par tacite reconduction, résiliable avec un préavis d'un mois. Les commissions dues sur les clients déjà signés restent dues."],
        ["sign", "L'Apporteur|Pour {{ent_nom}}"]] },
    { id: "avenant", group: "Clients", name: "Avenant au contrat", what: "Changer le prix, la zone, le plafond ou la durée.",
      fields: C_FIELDS.concat([["contrat_date", "Date du contrat initial", "", "date"], ["changement", "Ce qui change", c => `Prix par lead : ${contract(c).prix} € HT ; zone : ${contract(c).zone || "…"}`], ["effet", "À partir du", () => today(), "date"]]),
      body: [["h", "Avenant au contrat de prestation"],
        ["p", "Entre {{ent_nom}} et {{cli_nom}}, représentée par {{cli_rep}}, au contrat signé le {{contrat_date}}."],
        ["p", "Les parties conviennent de la modification suivante, à partir du {{effet}} : {{changement}}."],
        ["p", "Toutes les autres clauses du contrat restent inchangées."],
        ["sign", "Pour le Client|Pour {{ent_nom}}"]] },
    { id: "exclusivite", group: "Clients", name: "Attestation d'exclusivité de zone", what: "Le document à montrer : personne d'autre sur sa zone.",
      fields: C_FIELDS.concat([["zone", "Zone exclusive", c => contract(c).zone], ["fin", "Valable jusqu'au", c => c && window.ENTREMIS_PILOT ? window.ENTREMIS_PILOT.engagement(c.id).end : "", "date"]]),
      body: [["h", "Attestation d'exclusivité de zone"],
        ["p", "{{ent_nom}} atteste que {{cli_nom}} est le seul installateur avec lequel elle travaille sur la zone suivante : {{zone}}."],
        ["p", "Cette exclusivité vaut jusqu'au {{fin}}, aux conditions du contrat de prestation (budget publicitaire minimum et délai de rappel)."],
        ["sign", "|Pour {{ent_nom}}"]] },
    { id: "cession", group: "Tournage", name: "Remise et cession des vidéos", what: "Fin d'engagement ou rachat : les vidéos passent au client.",
      fields: C_FIELDS.concat([["nb", "Nombre de vidéos remises", c => c && window.ENTREMIS_PILOT ? ((window.ENTREMIS_PILOT.flowOf(c.id).shoot || {}).videos || "") : ""], ["motif", "Motif", "fin de l'engagement"], ["prix", "Prix de rachat (€ HT, 0 si fin d'engagement)", "0"], ["remise", "Remises le", () => today(), "date"]]),
      body: [["h", "Procès-verbal de remise et de cession des vidéos"],
        ["p", "{{ent_nom}} remet à {{cli_nom}}, le {{remise}}, {{nb}} vidéos tournées pour lui, avec leurs fichiers sources, au motif suivant : {{motif}}."],
        ["p", "À compter de cette date, {{cli_nom}} peut les utiliser librement pour sa propre promotion, dans la limite des autorisations de droit à l'image signées par les personnes filmées. Prix : {{prix}} € HT."],
        ["p", "Entremis cesse toute diffusion de ces vidéos et ne les réutilise pas pour un autre installateur."],
        ["sign", "Pour le Client|Pour {{ent_nom}}"]] },
    { id: "relance", group: "Paiement", name: "Relance et mise en demeure de payer", what: "Une facture impayée : pénalités et indemnité de 40 €.",
      fields: C_FIELDS.concat([["facture", "Facture n°", ""], ["montant", "Montant TTC dû (€)", ""], ["echeance", "Échéance dépassée le", "", "date"], ["delai", "Nouveau délai (jours)", "8"], ["niveau", "Niveau", "Mise en demeure"]]),
      body: [["h", "{{niveau}}"],
        ["p", "À l'attention de {{cli_nom}}, {{cli_adresse}}."],
        ["p", "Sauf erreur de notre part, la facture n° {{facture}} d'un montant de {{montant}} € TTC, échue le {{echeance}}, reste impayée."],
        ["p", "Nous vous demandons de la régler sous {{delai}} jours. À défaut, nous appliquerons les pénalités de retard prévues (trois fois le taux d'intérêt légal) et l'indemnité forfaitaire de 40 € pour frais de recouvrement (article L441-10 du Code de commerce), puis nous engagerons une procédure de recouvrement. Les publicités pourront être mises en pause d'ici là."],
        ["p", "Si le paiement est déjà parti, merci de ne pas tenir compte de ce courrier."],
        ["sign", "|Pour {{ent_nom}}"]] },
    { id: "resiliation", group: "Clients", name: "Lettre de résiliation", what: "Mettre fin au contrat, côté Entremis ou côté client.",
      fields: C_FIELDS.concat([["qui", "Qui résilie", "Le Client"], ["contrat_date", "Date du contrat", "", "date"], ["fin", "Fin effective le", "", "date"], ["motif", "Motif (facultatif)", ""]]),
      body: [["h", "Résiliation du contrat de prestation"],
        ["p", "{{qui}} met fin au contrat de prestation de génération de leads exclusifs signé le {{contrat_date}} entre {{ent_nom}} et {{cli_nom}}, avec effet au {{fin}}, dans le respect du préavis prévu."],
        ["p", "Motif : {{motif}}"],
        ["p", "Les leads transmis jusqu'à cette date restent dus. Le sort des vidéos suit l'article 8 du contrat (propriété à la fin de l'engagement, ou rachat)."],
        ["sign", "Pour le Client|Pour {{ent_nom}}"]] },
    { id: "cgv", group: "Clients", name: "Conditions générales de vente", what: "Les règles communes à tous les clients, à joindre aux devis.",
      fields: [["penalites", "Taux des pénalités de retard", "trois fois le taux d'intérêt légal"], ["paiement", "Délai de paiement (jours)", "30"]],
      body: [["h", "Conditions générales de vente – {{ent_nom}}"],
        ["h", "1. Champ"], ["p", "Ces conditions s'appliquent aux prestations de {{ent_nom}} auprès des professionnels : tournage de vidéos, gestion de publicités, qualification et transmission de leads."],
        ["h", "2. Commande"], ["p", "Toute prestation fait l'objet d'un devis ou d'un contrat signé. Le contrat particulier prime sur ces conditions."],
        ["h", "3. Prix"], ["p", "En euros hors taxes. TVA française au taux en vigueur pour les clients établis en France ; autoliquidation pour les clients établis dans un autre pays de l'Union européenne ; pas de TVA française pour les clients établis hors de l'Union."],
        ["h", "4. Paiement"], ["p", "À {{paiement}} jours à compter de la facture, par virement ou prélèvement SEPA. Retard : pénalités à {{penalites}}, indemnité forfaitaire de 40 € pour frais de recouvrement, et possibilité de suspendre les prestations."],
        ["h", "5. Contestation des leads"], ["p", "7 jours à compter de la transmission, selon les motifs prévus au contrat."],
        ["h", "6. Responsabilité"], ["p", "{{ent_nom}} s'engage sur les moyens, pas sur un nombre de ventes. Sa responsabilité est limitée aux sommes payées sur les 3 derniers mois."],
        ["h", "7. Propriété des contenus"], ["p", "Les vidéos restent la propriété de {{ent_nom}} jusqu'à la fin de l'engagement ou leur rachat."],
        ["h", "8. Données personnelles"], ["p", "Traitées conformément au RGPD ; accord de sous-traitance sur demande."],
        ["h", "9. Droit applicable"], ["p", "Droit français ; tribunal de commerce du siège de {{ent_nom}}."]] }
  ];
  const GROUPS = ["Clients", "Tournage", "Paiement", "Partenaires"];

  /* ---------- La marque sur les documents : le E d'Entremis (même dessin que l'app), en image pour le PDF ---------- */
  const INK = [6, 18, 28], MUTE = [96, 112, 128], LINE = [222, 229, 236], BLUE = [47, 91, 234], SOFT = [244, 247, 250];
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path fill="#06121C" d="M24 26a8 8 0 0 1 8-8h58a7 7 0 0 1 0 14H38v56h52a7 7 0 0 1 0 14H32a8 8 0 0 1-8-8Z"/><rect x="48" y="53" width="60" height="14" rx="7" fill="#2F5BEA"/></svg>`;
  let LOGO = null;
  function logoPng() {
    if (LOGO) return LOGO;
    LOGO = new Promise(ok => { const img = new Image(); img.onload = () => { const cv = document.createElement("canvas"); cv.width = cv.height = 480; cv.getContext("2d").drawImage(img, 0, 0, 480, 480); ok(cv.toDataURL("image/png")); }; img.onerror = () => ok(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(LOGO_SVG); });
    return LOGO;
  }
  // En-tête et pied de chaque page (logo, nom, coordonnées, numéro de page)
  function brandPages(doc, logo, v, title) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (logo) doc.addImage(logo, "PNG", 20, 11, 9, 9);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(String(v.ent_nom || "Entremis"), 31.5, 17.2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE); doc.text(String(title), 190, 17.2, { align: "right" });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(20, 24, 190, 24);
      doc.line(20, 282, 190, 282);
      doc.setFontSize(7.5); doc.text([v.ent_nom, v.ent_forme, v.ent_siege, v.ent_siret ? "SIRET " + v.ent_siret : "", v.ent_rcs ? "RCS " + v.ent_rcs : ""].filter(Boolean).join(" · "), 20, 287, { maxWidth: 150 });
      doc.text(`Page ${i} sur ${n}`, 190, 287, { align: "right" });
    }
  }

  const tpl = () => T.find(t => t.id === X.tpl);
  const vals = () => { const t = tpl(), c = cl(X.cid), base = me(); (t ? t.fields : []).forEach(([k, , d]) => { if (X.vals[k] === undefined) X.vals[k] = typeof d === "function" ? d(c) : d; }); return Object.assign({}, base, X.vals); };
  const fill = (s, v) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => { const x = v[k]; return x === undefined || x === "" ? "……" : (/^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? fr(x) : String(x)); });
  function paper(t, v) {
    const esc = EM().esc;
    return `<article class="paper legal-paper"><header><span class="legal-brand"><svg aria-hidden="true"><use href="#logo-e"/></svg><b>${esc(v.ent_nom || "Entremis")}</b></span><span>${esc(t.name)}</span></header>
      ${t.body.map(([k, s]) => k === "h" ? `<h3>${esc(fill(s, v))}</h3>` : k === "l" ? `<ul>${fill(s, v).split("|").map(x => `<li>${esc(x)}</li>`).join("")}</ul>`
        : k === "sign" ? `<div class="legal-sign">${fill(s, v).split("|").map(x => `<div><span>${esc(x)}</span><i></i></div>`).join("")}</div>` : `<p>${esc(fill(s, v))}</p>`).join("")}
      <footer>Fait à ${esc(v.ent_ville || "……")}, le ${fr(today())}, en deux exemplaires.</footer></article>`;
  }
  function view(S) {
    const esc = EM().esc, icon = EM().icon, t = tpl();
    if (!t) return `<div class="head"><div class="head-text"><h1 class="h1">Documents juridiques</h1><p class="sub">Choisissez un modèle : il se remplit avec ce que l'app sait du client.</p></div>
        <div class="head-actions"><button class="btn btn-ghost" type="button" data-legal-me>${icon("sliders")}Coordonnées d'Entremis</button></div></div>
      ${X.me ? meCard() : ""}
      ${GROUPS.map(g => `<section class="card"><div class="card-head"><h2 class="h2">${g}</h2></div><ul class="ac-list">${T.filter(x => x.group === g).map(x => `<li class="ac-row is-link" data-legal-tpl="${x.id}" tabindex="0"><span class="av av-md">${icon("book")}</span><span><b>${esc(x.name)}</b><small>${esc(x.what)}</small></span>${icon("chev")}</li>`).join("")}</ul></section>`).join("")}
      ${recent()}
      <p class="set-note">${icon("info")}Modèles de travail, pas un conseil juridique : à faire relire par un avocat ou un juriste avant le premier usage. Les coordonnées bancaires ne sont jamais saisies dans l'app.</p>`;
    const v = vals(), c = cl(X.cid);
    return `<div class="head"><div class="head-text"><button class="link" type="button" data-legal-back>${icon("back")} Tous les modèles</button><h1 class="h1">${esc(t.name)}</h1><p class="sub">${esc(t.what)}</p></div></div>
      <div class="gen">
        <form class="card gen-form" id="legal-form" autocomplete="off">
          <div class="field"><label for="legal-cli">Client</label><select id="legal-cli" name="__cid"><option value="">Aucun</option>${EM().allClients().map(x => `<option value="${esc(x.id)}"${x.id === X.cid ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
          ${t.fields.map(([k, l, , type]) => `<label class="field"><span>${esc(l)}</span><input name="${k}" ${type === "date" ? 'type="date"' : ""} value="${esc(v[k] == null ? "" : v[k])}"></label>`).join("")}
          ${!me().ent_siret ? `<p class="kpi-note t-warn">${icon("alert")} Les coordonnées d'Entremis (SIRET, siège…) sont à compléter une fois : bouton « Coordonnées d'Entremis » sur la page des modèles.</p>` : ""}
          <div class="form-actions"><button class="btn btn-primary" type="submit">${icon("download")}Télécharger le PDF</button></div>
        </form>
        <div class="gen-preview" data-legal-preview>${paper(t, v)}</div>
      </div>`;
  }
  function meCard() {
    const v = me(), esc = EM().esc;
    return `<form class="card" id="legal-me-form"><div class="card-head"><h2 class="h2">Coordonnées d'Entremis</h2><span class="muted">pour tous les modèles</span></div>
      <div class="field-grid">${ME_FIELDS.map(([k, l]) => `<label class="field"><span>${esc(l)}</span><input name="${k}" value="${esc(v[k] || "")}"></label>`).join("")}</div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>`;
  }
  function recent() {
    const list = ACTES().list.filter(a => a.id !== "me").sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1).slice(0, 8), esc = EM().esc;
    if (!list.length) return "";
    return `<section class="card"><div class="card-head"><h2 class="h2">Derniers documents faits</h2></div><ul class="history">${list.map(a => `<li>${EM().icon("book")}<div><b>${esc(a.name)}</b><span>${esc(a.client || "")} – ${fr(a.at)} – ${esc(TM().member(a.by).name)}</span></div></li>`).join("")}</ul></section>`;
  }
  async function pdf(S) {
    const t = tpl(), v = vals(), jsPDF = await window.ENTREMIS_GEN.loadPdf(), logo = await logoPng(), doc = new jsPDF({ unit: "mm", format: "a4" }), L = 20, W = 170, TOP = 34, BOTTOM = 274;
    let y = TOP;
    const need = h => { if (y + h > BOTTOM) { doc.addPage(); y = TOP; } };
    const body = (size, color, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color); };
    t.body.forEach(([k, s], idx) => {
      const txt = fill(s, v);
      if (k === "h" && idx === 0) {   // le titre du document, avec le trait bleu de la marque
        body(19, INK, true); const ls = doc.splitTextToSize(txt, W); need(ls.length * 8 + 14); doc.text(ls, L, y + 4); y += ls.length * 8 + 1;
        doc.setFillColor(...BLUE); doc.roundedRect(L, y, 18, 1.6, 0.8, 0.8, "F"); y += 9;
      } else if (k === "h") { body(10.5, INK, true); const ls = doc.splitTextToSize(txt, W); need(ls.length * 5 + 10); y += 3; doc.text(ls, L, y); y += ls.length * 5 + 1.5; }
      else if (k === "l") { body(9.6, INK); txt.split("|").forEach(x => { const ls = doc.splitTextToSize(x, W - 7); need(ls.length * 4.7 + 1.5); doc.setFillColor(...BLUE); doc.circle(L + 1.6, y - 1.2, 0.7, "F"); doc.text(ls, L + 6, y); y += ls.length * 4.7 + 1.5; }); y += 1; }
      else if (k === "sign") {
        const cols = txt.split("|"); need(46); y += 6;
        cols.forEach((x, i) => { if (!x && cols.length > 1 && i === 0) return; const X0 = cols.length === 1 || (!cols[0] && i === 1) ? (cols.length === 1 ? L : L + 88) : L + i * 88;
          doc.setFillColor(...SOFT); doc.setDrawColor(...LINE); doc.roundedRect(X0, y, 82, 36, 2.5, 2.5, "FD");
          body(8.5, MUTE); doc.text(doc.splitTextToSize(x || "Signature", 74), X0 + 4, y + 6); doc.text("Date et signature", X0 + 4, y + 32); });
        y += 42;
      } else { body(9.6, INK); const ls = doc.splitTextToSize(txt, W); need(ls.length * 4.7 + 2.5); doc.text(ls, L, y); y += ls.length * 4.7 + 2.5; }
    });
    need(12); body(9, MUTE); doc.text(`Fait à ${v.ent_ville || "……"}, le ${fr(today())}, en deux exemplaires.`, L, y + 5);
    brandPages(doc, logo, v, t.name);
    const name = `${t.name} – ${(cl(X.cid) || {}).name || v.p_nom || v.part_nom || "Entremis"}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
    doc.save(name);
    ACTES().put({ id: "a" + Date.now().toString(36), tpl: t.id, name: t.name, client: (cl(X.cid) || {}).name || v.p_nom || v.part_nom || "", cid: X.cid, at: new Date().toISOString().slice(0, 16), by: S.who });
    TM().haptic("done"); EM().toast("PDF prêt. À relire avant de le faire signer.");
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-legal-tpl],[data-legal-back],[data-legal-me],[data-legal-for]"); if (!t) return false;
    const d = t.dataset;
    if (d.legalFor) { X.cid = d.legalFor; X.tpl = null; return false; }   // le lien de la fiche client : on garde le client, la navigation continue
    if (d.legalTpl) { X.tpl = d.legalTpl; X.vals = {}; render(); window.scrollTo(0, 0); return true; }
    if ("legalBack" in d) { X.tpl = null; X.vals = {}; render(); return true; }
    if ("legalMe" in d) { X.me = !X.me; render(); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    const id = e.target.getAttribute && e.target.getAttribute("id");
    if (id === "legal-me-form") { e.preventDefault(); const fd = new FormData(e.target), vals = {}; ME_FIELDS.forEach(([k]) => { vals[k] = String(fd.get(k) || "").trim(); });
      ACTES().put({ id: "me", vals, by: S.who, at: new Date().toISOString().slice(0, 16) }); X.me = false; TM().haptic("done"); render(); EM().toast("Coordonnées enregistrées pour tous les modèles."); return true; }
    if (id !== "legal-form") return false;
    e.preventDefault(); pdf(S).catch(() => EM().toast("Le PDF n'a pas pu être créé. Vérifiez la connexion, puis réessayez.")); return true;
  }
  document.addEventListener("input", e => {
    const f = e.target.closest && e.target.closest("#legal-form"); if (!f) return;
    if (e.target.name === "__cid") { X.cid = e.target.value; X.vals = {}; EM().render(); return; }
    X.vals[e.target.name] = e.target.value;
    const pv = document.querySelector("[data-legal-preview]"), t = tpl(); if (pv && t) pv.innerHTML = paper(t, vals());
  });
  document.addEventListener("change", e => { if (e.target.name === "__cid" && e.target.closest("#legal-form")) { X.cid = e.target.value; X.vals = {}; EM().render(); } });

  window.ENTREMIS_LEGAL = { logoPng, view, onClick, onSubmit, TEMPLATES: T, init: render => ACTES().init(render), reset: () => { X.tpl = null; X.vals = {}; X.me = false; } };
})();
