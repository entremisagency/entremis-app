/* Entremis — espace équipe (les trois fondateurs) et notifications.
   Écrans : #equipe (mon portail) – #taches (tableau partagé) – #clients – #avancement – #notifications – #reglages
   Les tâches vivent dans la base partagée de la page publiée (capacité « db ») : Marc, Richard et Gianni voient la même liste.
   Sans base (aperçu local), on montre les tâches d'exemple de data.js, gardées dans ce navigateur seulement. */
(function () {
  "use strict";
  const TEAM_ROUTES = ["equipe", "taches", "clients", "pipeline", "avancement"];
  const SHARED_ROUTES = ["notifications", "reglages"];

  /* ---------- Tâches : stockage ---------- */
  const T = { list: [], source: "local", db: null, ready: false };
  /* Photos de profil : dans la page publiée, l'image va dans le stockage de fichiers de la page (capacité « assets »)
     et son identifiant dans la base (collection « profiles », un document par fondateur). En local : gardée dans ce navigateur. */
  const P = { photos: {}, busy: false };
  try { P.photos = JSON.parse(localStorage.getItem("entremis-app-photos") || "{}"); } catch (e) {}
  const photoUrl = id => { const p = P.photos[id]; return !p ? "" : p.asset ? "/_blob/" + p.asset : p.data || ""; };
  const LS_KEY = "entremis-app-tasks";
  function loadLocal() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return window.ENTREMIS_DATA.team.tasks.map(t => Object.assign({}, t));
  }
  function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(T.list)); } catch (e) {} }

  async function initTasks(onChange) {
    const hasRuntime = typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";
    if (!hasRuntime) { T.list = loadLocal(); T.source = "local"; T.ready = true; onChange(); return; }
    T.source = "loading"; onChange();
    let settled = false;
    const fallback = setTimeout(() => { if (!settled) { settled = true; T.list = loadLocal(); T.source = "local"; T.ready = true; onChange(); } }, 10000);
    try {
      const db = await window.claude.use("db");
      if (settled) return;
      if (!db) { settled = true; clearTimeout(fallback); T.list = loadLocal(); T.source = "local"; T.ready = true; onChange(); return; }
      T.db = db;
      db.collection("profiles").onSnapshot(snap => {
        snap.docs.forEach(d => { const v = d.data() || {}; if (v.asset) P.photos[d.id] = { asset: v.asset }; else delete P.photos[d.id]; });
        onChange();
      }, () => {});
      db.collection("tasks").onSnapshot(snap => {
        settled = true; clearTimeout(fallback);
        T.list = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        T.source = "db"; T.ready = true; onChange();
      }, () => {
        if (!settled) { settled = true; clearTimeout(fallback); T.list = loadLocal(); T.source = "local"; T.ready = true; onChange(); }
      });
    } catch (e) {
      if (!settled) { settled = true; clearTimeout(fallback); T.list = loadLocal(); T.source = "local"; T.ready = true; onChange(); }
    }
  }
  function clean(task) { const o = Object.assign({}, task); delete o.id; Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o; }
  async function putTask(task) {
    const i = T.list.findIndex(t => t.id === task.id);
    if (i >= 0) T.list[i] = task; else T.list.push(task);
    if (T.source === "db") { try { await T.db.collection("tasks").doc(task.id).set(clean(task)); } catch (e) { EM().toast("Pas enregistré : la base n'a pas répondu. Réessayez."); } }
    else saveLocal();
  }
  async function removeTask(id) {
    T.list = T.list.filter(t => t.id !== id);
    if (T.source === "db") { try { await T.db.collection("tasks").doc(id).delete(); } catch (e) { EM().toast("Pas supprimé : la base n'a pas répondu. Réessayez."); } }
    else saveLocal();
  }

  /* ---------- Outils ---------- */
  const EM = () => window.EM;
  const TD = () => window.ENTREMIS_DATA.team;
  const member = id => TD().members.find(m => m.id === id) || { id, name: "?", initials: "?" };
  const todayIso = () => window.ENTREMIS_DATA.today.iso;
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function shortDate(iso) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; }
  function whenDone(iso) {
    if (!iso) return "";
    const day = iso.slice(0, 10), time = iso.slice(11, 16);
    const yest = (() => { const x = new Date(todayIso() + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); })();
    const label = day === todayIso() ? "aujourd'hui" : day === yest ? "hier" : shortDate(day);
    return time ? `${label} à ${time}` : label;
  }
  function nowIso() { const n = new Date(); const p = x => String(x).padStart(2, "0"); return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`; }
  const isLate = t => t.status !== "done" && t.due && t.due < todayIso();
  const isToday = t => t.status !== "done" && t.due === todayIso();
  // Lundi de la semaine en cours (pour « fait cette semaine »)
  const weekStart = () => { const x = new Date(todayIso() + "T12:00:00Z"); const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return x.toISOString().slice(0, 10); };
  const doneThisWeek = t => t.status === "done" && t.doneAt && t.doneAt.slice(0, 10) >= weekStart();

  /* Vibration courte : Android et la plupart des navigateurs de bureau tactiles. Safari sur iPhone ne la permet pas. */
  function haptic(kind) {
    const p = { tap: 10, done: [12, 40, 18], warn: [30, 60, 30] }[kind] || 10;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }

  const av = (id, cls = "av av-md") => {
    const m = member(id), src = photoUrl(m.id);
    return `<span class="${cls} av-${m.id}${src ? " has-photo" : ""}" title="${m.name}">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ""}<em>${m.initials}</em></span>`;
  };
  const PACE = { ahead: ["En avance", "ok"], ontrack: ["Dans les temps", "info"], late: ["En retard", "danger"] };
  const tone = (label, kind) => `<span class="state state-${kind}">${label}</span>`;

  function dueChip(t) {
    if (t.status === "done") return "";
    if (isLate(t)) return tone(`En retard – ${shortDate(t.due)}`, "danger");
    if (isToday(t)) return tone("Aujourd'hui", "warn");
    return t.due ? `<span class="due">${shortDate(t.due)}${t.time ? " – " + t.time : ""}</span>` : "";
  }

  /* Une tâche (la même ligne partout). Glisser vers la droite = terminer, vers la gauche = supprimer. */
  function taskRow(t, opts = {}) {
    const done = t.status === "done";
    return `<li class="task${done ? " is-done" : ""}${isLate(t) ? " is-late" : ""}" data-task="${t.id}">
      <div class="task-under" aria-hidden="true"><span class="u-done">${EM().icon("check")}Terminer</span><span class="u-del">${EM().icon("trash")}Supprimer</span></div>
      <div class="task-body">
        <button class="tick" type="button" data-task-toggle="${t.id}" aria-label="${done ? "Rouvrir" : "Terminer"} : ${EM().esc(t.title)}" aria-pressed="${done}">${EM().icon("check")}</button>
        <div class="task-text" data-task-open="${t.id}" role="button" tabindex="0" aria-label="Ouvrir : ${EM().esc(t.title)}">
          <b>${EM().esc(t.title)}</b>
          <span>${opts.showWho ? `${member(t.who).name} – ` : ""}${EM().esc(t.client || "")}${t.status === "doing" ? " – en cours" : ""}${done && t.doneAt ? ` – fait ${whenDone(t.doneAt)}` : ""}</span>
        </div>
        ${dueChip(t)}
        <div class="task-acts">
          ${!done && t.due ? (() => { const st = window.ENTREMIS_GCAL.addState("task:" + t.id); return `<button class="icon-btn task-cal${st === "done" ? " is-done" : ""}" type="button" data-gcal-task="${t.id}" ${st ? "disabled" : ""} aria-label="${st === "done" ? "Dans votre Google Agenda" : "Ajouter à mon Google Agenda"} : ${EM().esc(t.title)}" title="${st === "done" ? "Dans votre Google Agenda" : "Ajouter à mon Google Agenda"}">${st === "done" ? EM().icon("check") : EM().brand("gcal", "Google Agenda")}</button>`; })() : ""}
          <button class="icon-btn task-del" type="button" data-task-del="${t.id}" aria-label="Supprimer : ${EM().esc(t.title)}">${EM().icon("trash")}</button>
        </div>
      </div>
    </li>`;
  }

  function loadingBlock(text) { return EM().loader(text, "Les tâches de toute l'équipe"); }

  /* ---------- Formulaire « Nouvelle tâche » (feuille qui monte sur téléphone) ---------- */
  function taskSheet(S) {
    if (!S.taskForm) return "";
    const ed = S.taskEdit ? T.list.find(x => x.id === S.taskEdit) : null, esc = EM().esc, icon = EM().icon;
    const ms = TD().members, cl = [...new Set(["Entremis"].concat(TD().clients.map(c => c.name), S.ctxClient ? [S.ctxClient] : [], ed && ed.client ? [ed.client] : []))];
    const curClient = ed ? ed.client : S.ctxClient, curWho = ed ? ed.who : S.who;
    const fiche = ed && (TD().clients.find(c => c.name === ed.client) || TD().pipeline.find(p => p.name === ed.client));
    return `<div class="scrim" data-act="close-task"></div>
    <form class="sheet" id="task-form" aria-label="${ed ? "La tâche" : "Nouvelle tâche"}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-act="close-task">${ed ? "Fermer" : "Annuler"}</button><b>${ed ? "La tâche" : "Nouvelle tâche"}</b><button class="link strong" type="submit">${ed ? "Enregistrer" : "Ajouter"}</button></div>
      ${ed ? `<div class="task-status">${ed.status === "done" ? `<span class="state state-ok">Faite</span><span>par ${member(ed.who).name}${ed.doneAt ? ", " + whenDone(ed.doneAt) : ""}</span>` : isLate(ed) ? `<span class="state state-danger">En retard</span><span>prévue le ${shortDate(ed.due)}</span>` : `<span class="state state-info">À faire</span><span>${ed.due ? "pour le " + shortDate(ed.due) : "sans date"}</span>`}</div>` : ""}
      <label class="field"><span>Quoi</span><input id="task-title" name="title" required maxlength="120" placeholder="Ex. Rappeler les demandes solaires de Vannes" value="${ed ? esc(ed.title) : ""}"></label>
      <fieldset class="field"><legend>Pour qui</legend><div class="who-pick">${ms.map(m => `<label><input type="radio" name="who" value="${m.id}" ${m.id === curWho ? "checked" : ""}>${av(m.id, "av")}<span>${m.name}</span></label>`).join("")}</div></fieldset>
      <div class="field-row">
        <label class="field"><span>Client</span><select id="task-client" name="client">${cl.map(c => `<option ${c === curClient ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label class="field"><span>Pour le</span><input id="task-due" name="due" type="date" value="${ed ? (ed.due || "") : todayIso()}"></label>
        <label class="field"><span>À</span><input id="task-time" name="time" type="time" value="${ed ? (ed.time || "") : ""}"></label>
      </div>
      ${ed ? `<div class="task-sheet-acts">
        <button class="btn btn-ghost" type="button" data-task-toggle="${ed.id}">${icon("check")}${ed.status === "done" ? "Rouvrir" : "Marquer faite"}</button>
        ${fiche ? `<a class="btn btn-ghost" href="#fiche-${fiche.id}">${icon("building")}Fiche ${esc(ed.client)}</a>` : ""}
        <button class="btn btn-ghost pr-danger" type="button" data-task-del="${ed.id}">${icon("trash")}Supprimer</button>
      </div>` : ""}
      ${ed ? "" : `<label class="check-line"><input type="checkbox" name="gcal" ${(() => { try { return localStorage.getItem("entremis-app-gcal-on") === "1" ? "checked" : ""; } catch (e) { return ""; } })()}><span>Ajouter aussi à mon Google Agenda</span></label>`}
    </form>`;
  }

  /* ---------- Écran : mon portail ---------- */
  function viewPortal(S) {
    const me = member(S.who), esc = EM().esc, icon = EM().icon;
    const mine = T.list.filter(t => t.who === me.id && t.status !== "done").sort(byUrgency);
    const myClients = TD().clients.filter(c => c.owner === me.id);
    const late = T.list.filter(isLate);
    const reps = TD().replacements.filter(r => r.status === "searching");
    const weekDone = T.list.filter(doneThisWeek);
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Bonjour ${esc(me.name)}</h1><p class="sub">${window.ENTREMIS_DATA.today.label.charAt(0).toUpperCase() + window.ENTREMIS_DATA.today.label.slice(1)} – ${esc(me.role)}</p></div>
      <div class="head-actions">${EM().sampleTag}<button class="btn btn-primary" type="button" data-act="new-task">${icon("plus")}Nouvelle tâche</button></div>
    </div>

    <div class="kpis kpis-4" role="list">
      ${kpi("Mes tâches ouvertes", mine.length, `${mine.filter(isLate).length} en retard`, mine.filter(isLate).length ? "danger" : "")}
      ${kpi("Faites par l'équipe cette semaine", weekDone.length, TD().members.map(m => `${m.name} ${weekDone.filter(t => t.who === m.id).length}`).join(" – "))}
      ${kpi("Remplacements à trouver", reps.length, reps.length ? "à placer sous 5 jours" : "rien en attente", reps.length ? "warn" : "ok")}
      ${kpi("Livrés cette semaine", TD().weekly[TD().weekly.length - 1].value, "RDV, appels et devis")}
    </div>
    ${window.ENTREMIS_OPS.quickCreate()}

    <div class="home-main">
      <div class="fcol">
      <section class="card">
        <div class="card-head"><h2 class="h2">Mes tâches</h2><a class="link" href="#taches">Tableau de l'équipe ${icon("arrow")}</a></div>
        ${!T.ready ? loadingBlock("Chargement des tâches") : mine.length ? `<ul class="tasks">${mine.map(t => taskRow(t)).join("")}</ul>` : emptyTasks("Rien à faire pour vous. Ajoutez une tâche ou prenez-en une à l'équipe.")}
      </section>
        <section class="card">
          <div class="card-head"><h2 class="h2">Mes clients</h2><span class="muted tabnum">${myClients.length}</span></div>
          ${myClients.length ? `<div class="list">${myClients.map(clientRow).join("")}</div>` : `<p class="body">Aucun client suivi.</p>`}
        </section>
      </div>
      <div class="fcol">
        ${window.ENTREMIS_LEADS.queueCard()}
        ${window.ENTREMIS_GCAL.panel()}
        <section class="card">
          <div class="card-head"><h2 class="h2">À surveiller</h2></div>
          <ul class="alerts">
            ${late.map(t => `<li>${tone("En retard", "danger")}<a href="#taches"><b>${esc(t.title)}</b><span>${member(t.who).name} – prévu le ${shortDate(t.due)}</span></a></li>`).join("")}
            ${reps.map(r => `<li>${tone("Remplacement", "warn")}<a href="#clients"><b>${esc(r.client)}</b><span>${esc(r.person)} – avant le ${esc(r.due)}</span></a></li>`).join("")}
            ${TD().clients.filter(c => c.pace === "late").map(c => `<li>${tone("Objectif", "danger")}<a href="#clients"><b>${esc(c.name)}</b><span>${c.done} / ${c.target} au jour ${c.day} sur ${c.days}</span></a></li>`).join("")}
            ${!late.length && !reps.length ? `<li class="muted">Rien d'urgent.</li>` : ""}
          </ul>
        </section>

      </div>
    </div>`;
  }
  const byUrgency = (a, b) => (isLate(b) - isLate(a)) || ((a.due || "9") < (b.due || "9") ? -1 : 1);
  function kpi(label, value, note, kind) {
    return `<article class="kpi" role="listitem"><p class="kpi-label">${label}</p><div><p class="kpi-value${kind ? " v-" + kind : ""}">${value}</p><p class="kpi-note">${EM().esc(note)}</p></div></article>`;
  }
  function emptyTasks(text) { return `<div class="empty">${EM().icon("check")}<p>${text}</p><button class="btn btn-ghost" type="button" data-act="new-task">${EM().icon("plus")}Nouvelle tâche</button></div>`; }
  function clientRow(c) {
    const p = PACE[c.pace];
    return `<a class="row row-client" href="#fiche-${c.id}">
      <span class="who"><b>${EM().esc(c.name)}</b><span>${EM().esc(c.trade)} – ${c.done} / ${c.target}</span></span>
      <span class="mini-bar" aria-hidden="true"><i style="--p:${Math.round(c.done / c.target * 100)}%"></i></span>
      ${tone(p[0], p[1])}
    </a>`;
  }

  /* ---------- Écran : tableau des tâches (tout le monde voit tout) ---------- */
  function viewTasks(S) {
    const esc = EM().esc, icon = EM().icon, narrow = EM().isNarrow();
    const ms = TD().members;
    const open = T.list.filter(t => t.status !== "done");
    const done = T.list.filter(t => t.status === "done").sort((a, b) => (b.doneAt || "") < (a.doneAt || "") ? -1 : 1);
    const journalWho = S.journalWho || "all";
    const journal = done.filter(t => journalWho === "all" || t.who === journalWho).slice(0, 12);
    const col = m => {
      const list = open.filter(t => t.who === m.id).sort(byUrgency);
      return `<section class="col" aria-label="Tâches de ${m.name}">
        <header class="col-head">${av(m.id, "av av-lg")}<div><b>${m.name}</b><span>${EM().esc(m.role)}</span></div></header>
        <dl class="col-stats"><div><dt>À faire</dt><dd>${list.length}</dd></div><div><dt>En retard</dt><dd class="${list.filter(isLate).length ? "t-danger" : ""}">${list.filter(isLate).length}</dd></div><div><dt>Faites</dt><dd>${T.list.filter(t => t.who === m.id && doneThisWeek(t)).length}</dd></div></dl>
        ${list.length ? `<ul class="tasks">${list.map(t => taskRow(t)).join("")}</ul>` : `<p class="col-empty">Rien en cours.</p>`}
      </section>`;
    };
    const mWho = S.boardWho || S.who;
    const syncNote = T.source === "db" ? `${icon("users")}Partagé avec l'équipe` : T.source === "loading" ? "Connexion…" : `${icon("info")}Exemple, gardé dans ce navigateur`;
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Tâches de l'équipe</h1><p class="sub">À faire, et déjà fait.</p></div>
      <div class="head-actions"><span class="sample sync">${syncNote}</span><button class="btn btn-primary" type="button" data-act="new-task">${icon("plus")}Nouvelle tâche</button></div>
    </div>

    ${!T.ready ? loadingBlock("Chargement des tâches") : !T.list.length ? `<section class="card">${emptyTasks("Aucune tâche pour l'instant. La première que vous ajoutez sera visible par Marc, Richard et Gianni.")}</section>` : narrow ? `
      <div class="seg seg-lg seg-full" role="group" aria-label="Personne">${ms.map(m => `<button type="button" data-board-who="${m.id}" aria-pressed="${mWho === m.id}">${m.name}</button>`).join("")}</div>
      ${col(member(mWho))}` : `<div class="board">${ms.map(col).join("")}</div>`}

    <section class="card">
      <div class="card-head"><h2 class="h2">Qui a fait quoi</h2>
        ${EM().fsel("journal", "Qui", [["all", "Tout le monde"]].concat(ms.map(m => [m.id, m.name])), journalWho)}
      </div>
      ${journal.length ? `<ol class="journal">${journal.map(t => `<li class="journal-row" data-task-open="${t.id}" role="button" tabindex="0">${av(t.who, "av")}<p><b>${member(t.who).name}</b> a terminé « ${esc(t.title)} »<span>${esc(t.client || "")} – ${whenDone(t.doneAt)}</span></p><button class="link" type="button" data-task-toggle="${t.id}">Rouvrir</button></li>`).join("")}</ol>` : `<p class="body">Rien de terminé pour l'instant.</p>`}
    </section>
    ${taskSheet(S)}`;
  }

  /* ---------- Écran : clients (installateurs) ---------- */
  function viewClients(S) {
    const esc = EM().esc, icon = EM().icon;
    const cs = TD().clients;
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Clients</h1><p class="sub">Les installateurs qui achètent nos leads.</p></div>
      <div class="head-actions">${EM().sampleTag}</div>
    </div>
    <div class="kpis kpis-4" role="list">
      ${kpi("Campagnes en cours", cs.length, `${cs.filter(c => c.pace === "late").length} en retard`)}
      ${kpi("Livrés sur les campagnes", cs.reduce((a, c) => a + c.done, 0), `sur ${cs.reduce((a, c) => a + c.target, 0)} promis`)}
      ${kpi("Absences à remplacer", TD().replacements.filter(r => r.status === "searching").length, "garantis ou remplacés", "warn")}
      ${kpi("Leads ce mois-ci", TD().trades.reduce((a, t) => a + t.value, 0).toLocaleString("fr-FR"), "donnés à ces clients")}
    </div>
    <section class="card guide-flow">
      <div class="card-head"><h2 class="h2">Comment on lance un nouveau client</h2></div>
      ${EM().nodeFlow([
        { icon: "check", title: "Signé", text: "Son métier fixe le parcours : RDV, transfert ou devis.", rows: [["Signés ce mois-ci", String(TD().pipeline.filter(p => p.stage === "won").length)]] },
        { icon: "signal", title: "Campagne en place", text: "Marc lance les publicités.", rows: [["Délai", "2 jours"]] },
        { icon: "inbox", title: "Premiers leads", text: "On rappelle et on vérifie 4 critères.", rows: [["À attribuer", String(window.ENTREMIS_LEADS.list().filter(l => !l.to && l.status !== "perdu").length)]] },
        { icon: "cal", title: "Première livraison", text: "RDV, appel ou devis, selon son parcours.", rows: [["Objectif", "sous 7 jours", "ok"], ["Sinon", "on l'appelle", "bad"]] }
      ], "Comment on lance un nouveau client")}
    </section>
    ${window.ENTREMIS_SECTORS.campSection(S, list => `<table class="table">
        <thead><tr><th>Installateur</th><th>Objectif</th><th>Rythme</th><th>Suivi par</th><th>Prochain</th><th></th></tr></thead>
        <tbody>${list.map(c => `<tr>
          <td class="org"><a class="org-link" href="#fiche-${c.id}"><b>${esc(c.name)}</b></a><span>${esc(c.trade)}</span></td>
          <td><div class="goal-cell"><span class="tabnum"><b>${c.done}</b> / ${c.target}</span><span class="mini-bar"><i style="--p:${Math.round(c.done / c.target * 100)}%"></i></span><span class="muted">jour ${c.day} / ${c.days}</span></div></td>
          <td><div class="tones">${tone(PACE[c.pace][0], PACE[c.pace][1])}${c.absences ? tone(c.absences + " absence", "warn") : ""}</div></td>
          <td class="hide-m"><span class="who-inline">${av(c.owner, "av")}${member(c.owner).name}</span></td>
          <td class="hide-m body">${esc(c.next)}</td>
          <td class="hide-m"><a class="link" href="#fiche-${c.id}">Fiche ${icon("arrow")}</a></td>
        </tr>`).join("")}</tbody>
      </table>`)}
    <section class="card">
      <div class="card-head"><h2 class="h2">Remplacements</h2></div>
      <ul class="alerts">${TD().replacements.map(r => `<li>${r.status === "placed" ? tone("Placé", "ok") : tone("À trouver", "warn")}<div><b>${esc(r.client)}</b><span>${esc(r.person)} – signalé le ${esc(r.reported)}${r.status === "placed" ? ` – remplacé par ${esc(r.by)}` : ` – avant le ${esc(r.due)}`}</span></div>${av(r.owner, "av")}</li>`).join("")}</ul>
    </section>`;
  }


  /* ---------- Écran : nouveaux clients à signer ---------- */
  const STAGES = [["lead", "À contacter"], ["call", "Appel fait"], ["quote", "Devis envoyé"], ["won", "Signé"]];
  let PIPE = null;
  const pipe = () => PIPE || (PIPE = TD().pipeline.map(p => Object.assign({}, p)));
  const euros = n => n.toLocaleString("fr-FR") + " €";
  function viewPipeline(S) {
    const esc = EM().esc, icon = EM().icon, narrow = EM().isNarrow();
    const list = pipe();
    const open = list.filter(p => p.stage !== "won");
    const stageSel = S.pipeStage || "lead";
    const card = p => {
      const i = STAGES.findIndex(s => s[0] === p.stage);
      const tel = (p.phone || "04 00 00 00 0" + (list.indexOf(p) % 10)).replace(/\s/g, "");
      return `<li class="deal">
        <div class="deal-top"><a class="deal-name" href="#fiche-${p.id}">${esc(p.name)}</a><span class="deal-val tabnum">${euros(p.value)}</span></div>
        <span class="deal-sub">${esc(p.trade)} – ${esc(p.city)}</span>
        <span class="deal-next">${icon("clock")}${esc(p.next)}</span>
        <div class="deal-foot"><span class="who-inline">${av(p.owner, "av")}${member(p.owner).name}</span>
          <span class="deal-acts"><a class="icon-btn" href="tel:${tel}" aria-label="Appeler ${esc(p.name)}">${icon("phone")}</a>${p.stage !== "won" ? `<a class="icon-btn" href="#propositions" data-prop-for="${p.id}" aria-label="Faire une proposition à ${esc(p.name)}" title="Proposition">${icon("euro")}</a>` : ""}
          ${i < STAGES.length - 1 ? `<button class="btn btn-ghost btn-xs" type="button" data-deal="${p.id}" aria-label="Passer ${esc(p.name)} à : ${STAGES[i + 1][1]}">${STAGES[i + 1][1]} ${icon("arrow")}</button>` : tone("Client", "ok")}</span></div>
      </li>`;
    };
    const column = ([k, l]) => {
      const items = list.filter(p => p.stage === k);
      return `<section class="stage" aria-label="${l}"><header><b>${l}</b><span class="tabnum">${items.length} – ${euros(items.reduce((a, p) => a + p.value, 0))}</span></header>
        ${items.length ? `<ul class="deals">${items.map(card).join("")}</ul>` : `<p class="col-empty">Personne à cette étape.</p>`}</section>`;
    };
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Prospection</h1><p class="sub">Les installateurs à signer, étape par étape. Notez chaque appel dans <a class="link" href="#appels">Appels</a>.</p></div>
      <div class="head-actions">${EM().sampleTag}</div>
    </div>
    <div class="kpis kpis-4" role="list">
      ${kpi("En discussion", open.length, "installateurs")}
      ${kpi("Potentiel par mois", euros(open.reduce((a, p) => a + p.value, 0)), "si tout est signé")}
      ${kpi("Devis envoyés", list.filter(p => p.stage === "quote").length, "réponse à suivre", "warn")}
      ${kpi("Signés ce mois-ci", list.filter(p => p.stage === "won").length, euros(list.filter(p => p.stage === "won").reduce((a, p) => a + p.value, 0)) + " par mois", "ok")}
    </div>
    ${narrow ? `<div class="seg seg-lg seg-full seg-4" role="group" aria-label="Étape">${STAGES.map(([k, l]) => `<button type="button" data-pipe-stage="${k}" aria-pressed="${stageSel === k}">${l}</button>`).join("")}</div>
      ${column(STAGES.find(s => s[0] === stageSel))}` : `<div class="pipeline">${STAGES.map(column).join("")}</div>`}
    <p class="kpi-note">Montants d'exemple.</p>
    ${window.ENTREMIS_GROWTH.prospectExtras()}`;
  }

  /* ---------- Écran : avancement ---------- */
  function viewProgress() {
    const esc = EM().esc;
    const w = TD().weekly, max = Math.max(...w.map(x => x.value)), top = Math.ceil(max / 5) * 5;
    const H = 160, BW = 100 / w.length;
    // Colonnes au sommet arrondi : un rectangle arrondi + un carré qui remplit le bas, pour un pied droit posé sur la ligne de base
    const bars = w.map((x, i) => {
      const h = Math.max(20, Math.round(x.value / top * H)), y = H - h + 24, cls = x.current ? "cb-now" : "cb";
      return `<g class="cbar"><title>Semaine du ${esc(x.label)} : ${x.value} rendez-vous livrés${x.current ? " (en cours)" : ""}</title>
        <rect x="${i * BW + BW * 0.24}%" y="${y}" width="${BW * 0.52}%" height="${h}" rx="18" class="${cls}"></rect>
        <rect x="${i * BW + BW * 0.24}%" y="${y + h - 18}" width="${BW * 0.52}%" height="18" class="${cls}"></rect>
        <text x="${i * BW + BW / 2}%" y="${y - 8}" text-anchor="middle" class="bar-val">${x.value}</text>
        <text x="${i * BW + BW / 2}%" y="${H + 46}" text-anchor="middle" class="bar-lab">${esc(x.label)}</text></g>`;
    }).join("");
    const trades = TD().trades, tmax = Math.max(...trades.map(t => t.value));
    const weekDone = T.list.filter(doneThisWeek);
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Avancement</h1><p class="sub">Semaine après semaine.</p></div>
      <div class="head-actions">${EM().sampleTag}</div>
    </div>
    <div class="home-main">
      <section class="card">
        <div class="card-head"><h2 class="h2">Livrés par semaine</h2><span class="muted">rendez-vous</span></div>
        <svg class="chart" width="100%" height="${H + 56}" role="img" aria-label="Livrés par semaine : ${w.map(x => x.label + " " + x.value).join(", ")}">
          <line x1="0%" x2="100%" y1="${H + 24}" y2="${H + 24}" class="grid"></line>
          ${bars}
        </svg>
        <p class="kpi-note">La semaine en cours, en noir, est encore ouverte.</p>
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h2">Objectifs du mois</h2></div>
        <ul class="goal-rings">${TD().goals.map(g => { const p = Math.round(g.done / g.target * 100); return `<li>${EM().tickRing(p, `${g.done}<small>/${g.target}</small>`)}<b>${esc(g.label)}</b></li>`; }).join("")}</ul>
      </section>
    </div>
    <div class="home-main">
      <section class="card">
        <div class="card-head"><h2 class="h2">Cette semaine, par personne</h2></div>
        <div class="people people-plain">${TD().members.map(m => `<article class="person">${av(m.id, "av av-lg")}<div><b>${m.name}</b><span>${esc(m.role)}</span></div>
          <dl><div><dt>Tâches faites</dt><dd class="t-ok">${weekDone.filter(t => t.who === m.id).length}</dd></div>${TD().perPerson[m.id].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></article>`).join("")}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h2">Demandes par métier</h2><span class="muted">ce mois-ci</span></div>
        ${waffle(trades)}
      </section>
    </div>
    ${window.ENTREMIS_GROWTH.goals()}`;
  }

  /* Grille de 100 points : un point = 1 % des demandes. Une seule teinte, du plus foncé (le plus gros métier) au plus clair. */
  function waffle(items) {
    const total = items.reduce((a, x) => a + x.value, 0);
    const raw = items.map(x => x.value / total * 100), n = raw.map(Math.floor);
    let left = 100 - n.reduce((a, x) => a + x, 0);
    raw.map((r, i) => [r - n[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => n[i]++);
    const dots = n.flatMap((k, i) => Array.from({ length: k }, () => i));
    return `<div class="waffle">
      <div class="waffle-grid" role="img" aria-label="${items.map((x, i) => `${x.label} ${n[i]} %`).join(", ")}">${dots.map(i => `<i class="s${i}" title="${EM().esc(items[i].label)} : ${n[i]} %"></i>`).join("")}</div>
      <ul class="waffle-legend">${items.map((x, i) => `<li><i class="s${i}"></i><span>${EM().esc(x.label)}</span><b class="tabnum">${n[i]} %</b><small class="tabnum">${x.value.toLocaleString("fr-FR")}</small></li>`).join("")}</ul>
    </div>`;
  }

  /* ---------- Notifications : la liste et les réglages ---------- */
  const NOTIFS = {
    team: [
      { id: "n1", kind: "danger", icon: "alert", text: "Tâche en retard : « Rappeler les 18 demandes solaires sans réponse »", who: "Gianni", at: "aujourd'hui 08:00", day: "Aujourd'hui", act: { label: "Voir la tâche", task: "Rappeler les 18 demandes solaires sans réponse" } },
      { id: "n6", kind: "warn", icon: "euro", text: "Facture F-2026-034 de Blindex Lyon : à payer avant le 25 nov.", who: "", at: "aujourd'hui 09:00", day: "Aujourd'hui", act: { label: "Relancer", doc: "F-2026-034" } },
      { id: "n2", kind: "warn", icon: "swap", text: "Absence signalée par Éco Toit Bretagne : Gaëlle Le Goff", who: "Richard", at: "hier 18:12", day: "Hier", act: { label: "Trouver un remplaçant", href: "#clients" } },
      { id: "n7", kind: "info", icon: "euro", text: "Devis D-2026-018 envoyé à Énergie Plus Rennes : pas encore de réponse", who: "", at: "hier 10:00", day: "Hier", act: { label: "Relancer", doc: "D-2026-018" } },
      { id: "n3", kind: "ok", icon: "check", text: "Richard a placé Claire Fontaine en remplacement chez Solaria Habitat", who: "Richard", at: "hier 09:30", day: "Hier", act: { label: "Voir la fiche", href: "#fiche-solaria" } },
      { id: "n4", kind: "info", icon: "user", text: "Richard vous a confié « Envoyer le bilan de semaine à Solaria Habitat »", who: "Richard", at: "hier 08:45", day: "Hier", act: { label: "Voir la tâche", task: "Envoyer le bilan de semaine à Solaria Habitat" } },
      { id: "n5", kind: "info", icon: "cal", text: "Nouveau rendez-vous chez Solaria Habitat : Hugo Lambert, jeudi 15:00", who: "", at: "18 nov.", day: "Plus tôt", act: { label: "Voir la fiche", href: "#fiche-solaria" } }
    ],
    client: [
      { id: "c1", kind: "info", icon: "cal", text: "Nouveau rendez-vous : Hugo Lambert, panneaux solaires, aujourd'hui 15:00", at: "hier 17:02", day: "Hier", act: { label: "Voir le RDV", href: "#rdv-hugo-lambert" } },
      { id: "c2", kind: "ok", icon: "swap", text: "Remplacement placé : Claire Fontaine remplace Paul Girard, aujourd'hui 11:30", at: "hier 09:30", day: "Hier", act: { label: "Voir le RDV", href: "#rdv-claire-fontaine" } },
      { id: "c3", kind: "warn", icon: "clock", text: "Rappel : visite technique chez Karim Benali demain à 08:30", at: "18 nov.", day: "Plus tôt", act: { label: "Voir le RDV", href: "#rdv-karim-benali" } },
      { id: "c4", kind: "info", icon: "chart", text: "Votre bilan de la semaine est prêt : 3 rendez-vous livrés", at: "16 nov.", day: "Plus tôt", act: { label: "Voir le bilan", href: "#accueil" } }
    ]
  };
  const PREF_EVENTS = {
    team: [["task-mine", "Tâche pour moi"], ["task-late", "Tâche en retard"], ["absence", "Absence signalée"], ["rdv", "RDV placé"], ["morning", "Résumé à 8 h"]],
    client: [["rdv", "Nouveau RDV"], ["remind", "Rappel la veille"], ["replace", "Remplacement placé"], ["weekly", "Bilan du vendredi"]]
  };
  const CHANNELS = [["app", "Dans l'app"], ["mail", "E-mail"], ["sms", "SMS"]];
  function prefs(space) {
    const def = {}; PREF_EVENTS[space].forEach(([k], i) => { def[k] = { app: true, mail: i < 2, sms: i === 0 }; });
    def.quiet = true;
    try { const raw = localStorage.getItem("entremis-app-notif-" + space); if (raw) return Object.assign(def, JSON.parse(raw)); } catch (e) {}
    return def;
  }
  function savePrefs(space, p) { try { localStorage.setItem("entremis-app-notif-" + space, JSON.stringify(p)); } catch (e) {} }
  const sw = (name, on, label) => `<label class="switch"><input type="checkbox" data-pref="${name}" ${on ? "checked" : ""}><span class="track" aria-hidden="true"></span><span class="sr">${label}</span></label>`;

  // Le bouton d'action d'une notification : la tâche, le devis ou la facture (ouvert en vrai PDF, prêt à relancer), la fiche ou le rendez-vous
  function notifAction(n) {
    const a = n.act; if (!a) return "";
    const btn = (attr, val) => `<button class="btn btn-ghost btn-xs n-act" type="button" ${attr}="${val}" data-n-act="${n.id}">${EM().esc(a.label)}</button>`;
    const link = href => `<a class="btn btn-ghost btn-xs n-act" href="${href}" data-n-act="${n.id}">${EM().esc(a.label)}</a>`;
    if (a.doc) { const d = window.ENTREMIS_OPS.stores.DOCS.list.find(x => x.number === a.doc); return d ? btn("data-doc-open", d.id) : link("#finances"); }
    if (a.task) { const t = T.list.find(x => x.title === a.task); return t ? btn("data-task-open", t.id) : link("#taches"); }
    return link(a.href);
  }
  function viewNotifications(S) {
    const esc = EM().esc, icon = EM().icon, space = S.space;
    const read = S.read || {};
    const list = NOTIFS[space];
    const p = prefs(space);
    const groups = [...new Set(list.map(n => n.day))];
    const unread = list.filter(n => !read[n.id]).length;
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Notifications</h1><p class="sub">${unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}</p></div>
      <div class="head-actions">${EM().sampleTag}<button class="btn btn-ghost" type="button" data-act="read-all" ${unread ? "" : "disabled"}>Tout marquer comme lu</button></div>
    </div>
    <div class="home-main">
      <section class="card">
        ${groups.map(g => `<p class="day-sep">${g}</p><ul class="notifs">${list.filter(n => n.day === g).map(n => `<li class="${read[n.id] ? "" : "unread"}"><span class="n-ico n-${n.kind}">${icon(n.icon)}</span><button type="button" data-read="${n.id}"><b>${esc(n.text)}</b><span>${esc(n.at)}</span></button>${notifAction(n)}</li>`).join("")}</ul>`).join("")}
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h2">Ce qui vous prévient</h2></div>
        <table class="prefs">
          <thead><tr><th><span class="sr">Événement</span></th>${CHANNELS.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead>
          <tbody>${PREF_EVENTS[space].map(([k, l]) => `<tr><td>${esc(l)}</td>${CHANNELS.map(([c, cl]) => `<td>${sw(k + "." + c, p[k][c], l + ", " + cl)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        <div class="pref-line"><div><b>Heures calmes</b><span>Rien entre 20 h et 8 h, sauf une absence le jour même.</span></div>${sw("quiet", p.quiet, "Heures calmes")}</div>
        <p class="kpi-note">E-mail et SMS : pas encore branchés.</p>
      </section>
    </div>`;
  }

  /* ---------- Réglages : dans settings.js (centre de réglages) ---------- */

  /* ---------- Interactions propres à l'équipe ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-deal],[data-pipe-stage],[data-task-toggle],[data-task-del],[data-board-who],[data-journal],[data-who],[data-space],[data-read],[data-open-client],[data-act],[data-task-open]");
    if (!t) return false;
    const toast = EM().toast;
    if (t.dataset.taskOpen) { S.taskForm = true; S.taskEdit = t.dataset.taskOpen; haptic("tap"); render(); return true; }
    if (t.dataset.taskToggle) {
      const task = T.list.find(x => x.id === t.dataset.taskToggle); if (!task) return true;
      const wasDone = task.status === "done";
      const next = Object.assign({}, task, wasDone ? { status: "todo", doneAt: undefined } : { status: "done", doneAt: nowIso() });
      haptic(wasDone ? "tap" : "done");
      const li = t.closest(".task"); if (li && !wasDone) li.classList.add("is-leaving");
      setTimeout(() => { putTask(next); render(); }, li && !wasDone ? 220 : 0);
      toast(wasDone ? "Tâche rouverte." : `Fait. Visible dans « Qui a fait quoi ».`, () => { putTask(task); render(); });
      return true;
    }
    if (t.dataset.deal) {
      const p = pipe().find(x => x.id === t.dataset.deal); if (!p) return true;
      const prev = p.stage, i = STAGES.findIndex(s => s[0] === p.stage);
      p.stage = STAGES[Math.min(i + 1, STAGES.length - 1)][0];
      haptic(p.stage === "won" ? "done" : "tap"); render();
      toast(p.stage === "won" ? `${p.name} est signé.` : `${p.name} : ${STAGES[i + 1][1].toLowerCase()}.`, () => { p.stage = prev; render(); });
      return true;
    }
    if (t.dataset.pipeStage) { S.pipeStage = t.dataset.pipeStage; haptic("tap"); render(); return true; }
    if (t.dataset.taskDel) { if (S.taskEdit) { S.taskForm = false; S.taskEdit = null; render(); } deleteTask(t.dataset.taskDel, render); return true; }
    if (t.dataset.boardWho) { S.boardWho = t.dataset.boardWho; haptic("tap"); render(); return true; }
    if (t.dataset.journal) { S.journalWho = t.dataset.journal; render(); return true; }
    if (t.dataset.who) { S.who = t.dataset.who; S.boardWho = null; EM().store.set("who", S.who); haptic("tap"); render(); toast(`Portail de ${member(S.who).name}.`); return true; }
    if (t.dataset.space) { S.space = t.dataset.space; EM().store.set("space", S.space); haptic("tap"); location.hash = S.space === "team" ? "#equipe" : "#accueil"; render(); return true; }
    if (t.dataset.read) { S.read = Object.assign({}, S.read, { [t.dataset.read]: true }); render(); return true; }
    if (t.dataset.openClient) {
      const c = TD().clients.find(x => x.id === t.dataset.openClient);
      if (c && c.camp) { e.preventDefault(); S.space = "client"; S.camp = c.camp; EM().store.set("space", "client"); EM().store.set("camp", c.camp); location.hash = "#accueil"; render(); toast(`Vue client de ${c.name}.`); }
      else if (c) { e.preventDefault(); toast("Maquette : seule Solaria Habitat a une vue client d'exemple."); }
      return true;
    }
    const act = t.dataset.act;
    if (act === "new-task") { S.taskForm = true; S.taskEdit = null; render(); setTimeout(() => { const i = document.getElementById("task-title"); if (i) i.focus(); }, 60); return true; }
    if (act === "close-task") { S.taskForm = false; S.taskEdit = null; render(); return true; }
    if (act === "photo-remove") {
      EM().confirm({ title: "Retirer votre photo de profil ?", text: "Vos initiales s'afficheront à la place.", ok: "Retirer" }).then(ok => { if (!ok) return;
      delete P.photos[S.who];
      if (T.source === "db" && T.db) T.db.collection("profiles").doc(S.who).delete().catch(() => {});
      else { try { localStorage.setItem("entremis-app-photos", JSON.stringify(P.photos)); } catch (e) {} }
      haptic("warn"); render(); toast("Photo retirée."); });
      return true;
    }
    if (act === "read-all") { const r = {}; NOTIFS[S.space].forEach(n => { r[n.id] = true; }); S.read = r; haptic("tap"); render(); return true; }
    return false;
  }
  async function deleteTask(id, render) {
    const task = T.list.find(x => x.id === id); if (!task) return;
    if (!(await EM().confirm({ title: `Supprimer la tâche « ${task.title} » ?`, text: "Elle disparaît pour toute l'équipe. Vous pourrez annuler pendant quelques secondes." }))) return;
    removeTask(id); render();
    EM().toast("Tâche supprimée.", () => { putTask(task); render(); });
  }
  /* Recadre au carré et réduit à 320 px avant l'envoi : une photo de téléphone pèse plusieurs Mo. */
  function squareJpeg(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), out = 320, cv = document.createElement("canvas");
        cv.width = cv.height = out;
        cv.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? res({ blob: b, data: cv.toDataURL("image/jpeg", 0.85) }) : rej(new Error("encode")), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("read")); };
      img.src = url;
    });
  }
  async function setPhoto(file, S, render) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.heic$/i.test(file.name)) { EM().toast("Choisissez une image (JPG, PNG ou WebP)."); return; }
    P.busy = true; render();
    try {
      const { blob, data } = await squareJpeg(file);
      const assets = T.source === "db" && window.claude ? await window.claude.use("assets") : null;
      if (assets && T.db) {
        const r = await assets.upload(blob, { filename: S.who + ".jpg" });
        await T.db.collection("profiles").doc(S.who).set({ asset: r.id, updatedAt: nowIso() });
        P.photos[S.who] = { asset: r.id };
      } else {
        P.photos[S.who] = { data };
        try { localStorage.setItem("entremis-app-photos", JSON.stringify(P.photos)); } catch (e) { EM().toast("Photo affichée, mais pas gardée : la mémoire du navigateur est pleine."); }
      }
      haptic("done"); EM().toast("Photo de profil mise à jour.");
    } catch (e) {
      EM().toast(e && e.code === "not_granted" ? "Vous n'avez pas le droit d'envoyer des fichiers sur cette page. Demandez à Marc de vous donner l'accès." : "La photo n'a pas pu être envoyée. Essayez une autre image.");
    }
    P.busy = false; render();
  }
  function onChange(e, S) {
    const ph = e.target.closest("[data-photo]");
    if (ph) { setPhoto(ph.files && ph.files[0], S, EM().render); ph.value = ""; return true; }
    const el = e.target.closest("[data-pref]"); if (!el) return false;
    const p = prefs(S.space), [k, c] = el.dataset.pref.split(".");
    if (c) p[k][c] = el.checked; else p[k] = el.checked;
    savePrefs(S.space, p); haptic("tap");
    return true;
  }
  function onSubmit(e, S, render) {
    if (e.target.id !== "task-form") return false;
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get("title") || "").trim();
    if (!title) { EM().toast("Écrivez ce qu'il faut faire."); return true; }
    const ed = S.taskEdit ? T.list.find(x => x.id === S.taskEdit) : null;
    if (ed) {
      putTask(Object.assign({}, ed, { title, who: f.get("who") || ed.who, client: f.get("client") || "", due: f.get("due") || "", time: f.get("time") || "" }));
      S.taskForm = false; S.taskEdit = null; haptic("done"); render(); EM().toast("Tâche mise à jour.");
      return true;
    }
    const task = { id: "t" + Date.now().toString(36), title, who: f.get("who") || S.who, client: f.get("client") || "", status: "todo", due: f.get("due") || "", time: f.get("time") || "", createdAt: nowIso(), by: S.who };
    putTask(task); S.taskForm = false; haptic("done"); render();
    if (f.get("gcal")) window.ENTREMIS_GCAL.addTask(task);
    EM().toast(`Ajoutée pour ${member(task.who).name}.`);
    return true;
  }

  // Ouvrir une tâche au clavier (Entrée ou espace sur la ligne)
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-task-open]")) { e.preventDefault(); e.target.click(); } });

  /* Glisser une tâche (téléphone) : droite = terminer, gauche = supprimer, comme dans Rappels sur iPhone. */
  function initSwipe(render) {
    let cur = null, x0 = 0, y0 = 0, dx = 0, locked = null;
    document.addEventListener("pointerdown", e => {
      const body = e.target.closest(".task-body"); if (!body || e.target.closest("button")) return;
      if (!EM().isNarrow()) return;
      cur = body; x0 = e.clientX; y0 = e.clientY; dx = 0; locked = null;
    });
    document.addEventListener("pointermove", e => {
      if (!cur) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (locked !== "x") return;
      dx = Math.max(-140, Math.min(140, mx));
      cur.style.transform = `translateX(${dx}px)`;
      cur.parentElement.dataset.swipe = dx > 0 ? "done" : "del";
      if (Math.abs(dx) > 90 && !cur.dataset.armed) { cur.dataset.armed = "1"; haptic("tap"); }
      if (Math.abs(dx) <= 90) delete cur.dataset.armed;
    });
    const end = () => {
      if (!cur) return;
      const li = cur.parentElement, id = li.dataset.task, body = cur;
      body.style.transform = ""; delete body.dataset.armed;
      setTimeout(() => { delete li.dataset.swipe; }, 320);
      if (locked === "x" && dx > 90) { const b = li.querySelector("[data-task-toggle]"); if (b) b.click(); }
      else if (locked === "x" && dx < -90) deleteTask(id, render);
      cur = null; locked = null;
    };
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  }

  window.ENTREMIS_TEAM = {
    avatar: av, taskSheet,
    TEAM_ROUTES, SHARED_ROUTES, T, initTasks, initSwipe, onClick, onChange, onSubmit, member, haptic, photoUrl, photoBusy: () => P.busy,
    views: { equipe: viewPortal, taches: viewTasks, clients: viewClients, pipeline: viewPipeline, avancement: viewProgress, notifications: viewNotifications, reglages: S => window.ENTREMIS_SETTINGS.view(S) },
    unreadCount: S => NOTIFS[S.space].filter(n => !(S.read || {})[n.id]).length
  };
})();
