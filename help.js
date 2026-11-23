/* Entremis — le petit « i » à côté du titre de chaque page (Marc, 21 nov. 2026).
   Un clic ouvre deux ou trois phrases : à quoi sert la page, et ce qu'on peut y faire. Rien ne s'affiche tant qu'on ne clique pas. */
(function () {
  "use strict";
  const TEAM = {
    equipe: "Votre point de départ chaque matin : vos tâches du jour, vos clients, les leads qui attendent et ce qui est en retard.",
    taches: "Les tâches de l'équipe. Créez-en une, donnez-la à quelqu'un avec une date, cochez-la quand c'est fait : tout le monde le voit.",
    discussions: "Les échanges internes de l'équipe, rangés par client. Les clients ne les voient jamais.",
    processus: "Les façons de faire de l'agence, étape par étape, pour que chacun travaille pareil.",
    notifications: "Tout ce qui demande votre attention : nouveaux leads, relances du jour, rendez-vous, factures en retard, sauvegarde à faire.",
    guide: "Le mode d'emploi de l'espace agence, en cinq minutes de lecture.",
    appel: "Le poste pour rappeler les leads : le script, les critères à vérifier, et le résultat de l'appel en un clic.",
    leads: "Les particuliers qui demandent une étude. Chaque lead va à un seul client. Ici : le donner, fixer son niveau, dire s'il est facturé, traiter une contestation.",
    "rendez-vous": "Tous les rendez-vous placés chez tous les clients. Marquez la visite faite, signalez une absence, placez un remplaçant.",
    videos: "Les vidéos des pubs, du montage à la mise en ligne : le lien pour la télécharger, le texte à poster, qui la poste et quand. Prête avec quelqu'un pour la poster : il reçoit une tâche. En ligne : elle rejoint les pubs en cours du client.",
    zones: "Qui travaille où. Une zone = un seul client : c'est ici qu'on vérifie l'exclusivité avant de signer.",
    contacts: "Le CRM : clients et prospects au même endroit. Cherchez, filtrez, planifiez la prochaine relance, étiquetez, attribuez à quelqu'un, importez ou exportez une liste.",
    clients: "Les installateurs qui achètent nos leads : leur campagne, leur rythme, qui les suit. Ouvrez une fiche pour tout le détail.",
    sante: "Les clients à surveiller : retard sur l'objectif, absences, fin d'engagement. Pour agir avant qu'un client parte.",
    "scripts-equipe": "Les scripts d'appel et de visite, à jour pour toute l'équipe et pour les clients.",
    secteurs: "Les métiers (pompes à chaleur, solaire…) et la façon de livrer chacun : rendez-vous, transfert d'appel ou devis.",
    juridique: "Les documents juridiques prêts à remplir : contrat, droit à l'image, prélèvement SEPA, RGPD… Ils se remplissent avec la fiche du client. À faire relire avant usage.",
    acces: "Créer l'accès d'un client à son espace, lui redonner un mot de passe provisoire, ou retirer son accès.",
    pipeline: "Les installateurs à signer, étape par étape. Glissez une carte d'une colonne à l'autre ; la prévision pondère chaque prospect selon son étape.",
    propositions: "Les propositions commerciales envoyées aux installateurs, et leur suite.",
    etudes: "Les preuves pour vendre : les vrais résultats de nos clients, à montrer aux prospects.",
    appels: "Le journal des appels de l'équipe : qui a appelé qui, quand, et pour quel résultat.",
    marketing: "Les chiffres du marketing d'Entremis, et le simulateur de rentabilité pour l'installateur (onglet Calcul).",
    chiffres: "Les chiffres suivis chaque semaine : coût de la pub par lead, leads facturables, rendez-vous pris, risques. Les chiffres « en direct » viennent de l'app.",
    documents: "Les documents de travail de l'équipe : argumentaire, brief de tournage, veille. Tenus à jour ici, visibles par l'équipe seulement.",
    avancement: "Où en sont les objectifs du mois : rendez-vous livrés, prospects signés, factures payées.",
    finances: "Devis et factures : ce qui est encaissé, en attente ou en retard. Ouvrez un document pour l'envoyer ou le relancer.",
    marge: "Ce que rapporte chaque client une fois la pub et nos coûts déduits.",
    conformite: "Les preuves de consentement des particuliers et les demandes d'effacement de leurs données (RGPD).",
    generer: "Créer un devis ou une facture : l'aperçu suit à chaque frappe, puis PDF, e-mail ou partage.",
    reglages: "Votre profil, vos connexions (votre Claude, Google), les notifications de cet appareil et la sauvegarde sur le Drive commun.",
    fiche: "Tout sur cette entreprise : coordonnées, contrat, prochaine relance, facturation du mois, avancement, pub, historique.",
    plus: "Toutes les pages de l'espace agence."
  };
  const CLIENT = {
    accueil: "Votre espace Entremis : vos prochains rendez-vous et l'essentiel de votre campagne.",
    agenda: "Vos rendez-vous, jour par jour. Touchez-en un pour tout savoir sur le particulier.",
    rdv: "Tout sur ce rendez-vous : le projet du particulier, ses réponses, le mot d'Entremis. Notez le résultat après la visite.",
    comptes: "Les demandes qui vous ont été transmises, et où en est chacune.",
    facturation: "Vos leads du mois, leur niveau et ce qui sera facturé. Vous avez 7 jours pour contester un lead.",
    signer: "Les contrats et documents envoyés par Entremis. Lisez-les, puis signez en ligne avec le doigt ou la souris.",
    resultats: "Le résultat de chaque visite (signé, devis, pas intéressé) : il aide Entremis à mieux cibler vos leads.",
    messages: "Vos échanges avec Entremis.",
    scripts: "Les scripts conseillés pour vos visites.",
    dispos: "Vos créneaux libres : Entremis place les rendez-vous dedans.",
    parrainage: "Recommandez un installateur d'une autre zone à Entremis.",
    aide: "Comment fonctionne votre espace, en quelques minutes.",
    notifications: "Ce qui vous concerne : nouveaux rendez-vous, résultats à noter.",
    reglages: "Votre profil, votre mot de passe et les notifications de cet appareil.",
    menu: "Toutes vos pages."
  };
  /* ---------- Les favoris : des raccourcis en haut du menu, propres à chacun (suivent le compte en ligne) ---------- */
  const NO_FAV = ["fiche", "rdv", "script"];
  const CL = () => window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? window.ENTREMIS_CLOUD : null;
  function favs(space) {
    const k = space === "client" ? "fav-client" : "fav-team", c = CL();
    if (c) { const v = c.privGet("prefs", k); return v && Array.isArray(v.list) ? v.list : []; }
    try { return JSON.parse(localStorage.getItem("entremis-app-" + k) || "[]"); } catch (_) { return []; }
  }
  function setFavs(space, list) {
    const k = space === "client" ? "fav-client" : "fav-team", c = CL();
    if (c) c.privSet("prefs", k, { list }); else try { localStorage.setItem("entremis-app-" + k, JSON.stringify(list)); } catch (_) {}
  }
  const text = (name, space) => (space === "client" ? CLIENT[name] || TEAM[name] : TEAM[name] || CLIENT[name]) || "";
  let open = false;
  // Pose le bouton à côté du premier titre de la page (appelé après chaque affichage)
  function decorate(root, name, space) {
    const t = text(name, space), h = root && root.querySelector(".head h1.h1"); if (!t || !h || h.querySelector(".info-i")) return;
    if (!NO_FAV.includes(name)) {   // l'étoile : ajouter ou retirer la page des favoris
      const on = favs(space).includes(name), f = document.createElement("button");
      f.type = "button"; f.className = "info-i fav-star" + (on ? " is-on" : ""); f.dataset.pageFav = name + "|" + space;
      f.setAttribute("aria-pressed", String(on)); f.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris"); f.title = on ? "Retirer des favoris" : "Ajouter aux favoris";
      f.innerHTML = window.EM.icon("star"); h.appendChild(f);
    }
    const b = document.createElement("button");
    b.type = "button"; b.className = "info-i"; b.setAttribute("aria-label", "À quoi sert cette page"); b.setAttribute("aria-expanded", String(open)); b.dataset.pageInfo = "";
    b.innerHTML = window.EM.icon("info");
    h.appendChild(b);
    const p = document.createElement("p"); p.className = "info-pop"; p.setAttribute("role", "note"); p.hidden = !open; p.textContent = t;
    h.insertAdjacentElement("afterend", p);
  }
  document.addEventListener("click", e => {
    const f = e.target.closest && e.target.closest("[data-page-fav]");
    if (f) { e.preventDefault(); const [name, space] = f.dataset.pageFav.split("|"), list = favs(space), on = list.includes(name);
      setFavs(space, on ? list.filter(x => x !== name) : list.concat(name)); if (window.ENTREMIS_TEAM) window.ENTREMIS_TEAM.haptic("tap");
      window.EM.render(); window.EM.toast(on ? "Retirée des favoris." : "Ajoutée aux favoris, en haut du menu."); return; }
    const b = e.target.closest && e.target.closest("[data-page-info]"); if (!b) return;
    e.preventDefault(); open = !open; b.setAttribute("aria-expanded", String(open));
    const p = b.closest("h1").nextElementSibling; if (p && p.classList.contains("info-pop")) p.hidden = !open;
  });
  window.ENTREMIS_HELP = { favs, decorate, text, reset: () => { open = false; } };
})();
