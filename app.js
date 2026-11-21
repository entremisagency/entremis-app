/* Entremis — webapp (maquette). Espace client : #accueil – #agenda – #rdv-<id> – #comptes – #messages – #message-<id>
   Espace équipe (team.js) : #equipe – #taches – #clients – #avancement. Partagés : #notifications – #reglages */
(function () {
  "use strict";
  const D = window.ENTREMIS_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const params = new URLSearchParams(location.search);
  

  /* ---------- Réglages (campagne, aperçu) ---------- */
  const store = {
    get(k, d) { try { return localStorage.getItem("entremis-app-" + k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("entremis-app-" + k, v); } catch (e) {} }
  };
  const S = {
    mode: "light",           // Décision de Marc (19 nov. 2026) : l'app reste en clair, pas de thème sombre
    camp: params.get("camp") || store.get("camp", "b2b"),
    space: params.get("space") || store.get("space", "team"),   // "client" | "team"
    who: params.get("who") || store.get("who", "marc"),         // portail : marc | richard | gianni
    viewAs: params.get("as") || store.get("as", "solaria"),     // le client dont l'équipe regarde l'espace
    lock: false,                                                  // compte client connecté : enfermé dans son espace, jamais l'agence
    read: {}, taskForm: false, boardWho: null, journalWho: "all",
    preview: params.get("preview") || store.get("preview", "desktop"),
    week: 1,              // index dans D.weeks (1 = semaine en cours)
    filter: "all",
    mDay: D.today.iso,    // jour choisi dans l'agenda mobile
    step: "all",          // filtre du tableau des comptes
    absenceOpen: false,
    reported: {}          // id -> { reason, note, at }
  };
  if (!D.campaigns[S.camp]) S.camp = "b2b";   // l'ancienne offre « Candidats » a été retirée
  const baseC = () => D.campaigns[S.camp];   // la campagne d'exemple complète (Solaria Habitat)

  /* ---------- Le client affiché dans l'espace client ----------
     Un compte client voit le sien, toujours. L'équipe (Marc, Richard, Gianni) choisit le client dont elle regarde l'espace.
     Solaria Habitat a la campagne d'exemple complète ; les autres clients ont une campagne tirée de leurs rendez-vous
     et de leurs leads d'exemple (page Rendez-vous de l'agence, page Leads). */
  const allClients = () => D.team.clients.concat((window.ENTREMIS_ACCESS ? window.ENTREMIS_ACCESS.extra() : [])
    .filter(x => !D.team.clients.some(c => c.id === x.id)).map(x => Object.assign({ trade: "", done: 0, target: 0, day: 0, days: 21, absences: 0, owner: "marc" }, x)));
  const viewId = () => S.lock ? (S.viewAs || "") : (S.viewAs || "solaria");
  const viewClient = () => allClients().find(x => x.id === viewId()) || { id: viewId(), name: "Votre entreprise", trade: "", done: 0, target: 0, day: 0, days: 21, absences: 0 };
  function viewUser() {
    const c = viewClient();
    if (c.camp && c.name === D.user.company) return D.user;
    const name = c.contact || c.name, w = name.split(/\s+/);
    return { name, first: c.contact ? w[0] : c.name, initials: (w[0].charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase(), role: c.contactRole || "Gérant", company: c.name };
  }
  const CAMP = {};
  const MONTHS_S = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const LEAD_STEP = { nouveau: "targeted", rappele: "contacted", qualifie: "replied", attribue: "replied", rdv: "meeting" };
  function campOf(id) {
    const b = baseC(), cl = allClients().find(x => x.id === id);
    const cloud = window.ENTREMIS_CLOUD.on();
    if (!cloud && cl && cl.camp && D.campaigns[cl.camp]) return D.campaigns[cl.camp];
    const c0 = cl || viewClient();
    const rdv = (!cloud && window.ENTREMIS_GROWTH ? window.ENTREMIS_GROWTH.otherRdv(id) : []).concat(window.ENTREMIS_LIVE ? window.ENTREMIS_LIVE.rdvFor(id).filter(r => r.state !== "cancel").map(window.ENTREMIS_LIVE.asAppt) : []);
    const leads = window.ENTREMIS_LEADS ? window.ENTREMIS_LEADS.list().filter(l => l.to === id && l.status !== "perdu") : [];
    const key = rdv.map(a => [a.id, a.state, a.date, a.start, a.name, a.replacedBy].join("~")).join(",") + "|" + leads.map(l => l.id + l.status).join(",");
    if (CAMP[id] && CAMP[id].key === key) return CAMP[id].c;   // même objet tant que rien ne change
    const ini = n => n.split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase();
    const day = iso => { const d = new Date(String(iso || "").slice(0, 10) + "T12:00:00Z"); return isNaN(d) ? "" : d.getUTCDate() + " " + MONTHS_S[d.getUTCMonth()]; };
    const appointments = rdv.map(a => ({ id: a.id, date: a.date, start: a.start, end: a.end, name: a.name, initials: ini(a.name), role: a.role, org: a.org || (a.address ? a.address : "Maison individuelle"), city: a.city, mode: "Visite technique", state: a.state, reply: a.reply,
      replacedBy: a.replacedBy, note: a.note, phone: a.phone, address: a.address,
      absence: a.state === "replaced" ? (a.absence || { reported: day(a.absentAt || a.date) + " à " + a.end, reason: a.reply === "rien" ? "Absent, sans répondre au rappel" : "Absent" }) : undefined,
      criteria: { besoin: a.role, budget: "À préciser au rendez-vous", decideur: "Propriétaire, à confirmer", delai: "À préciser" }, signals: a.note ? [a.note] : [] }));
    const accounts = leads.map(l => ({ org: l.name, sector: l.trade, city: l.city, size: l.zone || "", signal: l.source ? "Demande via " + l.source : "", step: LEAD_STEP[l.status] || "targeted", last: day(l.givenAt || l.at) }));
    const past = appointments.filter(a => a.date < D.today.iso && a.state !== "new"), ok = past.filter(a => a.state === "ok").length, abs = c0.absences || 0;
    const c = Object.assign({}, b, {
      name: c0.trade || b.name,
      goal: Object.assign({}, b.goal, { done: c0.done, target: c0.target, day: c0.day, days: c0.days }),
      kpis: [
        { label: "Demandes reçues", value: String(accounts.length), note: "depuis le début", ticks: [] },
        { label: "Qualifiées", value: String(accounts.filter(a => a.step === "replied" || a.step === "meeting").length), note: "prêtes pour une visite", ticks: [] },
        { label: "Délai de rappel", value: "—", note: "mesuré au premier appel", ticks: [] },
        { label: "Présence aux rendez-vous", value: `${ok} / ${past.length}`, note: abs ? `${abs} absence${abs > 1 ? "s" : ""}, remplacée${abs > 1 ? "s" : ""}` : "aucune absence", ticks: [] }
      ],
      appointments, accounts, messages: [], absences: appointments.filter(a => a.state === "replaced").length
    });
    CAMP[id] = { key, c };
    return c;
  }
  const C = () => S.space === "client" ? campOf(viewId()) : baseC();
  // L'équipe passe sur l'espace d'un client (bandeau, réglages, fiche du client). Jamais pour un compte client.
  function pickClient(id) {
    if (S.lock || !allClients().some(x => x.id === id)) return;
    S.viewAs = id; store.set("as", id); S.space = "client"; store.set("space", "client");
    S.step = "all"; S.filter = "all"; S.acc = null; S.mDay = D.today.iso;
    if (!/^#(accueil|agenda|comptes|resultats|facturation|dispos|parrainage|scripts|aide|menu|notifications|reglages)$/.test(location.hash)) location.hash = "#accueil";
    render(); toast(`Vue client : ${viewClient().name}.`);
  }

  function applyTheme() {
    document.documentElement.dataset.mode = S.mode;
    document.documentElement.classList.toggle("clean", params.has("clean"));
    document.documentElement.classList.toggle("phone", S.preview === "phone");
  }

  /* ---------- Petits outils ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  /* Coordonnées : un clic ouvre l'appli liée (téléphone, mail, plan), un bouton copie.
     Dans une page claude.ai, l'ouverture du téléphone ou du mail peut ne pas marcher pour tout le monde : le bouton Copier reste toujours là. */
  const STREETS = ["rue des Lilas", "avenue Jean-Jaurès", "chemin des Vignes", "rue Victor-Hugo", "allée des Tilleuls", "rue du Stade", "impasse des Rosiers", "boulevard Pasteur", "rue de la Gare"];
  function coords(p, i) {
    const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
    return { phone: `06 ${String(12 + i * 7).padStart(2, "0")} ${String(30 + i * 3).padStart(2, "0")} ${String(40 + i).padStart(2, "0")} ${String(10 + i * 9 % 90).padStart(2, "0")}`,
             email: `${slug(p.name)}@exemple.fr`, address: `${8 + i * 5} ${STREETS[i % STREETS.length]}, ${p.city}` };
  }
  function cline(kind, value, label) {
    const href = kind === "phone" ? "tel:" + value.replace(/\s/g, "") : kind === "email" ? "mailto:" + value : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(value);
    const ico = { phone: "phone", email: "chat", address: "pin" }[kind];
    return `<div class="cline"><span class="cline-label">${icon(ico)}${label}</span>
      <a class="cline-value" href="${esc(href)}" ${kind === "address" ? 'target="_blank" rel="noopener"' : ""}>${esc(value)}</a>
      <button class="icon-btn cline-copy" type="button" data-copy="${esc(value)}" aria-label="Copier : ${esc(value)}" title="Copier">${icon("copy")}</button></div>`;
  }
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      // Repli : on sélectionne le texte pour un copier manuel
      const r = document.createRange(), v = btn && btn.parentElement.querySelector(".cline-value");
      if (v) { r.selectNodeContents(v); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast("Copie bloquée par le navigateur : le texte est sélectionné, copiez-le."); return;
    }
    if (btn) { btn.classList.add("is-copied"); setTimeout(() => btn.classList.remove("is-copied"), 1400); }
    TM().haptic("tap"); toast("Copié : " + text);
  }
  /* Confirmation avant de supprimer (évite les clics par erreur). Renvoie une promesse : true si l'on confirme. */
  function askConfirm({ title, text, ok = "Supprimer" }) {
    return new Promise(resolve => {
      const old = document.getElementById("confirm"); if (old) old.remove();
      const wrap = document.createElement("div");
      wrap.id = "confirm"; wrap.className = "confirm-wrap";
      wrap.innerHTML = `<div class="scrim" data-confirm="no"></div>
        <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-t">
          <span class="confirm-ico">${icon("trash")}</span>
          <p class="confirm-t" id="confirm-t">${esc(title)}</p>
          ${text ? `<p class="confirm-x">${esc(text)}</p>` : ""}
          <div class="confirm-acts"><button class="btn btn-ghost" type="button" data-confirm="no">Annuler</button><button class="btn btn-danger" type="button" data-confirm="yes">${esc(ok)}</button></div>
        </div>`;
      const done = v => { document.removeEventListener("keydown", onKey, true); wrap.remove(); resolve(v); };
      const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
      wrap.addEventListener("click", e => { const b = e.target.closest("[data-confirm]"); if (b) { e.stopPropagation(); if (b.dataset.confirm === "yes") TM().haptic("warn"); done(b.dataset.confirm === "yes"); } });
      document.addEventListener("keydown", onKey, true);
      root.appendChild(wrap);
      TM().haptic("warn");
      setTimeout(() => { const y = wrap.querySelector('[data-confirm="no"].btn'); if (y) y.focus(); }, 30);
    });
  }
  // Logo officiel d'une marque (Google, Meta, Facebook, LinkedIn, Google Ads, Google Agenda)
  const brand = (id, label) => `<svg class="brand" role="img" aria-label="${label || id}"><use href="#b-${id}"/></svg>`;
  const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const DAYS_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const d = iso => new Date(iso + "T12:00:00Z");
  const addDays = (iso, n) => { const x = d(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dayShort = iso => DAYS[d(iso).getUTCDay()];
  const dayNum = iso => d(iso).getUTCDate();
  const dateLabel = iso => `${DAYS_LONG[d(iso).getUTCDay()]} ${dayNum(iso)} ${MONTHS[d(iso).getUTCMonth()]}`;
  const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const isPast = a => a.date < D.today.iso || (a.date === D.today.iso && mins(a.end) <= D.today.nowMinutes);
  const byId = id => C().appointments.find(a => a.id === id);

  const STATE = {
    ok: "Qualifié", new: "Nouveau", replacement: "Remplacement", replaced: "Absent, remplacé", reported: "Absence signalée"
  };
  const stateOf = a => S.reported[a.id] ? "reported" : a.state;
  const pill = a => `<span class="state state-${stateOf(a)}">${STATE[stateOf(a)]}</span>`;
  const STEP_ORDER = { targeted: 1, contacted: 2, replied: 3, meeting: 4 };
  const STEPS = new Proxy({}, { get: (_, k) => [C().steps[k], STEP_ORDER[k]], ownKeys: () => Object.keys(STEP_ORDER), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const MSG = { sent: "Envoyé", replied: "A répondu", followup: "Relance" };

  let toastTimer, toastUndo = null;
  // Message en bas d'écran, avec « Annuler » quand une action peut être défaite
  function toast(text, undo) {
    const t = $("#toast");
    toastUndo = undo || null;
    t.innerHTML = icon(undo ? "check" : "info") + `<span>${esc(text)}</span>` + (undo ? `<button type="button" data-act="toast-undo">Annuler</button>` : "");
    t.classList.toggle("has-undo", !!undo);
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("on"); toastUndo = null; }, undo ? 5000 : 3200);
  }
  const NOT_WIRED = "Maquette : cette action n'est pas encore branchée.";

  // Le parcours de l'installateur connecté (espace client) : d'après son métier, ou ce que l'agence a choisi sur sa fiche
  function clientParcours() {
    return window.ENTREMIS_SECTORS.forClient(viewId()).parcours;
  }
  /* ---------- Cadre : barre latérale, haut, onglets ---------- */
  const TM = () => window.ENTREMIS_TEAM;
  function renderChrome(route) {
    const c = C(), team = S.space === "team", U = viewUser();
    const TD_ = () => window.ENTREMIS_DATA.team;
    const section = route.name === "script" ? "scripts" : route.name === "rdv" ? "agenda" : route.name === "fiche" ? (TD_().clients.some(x => x.id === route.id) ? "clients" : "pipeline") : route.name;
    const tabSection = !team && ["facturation", "messages", "scripts", "dispos", "parrainage", "notifications", "aide", "reglages", "menu"].includes(section) ? "menu" : team && ["appels", "marketing", "avancement", "notifications", "reglages", "chiffres", "scripts-equipe", "pipeline", "finances", "guide", "processus", "discussions", "secteurs", "acces", "appel", "rendez-vous", "zones", "sante", "propositions", "etudes", "marge", "conformite"].includes(section) ? "plus" : section === "fiche" ? "clients" : section;
    document.documentElement.dataset.zone = S.space;   // pas « data-space » : ce nom sert aux boutons, et <html> les attraperait tous
    const campBox = $("#space").closest(".camp"); if (campBox) campBox.hidden = S.lock;
    $("#space").innerHTML = S.lock ? "" : [["client", "Client"], ["team", "Agence"]].map(([v, l]) =>
      `<button type="button" data-space="${v}" aria-pressed="${S.space === v}">${l}</button>`).join("");
    const bar = $("#as-bar");
    if (bar) { bar.hidden = team || S.lock; bar.innerHTML = team || S.lock ? "" : asBar(); }
    const replies = c.messages.filter(m => m.status === "replied").length;
    const openTasks = TM().T.list.filter(t => t.status !== "done" && t.who === S.who).length;
    const unread = TM().unreadCount(S);
    const items = team ? [
      "Mon espace", ["equipe", "home", "Mon portail"], ["taches", "check", "Tâches", openTasks], ["discussions", "chat", "Discussions", window.ENTREMIS_CHAT.unreadAll(S.who)], ["processus", "grid", "Processus"], ["notifications", "bell", "Notifications", unread], ["guide", "info", "Guide de l'app"],
      "Production", ["appel", "phone", "Poste d'appel"], ["leads", "inbox", "Leads", window.ENTREMIS_LEADS.list().filter(l => !l.to && l.status !== "perdu").length], ["rendez-vous", "cal", "Rendez-vous"], ["zones", "pin", "Zones"],
      "Clients", ["clients", "building", "Clients"], ["sante", "gauge", "Santé et suivi", window.ENTREMIS_GROWTH.riskCount()], ["scripts-equipe", "book", "Scripts"], ["secteurs", "tool", "Secteurs"], ["acces", "lock", "Accès clients"],
      "Trouver des clients", ["pipeline", "users", "Prospection"], ["propositions", "euro", "Propositions"], ["etudes", "check", "Études de cas"], ["appels", "phone", "Appels"], ["marketing", "signal", "Marketing"],
      "Pilotage", ["chiffres", "gauge", "Chiffres"], ["avancement", "chart", "Avancement"], ["finances", "euro", "Finances"], ["marge", "chart", "Marge"], ["conformite", "shield", "Conformité"]
    ] : [
      ["accueil", "home", "Accueil"], ["agenda", "cal", "Agenda"], ["resultats", "chart", "Résultats"], ["facturation", "euro", "Leads et facture"], ["comptes", "inbox", c.words.accounts], ["messages", "chat", "Messages", replies], ["scripts", "book", "Scripts"], ["dispos", "clock", "Disponibilités"], ["parrainage", "users", "Parrainer"], ["notifications", "bell", "Notifications", unread], ["aide", "info", "Comment ça marche"]
    ];
    // Groupes du menu, repliables (on se souvient de ce qui est replié). Celui de la page ouverte reste ouvert.
    const link = ([r, i, l, n]) => `<a href="#${r}" ${section === r ? 'aria-current="page"' : ""}>${icon(i)}<span>${esc(l)}</span>${n ? `<span class="count">${n}</span>` : ""}</a>`;
    const groups = []; items.forEach(it => typeof it === "string" ? groups.push({ t: it, l: [] }) : (groups.length ? groups[groups.length - 1] : (groups.push({ t: team ? "" : c.name, l: [] }), groups[0])).l.push(it));
    const folded = (() => { try { return JSON.parse(store.get("fold", "[]")); } catch (_) { return []; } })();
    $("#menu").innerHTML = groups.map(g => { const shut = folded.includes(g.t) && !g.l.some(x => x[0] === section);
      return `<div class="menu-group${shut ? " is-shut" : ""}">${g.t ? `<button class="menu-title" type="button" data-menu-fold="${esc(g.t)}" aria-expanded="${!shut}"><span>${esc(g.t)}</span>${icon("chev")}</button>` : ""}<div class="menu-items">${g.l.map(link).join("")}</div></div>`; }).join("");
    const tabs = team
      ? [["equipe", "home", "Portail"], ["taches", "check", "Tâches", openTasks], ["leads", "inbox", "Leads", window.ENTREMIS_LEADS.list().filter(l => !l.to && l.status !== "perdu").length], ["clients", "building", "Clients"], ["plus", "grid", "Plus"]]
      : [["accueil", "home", "Accueil"], ["agenda", "cal", "Agenda"], ["comptes", "inbox", c.words.tab], ["resultats", "chart", "Résultats"], ["menu", "grid", "Plus", replies]];
    $("#tabbar").innerHTML = tabs.map(([r, i, l, n]) => `<a href="#${r}" ${(team ? tabSection : section) === r ? 'aria-current="page"' : ""}>${icon(i)}<span>${l}</span>${n ? `<i class="count">${n}</i>` : ""}</a>`).join("");

    const me = TM().member(S.who);
    $("#account").innerHTML = team
      ? `${TM().avatar(me.id)}<div><b>${me.name}</b><span>Mon portail – changer</span></div>`
      : `<span class="av av-md">${esc(U.initials)}</span><div><b>${esc(U.name)}</b><span>${esc(U.company)}${S.lock || window.ENTREMIS_CLOUD.on() ? "" : " – exemple"}</span></div>`;
    const so = $("#side-out"); if (so) so.innerHTML = window.ENTREMIS_CLOUD.on() ? `<button class="side-out" type="button" data-cloud-out>${icon("logout")}<span>Se déconnecter</span></button>` : "";
    $("#m-avatar").outerHTML = team ? `<a class="m-avatar-link" id="m-avatar" href="#reglages" aria-label="Réglages">${TM().avatar(me.id, "av")}</a>` : `<a class="m-avatar-link" id="m-avatar" href="#reglages" aria-label="Réglages"><span class="av">${esc(U.initials)}</span></a>`;
    document.querySelectorAll(".bell .dot").forEach(d => { d.hidden = !unread; });
    const pt = document.getElementById("promise-text"); if (pt && !team) pt.textContent = clientParcours().guarantee;

    const names = { accueil: "Accueil", agenda: "Agenda", comptes: c.words.accounts, messages: "Messages", equipe: "Mon portail", taches: "Tâches", clients: "Clients", pipeline: "Prospection", avancement: "Avancement", finances: "Finances", appels: "Appels", marketing: "Marketing", plus: "Plus", chiffres: "Chiffres", leads: "Leads", generer: "Nouveau document", guide: "Guide", processus: "Processus", discussions: "Discussions", secteurs: "Secteurs", acces: "Accès clients", appel: "Poste d'appel", "rendez-vous": "Rendez-vous", zones: "Zones", sante: "Santé et suivi", propositions: "Propositions", etudes: "Études de cas", marge: "Marge", conformite: "Conformité", aide: "Comment ça marche", resultats: "Résultats", facturation: "Leads et facture", dispos: "Disponibilités", parrainage: "Parrainage", menu: "Plus", scripts: "Scripts", "scripts-equipe": "Scripts", notifications: "Notifications", reglages: "Réglages" };
    const fe = route.name === "fiche" ? (TD_().clients.find(x => x.id === route.id) || TD_().pipeline.find(x => x.id === route.id)) : null;
    const crumbs = route.name === "script" ? ["Scripts", (window.ENTREMIS_SCRIPTS && document.title) ? "Script" : "Script"] : route.name === "rdv" ? ["Agenda", route.appt ? route.appt.name : ""] : route.name === "fiche" ? [fe && fe.camp !== undefined || (fe && TD_().clients.includes(fe)) ? "Clients" : "Prospection", fe ? fe.name : "Fiche"] : route.name === "generer" ? ["Finances", "Nouveau document"] : [names[route.name]];
    $("#crumbs").innerHTML = `<span>${team ? "Espace agence" : esc(U.company) + " – " + esc(c.name)}</span>` + crumbs.map((x, i) =>
      icon("chev") + (i === crumbs.length - 1 ? `<b>${esc(x)}</b>` : `<a href="#${{ Agenda: "agenda", Clients: "clients", Prospection: "pipeline", Scripts: "scripts", Finances: "finances" }[x] || "agenda"}">${esc(x)}</a>`)).join("");

    // En-tête mobile : retour sur la fiche et les écrans secondaires, logo ailleurs
    const back = route.name === "script" ? ["#scripts", "Scripts"] : route.name === "rdv" ? ["#agenda", "Agenda"] : route.name === "fiche" ? (section === "clients" ? ["#clients", "Clients"] : ["#pipeline", "Prospection"]) : ["notifications", "reglages"].includes(route.name) ? [team ? "#equipe" : "#accueil", team ? "Portail" : "Accueil"] : null;
    $("#m-left").innerHTML = back
      ? `<a class="m-back" href="${back[0]}">${icon("back")}${back[1]}</a>`
      : `<a class="logo" href="${team ? "#equipe" : "#accueil"}" aria-label="Entremis, accueil"><svg aria-hidden="true"><use href="#logo-e"/></svg><span>ENTREMIS</span></a>`;
  }

  // Le bandeau en haut de l'espace client, pour l'équipe : quel client on regarde, et le retour à l'agence
  function asBar() {
    const cur = viewId();
    return `<p class="as-text">${icon("eye")}<span class="as-long">Vous voyez l'espace de</span><span class="as-short">Vue client</span></p>
      ${fsel("as-pick", "Client", allClients().map(x => [x.id, x.name]), cur)}
      <button class="btn btn-ghost as-back" type="button" data-space="team">${icon("back")}<span class="as-long">Revenir à l'agence</span><span class="as-short">Agence</span></button>`;
  }

  /* ---------- Morceaux réutilisés ---------- */
  function apptRow(a, sameDay) {
    return `<a class="row" href="#rdv-${a.id}">
      <time><b>${a.start}</b>${sameDay ? a.end : dayShort(a.date) + " " + dayNum(a.date)}</time>
      <span class="av av-md">${a.initials}</span>
      <span class="who"><b>${esc(a.name)}</b><span>${esc(a.role)} – ${esc(a.org)}</span></span>
      ${pill(a)}
    </a>`;
  }
  const ticks = arr => { const m = Math.max(...arr, 1); return `<span class="ticks" aria-hidden="true">${arr.map(v => `<i style="--h:${Math.round(v / m * 100)}%"></i>`).join("")}</span>`; };
  const sampleTag = `<span class="sample" title="Données d'exemple pour la maquette">${icon("info")}Exemple</span>`;

  /* ---------- Écran 1 : vue d'ensemble ---------- */
  function viewHome() {
    const c = C(), g = Object.assign({}, c.goal);
    // Un rendez-vous signalé absent sort de l'objectif jusqu'à son remplacement
    g.done -= Object.keys(S.reported).filter(id => byId(id) && byId(id).state === "ok").length;
    const upcoming = c.appointments.filter(a => !isPast(a) && a.state !== "replaced").slice(0, 4);
    let lastDay = "";
    const rows = upcoming.map(a => {
      const sep = a.date !== lastDay ? `<p class="day-sep">${a.date === D.today.iso ? "Aujourd'hui" : dateLabel(a.date)}</p>` : "";
      lastDay = a.date;
      return sep + apptRow(a, true);
    }).join("");
    const pct = Math.round(g.done / g.target * 100);
    const next = upcoming[0];
    const guideOff = store.get("guide-off", "") === "1";
    const kv = re => (c.kpis.find(k => re.test(k.label)) || {}).value || "—";
    const P = clientParcours();   // rendez-vous, transfert direct ou devis, selon le métier du client
    const guideHtml = guideOff ? "" : `<section class="card guide-flow" aria-label="Comment ça marche">
      <div class="card-head"><h2 class="h2">Comment ça marche</h2><span class="gd-links"><a class="link" href="#aide">Le guide</a><button class="link" type="button" data-act="guide-off">J'ai compris</button></span></div>
      ${nodeFlow([
        Object.assign({}, P.steps[0], { rows: [["Rappel", kv(/rappel/)], ["Reçues", kv(/reçues/)]] }),
        Object.assign({}, P.steps[1], { rows: [["Critères", "4"], ["Qualifiées", kv(/Qualifi/)]] }),
        Object.assign({}, P.steps[2], { rows: [[P.doneLabel, `${c.goal.done}/${c.goal.target}`], [P.nextLabel, next ? (next.date === window.ENTREMIS_DATA.today.iso ? "auj. " : next.date.slice(8, 10) + "/" + next.date.slice(5, 7) + " ") + next.start : "–"]] }),
        Object.assign({}, P.steps[3], { rows: [[P.ok, kv(/Présence/).split(" ")[0].split("/")[0], "ok"], [P.bad, String(c.absences != null ? c.absences : 1), "bad"]] })
      ], "Comment ça marche")}
    </section>`;
    const gst = next ? window.ENTREMIS_GCAL.addState("rdv:" + next.id) : null;
    const kLabels = { "Demandes reçues": "Particuliers qui ont demandé une étude", "Qualifiées": "Ont passé les 4 critères", "Délai de rappel": "Temps pour rappeler un particulier", "Présence aux rendez-vous": P.presenceHelp };
    return `
    <div class="head">
      <div class="head-text">
        <h1 class="h1">Bonjour ${esc(viewUser().first)}</h1>
        <p class="sub">Voici où en est votre campagne « ${esc(c.name)} ».</p>
      </div>
      <div class="head-actions">${sampleTag}</div>
    </div>

    ${isNarrow() ? "" : guideHtml}
    ${window.ENTREMIS_CPLUS.homeCard()}

    <div class="home-top home-top-next">
      ${next ? `<section class="card next" aria-label="${esc(P.next)}">
        <div class="card-head"><h2 class="h2">${isNarrow() ? esc(P.nextShort) : esc(P.next)}</h2>${pill(next)}</div>
        <div class="next-when"><p class="next-time tabnum">${next.start}</p><p><b>${next.date === D.today.iso ? "Aujourd'hui" : dateLabel(next.date)}</b><span>${esc(next.mode)} – jusqu'à ${next.end}</span></p></div>
        <div class="next-who"><span class="av av-lg">${next.initials}</span><div><b>${esc(next.name)}</b><span>${esc(next.role)}</span><span>${esc(next.org)} – ${esc(next.city)}</span></div></div>
        ${next.note ? `<div class="note"><b>${icon("info")}À savoir avant d'y aller</b><span>${esc(next.note)}</span></div>` : ""}
        <div class="form-actions">
          <a class="btn btn-primary" href="#rdv-${next.id}">Voir la fiche ${icon("arrow")}</a>
          <button class="btn btn-ghost" type="button" data-gcal-rdv="${next.id}" ${gst ? "disabled" : ""}>${gst === "done" ? icon("check") : brand("gcal", "Google Agenda")}${gst === "done" ? "Dans votre agenda" : "Ajouter à mon agenda"}</button>
        </div>
      </section>` : `<section class="card next"><h2 class="h2">Pas de rendez-vous prévu</h2><p class="body">Vous serez prévenu dès qu'il arrive.</p></section>`}

      <section class="goal scope-dark scope-blue" aria-label="Objectif de la campagne">
        <div class="goal-top">
          <p class="goal-title">Objectif <span class="soft">de la campagne</span></p>
          <span class="sample">Jour ${g.day} sur ${g.days}</span>
        </div>
        <div class="goal-mid">
          <div><p class="goal-num"><span>${g.done}</span><small>/ ${g.target}</small></p><p class="goal-unit">${esc(P.delivered)}</p></div>
          ${tickRing(pct, pct + " %")}
        </div>
        <div class="track">
          <div class="bar" role="progressbar" aria-valuenow="${g.done}" aria-valuemin="0" aria-valuemax="${g.target}"><i style="--p:${pct}%"></i></div>
          <div class="track-legend"><span>Encore ${g.target - g.done} à livrer</span><span>${g.days - g.day} jours restants</span></div>
        </div>
        <div class="goal-foot">
          <span>${icon("shield")}Garantis ou remplacés</span>
          <a class="link" href="#agenda">Voir l'agenda ${icon("arrow")}</a>
        </div>
      </section>
    </div>

    ${isNarrow() ? guideHtml : ""}
    <div class="kpis kpis-4" role="list">
      ${c.kpis.map(k => `<article class="kpi" role="listitem">
        <p class="kpi-label">${esc(/^Présence/.test(k.label) ? P.presence : k.label)}</p>
        <div class="kpi-row"><div><p class="kpi-value">${esc(k.value)}</p><p class="kpi-note">${esc(k.note)}</p></div>${ticks(k.ticks)}</div>
        ${kLabels[k.label] ? `<p class="kpi-help">${esc(kLabels[k.label])}</p>` : ""}
      </article>`).join("")}
    </div>

    <div class="home-main">
      <section class="card">
        <div class="card-head"><h2 class="h2">Vos prochains ${esc(c.words.people)}</h2><a class="link" href="#agenda">Tout l'agenda ${icon("arrow")}</a></div>
        <div class="list">${rows}</div>
      </section>
      <section class="card contact">
        <div class="card-head"><h2 class="h2">Votre contact Entremis</h2></div>
        <div class="next-who">${window.ENTREMIS_TEAM.avatar("richard", "av av-lg")}<div><b>Richard</b><span>Il place vos rendez-vous et répond à vos questions.</span></div></div>
        <div class="clines">
          ${cline("phone", "06 00 00 00 00", "Téléphone")}
          ${cline("email", "richard@entremis.fr", "E-mail")}
          <p class="kpi-note">Coordonnées d'exemple.</p>
        </div>
        <div class="contact-help">
          <p><b>Un rendez-vous s'est mal passé ?</b><span>On en place un autre, sans frais.</span></p>
          <button class="btn btn-warn" type="button" data-act="absence">${icon("swap")}Signaler une absence</button>
        </div>
      </section>
    </div>`;
  }

  /* ---------- Écran 2 : agenda de la semaine ---------- */
  const H0 = 8, H1 = 18;
  /* Plusieurs vues : Jour – Semaine – Mois – Liste (sur téléphone : Jour – Mois – Liste) */
  const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const mondayOf = iso => { const x = d(iso); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return x.toISOString().slice(0, 10); };
  const addMonths = (ym, n) => { const [y, m] = ym.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1 + n, 1)); return x.toISOString().slice(0, 7); };
  function viewAgenda() {
    const c = C(), narrow = isNarrow();
    if (!S.agView) S.agView = params.get("vue") || "week";   // ?vue=day|week|month|list pour ouvrir une vue précise
    if (!S.agDay) S.agDay = D.today.iso;
    if (!S.agMonth) S.agMonth = D.today.iso.slice(0, 7);
    const view = narrow && S.agView === "week" ? "day" : S.agView;
    const all = c.appointments.slice().sort((x, y) => (x.date + x.start < y.date + y.start ? -1 : 1));
    const filters = [["all", "Tous"], ["ok", "Qualifié"], ["new", "Nouveau"], ["replacement", "Remplacement"]];
    const is = (a, k) => k === "all" || stateOf(a) === k || (k === "replacement" && ["replaced", "reported"].includes(stateOf(a)));
    const match = a => is(a, S.filter);

    // Ce que la vue montre
    const weekStart = view === "week" ? D.weeks[S.week].start : mondayOf(S.agDay);
    const weekDays = [0, 1, 2, 3, 4].map(i => addDays(weekStart, i));
    const scope = view === "week" ? all.filter(x => weekDays.includes(x.date))
      : view === "day" ? all.filter(x => x.date === S.agDay)
      : view === "month" ? all.filter(x => x.date.slice(0, 7) === S.agMonth) : all;
    const count = k => scope.filter(x => is(x, k)).length;
    const [my, mm] = S.agMonth.split("-").map(Number);
    const title = view === "week" ? D.weeks[S.week].label
      : view === "day" ? (S.agDay === D.today.iso ? "Aujourd'hui, " : "") + dateLabel(S.agDay)
      : view === "month" ? `${MONTHS_LONG[mm - 1]} ${my}` : `Tous vos ${c.words.people}`;
    const sub = scope.length ? `${scope.length} ${scope.length > 1 ? c.words.people : c.words.one}${view === "list" ? "" : view === "day" ? " ce jour-là" : view === "week" ? " cette semaine" : " ce mois-ci"}` : `Aucun ${c.words.one} placé${view === "list" ? "" : " sur cette période"}`;

    const nav = view === "week" ? `
        <button class="icon-btn" type="button" data-week="-1" aria-label="Semaine précédente" ${S.week === 0 ? "disabled" : ""}>${icon("back")}</button>
        <button class="btn btn-ghost" type="button" data-week="0">Cette semaine</button>
        <button class="icon-btn" type="button" data-week="1" aria-label="Semaine suivante" ${S.week === D.weeks.length - 1 ? "disabled" : ""}>${icon("chev")}</button>`
      : view === "day" ? `
        <button class="icon-btn" type="button" data-ag-step="-1" aria-label="Jour précédent">${icon("back")}</button>
        <button class="btn btn-ghost" type="button" data-ag-step="0">Aujourd'hui</button>
        <button class="icon-btn" type="button" data-ag-step="1" aria-label="Jour suivant">${icon("chev")}</button>`
      : view === "month" ? `
        <button class="icon-btn" type="button" data-ag-step="-1" aria-label="Mois précédent">${icon("back")}</button>
        <button class="btn btn-ghost" type="button" data-ag-step="0">Ce mois-ci</button>
        <button class="icon-btn" type="button" data-ag-step="1" aria-label="Mois suivant">${icon("chev")}</button>` : "";
    const views = (narrow ? [["day", "Jour"], ["month", "Mois"], ["list", "Liste"]] : [["day", "Jour"], ["week", "Semaine"], ["month", "Mois"], ["list", "Liste"]]);

    const head = `
    <div class="head">
      <div class="head-text">
        <h1 class="h1">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</h1>
        <p class="sub">${sub}</p>
      </div>
      <div class="head-actions">
        ${sampleTag}
        <div class="seg seg-lg ag-views" role="group" aria-label="Vue">${views.map(([k, l]) => `<button type="button" data-ag-view="${k}" aria-pressed="${view === k}">${l}</button>`).join("")}</div>
        ${nav ? `<div class="ag-week">${nav}</div>` : ""}
      </div>
    </div>
    <div class="filters">${fsel("filter", "État", filters.map(([k, l]) => [k, `${l} (${count(k)})`]), S.filter)}</div>
`;

    // Grille horaire (semaine ou jour, ordinateur)
    const hours = [];
    for (let h = H0; h < H1; h++) hours.push(`<span>${String(h).padStart(2, "0")}:00</span>`);
    const wide = view === "day";
    const col = iso => {
      const evs = all.filter(x => x.date === iso).map(x => {
        const top = (mins(x.start) - H0 * 60) / 60, h = (mins(x.end) - mins(x.start)) / 60;
        const tall = h >= 0.75;
        const cls = ["ag-ev", "ev-" + stateOf(x), tall ? "is-tall" : "", wide ? "is-wide" : "", x.state === "replaced" ? "is-replaced" : "", match(x) ? "" : "is-dim"].join(" ");
        return `<a class="${cls}" href="#rdv-${x.id}" style="--top:calc(${top} * var(--hour-h));--h:calc(${h} * var(--hour-h) - var(--space-1))">
          <b>${tall ? "" : `<i class="sd sd-${stateOf(x)}" title="${STATE[stateOf(x)]}"></i>`}${esc(x.name)}</b><span class="t">${x.start} – ${x.end} – ${esc(wide ? x.role + " – " + x.org + " – " + x.city : x.city)}</span>${tall ? `<span class="ag-st"><i aria-hidden="true"></i>${STATE[stateOf(x)]}</span>` : ""}
        </a>`;
      }).join("");
      const past = iso < D.today.iso ? " is-past" : "";
      const nowSeg = iso === D.today.iso ? `<i class="ag-now-day" style="--top:calc(${(D.today.nowMinutes - H0 * 60) / 60} * var(--hour-h))"></i>` : "";
      return `<div class="ag-col${past}" style="grid-row:2;height:calc(${H1 - H0} * var(--hour-h))">${evs}${nowSeg}</div>`;
    };
    const timeGrid = cols => {
      const showNow = cols.includes(D.today.iso), nowTop = (D.today.nowMinutes - H0 * 60) / 60;
      return `<div class="ag-grid" style="grid-template-columns:var(--agenda-time-col) repeat(${cols.length},minmax(0,1fr))">
        <div class="ag-corner"></div>
        ${cols.map(iso => `<div class="ag-dayhead${iso === D.today.iso ? " is-today" : ""}">${dayShort(iso)} <b>${dayNum(iso)}</b></div>`).join("")}
        <div class="ag-times" style="grid-row:2">${hours.join("")}</div>
        ${cols.map(col).join("")}
        ${showNow ? `<div class="ag-now" style="--top:calc(var(--agenda-head-h) + ${nowTop} * var(--hour-h))"><span>${D.today.now}</span></div>` : ""}
        ${scope.length ? "" : `<div class="ag-empty"><b>Pas de ${esc(c.words.one)} sur cette période</b><span>Richard place les prochains créneaux dès qu'un particulier confirme. Vous êtes prévenu à chaque ajout.</span></div>`}
      </div>`;
    };

    // Liste d'un jour, avec la ligne « maintenant » (téléphone, vue Jour)
    const dayList = iso => {
      const evs = all.filter(x => x.date === iso && match(x));
      let placed = iso !== D.today.iso;
      const rows = evs.map(x => { let pre = ""; if (!placed && mins(x.start) >= D.today.nowMinutes) { pre = `<p class="m-now"><span>${D.today.now}</span></p>`; placed = true; } return pre + apptRow(x, true); }).join("") + (!placed ? `<p class="m-now"><span>${D.today.now}</span></p>` : "");
      return `<section class="card" aria-label="${dateLabel(iso)}">
        <div class="card-head"><h2 class="h2">${iso === D.today.iso ? "Aujourd'hui" : dateLabel(iso)}</h2><span class="muted tabnum">${evs.length} ${evs.length > 1 ? c.words.people : c.words.one}</span></div>
        <div class="list">${evs.length ? rows : `<p class="body">Rien de prévu ce jour-là.</p>`}</div>
      </section>`;
    };
    const dayStrip = () => `<div class="days" role="group" aria-label="Jour">
      ${weekDays.map(iso => `<button type="button" data-ag-day="${iso}" aria-pressed="${S.agDay === iso}">${dayShort(iso)}<b>${dayNum(iso)}</b><i class="${all.some(x => x.date === iso) ? "" : "none"}"></i></button>`).join("")}
    </div>`;

    // Mois : une case par jour, du lundi au dimanche
    const monthGrid = () => {
      const first = S.agMonth + "-01", start = mondayOf(first);
      const cells = []; for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
      while (cells.length > 35 && cells[cells.length - 7].slice(0, 7) !== S.agMonth) cells.splice(-7);
      const names = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
      return `<div class="month${narrow ? " is-compact" : ""}" role="grid" aria-label="${MONTHS_LONG[mm - 1]} ${my}">
        ${names.map(n => `<div class="m-dow" role="columnheader">${n}</div>`).join("")}
        ${cells.map(iso => {
          const evs = all.filter(x => x.date === iso), out = iso.slice(0, 7) !== S.agMonth;
          const cls = ["m-cell", out ? "is-out" : "", iso === D.today.iso ? "is-today" : "", iso < D.today.iso ? "is-past" : "", narrow && S.agDay === iso ? "is-sel" : ""].join(" ");
          return `<div class="${cls}" role="gridcell">
            <button class="m-num tabnum" type="button" data-ag-day="${iso}" data-ag-open="${narrow ? "" : "day"}" aria-label="${dateLabel(iso)}, ${evs.length} ${evs.length > 1 ? c.words.people : c.words.one}">${dayNum(iso)}</button>
            ${narrow ? `<span class="m-dots">${evs.slice(0, 3).map(x => `<i class="sd sd-${stateOf(x)}"></i>`).join("")}</span>`
              : evs.slice(0, 3).map(x => `<a class="m-chip${match(x) ? "" : " is-dim"}${x.state === "replaced" ? " is-replaced" : ""}" href="#rdv-${x.id}"><i class="sd sd-${stateOf(x)}"></i><span class="tabnum">${x.start}</span>${esc(x.name)}</a>`).join("") + (evs.length > 3 ? `<button class="m-more" type="button" data-ag-day="${iso}" data-ag-open="day">+${evs.length - 3} autres</button>` : "")}
          </div>`;
        }).join("")}
      </div>`;
    };

    // Liste : tout, groupé par jour
    const listView = () => {
      const evs = all.filter(match);
      if (!evs.length) return `<section class="card"><p class="body">Aucun ${esc(c.words.one)} avec ce filtre.</p></section>`;
      const days = [...new Set(evs.map(x => x.date))];
      const next = days.filter(x => x >= D.today.iso), past = days.filter(x => x < D.today.iso).reverse();
      const block = dd => `<p class="day-sep${dd < D.today.iso ? " is-past" : ""}">${dd === D.today.iso ? "Aujourd'hui" : dateLabel(dd)}</p><div class="list">${evs.filter(x => x.date === dd).map(x => apptRow(x, true)).join("")}</div>`;
      return `<section class="card ag-list">
        ${next.length ? `<p class="list-split is-first">À venir</p>${next.map(block).join("")}` : `<p class="body">Aucun ${esc(c.words.one)} à venir avec ce filtre.</p>`}
        ${past.length ? `<p class="list-split">Déjà passés</p>${past.map(block).join("")}` : ""}
      </section>`;
    };

    let body;
    if (view === "week") body = timeGrid(weekDays);
    else if (view === "day") body = narrow ? dayStrip() + dayList(S.agDay) : timeGrid([S.agDay]);
    else if (view === "month") body = monthGrid() + (narrow ? dayList(S.agDay) : "");
    else body = listView();
    return head + body;
  }

  /* ---------- Écran 3 : fiche d'un rendez-vous ---------- */
  function viewRdv(a) {
    const c = C();
    if (!a) return `<div class="card"><h1 class="h2">Ce ${esc(c.words.one)} n'existe plus</h1><p class="body">Il a peut-être été déplacé ou remplacé.</p><a class="link" href="#agenda">Retour à l'agenda ${icon("arrow")}</a></div>`;
    const st = stateOf(a);
    const rep = S.reported[a.id];
    const replacedBy = a.replacedBy && byId(a.replacedBy);
    const replaces = a.replaces && byId(a.replaces);

    let absence;
    if (a.state === "replaced") {
      absence = `<div class="done">
        <b>${icon("swap")}Absence signalée le ${esc(a.absence.reported)}</b>
        <p>Motif : ${esc(a.absence.reason)}. Ce ${esc(c.words.one)} ne compte pas dans votre objectif. Il a été remplacé sans frais.</p>
        ${replacedBy ? `<a class="swap" href="#rdv-${replacedBy.id}"><span class="av av-md">${replacedBy.initials}</span><span class="who"><b>${esc(replacedBy.name)}</b><span>${dateLabel(replacedBy.date)} – ${replacedBy.start} – ${esc(replacedBy.org)}</span></span>${pill(replacedBy)}</a>` : ""}
      </div>`;
    } else if (rep) {
      absence = `<div class="done" role="status">
        <b>${icon("swap")}Absence signalée, remplacement en cours</b>
        <p>Motif : ${esc(rep.reason)}. Ce ${esc(c.words.one)} ne compte plus dans votre objectif. Richard cherche un remplaçant et vous prévient dès qu'il est placé.</p>
        <ol class="steps"><li class="on">Absence reçue – ${rep.at}</li><li>Nouveau ${esc(c.words.one)} placé</li><li>Confirmé dans votre agenda</li></ol>
        <div class="form-actions"><button class="btn btn-ghost" type="button" data-act="undo-absence">Annuler le signalement</button></div>
      </div>`;
    } else if (S.absenceOpen) {
      absence = `<form class="absence-form" id="absence-form">
        <p><b>Que s'est-il passé ?</b></p>
        <div class="choices">${D.absenceReasons.map((r, i) => `<label class="choice"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked" : ""}>${esc(r)}</label>`).join("")}</div>
        <label class="sr" for="absence-note">Précision</label>
        <textarea id="absence-note" name="note" placeholder="Une précision pour Richard (facultatif)"></textarea>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Confirmer et demander un remplacement</button>
          <button class="btn btn-ghost" type="button" data-act="close-absence">Annuler</button>
        </div>
      </form>`;
    } else {
      absence = isPast(a)
        ? `<p class="body">Personne ${esc(c.words.at)} ? On en place un autre, sans frais.</p>
        <div class="form-actions"><button class="btn btn-warn btn-lg" type="button" data-act="open-absence">${icon("swap")}Signaler une absence</button></div>`
        : `<p class="body">Possible dès l'heure passée. Sans frais.</p>
        <div class="form-actions"><button class="btn btn-warn btn-lg" type="button" disabled>${icon("swap")}Signaler une absence</button></div>`;
    }

    const timeline = [
      ["search", c.words.found, a.signals[a.signals.length - 1] || "Signal d'achat"],
      ["chat", "Rappelé et premier message envoyé", "En moins d'une minute après la demande (à confirmer)"],
      ["phone", `Appel de qualification avec Richard`, "Les 4 critères vérifiés"],
      ["cal", `${c.words.one[0].toUpperCase() + c.words.one.slice(1)} placé dans votre agenda`, `${dateLabel(a.date)} à ${a.start}`]
    ];

    return `
    <div class="head">
      <div class="fiche-id">
        <span class="av av-lg">${a.initials}</span>
        <div class="head-text">
          <h1 class="h1">${esc(a.name)}</h1>
          <p class="sub">${esc(a.role)} – ${esc(a.org)} – ${esc(a.city)}</p>
        </div>
      </div>
      <div class="head-actions">${sampleTag}${pill(a)}</div>
    </div>

    <div class="fiche">
      <div class="fcol">
        <section class="card f-facts">
          <dl class="facts">
            <div><dt>Date</dt><dd>${dateLabel(a.date)}</dd></div>
            <div><dt>Heure</dt><dd>${a.start} – ${a.end}</dd></div>
            <div><dt>Format</dt><dd>${esc(a.mode)}</dd></div>
            <div><dt>${esc(c.words.org)}</dt><dd>${esc(a.org)}</dd></div>
          </dl>
          <div class="clines">
            ${(() => { const k = coords(a, c.appointments.indexOf(a)); return cline("phone", k.phone, "Téléphone") + cline("email", k.email, "E-mail") + cline("address", k.address, "Adresse"); })()}
          </div>
          ${a.state !== "replaced" && !isPast(a) ? `<button class="btn btn-primary" type="button" data-prep-for="${a.id}">${icon("book")}Préparer ce rendez-vous</button>` : ""}
          <p class="exclusive">${icon("shield")}Demande réservée à vous : jamais revendue ni partagée avec un autre artisan.</p>
          ${(() => { const st = window.ENTREMIS_GCAL.addState("rdv:" + a.id); return a.state === "replaced" ? "" : `<div class="form-actions"><button class="btn btn-ghost" type="button" data-gcal-rdv="${a.id}" ${st ? "disabled" : ""}>${st === "done" ? icon("check") : brand("gcal", "Google Agenda")}${st === "done" ? "Dans votre Google Agenda" : st === "busy" ? "Ajout…" : "Ajouter à mon Google Agenda"}</button></div>`; })()}
          ${replaces ? `<div class="note"><b>${icon("swap")}Remplace ${esc(replaces.name)}</b><span>${esc(replaces.name)} était absent le ${dateLabel(replaces.date)}, ce ${esc(c.words.one)} le remplace sans frais et compte dans votre objectif.</span> <a class="link" href="#rdv-${replaces.id}">Voir le ${esc(c.words.one)} d'origine ${icon("arrow")}</a></div>` : ""}
        </section>

        <section class="card f-crit">
          <div class="card-head"><h2 class="h2">Pourquoi ${st === "new" ? "il est" : "il a été"} qualifié</h2><span class="muted tabnum">${c.criteria.length} critères sur ${c.criteria.length}</span></div>
          <ul class="crit">${c.criteria.map(k => `<li><span class="ok">${icon("check")}</span><b>${k.label}</b><span>${esc(a.criteria[k.key])}</span></li>`).join("")}</ul>
        </section>

        <section class="card f-sig">
          <h2 class="h2">Signaux d'achat</h2>
          <div class="signals">${a.signals.map(s => `<span class="badge">${/facebook/i.test(s) ? brand("facebook", "Facebook") : /google/i.test(s) ? brand("google", "Google") : icon("signal")}${esc(s)}</span>`).join("")}</div>
          ${a.note ? `<div class="note"><b>${icon("user")}Le mot de Richard</b><span>${esc(a.note)}</span></div>` : ""}
        </section>
      </div>

      <div class="fcol">
        ${window.ENTREMIS_CPLUS.resultCard(a)}
        ${window.ENTREMIS_CPLUS.confirmCard(a)}
        <section class="card absence f-abs" aria-label="Absence et remplacement">
          <h2 class="h2">Absence et remplacement</h2>
          ${absence}
        </section>
        <section class="card f-time">
          <h2 class="h2">Comment on l'a trouvé</h2>
          <ol class="timeline">${timeline.map(([i, t, s]) => `<li><span class="dotico">${icon(i)}</span><div><b>${esc(t)}</b><span>${esc(s)}</span></div></li>`).join("")}</ol>
        </section>
      </div>
    </div>`;
  }

  /* ---------- Écran 4 : comptes ciblés et messages ---------- */
  function tabsHtml(active) {
    const c = C();
    return `<nav class="tabs" aria-label="Comptes et messages">
      <a href="#comptes" ${active === "comptes" ? 'aria-current="page"' : ""}>${icon("inbox")}${esc(c.words.accounts)}</a>
      <a href="#messages" ${active === "messages" ? 'aria-current="page"' : ""}>${icon("chat")}Messages envoyés</a>
    </nav>`;
  }
  function viewAccounts() {
    const c = C();
    const total = c.accounts.length;
    const n = k => c.accounts.filter(a => STEPS[a.step][1] >= STEPS[k][1]).length;
    const list = c.accounts.filter(a => S.step === "all" || a.step === S.step);
    return `
    <div class="head">
      <div class="head-text">
        <h1 class="h1">${esc(c.words.accounts)}</h1>
        <p class="sub">${esc(c.words.accountsSub)}</p>
      </div>
      <div class="head-actions">${sampleTag}${tabsHtml("comptes")}</div>
    </div>
    ${(() => { const mine = window.ENTREMIS_LEADS.list().filter(l => l.to === viewId()); const src = ["Facebook", "Google", "Site"].map(s => [s, mine.filter(l => l.source === s).length]);
      return `<section class="card my-leads"><div class="ml-main">${icon("shield")}<div><b>${esc((c.kpis.find(k => /reçues/.test(k.label)) || { value: mine.length }).value)} demandes, toutes à vous</b><span>Jamais revendues ni partagées. Sources des ${mine.length} dernières :</span></div></div>
        <div class="ml-src">${src.map(([s, n]) => window.ENTREMIS_LEADS.srcTag(s).replace("</span>", `<b class="tabnum">${n}</b></span>`)).join("")}</div></section>`; })()}

    <div class="funnel" role="group" aria-label="Filtrer par étape">
      ${Object.keys(STEPS).map(k => `<button type="button" data-step="${k}" aria-pressed="${S.step === k}">
        <span>${STEPS[k][0]}</span><b>${n(k)}</b><div class="bar"><i style="--p:${Math.round(n(k) / total * 100)}%"></i></div>
      </button>`).join("")}
    </div>
    <section class="card">
      <div class="card-head">
        <h2 class="h2">${S.step === "all" ? esc(c.words.accountsAll) : STEPS[S.step][0]} <span class="muted tabnum">${list.length}</span></h2>
        ${S.step !== "all" ? `<button class="link" type="button" data-step="all">Tout afficher</button>` : ""}
      </div>
      <table class="table">
        <thead><tr><th>${esc(c.words.account)}</th><th class="col-src">Venu de</th><th>Signal d'achat</th><th>Étape</th><th>Ville</th><th>Dernier contact</th></tr></thead>
        <tbody>${list.map(a => `<tr class="doc-row" data-acc-open="${esc(a.org)}" tabindex="0" aria-label="Voir la demande de ${esc(a.org)}">
          <td class="org"><b>${esc(a.org)}</b><span>${esc(a.sector)} – ${esc(a.size)}</span></td>
          <td class="col-src">${(() => { const l = window.ENTREMIS_LEADS.list().find(x => x.name === a.org); const s = l && l.source; return s ? window.ENTREMIS_LEADS.srcTag(s) : `<span class="muted">—</span>`; })()}</td>
          <td class="sig"><span class="badge">${icon("signal")}${esc(a.signal)}</span></td>
          <td><span class="stepdots" aria-label="${STEPS[a.step][0]}">${[1, 2, 3, 4].map(i => `<i class="${i <= STEPS[a.step][1] ? "on" : ""}"></i>`).join("")}<span>${STEPS[a.step][0]}</span></span></td>
          <td class="hide-m body">${esc(a.city)}</td>
          <td class="hide-m muted tabnum">${esc(a.last)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </section>
    ${accountPanel()}`;
  }
  // « Plus » côté client (téléphone) : toutes les pages qui ne sont pas dans les onglets
  function viewClientMenu() {
    const c = C(), replies = c.messages.filter(m => m.status === "replied").length, unread = TM().unreadCount(S);
    const groups = [["Votre campagne", [["facturation", "euro", "Leads et facture"], ["messages", "chat", "Messages", replies], ["scripts", "book", "Scripts"]]],
      ["Votre organisation", [["dispos", "clock", "Disponibilités"], ["parrainage", "users", "Parrainer un installateur"]]],
      ["Compte", [["notifications", "bell", "Notifications", unread], ["reglages", "user", "Réglages"], ["aide", "info", "Comment ça marche"]]]];
    return `<div class="head"><div class="head-text"><h1 class="h1">Plus</h1><p class="sub">Toutes vos pages.</p></div></div>
      ${groups.map(([t, items]) => `<section class="ios-group"><p class="ios-title">${t}</p><div class="card ios-list">${items.map(([r, i, l, n]) => `<a href="#${r}"><span class="ios-ico">${icon(i)}</span><span>${l}</span>${n ? `<span class="count">${n}</span>` : ""}${icon("chev")}</a>`).join("")}</div></section>`).join("")}${window.ENTREMIS_CLOUD.on() ? `<section class="ios-group ios-out-group"><div class="card ios-list"><button class="ios-out" type="button" data-cloud-out><span class="ios-ico">${icon("logout")}</span><span>Se déconnecter</span></button></div></section>` : ""}`;
  }
  // Une demande ouverte : tout ce qu'on sait d'elle, et ce qui se passe ensuite
  function accountPanel() {
    const c = C(), a = S.acc && c.accounts.find(x => x.org === S.acc); if (!a) return "";
    const P = clientParcours(), appt = c.appointments.find(x => x.name === a.org);
    const lead = window.ENTREMIS_LEADS.list().find(x => x.name === a.org);
    const rank = STEPS[a.step][1], okN = { 1: 0, 2: 2, 3: 4, 4: 4 }[rank] || 0;
    const crit = appt ? c.criteria.map(k => [k.label, appt.criteria[k.key]]) : P.criteria.map(q => [q, ""]);
    const signals = appt && appt.signals && appt.signals.length ? appt.signals : [a.signal];
    const next = { 1: "Richard rappelle cette personne tout de suite.", 2: "Rappelée. On vérifie les 4 points avant de vous la passer.", 3: "Qualifiée. Richard cale le rendez-vous avec vous.", 4: "" }[rank];
    const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : "";
    return `<div class="lp-scrim" data-acc-close></div><aside class="lead-panel acc-panel" aria-label="Demande de ${esc(a.org)}">
      <header class="lp-head"><div><h2 class="h2">${esc(a.org)}</h2><div class="lp-tags"><span class="state state-${rank >= 4 ? "ok" : rank === 3 ? "info" : "neutral"}">${STEPS[a.step][0]}</span>${lead ? window.ENTREMIS_LEADS.srcTag(lead.source) : ""}</div></div>
        <button class="icon-btn" type="button" data-acc-close aria-label="Fermer">${icon("plus")}</button></header>
      ${appt ? `<a class="btn btn-primary acc-go" href="#rdv-${appt.id}">${icon("cal")}Voir le rendez-vous – ${esc(dateLabel(appt.date))} à ${esc(appt.start)}</a>` : `<p class="acc-next">${icon("clock")}${esc(next)}</p>`}
      <dl class="lp-dl">${row("Projet", a.sector)}${row("Logement", a.size)}${row("Ville", a.city)}${row("Venu de", lead ? lead.source : "")}${row("Dernier contact", a.last !== "—" ? a.last : "")}</dl>
      <section class="lp-box"><p class="lp-label">Les 4 points vérifiés</p>
        <ul class="acc-crit">${crit.map(([k, v], i) => `<li class="${i < okN ? "is-ok" : ""}">${i < okN ? icon("check") : "<i></i>"}<div><b>${esc(k)}</b>${v ? `<span>${esc(v)}</span>` : i < okN ? "" : `<span>pas encore vérifié</span>`}</div></li>`).join("")}</ul></section>
      <section class="lp-box"><p class="lp-label">Pourquoi c'est sérieux</p><ul class="acc-sig">${signals.map(sg => `<li>${icon("signal")}<span>${esc(sg)}</span></li>`).join("")}</ul></section>
      <section class="lp-box"><p class="lp-label">Les étapes</p><ol class="acc-steps">${Object.keys(STEP_ORDER).map(k => `<li class="${STEP_ORDER[k] <= rank ? "is-done" : ""}"><i></i><span>${esc(STEPS[k][0])}</span></li>`).join("")}</ol></section>
      <p class="acc-own">${icon("shield")}À vous seul. Jamais revendue ni partagée.</p>
    </aside>`;
  }
  function viewMessages(id) {
    const c = C();
    const isMobile = isNarrow();
    const cur = c.messages.find(m => m.id === id) || (isMobile ? null : c.messages[0]);
    const list = `<section class="card ${cur && isMobile ? "" : ""}" ${cur && isMobile ? "hidden" : ""}>
      <div class="card-head"><h2 class="h2">${c.messages.length} messages</h2><span class="muted">${c.messages.filter(m => m.status === "replied").length} réponses</span></div>
      <div class="msg-list">${c.messages.map(m => `<a class="msg-item" href="#message-${m.id}" ${cur && cur.id === m.id ? 'aria-current="true"' : ""}>
        <span class="av av-md">${m.to.split(" ").map(x => x[0]).join("").slice(0, 2)}</span>
        <span class="who"><b>${esc(m.to)}</b><span>${esc(m.subject)}</span></span>
        <span class="msg-meta"><span>${esc(m.date.split(" – ")[0])}</span>${m.status === "replied" ? `<span class="state state-ok">${MSG[m.status]}</span>` : `<span>${MSG[m.status]}</span>`}</span>
      </a>`).join("")}</div>
    </section>`;
    // Le message, comme une conversation : envoyé à droite (en bleu), réponse à gauche
    const mail = cur ? (() => {
      const [day, time] = cur.date.split(" – ");
      const first = cur.to.split(" ")[0], ini = cur.to.split(" ").map(x => x[0]).join("").slice(0, 2);
      return `<section class="card mail">
      ${isMobile ? `<a class="link" href="#messages">${icon("back")}Tous les messages</a>` : ""}
      <div class="mail-head">
        <span class="av av-md">${ini}</span>
        <div><h2 class="h2">${esc(cur.to)}</h2><p>${esc(cur.org)} – ${esc(cur.subject)}</p></div>
        <span class="chan-chip">${icon(cur.channel === "SMS" ? "phone" : "chat")}${esc(cur.channel)}</span>
      </div>
      <div class="thread">
        <p class="thread-day">${esc(day)}</p>
        <div class="bubble out"><p>${esc(cur.body)}</p></div>
        <p class="b-meta out">Richard, pour vous – ${esc(time || "")}${cur.reply ? " – Lu" : ""}</p>
        ${cur.reply ? `<div class="bubble in"><p>${esc(cur.reply)}</p></div><p class="b-meta in">${esc(first)} a répondu</p>`
          : `<p class="thread-wait">${icon("clock")}Pas encore de réponse. Une relance part après 3 jours ouvrés.</p>`}
      </div>
      <p class="sent-from">${icon("shield")}Validé avec vous, envoyé depuis une boîte dédiée, jamais votre adresse principale.</p>
    </section>`; })() : "";
    return `
    <div class="head">
      <div class="head-text">
        <h1 class="h1">Messages envoyés</h1>
        <p class="sub">Tout ce qu'on a écrit en votre nom, mot pour mot.</p>
      </div>
      <div class="head-actions">${sampleTag}${tabsHtml("messages")}</div>
    </div>
    <div class="msg-layout">${list}${mail}</div>`;
  }

  /* ---------- Routeur ---------- */
  function parse() {
    const h = location.hash.replace(/^#/, "") || "accueil";
    let name = h, id;
    if (h.startsWith("rdv-")) {
      name = "rdv"; id = h.slice(4);
      // Un lien vers une fiche de l'autre offre bascule sur cette offre
      if (!byId(id)) { const other = Object.values(D.campaigns).find(c => c.appointments.some(a => a.id === id)); if (other) S.camp = other.id; }
      // Le rendez-vous d'un autre client : l'équipe passe sur l'espace de ce client (jamais un compte client)
      if (!S.lock) { const owner = window.ENTREMIS_GROWTH && window.ENTREMIS_GROWTH.rdvClient(id); if (owner && owner !== viewId()) { S.viewAs = owner; store.set("as", owner); } }
    }
    else if (h.startsWith("message-")) { name = "messages"; id = h.slice(8); }
    else if (h.startsWith("fiche-")) { name = "fiche"; id = h.slice(6); }
    else if (h.startsWith("script-")) { name = "script"; id = h.slice(7); }
    const GROWTH_ROUTES = ["appel", "rendez-vous", "zones", "sante", "propositions", "etudes", "marge", "conformite", "acces"];
    const CLIENT_ROUTES = ["accueil", "agenda", "rdv", "comptes", "messages", "scripts", "script", "aide", "resultats", "dispos", "parrainage", "menu", "facturation"];
    const OPS = window.ENTREMIS_OPS;
    if (S.lock) {
      // Compte client : jamais l'agence. Une autre adresse ramène à son accueil.
      S.space = "client";
      if (!CLIENT_ROUTES.includes(name) && !TM().SHARED_ROUTES.includes(name)) { name = "accueil"; id = undefined; history.replaceState(null, "", location.pathname + location.search + "#accueil"); }
      else if (name === "rdv" && !byId(id)) { name = "agenda"; id = undefined; history.replaceState(null, "", location.pathname + location.search + "#agenda"); }
    }
    else if (TM().TEAM_ROUTES.includes(name) || OPS.ROUTES.includes(name) || name === "chiffres" || name === "fiche" || name === "scripts-equipe" || name === "leads" || name === "generer" || name === "guide" || name === "processus" || name === "discussions" || name === "secteurs" || GROWTH_ROUTES.includes(name)) S.space = "team";
    else if (CLIENT_ROUTES.includes(name)) S.space = "client";
    else if (!TM().SHARED_ROUTES.includes(name) && name !== "scripts-equipe" && name !== "leads" && name !== "generer" && name !== "guide" && name !== "processus" && name !== "discussions" && name !== "secteurs" && !GROWTH_ROUTES.includes(name)) name = S.space === "team" ? "equipe" : "accueil";
    return { name, id, appt: name === "rdv" ? byId(id) : null };
  }
  let lastKey = "";
  function render() {
    if (window.ENTREMIS_LIVE) { window.ENTREMIS_LIVE.rebuild(); window.ENTREMIS_LIVE.watch(); }
    const r = parse();
    const key = r.name + "/" + (r.id || "");
    if (key !== lastKey && r.name === "rdv") S.absenceOpen = !!S.keepAbsence;
    S.keepAbsence = false;
    renderChrome(r);
    if (key !== lastKey) { S.taskForm = false; S.acc = null; }
    if (key !== lastKey) { window.ENTREMIS_OPS.resetSheet(); window.ENTREMIS_METRICS.resetSheet(); window.ENTREMIS_FICHE.reset(); window.ENTREMIS_SCRIPTS.reset(); window.ENTREMIS_GEN.closeDoc(); window.ENTREMIS_SETTINGS.reset(); window.ENTREMIS_GROWTH.reset(); window.ENTREMIS_ACCESS.reset(); window.ENTREMIS_LIVE.reset(); window.ENTREMIS_MACHINE.reset(); }
    const tv = TM().views[r.name] || window.ENTREMIS_OPS.views[r.name] || (r.name === "chiffres" ? window.ENTREMIS_METRICS.view : null) || (r.name === "fiche" ? s => window.ENTREMIS_FICHE.view(s, r.id) : null)
      || (r.name === "scripts" ? window.ENTREMIS_SCRIPTS.viewList : r.name === "script" ? s => window.ENTREMIS_SCRIPTS.viewScript(s, r.id) : r.name === "scripts-equipe" ? window.ENTREMIS_SCRIPTS.viewTeam : r.name === "leads" ? window.ENTREMIS_LEADS.view : r.name === "generer" ? window.ENTREMIS_GEN.view : r.name === "guide" ? window.ENTREMIS_GUIDE.viewTeam : r.name === "processus" ? window.ENTREMIS_PROCESS.view : r.name === "discussions" ? window.ENTREMIS_CHAT.view : r.name === "secteurs" ? window.ENTREMIS_SECTORS.view : r.name === "acces" ? window.ENTREMIS_ACCESS.view : window.ENTREMIS_GROWTH.views[r.name] ? window.ENTREMIS_GROWTH.views[r.name] : r.name === "aide" ? window.ENTREMIS_GUIDE.viewClient : r.name === "resultats" ? window.ENTREMIS_CPLUS.viewResults : r.name === "dispos" ? window.ENTREMIS_CPLUS.viewDispos : r.name === "parrainage" ? window.ENTREMIS_CPLUS.viewParrainage : r.name === "facturation" ? window.ENTREMIS_MACHINE.viewClientBilling : r.name === "menu" ? viewClientMenu : null);
    const v = tv ? tv(S) : { accueil: viewHome, agenda: viewAgenda, rdv: () => viewRdv(r.appt), comptes: viewAccounts, messages: () => viewMessages(r.id) }[r.name]();
    if (key !== lastKey && r.name !== "fiche") { S.ctxClient = null; S.ctxContact = null; }
    let html = v;
    // Les formulaires (tâche, appel, document) s'ouvrent depuis n'importe quel écran
    if (S.taskForm && !html.includes('id="task-form"')) html += TM().taskSheet(S);
    if (window.ENTREMIS_OPS.sheetOpen() && !html.includes('class="sheet"')) html += window.ENTREMIS_OPS.sheetHtml(S);
    html += window.ENTREMIS_GEN.docPanel(S);
    html += window.ENTREMIS_LIVE.sheet(S);
    html += window.ENTREMIS_MACHINE.callSheet();   // client, prospect, rendez-vous, dépense   // un devis ou une facture ouvert (vrai PDF, partage)
    window.ENTREMIS_PICK.close();
    $("#view").innerHTML = html;
    window.ENTREMIS_PICK.enhance($("#view"));   // dates et heures : pastilles et calendrier façon Apple
    window.ENTREMIS_CHAT.scrollDown();
    softNums($("#view"));
    document.title = "Entremis – " + ($("#crumbs b") ? $("#crumbs b").textContent : "");
    if (key !== lastKey) { window.scrollTo(0, 0); root.scrollTop = 0; const ap = root.querySelector(".app"); if (ap) ap.scrollTop = 0; }
    lastKey = key;
    syncFrame();
  }

  /* ---------- Interactions ---------- */
  document.addEventListener("click", e => {
    if (e.target.closest("[data-cloud-out]")) { window.ENTREMIS_CLOUD.signOut(); return; }
    if (e.target.closest("#tabbar a, #menu a, .ios-list a, .m-back, #crumbs a, .m-avatar-link")) TM().haptic("tap");   // changement de page
    if (e.target.closest('[data-act="toast-undo"]')) { const u = toastUndo; toastUndo = null; $("#toast").classList.remove("on"); if (u) u(); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) { copyText(cp.dataset.copy, cp); return; }
    const na = e.target.closest("[data-n-act]"); if (na) S.read = Object.assign({}, S.read, { [na.dataset.nAct]: true });   // agir sur une notification la marque comme lue
    if (window.ENTREMIS_GCAL.onClick(e)) return;
    if (window.ENTREMIS_MACHINE.onClick(e, S, render)) return;
    if (window.ENTREMIS_CPLUS.onClick(e, S, render)) return;
    if (window.ENTREMIS_OPS.onClick(e, S, render)) return;
    if (window.ENTREMIS_METRICS.onClick(e, S, render)) return;
    if (window.ENTREMIS_FICHE.onClick(e, S, render)) return;
    if (window.ENTREMIS_SCRIPTS.onClick(e, S, render)) return;
    if (window.ENTREMIS_LEADS.onClick(e, S, render)) return;
    if (window.ENTREMIS_GEN.onClick(e, S, render)) return;
    if (window.ENTREMIS_CALC.onClick(e, S, render)) return;
    if (window.ENTREMIS_PROCESS.onClick(e, S, render)) return;
    if (window.ENTREMIS_CHAT.onClick(e, S, render)) return;
    if (window.ENTREMIS_SECTORS.onClick(e, S, render)) return;
    if (window.ENTREMIS_SETTINGS.onClick(e, S, render)) return;
    if (window.ENTREMIS_GROWTH.onClick(e, S, render)) return;
    if (window.ENTREMIS_ACCESS.onClick(e, S, render)) return;
    if (window.ENTREMIS_LIVE.onClick(e, S, render)) return;
    if (TM().onClick(e, S, render)) return;
    const ap = e.target.closest("[data-as-pick]");
    if (ap) { pickClient(ap.dataset.asPick); return; }
    const acc = e.target.closest("[data-acc-open]");
    if (acc && !e.target.closest("button,a")) { S.acc = acc.dataset.accOpen; render(); return; }
    if (e.target.closest("[data-acc-close]")) { S.acc = null; render(); return; }
    const fold = e.target.closest("[data-menu-fold]");
    if (fold) { const k = fold.dataset.menuFold; let f = []; try { f = JSON.parse(store.get("fold", "[]")); } catch (_) {} store.set("fold", JSON.stringify(f.includes(k) ? f.filter(x => x !== k) : f.concat(k))); renderChrome(parse()); return; }
    const t = e.target.closest("[data-camp],[data-week],[data-filter],[data-ag-view],[data-ag-day],[data-ag-step],[data-step],[data-act],[data-set]");
    if (!t) return;
    if (t.dataset.camp) { S.camp = t.dataset.camp; store.set("camp", S.camp); S.step = "all"; S.filter = "all"; if (parse().name === "rdv" && !parse().appt) location.hash = "#agenda"; render(); return; }
    if (t.dataset.week) { const v = Number(t.dataset.week); S.week = v === 0 ? 1 : Math.min(D.weeks.length - 1, Math.max(0, S.week + v)); render(); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; render(); return; }
    if (t.dataset.agView) { S.agView = t.dataset.agView; if (S.agView === "week") { const i = D.weeks.findIndex(w => w.start === mondayOf(S.agDay)); if (i >= 0) S.week = i; } TM().haptic("tap"); render(); return; }
    if (t.dataset.agDay) { S.agDay = t.dataset.agDay; S.agMonth = S.agDay.slice(0, 7); if (t.dataset.agOpen === "day") S.agView = "day"; TM().haptic("tap"); render(); return; }
    if (t.dataset.agStep) {
      const n = Number(t.dataset.agStep), v = isNarrow() && S.agView === "week" ? "day" : S.agView;
      if (v === "day") S.agDay = n === 0 ? D.today.iso : addDays(S.agDay, n);
      if (v === "month") S.agMonth = n === 0 ? D.today.iso.slice(0, 7) : addMonths(S.agMonth, n);
      render(); return;
    }
    if (t.dataset.step) { S.step = S.step === t.dataset.step ? "all" : t.dataset.step; render(); return; }
    if (t.dataset.set) { const [k, v] = t.dataset.set.split(":"); S[k] = v; store.set(k, v); applyTheme(); renderTweak(); syncFrame(); render(); return; }
    const act = t.dataset.act;
    if (act === "absence") {
      // Le dernier rendez-vous passé et tenu : c'est celui qu'on signale le plus souvent
      const last = C().appointments.filter(a => isPast(a) && a.state === "ok" && !S.reported[a.id]).pop();
      S.keepAbsence = true;
      location.hash = "#rdv-" + (last ? last.id : "");
      return;
    }
    if (act === "open-absence") { S.absenceOpen = true; render(); const f = $("#absence-form input"); if (f) f.focus(); return; }
    if (act === "close-absence") { S.absenceOpen = false; render(); return; }
    if (act === "undo-absence") { delete S.reported[parse().id]; S.absenceOpen = false; render(); toast("Signalement annulé."); return; }
    if (act === "guide-off") { store.set("guide-off", "1"); render(); return; }
    if (act === "tweak") { const box = $("#tweak-box"); box.hidden = !box.hidden; t.setAttribute("aria-expanded", String(!box.hidden)); return; }
    if (act === "dispo" || act === "export" || act === "ecrire" || act === "notif") { toast(NOT_WIRED); return; }
  });
  document.addEventListener("change", e => {
    const fs = e.target.closest("select[data-fsel]");
    if (fs) { const b = document.createElement("button"); b.type = "button"; b.hidden = true; b.setAttribute("data-" + fs.dataset.fsel, fs.value); document.body.appendChild(b); b.click(); b.remove(); return; }
    if (e.target.closest("#gen-form,#calc-form")) return; if (window.ENTREMIS_SETTINGS.onChange(e, S, render)) return; if (window.ENTREMIS_SCRIPTS.onChange(e, render)) return; if (!window.ENTREMIS_OPS.onChange(e)) TM().onChange(e, S); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && S.taskForm) { S.taskForm = false; render(); } });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && S.acc) { S.acc = null; render(); return; }
    const r = e.key === "Enter" && e.target.matches && e.target.matches("[data-acc-open]") ? e.target : null;
    if (r) { e.preventDefault(); S.acc = r.dataset.accOpen; render(); }
  });
  document.addEventListener("submit", e => {
    if (window.ENTREMIS_GEN.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_CPLUS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_PROCESS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_SECTORS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_SETTINGS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_ACCESS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_MACHINE.onSubmit(e, S, render)) return;
    if (e.target.getAttribute && e.target.getAttribute("id") === "live-form") { window.ENTREMIS_LIVE.onSubmit(e, S, render); return; }
    if (window.ENTREMIS_GROWTH.onSubmit(e, S, render)) return;
    if (e.target.id === "doc-form" || e.target.id === "call-form") { window.ENTREMIS_OPS.onSubmit(e, S, render); return; }
    if (window.ENTREMIS_METRICS.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_FICHE.onSubmit(e, S, render)) return;
    if (window.ENTREMIS_SCRIPTS.onSubmit(e, S, render)) return;
    if (TM().onSubmit(e, S, render)) return;
    if (e.target.id !== "absence-form") return;
    e.preventDefault();
    const f = new FormData(e.target);
    S.reported[parse().id] = { reason: f.get("reason"), note: f.get("note"), at: `${D.today.label.split(" ").slice(1).join(" ")} à ${D.today.now}` };
    S.absenceOpen = false;
    render();
    TM().haptic("done");
    toast("Absence signalée. Un remplacement est demandé.");
  });
  addEventListener("hashchange", render);
  // Le rendu mobile suit la largeur de #root (fenêtre étroite ou aperçu téléphone)
  const root = $("#root");
  // En dessous de 640 px : mode téléphone (barre d'onglets en bas). Au-dessus : menu à gauche.
  function isNarrow() { return root.clientWidth <= 640; }
  let wasNarrow = null;
  new ResizeObserver(() => { const n = isNarrow(); if (wasNarrow !== null && n !== wasNarrow) render(); wasNarrow = n; }).observe(root);

  /* ---------- Panneau Thème / Couleurs / Aperçu ---------- */
  function renderTweak() {
    const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-set="${k}:${v}" aria-pressed="${S[k] === v}">${l}</button>`).join("")}</div>`;
    $("#tweak-box").innerHTML = `
      <fieldset><legend>Aperçu</legend>${seg("preview", [["desktop", "Ordinateur"], ["phone", "Téléphone"]])}</fieldset>
      <p class="tweak-note">Réglage de maquette, pour voir l'app sur ordinateur ou sur téléphone. Il ne fera pas partie de l'app.</p>`;
  }
  function syncFrame() {
    document.documentElement.classList.toggle("phone", S.preview === "phone");
  }

  // Ce que team.js utilise
  // Anneau de traits fins : la part faite d'un objectif (traits pleins) et ce qui reste (traits pâles)
  function tickRing(p, center, sub) {
    const N = 90, on = Math.round(Math.max(0, Math.min(100, p)) / 100 * N);
    return `<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true">${Array.from({ length: N }, (_, i) => `<line class="${i < on ? "on" : ""}" x1="60" y1="5" x2="60" y2="16" transform="rotate(${i * 360 / N} 60 60)"/>`).join("")}</svg>
      <div class="ring-c"><b class="tabnum">${center}</b>${sub ? `<span>${sub}</span>` : ""}</div></div>`;
  }
  // Filtre en menu déroulant : un libellé court + la valeur choisie. Au changement, l'app reçoit le même clic qu'avec l'ancien bouton (data-<attr>="valeur").
  function fsel(attr, label, opts, cur) {
    return `<label class="fsel"><span>${esc(label)}</span><select data-fsel="${attr}" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${esc(String(v))}" ${String(cur) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${icon("chev")}</label>`;
  }
  // Chiffres façon AgentOps : le nombre entier toujours en noir (milliers et décimales compris), seuls l'unité et le dénominateur en gris
  // (« 14 700 € » → « 14 700 » noir + « € » gris ; « 8 / 10 » → « 8 » noir + « / 10 » gris). Jamais un nombre coupé en deux couleurs (Marc, 20 nov.).
  const SOFT_SEL = ".kpi-value,.col-stats dd,.person dd,.flow-hub b,.funnel b,.calc-num,.calc-hero,.script-pct,.kw-pos,.camp-num";
  function softNums(root) {
    if (!root) return;
    root.querySelectorAll(SOFT_SEL).forEach(el => {
      if (el.children.length || el.dataset.soft) return;
      const m = el.textContent.match(/^(\D*?)(\d+(?:[ \u00a0\u202f]\d{3})*(?:[,.]\d+)?)([\s\S]*)$/);
      if (!m || !m[3].trim()) return;
      el.innerHTML = esc(m[1] + m[2]) + `<span class="num-soft">${esc(m[3])}</span>`;
      el.dataset.soft = "1";
    });
  }
  // Icône de fichier : une petite page et une étiquette de couleur selon le type (PDF, DOC, XLS, CSV, JPG…). kind = un type ou un nom de fichier.
  const FT = { pdf: ["PDF", "lines"], doc: ["DOC", "lines"], docx: ["DOC", "lines"], txt: ["TXT", "lines"], md: ["MD", "lines"], xls: ["XLS", "grid"], xlsx: ["XLS", "grid"], csv: ["CSV", "grid"],
    zip: ["ZIP", "zip"], ppt: ["PPT", "img"], pptx: ["PPT", "img"], key: ["PPT", "img"], json: ["JSON", "code"], png: ["PNG", "img"], jpg: ["JPG", "img"], jpeg: ["JPG", "img"], heic: ["IMG", "img"], webp: ["IMG", "img"], img: ["IMG", "img"],
    mp4: ["VIDÉO", "video"], mov: ["VIDÉO", "video"], video: ["VIDÉO", "video"] };
  const FT_BODY = {
    lines: `<path class="fl" d="M9 12.5h11M9 18h16M9 23.5h13M9 29h16M9 34.5h9"/>`,
    grid: `<path class="fg" d="M8 10h7v5H8zM17 10h7v5h-7zM26 10h6v5h-6zM8 17h7v5H8zM17 17h7v5h-7zM26 17h6v5h-6zM8 24h7v5H8zM17 24h7v5h-7z"/>`,
    zip: `<path class="fg" d="M17 6h5v4h-5zM20 10h5v4h-5zM17 14h5v4h-5zM20 18h5v4h-5zM17 22h5v4h-5zM20 26h5v4h-5z"/>`,
    img: `<rect class="fg" x="7.5" y="9" width="25" height="18" rx="2.5"/><circle class="fs" cx="20" cy="15.5" r="3"/><path class="fl" d="M11 22.5h18M9 32h14"/>`,
    video: `<rect class="fg" x="7.5" y="9" width="25" height="18" rx="2.5"/><path class="fv" d="M17.5 13.5l6 4.5-6 4.5z"/><path class="fl" d="M9 32h14"/>`,
    code: `<path class="fl" d="M9 11h2.5M13 16h12M13 21h8M13 26h11M9 31h2.5"/>`
  };
  const ftKey = kind => { const k = String(kind || "").toLowerCase(); if (FT[k]) return k; const ext = k.includes(".") ? k.split(".").pop() : ""; return FT[ext] ? ext : "pdf"; };
  function fileIcon(kind, cls) {
    const [label, body] = FT[ftKey(kind)];
    return `<span class="fic ft-${label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${cls ? " " + cls : ""}" aria-hidden="true"><svg viewBox="0 0 40 48"><rect class="pg" x="1" y="1" width="38" height="46" rx="7"/>${FT_BODY[body]}</svg><b>${label}</b></span>`;
  }
  // Processus en blocs reliés par des fils (étapes, onboarding). steps : [{ icon, title, rows: [[libellé, valeur, "ok"|"bad"]] }]
  function nodeFlow(steps, label) {
    const wire = i => `<svg class="nf-wire${i % 2 ? " up" : ""}" viewBox="0 0 56 120" preserveAspectRatio="none" aria-hidden="true"><path d="${i % 2 ? "M2,98 C28,98 28,58 54,58" : "M2,58 C28,58 28,98 54,98"}"/><circle cx="2" cy="${i % 2 ? 98 : 58}" r="3.5"/><circle cx="54" cy="${i % 2 ? 58 : 98}" r="3.5"/></svg>`;
    return `<div class="nf" role="list" aria-label="${esc(label)}">${steps.map((s, i) => `${i ? wire(i - 1) : ""}<article class="nf-node${i % 2 ? " low" : ""}" role="listitem">
      ${i === 0 ? `<span class="nf-start">Début</span>` : ""}
      <header>${icon(s.icon)}<b>${esc(s.title)}</b><span class="nf-n tabnum">${i + 1}</span></header>
      ${s.text ? `<p class="nf-text">${esc(s.text)}</p>` : ""}
      ${s.rows && s.rows.length ? `<dl>${s.rows.map(([k, v, t]) => `<div${t ? ` class="nf-${t}"` : ""}><dt>${t ? "<i></i>" : ""}${esc(k)}</dt><dd class="tabnum">${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    </article>`).join("")}</div>`;
  }
  // Chargement : un petit disque de traits qui tourne, ce qui se passe, et une ligne plus discrète
  const loader = (what, sub) => `<div class="loader" role="status"><span class="orb" aria-hidden="true"><i></i></span><div><b>${esc(what)}…</b><span>${esc(sub || "Un instant")}</span></div></div>`;
  // Ouverture sur téléphone : le logo se dessine, puis l'app apparaît. Une fois par visite, jamais si l'animation est réduite.
  function splash() {
    let seen = false; try { seen = sessionStorage.getItem("entremis-splash") === "1"; sessionStorage.setItem("entremis-splash", "1"); } catch (_) {}
    if (seen || !isNarrow() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = document.createElement("div");
    el.className = "splash"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<svg viewBox="0 0 120 120"><path class="sp-e" d="M24 26a8 8 0 0 1 8-8h58a7 7 0 0 1 0 14H38v56h52a7 7 0 0 1 0 14H32a8 8 0 0 1-8-8Z"/><rect class="sp-bar" x="48" y="53" width="60" height="14" rx="7"/></svg><p>ENTREMIS</p>`;
    $("#root").appendChild(el);
    setTimeout(() => el.classList.add("out"), 1250);
    setTimeout(() => el.remove(), 1700);
  }
  window.EM = { D, S, C, baseC, allClients, viewId, viewClient, viewUser, pickClient, esc, icon, fileIcon, brand, cline, confirm: o => askConfirm(o), toast, store, isNarrow: () => isNarrow(), sampleTag, loader, nodeFlow, tickRing, fsel, render: () => render() };
  splash();

  applyTheme();
  renderTweak();
  render();
  TM().initSwipe(render);
  TM().initTasks(() => render());
  window.ENTREMIS_GCAL.init();
  window.ENTREMIS_OPS.init(() => render());
  window.ENTREMIS_METRICS.init(() => render());
  window.ENTREMIS_FICHE.init(() => render());
  window.ENTREMIS_SCRIPTS.init(() => render());
  window.ENTREMIS_LEADS.init(() => render());
  window.ENTREMIS_MACHINE.init(() => render());
  window.ENTREMIS_PROCESS.init(() => render());
  window.ENTREMIS_CHAT.bind(S, render);
  window.ENTREMIS_CHAT.init(() => render());
  // Site en ligne : la personne connectée décide du portail et de l'espace
  if (window.ENTREMIS_CLOUD.on()) window.ENTREMIS_CLOUD.ready().then(m => {
    if (m.role === "client") {
      // Compte client : son espace seulement, sur son entreprise (la base ne lui envoie que ses propres données)
      S.lock = true; S.space = "client"; S.viewAs = m.client || ""; document.documentElement.classList.add("is-locked");
    } else {
      if (m.who && D.team.members.some(x => x.id === m.who)) S.who = m.who; else S.shared = true;   // compte agence partagé : on choisit son portail
      S.space = "team";
      if (location.hash === "" || location.hash === "#accueil") location.hash = "#equipe";
    }
    render();
  });
  window.ENTREMIS_SECTORS.init(() => render());
  window.ENTREMIS_CPLUS.init(() => render());
  window.ENTREMIS_GROWTH.init(() => render());
  window.ENTREMIS_ACCESS.init(() => render());
  window.ENTREMIS_LIVE.init(() => render());
})();
