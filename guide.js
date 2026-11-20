/* Entremis — le petit guide de l'app.
   #guide : côté fondateurs (Marc, Richard, Gianni).   #aide : côté client (l'installateur).
   Des tuiles courtes, un lien « Ouvrir » vers chaque page. Les textes disent ce qui marche aujourd'hui, rien de plus. */
(function () {
  "use strict";
  const EM = () => window.EM;

  const tile = ([href, icon, title, text]) => `<li><a class="gd-tile" href="#${href}">${EM().icon(icon)}<div><b>${title}</b><span>${text}</span></div>${EM().icon("chev")}</a></li>`;
  const section = (title, sub, body) => `<section class="card"><div class="card-head"><h2 class="h2">${title}</h2>${sub ? `<span class="muted">${sub}</span>` : ""}</div>${body}</section>`;
  const tips = list => `<ul class="gd-tips">${list.map(([k, t]) => `<li><b>${k}</b><span>${t}</span></li>`).join("")}</ul>`;
  const faq = list => `<div class="gd-faq">${list.map(([q, a]) => `<details><summary>${q}${EM().icon("chev")}</summary><p>${a}</p></details>`).join("")}</div>`;

  function viewTeam() {
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Guide de l'app</h1><p class="sub">Comment l'espace agence fonctionne, en cinq minutes de lecture.</p></div></div>
    ${section("Votre journée en quatre gestes", "", EM().nodeFlow([
      { icon: "home", title: "Ouvrir Mon portail", text: "Vos tâches du jour, vos clients, les leads qui attendent et ce qui est en retard." },
      { icon: "inbox", title: "Donner les leads", text: "Chaque lead va à un seul client. L'app propose celui qui a le même métier et la même zone." },
      { icon: "phone", title: "Noter ses appels", text: "Dix secondes après chaque appel. Toute l'équipe sait où on en est." },
      { icon: "check", title: "Cocher ses tâches", text: "Une tâche faite part dans « Qui a fait quoi ». Tout le monde la voit." }
    ], "Votre journée en quatre gestes"))}
    ${section("Clients et leads : la différence", "", `<ul class="gd-tips">
      <li><b>Un client</b><span>Un installateur qui nous achète des rendez-vous (Solaria Habitat, Thermo Rhône…). Il a une campagne, un objectif et un espace client.</span></li>
      <li><b>Un lead</b><span>Un particulier qui demande une étude (une pompe à chaleur, des panneaux…). On le rappelle, on vérifie 4 critères, puis on le donne à un seul client.</span></li>
    </ul>`)}
    ${section("Les pages", "dans l'ordre du menu", `<ul class="gd-tiles">${[
      ["equipe", "home", "Mon portail", "Votre page d'accueil. Chacun a la sienne."],
      ["taches", "check", "Tâches", "Ce que chacun a à faire, et le journal de ce qui a été fait."],
      ["appel", "phone", "Poste d'appel", "Un lead à la fois : le script, les 4 points à cocher, le résultat en un clic. Le suivant arrive tout seul."],
      ["rendez-vous", "cal", "Rendez-vous", "Tous les RDV des clients : rappels au particulier (veille et matin), absences, résultats."],
      ["zones", "pin", "Zones", "Un seul installateur par métier et par département : qui a quoi, où prospecter, la liste d'attente."],
      ["sante", "gauge", "Santé et suivi", "Les clients à risque, les fins de campagne, les avis. Bilan et proposition de suite en un clic."],
      ["propositions", "euro", "Propositions", "La proposition pour un prospect : ce qu'on livre, le prix, ce que ça peut lui rapporter. En PDF."],
      ["etudes", "check", "Études de cas", "Les vrais résultats des clients, prêts pour le site quand ils sont d'accord."],
      ["marge", "chart", "Marge", "Ce que rapporte chaque campagne, une fois la pub, les appels et les remplacements payés."],
      ["conformite", "shield", "Conformité", "Les preuves de consentement et l'effacement des données sur demande."],
      ["secteurs", "tool", "Secteurs", "Un seul parcours pour tous les métiers. Ajoutez un métier et choisissez comment on livre : rendez-vous, transfert direct ou devis. L'app suit."],
      ["discussions", "chat", "Discussions", "Entre Marc, Richard et Gianni. Un fil pour l'équipe, un par client. Le client ne voit rien."],
      ["processus", "grid", "Processus", "Vos marches à suivre, en blocs reliés. Ajoutez, déplacez, attribuez chaque étape."],
      ["notifications", "bell", "Notifications", "Les alertes, et le réglage de ce qui vous prévient."],
      ["clients", "building", "Clients", "Les campagnes en cours, leur rythme, les remplacements à trouver."],
      ["leads", "inbox", "Leads", "D'où viennent les leads, à qui ils vont, et ceux à attribuer. Cliquez un nom pour son détail."],
      ["scripts-equipe", "book", "Scripts", "Écrire les scripts des clients et voir où chacun en est de sa préparation."],
      ["pipeline", "users", "Prospection", "Les installateurs à signer, étape par étape."],
      ["appels", "phone", "Appels", "Le suivi des appels de chacun et le journal."],
      ["marketing", "signal", "Marketing", "Référencement, publicités, et le calculateur : combien coûte un rendez-vous."],
      ["chiffres", "gauge", "Chiffres", "Tout ce qu'on suit, comparé à la période d'avant. Créez vos propres indicateurs."],
      ["avancement", "chart", "Avancement", "Les rendez-vous livrés par semaine et les objectifs du mois."],
      ["finances", "euro", "Finances", "Devis et factures. « Créer un devis ou une facture » fait le document et son PDF."]
    ].map(tile).join("")}</ul>`)}
    ${section("Bon à savoir", "", tips([
      ["⌘K ou Ctrl K", "Ouvre la recherche : un client, un lead, une tâche, une page. Sur téléphone, la loupe en haut."],
      ["Fiche d'un client", "Cliquez son nom partout dans l'app : coordonnées à copier, notes, leads donnés, historique, « Faire un devis »."],
      ["Supprimer", "L'app demande toujours de confirmer. Après une action, « Annuler » reste quelques secondes en bas de l'écran."],
      ["Sur téléphone", "Glissez une tâche vers la droite pour la finir, vers la gauche pour la supprimer."],
      ["Espace client", "Le bouton « Client » en haut du menu montre l'app comme la voit Solaria Habitat."],
      ["« Exemple »", "Cette étiquette signale des chiffres d'exemple. Les tâches, appels, leads, devis et scripts sont partagés entre vous trois dans la version en ligne."]
    ]))}`;
  }

  function viewClient() {
    const c = EM().C();
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Comment ça marche</h1><p class="sub">Votre espace Entremis, expliqué simplement.</p></div></div>
    ${section("Ce qu'Entremis fait pour vous", "", EM().nodeFlow([
      { icon: "phone", title: "On rappelle", text: "Chaque particulier qui demande une étude est rappelé tout de suite." },
      { icon: "check", title: "On vérifie", text: "Le projet, le budget et les aides, s'il est propriétaire, le délai." },
      { icon: "cal", title: "Vous recevez", text: "Le rendez-vous arrive dans votre agenda, avec sa fiche." },
      { icon: "shield", title: "Garanti", text: "Personne au rendez-vous ? On en place un autre, sans frais." }
    ], "Ce qu'Entremis fait pour vous"))}
    ${section("Les pages de votre espace", "", `<ul class="gd-tiles">${[
      ["accueil", "home", "Accueil", "Votre prochain rendez-vous, l'objectif de la campagne et vos chiffres."],
      ["agenda", "cal", "Agenda", "Tous vos rendez-vous, par jour, semaine ou mois. Touchez-en un pour sa fiche."],
      ["comptes", "inbox", c.words.accounts, "Les particuliers qui ont demandé une étude, et où en est chacun. Ils vous sont réservés."],
      ["messages", "chat", "Messages", "Tout ce qu'on a écrit en votre nom, mot pour mot, et leurs réponses."],
      ["scripts", "book", "Scripts", "Préparez vos visites et vos appels. Cochez chaque point quand il est prêt."],
      ["resultats", "chart", "Résultats", "Après chaque visite : signé, devis ou pas intéressé. Le montant signé grâce à nous, et votre avis."],
      ["dispos", "clock", "Disponibilités", "Vos créneaux et vos congés : on place les rendez-vous seulement là."],
      ["parrainage", "users", "Parrainer", "Présentez-nous un autre installateur. On l'appelle de votre part."],
      ["notifications", "bell", "Notifications", "Ce qui vous prévient, et comment."]
    ].map(tile).join("")}</ul>`)}
    ${section("Un rendez-vous s'est mal passé ?", "", tips([
      ["1. Ouvrez sa fiche", "Depuis l'Agenda ou l'Accueil."],
      ["2. « Signaler une absence »", "Personne n'était là, ou ce n'était pas la bonne personne : dites-le en un clic."],
      ["3. On le remplace", "Un autre rendez-vous est placé dans votre agenda, sans frais. Vous le voyez arriver."]
    ]))}
    ${section("Questions fréquentes", "", faq([
      ["Les demandes sont-elles partagées avec d'autres artisans ?", "Non. Chaque demande est réservée à vous seul : elle n'est jamais revendue ni partagée."],
      ["Pourquoi dire si j'ai signé ?", "Pour voir ce que la campagne vous rapporte, et pour qu'on cible mieux vos demandes. Ces chiffres restent entre vous et Entremis."],
      ["Le particulier est-il prévenu avant la visite ?", "Oui : un SMS la veille et un le matin. Il peut confirmer ou demander à décaler."],
      ["Comment préparer une visite ?", "Ouvrez la fiche du rendez-vous puis « Préparer ce rendez-vous » : le script se remplit avec le prénom, le projet, le budget et le délai du particulier."],
      ["Puis-je mettre mes rendez-vous dans mon agenda Google ?", "Oui : « Ajouter à mon agenda » sur la fiche ou l'Accueil, une fois votre agenda Google connecté dans la version en ligne."],
      ["Qui contacter ?", "Votre contact Entremis, sur l'Accueil : son téléphone et son e-mail s'ouvrent d'un clic."]
    ]))}`;
  }

  window.ENTREMIS_GUIDE = { viewTeam, viewClient };
})();
