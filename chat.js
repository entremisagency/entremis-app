/* Entremis — #discussions (espace agence) : la messagerie interne de Marc, Richard et Gianni.
   Un fil « Toute l'équipe » et un fil par client. Rien n'apparaît jamais dans l'espace client.
   Partagé : collection « chat » (un document par message : thread, who, text, at). Sans base : exemples, gardés dans ce navigateur.
   « Non lu » : chacun garde dans son navigateur la date du dernier message lu de chaque fil. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const C = { thread: null };
  const SAMPLE = () => [
    { id: "m1", thread: "equipe", who: "gianni", text: "Point du jeudi : on est à 11 rendez-vous livrés cette semaine. Objectif 14.", at: "2026-11-19T08:05" },
    { id: "m2", thread: "equipe", who: "marc", text: "Je relance la pub chauffe-eau pour Delmas ce matin, ça devrait aider.", at: "2026-11-19T08:12" },
    { id: "m3", thread: "equipe", who: "richard", text: "Ok. Je prends les 5 leads à attribuer avant midi.", at: "2026-11-19T08:20" },
    { id: "m4", thread: "solaria", who: "richard", text: "Laurent préfère être appelé le matin. Ne pas lui proposer de créneau après 17 h.", at: "2026-11-18T17:45" },
    { id: "m5", thread: "solaria", who: "marc", text: "Noté. Il a aimé le bilan de vendredi, on garde ce format.", at: "2026-11-18T18:02" },
    { id: "m6", thread: "ecotoit", who: "gianni", text: "En retard sur l'objectif (3/12). On propose un geste ou on pousse la pub Morbihan ?", at: "2026-11-19T09:30" }
  ];
  let ST = null;
  const store = () => ST || (ST = OPS().makeStore("chat", SAMPLE));
  const threads = () => [{ id: "equipe", name: "Toute l'équipe", sub: "Marc, Richard et Gianni" }].concat(TD().clients.map(c => ({ id: c.id, name: c.name, sub: "Discussion interne sur ce client" })));
  const msgs = id => store().list.filter(m => m.thread === id).sort((a, b) => (a.at || "") < (b.at || "") ? -1 : 1);
  const readKey = who => "entremis-app-chat-read-" + who;
  const readMap = who => { try { return JSON.parse(localStorage.getItem(readKey(who)) || "{}"); } catch (_) { return {}; } };
  const markRead = (who, id) => { const m = readMap(who), last = msgs(id).slice(-1)[0]; if (!last) return; m[id] = last.at; try { localStorage.setItem(readKey(who), JSON.stringify(m)); } catch (_) {} };
  const unread = (who, id) => { const since = readMap(who)[id] || ""; return msgs(id).filter(m => m.who !== who && (m.at || "") > since).length; };
  const unreadAll = who => threads().reduce((a, t) => a + unread(who, t.id), 0);
  const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };   // heure de Paris, pas l'heure universelle
  const when = iso => { if (!iso) return ""; const t = nowLocal().slice(0, 10), d = iso.slice(0, 10); return (d === t ? "" : `${+d.slice(8, 10)}/${d.slice(5, 7)} `) + iso.slice(11, 16); };

  function bubbles(id, me, last) {
    const esc = EM().esc, list = last ? msgs(id).slice(-last) : msgs(id);
    if (!list.length) return `<p class="chat-empty">Pas encore de message. Écrivez le premier : seuls Marc, Richard et Gianni le verront.</p>`;
    return list.map((m, i) => { const mine = m.who === me, prev = list[i - 1], same = prev && prev.who === m.who;
      return `<div class="chat-msg${mine ? " mine" : ""}${same ? " same" : ""}">${mine || same ? "" : TM().avatar(m.who, "av")}<div>${mine || same ? "" : `<span class="chat-who">${TM().member(m.who).name}</span>`}<div class="bubble ${mine ? "out" : "in"}"><p>${esc(m.text)}</p></div><span class="chat-at tabnum">${when(m.at)}</span></div></div>`; }).join("");
  }
  // Pas de <form> : la fiche client est déjà un formulaire, et un formulaire dans un formulaire est ignoré par le navigateur
  function composer(id, compact) {
    return `<div class="chat-form${compact ? " compact" : ""}" data-chat-box="${id}"><textarea data-chat-text="${id}" rows="1" maxlength="1000" placeholder="Écrire à l'équipe…" aria-label="Message interne"></textarea><button class="btn btn-primary" type="button" data-chat-send="${id}" aria-label="Envoyer">${EM().icon("arrow")}</button></div>`;
  }
  const lockNote = short => `<p class="chat-lock">${EM().icon("shield")}${short ? "Équipe seulement, jamais le client." : "Visible seulement par Marc, Richard et Gianni. Jamais par le client."}</p>`;

  function view(S) {
    const esc = EM().esc, icon = EM().icon, me = S.who, ts = threads(), narrow = EM().isNarrow();
    if (!C.thread && !narrow) C.thread = "equipe";
    const cur = ts.find(t => t.id === C.thread);
    if (cur) markRead(me, cur.id);
    const list = `<section class="card chat-list"><ul>${ts.map(t => { const n = unread(me, t.id), last = msgs(t.id).slice(-1)[0];
      return `<li><button type="button" class="chat-th${cur && cur.id === t.id ? " is-on" : ""}" data-chat-thread="${t.id}">${t.id === "equipe" ? `<span class="av chat-team">${icon("users")}</span>` : `<span class="av">${esc(t.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>`}
        <span class="chat-th-main"><b>${esc(t.name)}</b><small>${last ? esc(TM().member(last.who).name + " : " + last.text) : esc(t.sub)}</small></span>
        ${n ? `<span class="count">${n}</span>` : last ? `<span class="chat-at tabnum">${when(last.at)}</span>` : ""}</button></li>`; }).join("")}</ul></section>`;
    const conv = cur ? `<section class="card chat-conv">
      <div class="card-head">${narrow ? `<button class="icon-btn" type="button" data-chat-back aria-label="Toutes les discussions">${icon("back")}</button>` : ""}<h2 class="h2${cur.id !== "equipe" ? " is-co" : ""}">${esc(cur.name)}</h2>${cur.id !== "equipe" ? `<a class="link" href="#fiche-${cur.id}">Fiche ${icon("arrow")}</a>` : ""}</div>
      ${lockNote(narrow)}
      <div class="chat-scroll" data-chat-scroll>${bubbles(cur.id, me)}</div>
      ${composer(cur.id)}
    </section>` : "";
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Discussions</h1><p class="sub">Entre Marc, Richard et Gianni. Le client ne voit rien.</p></div>
      <div class="head-actions">${store().source === "db" ? `<span class="sample sync">${icon("users")}Partagé</span>` : EM().sampleTag}</div></div>
    <div class="chat-grid${cur ? " has-conv" : ""}">${narrow && cur ? conv : narrow ? list : list + conv}</div>`;
  }

  // Carte pour la fiche d'un client : les derniers messages internes + un champ pour écrire
  function card(clientId, S) {
    return `<section class="card chat-card">
      <div class="card-head"><h2 class="h2">Discussion interne</h2><a class="link" href="#discussions" data-chat-open="${clientId}">Tout voir ${EM().icon("arrow")}</a></div>
      ${lockNote(true)}
      <div class="chat-scroll short" data-chat-scroll>${msgs(clientId).length ? bubbles(clientId, S.who, 3) : `<p class="chat-empty">Rien pour l'instant.</p>`}</div>
      ${composer(clientId, true)}
    </section>`;
  }

  function scrollDown() { document.querySelectorAll("[data-chat-scroll]").forEach(el => { el.scrollTop = el.scrollHeight; }); }

  function send(id, S, render) {
    const ta = document.querySelector(`[data-chat-text="${id}"]`); if (!ta) return;
    const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    store().put({ id: "m" + Date.now().toString(36), thread: id, who: S.who, text, at: nowLocal() });
    markRead(S.who, id); TM().haptic("done"); render(); scrollDown();
    const box = document.querySelector(`[data-chat-text="${id}"]`); if (box) box.focus();
  }
  let ctx = null;   // de quoi envoyer depuis le clavier (Entrée)
  function onClick(e, S, render) {
    ctx = { S, render };
    const t = e.target.closest("[data-chat-thread],[data-chat-back],[data-chat-open],[data-chat-send]"); if (!t) return false;
    if (t.dataset.chatSend) { send(t.dataset.chatSend, S, render); return true; }
    if (t.dataset.chatThread) { C.thread = t.dataset.chatThread; TM().haptic("tap"); render(); scrollDown(); return true; }
    if ("chatBack" in t.dataset) { C.thread = null; render(); return true; }
    if (t.dataset.chatOpen) { C.thread = t.dataset.chatOpen; return false; }   // le lien suit son chemin vers #discussions
    return false;
  }
  // Entrée envoie, Maj + Entrée passe à la ligne. Le champ grandit avec le texte.
  document.addEventListener("keydown", e => { const ta = e.target.closest && e.target.closest("[data-chat-text]"); if (!ta || e.key !== "Enter" || e.shiftKey || e.isComposing) return; e.preventDefault(); if (ctx) send(ta.dataset.chatText, ctx.S, ctx.render); });
  document.addEventListener("input", e => { const ta = e.target.closest && e.target.closest("[data-chat-text]"); if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; });

  window.ENTREMIS_CHAT = { view, card, onClick, bind: (S, render) => { ctx = { S, render }; }, init: render => store().init(() => { render(); scrollDown(); }), unreadAll, scrollDown };
})();
