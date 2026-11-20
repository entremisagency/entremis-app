/* Entremis — #reglages : le centre de réglages (Marc, 20 nov. 2026).
   Une colonne de rubriques à gauche, la rubrique ouverte à droite (sur téléphone : la liste, puis la rubrique).
   Rubriques : profil, espace, notifications, apparence, connexions (agence), données et sécurité, aide.
   Connexions : chacun (Marc, Richard, Gianni) branche SON IA, ses serveurs MCP, ses bots et ses automatisations.
   C'est propre à chaque compte : rangé par personne, jamais montré aux deux autres. Dans la maquette, rien n'est branché
   et aucune clé n'est demandée ni gardée ; le vrai branchement arrive avec Supabase (un compte par personne) et GitHub. */
(function () {
  "use strict";
  const EM = () => window.EM, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const X = { sec: null, cx: null };   // rubrique ouverte, connexion ouverte dans la fenêtre

  // La police : Inter Tight (style AgentOps) ou Outfit (la charte). Gardée dans ce navigateur.
  const FONT_KEY = "entremis-app-font";
  const font = () => { try { return localStorage.getItem(FONT_KEY) || "inter"; } catch (_) { return "inter"; } };
  const applyFont = f => { if (f === "outfit") document.documentElement.style.setProperty("--font", "var(--font-charte)"); else document.documentElement.style.removeProperty("--font"); };
  applyFont(font());

  /* ---------- Connexions : le catalogue ---------- */
  const GROUPS = [
    ["ia", "Ton IA et tes outils (MCP)"], ["bot", "Bots et messages"], ["auto", "Automatisations"], ["outils", "Agenda et mail"], ["socle", "Le socle, à l'étape Supabase et GitHub"]
  ];
  const CONNECT = [
    { id: "claude", group: "ia", name: "Claude", mark: "C", what: "Ton assistant : rédige, résume, prépare les messages.", can: ["Lire les leads et les fiches que tu lui ouvres", "Préparer un message, tu valides avant l'envoi"] },
    { id: "chatgpt", group: "ia", name: "ChatGPT", mark: "G", what: "Un autre assistant, si tu préfères.", can: ["Lire les leads et les fiches que tu lui ouvres", "Préparer un message, tu valides avant l'envoi"] },
    { id: "mcp", group: "ia", name: "Serveur MCP", mark: "M", what: "Donne à ton IA un accès à un outil : base, agenda, fichiers.", field: "Adresse du serveur", ph: "https://…", can: ["Ce que le serveur autorise, rien de plus", "Seulement sur ton compte"] },
    { id: "telegram", group: "bot", name: "Bot Telegram", mark: "T", what: "Tes alertes et tes tâches du jour sur Telegram.", field: "Nom du bot", ph: "@…", can: ["T'envoyer tes alertes", "Noter une tâche quand tu lui écris"] },
    { id: "whatsapp", group: "bot", name: "WhatsApp Business", mark: "W", what: "Écrire aux particuliers depuis le numéro d'Entremis.", can: ["Envoyer les messages que tu valides", "Recevoir leurs réponses dans Discussions"] },
    { id: "slack", group: "bot", name: "Slack", mark: "S", what: "Recevoir les alertes dans un canal Slack.", field: "Nom du canal", ph: "#…", can: ["Poster tes alertes dans ce canal"] },
    { id: "make", group: "auto", name: "Make ou Zapier", mark: "Z", what: "Relier Entremis à d'autres outils, sans code.", field: "Nom du scénario", ph: "Ex. : nouveau lead vers Google Sheets", can: ["Recevoir un signal à chaque événement choisi"] },
    { id: "n8n", group: "auto", name: "n8n", mark: "N", what: "Des automatisations hébergées chez toi.", field: "Adresse de ton n8n", ph: "https://…", can: ["Recevoir un signal à chaque événement choisi"] },
    { id: "gcal", group: "outils", name: "Google Agenda", brand: "gcal", what: "Tes tâches et les rendez-vous dans ton agenda.", live: true, can: ["Lire ton agenda de la semaine", "Ajouter un événement quand tu le demandes"] },
    { id: "gmail", group: "outils", name: "Gmail", brand: "google", what: "Envoyer devis, factures et relances depuis ta boîte.", can: ["Préparer un brouillon avec le PDF joint", "Tu cliques sur Envoyer, jamais l'app seule"] },
    { id: "supabase", group: "socle", name: "Supabase", mark: "S", what: "La vraie base : un compte par personne, données séparées.", later: true, can: ["Un compte et un mot de passe chacun", "Tes connexions rangées sur ton compte, clés chiffrées côté serveur"] },
    { id: "github", group: "socle", name: "GitHub", mark: "G", what: "Le code de l'app, ses versions et sa mise en ligne.", later: true, can: ["Garder chaque version de l'app", "Mettre en ligne sans perdre les données"] }
  ];
  const AUTO = [
    { id: "lead-ia", text: "Quand un lead arrive, mon IA prépare le premier message", needs: ["claude", "chatgpt", "mcp"] },
    { id: "morning", text: "Chaque matin à 8 h, mon bot m'envoie mes tâches du jour", needs: ["telegram", "slack", "whatsapp"] },
    { id: "late-invoice", text: "Facture en retard : mon IA rédige la relance, je valide", needs: ["claude", "chatgpt"] },
    { id: "rdv-cal", text: "RDV placé : il arrive dans mon Google Agenda", needs: ["gcal"] },
    { id: "weekly", text: "Le vendredi, mon IA fait le bilan de mes clients", needs: ["claude", "chatgpt", "mcp"] }
  ];
  // Rangé par personne : Marc ne voit que les siennes, Richard et Gianni pareil
  const key = who => "entremis-app-connect-" + who;
  // Site en ligne : rangé sur le compte de la personne connectée (table private_docs), sinon dans ce navigateur
  const CL = () => window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? window.ENTREMIS_CLOUD : null;
  const mine = who => { const c = CL(); if (c) return Object.assign({ cx: {}, auto: {} }, c.privGet("connect", "me") || {}); try { return Object.assign({ cx: {}, auto: {} }, JSON.parse(localStorage.getItem(key(who)) || "{}")); } catch (_) { return { cx: {}, auto: {} }; } };
  const saveMine = (who, v) => { const c = CL(); if (c) { c.privSet("connect", "me", v); return; } try { localStorage.setItem(key(who), JSON.stringify(v)); } catch (_) {} };
  const state = (c, m) => c.live ? ["Dans la version en ligne", "ok"] : c.later ? ["Étape suivante", "neutral"] : m.cx[c.id] && m.cx[c.id].on ? ["Prévu", "info"] : ["Pas branché", "neutral"];
  const ready = (a, m) => a.needs.some(id => { const c = CONNECT.find(x => x.id === id); return c && (c.live || (m.cx[id] && m.cx[id].on)); });

  /* ---------- Les rubriques ---------- */
  const SECS = space => (space === "team"
    ? [["profil", "user", "Profil"], ["espace", "swap", "Espace"], ["notifs", "bell", "Notifications"], ["apparence", "sliders", "Apparence"], ["connexions", "tool", "Connexions"], ["donnees", "shield", "Données et sécurité"], ["aide", "info", "Aide"]]
    : [["profil", "user", "Profil"], ["espace", "swap", "Espace"], ["notifs", "bell", "Notifications"], ["apparence", "sliders", "Apparence"], ["donnees", "shield", "Données et sécurité"], ["aide", "info", "Aide"]]);

  const row = (title, sub, control) => `<div class="set-row"><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${control || ""}</div>`;
  const linkRow = (href, title, sub) => `<a class="set-row set-link" href="${href}"><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${EM().icon("chev")}</a>`;
  const seg = (attr, opts, cur) => `<div class="seg seg-lg">${opts.map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;

  function secProfil(S) {
    const esc = EM().esc, team = S.space === "team";
    if (!team) {
      const u = window.ENTREMIS_DATA.user;
      return `<section class="set-group"><div class="set-me"><span class="av av-xl">${esc(u.initials)}</span><div><b>${esc(u.name)}</b><span>${esc(u.role)} – ${esc(u.company)}</span></div></div>
        ${row("Votre contact chez Entremis", "Richard place vos rendez-vous et répond à vos questions.", `<a class="btn btn-ghost" href="#messages">${EM().icon("chat")}Écrire</a>`)}</section>`;
    }
    const me = TM().member(S.who), url = TM().photoUrl(S.who), busy = TM().photoBusy();
    return `<section class="set-group">
      <div class="set-me">${TM().avatar(S.who, "av av-xl")}<div><b>${esc(me.name)}</b><span>${esc(me.role || "")}</span></div>
        <div class="set-me-acts"><label class="btn btn-ghost${busy ? " is-busy" : ""}"><input class="sr" type="file" accept="image/png,image/jpeg,image/webp,image/heic" data-photo>${EM().icon("user")}${busy ? "Envoi…" : url ? "Changer la photo" : "Choisir une photo"}</label>${url ? `<button class="link" type="button" data-act="photo-remove">Retirer</button>` : ""}</div></div>
      ${CL() ? row("Connecté", esc((CL().me() || {}).email || ""), `<button class="btn btn-ghost" type="button" data-cloud-out>Se déconnecter</button>`)
        : row("C'est moi", "Ton portail : tes tâches, tes clients, tes alertes, tes connexions.", seg("data-who", TD().members.map(m => [m.id, m.name]), S.who))}
    </section>
    ${CL() ? "" : `<p class="set-note">${EM().icon("info")}Dans la maquette, n'importe qui peut choisir son nom ici. Sur le site en ligne, chacun se connecte avec son compte.</p>`}`;
  }
  function secEspace(S) {
    return `<section class="set-group">${row("Espace affiché", "L'espace d'un installateur client, ou celui de l'agence.", seg("data-space", [["client", "Client"], ["team", "Agence"]], S.space))}</section>
      <p class="set-note">${EM().icon("info")}Réglage de maquette. Dans la vraie app, un client ne voit que son espace, jamais celui de l'agence.</p>`;
  }
  function secNotifs(S) {
    const n = TM().unreadCount(S);
    return `<section class="set-group">${linkRow("#notifications", "Ce qui vous prévient", "Choisir les événements, et comment : dans l'app, par e-mail, par SMS.")}
      ${row("Non lues", n ? `${n} notification${n > 1 ? "s" : ""} à lire` : "Tout est lu", `<a class="btn btn-ghost" href="#notifications">${EM().icon("bell")}Voir</a>`)}</section>`;
  }
  function secApparence() {
    const f = font();
    return `<section class="set-group">${row("Police", f === "outfit" ? "Outfit, la police de la charte Entremis." : "Inter Tight, nette et serrée, comme la référence AgentOps.", seg("data-set-font", [["inter", "Inter Tight"], ["outfit", "Outfit"]], f))}
      <div class="set-sample" aria-hidden="true"><b class="tabnum">14 700 €</b><span>Potentiel par mois</span></div></section>
      <p class="set-note">${EM().icon("info")}Gardé dans ce navigateur. Le logo reste en Outfit.</p>`;
  }
  function secConnexions(S) {
    const esc = EM().esc, me = TM().member(S.who), m = mine(S.who);
    const card = c => { const [l, k] = state(c, m), note = m.cx[c.id] && m.cx[c.id].note;
      return `<li><button type="button" class="cx" data-cx-open="${c.id}">
        <span class="cx-mark">${c.brand ? EM().brand(c.brand, c.name) : esc(c.mark)}</span>
        <span class="cx-main"><b>${esc(c.name)}</b><small>${esc(note || c.what)}</small></span>
        <span class="state state-${k}">${l}</span></button></li>`; };
    return `<p class="set-private">${EM().icon("shield")}<span><b>Visible seulement par ${esc(me.name)}.</b> ${TD().members.filter(x => x.id !== S.who).map(x => x.name).join(" et ")} ont les leurs et ne voient pas les tiennes.</span></p>
      ${GROUPS.map(([g, title]) => `<section class="set-group"><p class="set-title">${title}</p><ul class="cx-list">${CONNECT.filter(c => c.group === g).map(card).join("")}</ul></section>`).join("")}
      <section class="set-group"><p class="set-title">Mes automatisations</p>
        ${AUTO.map(a => { const ok = ready(a, m), on = !!m.auto[a.id] && ok;
          return `<label class="set-row set-toggle${ok ? "" : " is-off"}"><div><b>${esc(a.text)}</b>${ok ? "" : `<span>Branche d'abord : ${a.needs.map(id => CONNECT.find(c => c.id === id).name).join(", ")}</span>`}</div>
            <span class="switch"><input type="checkbox" data-auto="${a.id}" ${on ? "checked" : ""} ${ok ? "" : "disabled"}><span class="track" aria-hidden="true"></span></span></label>`; }).join("")}
      </section>
      <p class="set-note">${EM().icon("info")}${CL() ? "Rangé sur ton compte : personne d'autre ne le voit. Aucune clé n'est demandée ici : le branchement de chaque outil se fera côté serveur." : "Maquette : rien n'est encore branché, aucune clé n'est demandée ni gardée. Sur le site en ligne, tout est rangé sur ton compte."}</p>`;
  }
  function secDonnees(S) {
    return `<section class="set-group">
      ${row("Données de l'équipe", "Leads, tâches, devis, discussions : partagés entre Marc, Richard et Gianni.", `<span class="state state-ok">Partagées</span>`)}
      ${row("Ce qui reste dans ce navigateur", "Tes connexions, la police, ce que tu as déjà lu.", `<span class="state state-neutral">Ici seulement</span>`)}
      ${row("Fichiers déposés", "Rangés avec l'app, visibles par l'équipe.", "")}
      ${row("Comptes séparés", "Un compte et un mot de passe chacun, à l'étape Supabase.", `<span class="state state-neutral">Étape suivante</span>`)}
    </section>
    <p class="set-note">${EM().icon("info")}${S.space === "team" ? "Dans la maquette, le lien de l'app ouvre aussi l'espace agence. Avant de donner des comptes aux clients, il faudra des accès séparés." : "Vos demandes et vos rendez-vous ne sont jamais revendus ni partagés."}</p>`;
  }
  function secAide(S) {
    const team = S.space === "team";
    return `<section class="set-group">${linkRow(team ? "#guide" : "#aide", team ? "Guide de l'app" : "Comment ça marche", "Ce que fait chaque page, en cinq minutes de lecture.")}
      ${team ? linkRow("#secteurs", "Secteurs et parcours", "Ajouter un métier, choisir comment on livre.") : linkRow("#messages", "Poser une question à Entremis", "Richard vous répond dans la journée.")}
      ${row("Version", "Maquette du 20 novembre 2026", "")}</section>`;
  }
  const SECTION = { profil: secProfil, espace: secEspace, notifs: secNotifs, apparence: secApparence, connexions: secConnexions, donnees: secDonnees, aide: secAide };

  function cxSheet(S) {
    const c = X.cx && CONNECT.find(x => x.id === X.cx); if (!c) return "";
    const esc = EM().esc, m = mine(S.who), cur = m.cx[c.id] || {}, me = TM().member(S.who).name;
    return `<div class="scrim" data-cx-close></div>
    <form class="sheet" id="cx-form" aria-label="${esc(c.name)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-cx-close>Annuler</button><b>${esc(c.name)}</b><button class="link strong" type="submit">${c.live || c.later ? "OK" : "Enregistrer"}</button></div>
      <div class="cx-top"><span class="cx-mark">${c.brand ? EM().brand(c.brand, c.name) : esc(c.mark)}</span><p class="body">${esc(c.what)}</p></div>
      <ul class="cx-can">${c.can.map(x => `<li>${EM().icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>
      ${c.live ? `<p class="set-note">${EM().icon("info")}Branché dans la version en ligne de l'app, sur ton propre compte Google. Rien à faire ici.</p>`
        : c.later ? `<p class="set-note">${EM().icon("info")}Prévu pour l'étape où l'app aura sa vraie base. Coche pour qu'on le prépare.</p><label class="check-line"><input type="checkbox" name="on" ${cur.on ? "checked" : ""}><span>Je le veux pour mon compte</span></label>`
        : `<label class="check-line"><input type="checkbox" name="on" ${cur.on ? "checked" : ""}><span>Je veux le brancher sur mon compte (${esc(me)})</span></label>
          ${c.field ? `<label class="field"><span>${esc(c.field)}</span><input name="note" maxlength="120" autocomplete="off" value="${esc(cur.note || "")}" placeholder="${esc(c.ph || "")}"></label>` : ""}
          <p class="field-help">Ne colle jamais de clé ni de mot de passe ici. Le vrai branchement se fera de façon sécurisée, à l'étape Supabase.</p>`}
    </form>`;
  }

  function view(S) {
    const esc = EM().esc, icon = EM().icon, secs = SECS(S.space), narrow = EM().isNarrow();
    if (!secs.some(s => s[0] === X.sec)) X.sec = narrow ? null : "profil";
    const nav = `<nav class="set-nav" aria-label="Rubriques des réglages"><ul>${secs.map(([k, i, l]) => `<li><button type="button" data-set-sec="${k}" ${X.sec === k ? 'aria-current="page"' : ""}><span class="set-ico">${icon(i)}</span><span>${l}</span>${icon("chev")}</button></li>`).join("")}</ul></nav>`;
    const cur = secs.find(s => s[0] === X.sec);
    const main = cur ? `<div class="set-main">${narrow ? `<button class="m-back set-back" type="button" data-set-back>${icon("back")}Réglages</button>` : ""}<h2 class="h2 set-h">${cur[2]}</h2>${SECTION[cur[0]](S)}</div>` : "";
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Réglages</h1><p class="sub">${S.space === "team" ? "Ton profil, ton espace et tes connexions." : "Votre profil et votre espace."}</p></div></div>
    <div class="set${cur ? " has-main" : ""}">${narrow ? (cur ? main : nav) : nav + main}</div>
    ${cxSheet(S)}`;
  }

  function onClick(e, S, render) {
    if (e.target.closest("[data-cloud-out]")) { window.ENTREMIS_CLOUD.signOut(); return true; }
    const t = e.target.closest("[data-set-sec],[data-set-back],[data-set-font],[data-cx-open],[data-cx-close]"); if (!t) return false;
    const d = t.dataset;
    if (d.setSec) { X.sec = d.setSec; TM().haptic("tap"); render(); window.scrollTo(0, 0); const ap = document.querySelector(".app"); if (ap) ap.scrollTop = 0; return true; }
    if ("setBack" in d) { X.sec = null; render(); return true; }
    if (d.setFont) { try { localStorage.setItem(FONT_KEY, d.setFont); } catch (_) {} applyFont(d.setFont); render(); return true; }
    if (d.cxOpen) { X.cx = d.cxOpen; render(); return true; }
    if ("cxClose" in d) { X.cx = null; render(); return true; }
    return false;
  }
  function onChange(e, S, render) {
    const a = e.target.closest && e.target.closest("[data-auto]"); if (!a) return false;
    const m = mine(S.who); m.auto[a.dataset.auto] = a.checked; saveMine(S.who, m); TM().haptic("tap");
    EM().toast(a.checked ? "Automatisation notée pour ton compte. Elle tournera à l'étape Supabase." : "Automatisation retirée.");
    return true;
  }
  function onSubmit(e, S, render) {
    if (e.target.id !== "cx-form") return false;
    e.preventDefault();
    const c = CONNECT.find(x => x.id === X.cx); if (!c) return true;
    if (!c.live) {
      const fd = new FormData(e.target), m = mine(S.who);
      m.cx[c.id] = { on: !!fd.get("on"), note: String(fd.get("note") || "").trim().slice(0, 120) };
      saveMine(S.who, m);
      EM().toast(m.cx[c.id].on ? `${c.name} : prévu sur ton compte.` : `${c.name} : retiré de ton compte.`);
    }
    X.cx = null; TM().haptic("done"); render();
    return true;
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && X.cx && !document.querySelector(".confirm,.dp-pop")) { X.cx = null; EM().render(); } });

  window.ENTREMIS_SETTINGS = { view, onClick, onChange, onSubmit, reset: () => { X.cx = null; X.sec = null; } };   // en arrivant sur la page : la liste des rubriques (téléphone), Profil (ordinateur)
})();
