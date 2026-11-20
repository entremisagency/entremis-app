/* Entremis — lien avec Google Agenda.
   Passe par le connecteur « Google Calendar » de claude.ai (capacité « mcp » de la page publiée) :
   chaque personne utilise SON propre Google Agenda, avec ses propres identifiants. La page ne voit jamais de mot de passe.
   - lire : les événements des 7 prochains jours (list_events), rafraîchis toutes les 5 minutes ;
   - écrire : ajouter une tâche ou un rendez-vous à son agenda (create_event), seulement sur un clic.
   En aperçu local, il n'y a pas de connecteur : le bloc explique qu'il marche dans la version publiée. */
(function () {
  "use strict";
  const SERVER = "Google Calendar";
  const G = { state: "idle", events: [], error: null, storedAt: 0, unwatch: null, mcp: null, adding: {} };
  const EM = () => window.EM;
  const ON_KEY = "entremis-app-gcal-on";
  const remembered = () => { try { return localStorage.getItem(ON_KEY) === "1"; } catch (e) { return false; } };
  const remember = v => { try { v ? localStorage.setItem(ON_KEY, "1") : localStorage.removeItem(ON_KEY); } catch (e) {} };
  const hasRuntime = () => typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";

  // Heure locale sans fuseau ni « Z », comme le demande le connecteur
  const p2 = n => String(n).padStart(2, "0");
  const localIso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:00`;
  function range() { const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(e.getDate() + 7); return { startTime: localIso(s), endTime: localIso(e), orderBy: "startTime", pageSize: 25 }; }

  async function getMcp() {
    if (G.mcp) return G.mcp;
    if (!hasRuntime()) return null;
    try { G.mcp = await window.claude.use("mcp"); } catch (e) { G.mcp = null; }
    return G.mcp;
  }

  // Ce que chaque code d'erreur veut dire pour la personne, et ce qu'elle peut faire
  function explain(err) {
    const c = err && err.code;
    if (c === "server_not_connected" || c === "server_not_found") return { text: "Google Agenda n'est pas encore relié à votre compte Claude.", fix: "Ajoutez-le dans claude.ai › Réglages › Connecteurs, puis revenez ici." };
    if (c === "needs_reauth") return { text: "La connexion à Google Agenda a expiré.", fix: "Reconnectez-le dans claude.ai › Réglages › Connecteurs." };
    if (c === "approval_required" || c === "not_in_manifest" || c === "consent_required") return { text: "Il faut autoriser cette page à lire votre agenda.", fix: "", retry: true };
    if (c === "selection_required") return { text: "Vous avez plusieurs Google Agenda reliés.", fix: "Choisissez lequel utiliser dans la fenêtre que Claude affiche." };
    if (c === "blocked_by_policy") return { text: "Votre organisation bloque l'accès à Google Agenda ici.", fix: "" };
    if (c === "server_unavailable" || c === "rate_limited") return { text: "Google Agenda ne répond pas pour l'instant.", fix: "On réessaie tout seul dans quelques minutes.", retry: true };
    if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed") return { text: "Le lien avec Google Agenda n'est pas disponible dans cette vue.", fix: "Ouvrez la page dans claude.ai." };
    return { text: "Google Agenda a répondu par une erreur.", fix: err && err.message ? String(err.message).slice(0, 140) : "", retry: true };
  }

  function readEvents(result) {
    const p = result && result.payload;
    const list = p && Array.isArray(p.events) ? p.events : [];
    return list.filter(e => e && e.status !== "cancelled").map(e => ({
      id: e.id, title: e.summary || "(sans titre)", link: e.htmlLink || "", where: e.location || "",
      allDay: !!(e.start && e.start.date && !e.start.dateTime),
      start: (e.start && (e.start.dateTime || e.start.date)) || "", end: (e.end && (e.end.dateTime || e.end.date)) || ""
    }));
  }

  function startWatch() {
    if (!G.mcp || G.unwatch) return;
    G.state = "loading"; EM().render();
    G.unwatch = G.mcp.watchTool(SERVER, "list_events", range(), ev => {
      if (ev.type === "data") {
        G.events = readEvents(ev.result); G.error = null; G.state = "ready";
        G.storedAt = ev.result && ev.result.cache ? ev.result.cache.storedAt : Date.now();
      } else {
        const authz = ["needs_reauth", "server_not_connected", "blocked_by_policy", "approval_required", "not_in_manifest", "selection_required"];
        if (authz.includes(ev.error.code)) G.events = [];
        G.error = ev.error; G.state = G.events.length ? "ready" : "error";
      }
      EM().render();
    }, { refetchInterval: 300000, cache: { staleTime: 60000, gcTime: 600000 } });
  }

  // Premier branchement : un clic, qui fait un appel direct (c'est lui qui fait apparaître la demande d'autorisation)
  async function connect() {
    const mcp = await getMcp();
    if (!mcp) { G.state = "unavailable"; EM().render(); return; }
    G.state = "loading"; G.error = null; EM().render();
    try {
      const r = await mcp.callTool(SERVER, "list_events", range(), { cache: { staleTime: 60000, gcTime: 600000 } });
      G.events = readEvents(r); G.state = "ready"; G.storedAt = Date.now();
      remember(true); startWatch();
    } catch (err) { G.error = err; G.state = "error"; }
    EM().render();
  }

  function disconnect() {
    if (G.unwatch) { G.unwatch(); G.unwatch = null; }
    remember(false); G.events = []; G.state = "idle"; G.error = null; EM().render();
  }

  async function init() {
    if (!hasRuntime()) { G.state = "preview"; EM().render(); return; }
    if (remembered()) { const mcp = await getMcp(); if (mcp) startWatch(); else G.state = "unavailable"; EM().render(); }
  }

  /* ---------- Ajouter à Google Agenda (un clic = un appel, jamais rejoué tout seul) ---------- */
  async function add(key, input) {
    if (G.adding[key] === "busy" || G.adding[key] === "done") return;
    const mcp = await getMcp();
    if (!mcp) { EM().toast(hasRuntime() ? "Google Agenda n'est pas disponible dans cette vue." : "Aperçu local : l'ajout à Google Agenda marche dans la version publiée."); return; }
    G.adding[key] = "busy"; EM().render();
    try {
      const r = await mcp.callTool(SERVER, "create_event", input);
      G.adding[key] = "done";
      const link = r && r.payload && r.payload.htmlLink;
      window.ENTREMIS_TEAM.haptic("done");
      EM().toast("Ajouté à votre Google Agenda.");
      try { await mcp.invalidate(SERVER, "list_events"); } catch (e) {}
    } catch (err) {
      G.adding[key] = null;
      const amb = err && (err.code === "server_unavailable" || err.code === "upstream_error");
      EM().toast(amb ? "Pas de réponse de Google Agenda. Vérifiez votre agenda avant de réessayer, l'événement a peut-être été créé." : explain(err).text + (explain(err).fix ? " " + explain(err).fix : ""));
    }
    EM().render();
  }
  const nextDay = iso => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  function addTask(t) {
    if (!t.due) { EM().toast("Donnez une date à la tâche pour l'ajouter à l'agenda."); return; }
    const timed = /^\d{2}:\d{2}$/.test(t.time || ""), end = timed ? (() => { const [h, m] = t.time.split(":").map(Number), n = h * 60 + m + 30; return `${p2(Math.min(23, Math.floor(n / 60)))}:${p2(n >= 24 * 60 ? 59 : n % 60)}`; })() : "";
    return add("task:" + t.id, { summary: "Tâche Entremis : " + t.title, startTime: timed ? `${t.due}T${t.time}:00` : t.due + "T00:00:00", endTime: timed ? `${t.due}T${end}:00` : nextDay(t.due) + "T00:00:00", allDay: !timed,
      description: `Client : ${t.client || "Entremis"}\nCréée dans l'espace agence d'Entremis.`, availability: "AVAILABILITY_FREE" });
  }
  function addAppt(a, c) {
    return add("rdv:" + a.id, { summary: `${a.mode} – ${a.name} (${a.role})`, startTime: `${a.date}T${a.start}:00`, endTime: `${a.date}T${a.end}:00`,
      location: a.city, description: c.criteria.map(k => `${k.label} : ${a.criteria[k.key]}`).join("\n") + (a.note ? `\n\nLe mot de Richard : ${a.note}` : "") + "\n\nRendez-vous livré par Entremis." });
  }
  const addState = key => G.adding[key] || null;

  /* ---------- Le bloc « Mon agenda Google » ---------- */
  const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function dayLabel(iso) {
    const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso), t = new Date(); t.setHours(0, 0, 0, 0);
    const k = new Date(d); k.setHours(0, 0, 0, 0); const diff = Math.round((k - t) / 864e5);
    return diff === 0 ? "Aujourd'hui" : diff === 1 ? "Demain" : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const hhmm = iso => { const d = new Date(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  function panel() {
    const esc = EM().esc, icon = EM().icon;
    const head = `<div class="card-head"><h2 class="h2 h2-brand">${EM().brand("gcal", "Google Agenda")}Mon agenda Google</h2>${G.state === "ready" ? `<button class="link" type="button" data-gcal="off">Déconnecter</button>` : ""}</div>`;
    if (G.state === "preview") return `<section class="card gcal">${head}
      <div class="gcal-empty"><p>Disponible dans la version en ligne. Chacun relie son agenda.</p></div></section>`;
    if (G.state === "idle") return `<section class="card gcal">${head}
      <div class="gcal-empty"><p>Vos rendez-vous de la semaine, ici.</p>
      <button class="btn btn-ghost" type="button" data-gcal="on">${EM().brand("gcal", "Google Agenda")}Relier mon Google Agenda</button></div></section>`;
    if (G.state === "unavailable") return `<section class="card gcal">${head}<p class="body">Disponible dans la version en ligne.</p></section>`;
    if (G.state === "loading") return `<section class="card gcal">${head}${EM().loader("Lecture de votre agenda Google", "Les rendez-vous de la semaine")}</section>`;
    if (G.state === "error") {
      const x = explain(G.error);
      return `<section class="card gcal">${head}<div class="gcal-empty is-error">${icon("alert")}<p><b>${esc(x.text)}</b>${x.fix ? " " + esc(x.fix) : ""}</p>
        ${x.retry ? `<button class="btn btn-ghost" type="button" data-gcal="on">Réessayer</button>` : ""}</div></section>`;
    }
    // prêt
    const groups = [];
    G.events.forEach(e => { const k = e.start.slice(0, 10); let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(e); });
    const stale = G.error ? `<p class="kpi-note">${icon("info")} Dernière mise à jour à ${hhmm(new Date(G.storedAt).toISOString())}. ${esc(explain(G.error).text)}</p>` : "";
    return `<section class="card gcal">${head}${stale}
      ${groups.length ? groups.map(g => `<p class="day-sep">${dayLabel(g.k)}</p><ul class="gcal-list">${g.items.map(e => `<li>
        <time class="tabnum">${e.allDay ? "Journée" : `<b>${hhmm(e.start)}</b>${hhmm(e.end)}`}</time>
        <div><b>${esc(e.title)}</b>${e.where ? `<span>${esc(e.where)}</span>` : ""}</div>
        ${e.link ? `<a class="icon-btn" href="${esc(e.link)}" target="_blank" rel="noopener" aria-label="Ouvrir dans Google Agenda : ${esc(e.title)}">${icon("arrow")}</a>` : ""}
      </li>`).join("")}</ul>`).join("") : `<p class="body">Rien dans votre agenda pour les 7 prochains jours.</p>`}
    </section>`;
  }

  function onClick(e) {
    const t = e.target.closest("[data-gcal],[data-gcal-task],[data-gcal-rdv]");
    if (!t) return false;
    if (t.dataset.gcal === "on") { connect(); return true; }
    if (t.dataset.gcal === "off") { disconnect(); return true; }
    if (t.dataset.gcalTask) { const task = window.ENTREMIS_TEAM.T.list.find(x => x.id === t.dataset.gcalTask); if (task) addTask(task); return true; }
    if (t.dataset.gcalRdv) { const c = EM().C(); const a = c.appointments.find(x => x.id === t.dataset.gcalRdv); if (a) addAppt(a, c); return true; }
    return false;
  }

  window.ENTREMIS_GCAL = { init, panel, onClick, addState, addTask };
})();
