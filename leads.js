/* Entremis — #leads (espace fondateurs) : les demandes de particuliers trouvées par Entremis, et à quel client chacune est donnée.
   Clients = les installateurs qui achètent. Leads = les particuliers qui demandent une étude.
   Un lead n'est donné qu'à un seul client (exclusif). File « À attribuer » avec le client proposé (même métier, même zone).
   Partagé : collection « leads ». Sans base : exemples de data.js, gardés dans ce navigateur. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const L = { status: "all", client: "all", pick: null, open: null };
  let ST = null;
  const store = () => ST || (ST = OPS().makeStore("leads", () => TD().leads));
  const STATUS = { nouveau: ["Nouveau", "new"], rappele: ["Rappelé", "info"], qualifie: ["Qualifié", "ok"], attribue: ["Attribué", "ok"], rdv: ["Rendez-vous placé", "ok"], perdu: ["Écarté", "replaced"] };
  const SOURCES = { Facebook: "facebook", Google: "google", Site: null };
  const client = id => TD().clients.find(c => c.id === id);
  const p2 = n => String(n).padStart(2, "0");
  const when = iso => { if (!iso) return ""; const t = window.ENTREMIS_DATA.today.iso; const d = iso.slice(0, 10); return (d === t ? "aujourd'hui" : `${+d.slice(8, 10)}/${d.slice(5, 7)}`) + " à " + iso.slice(11, 16); };
  // Le client qui correspond le mieux : même métier ET même zone, puis celui qui a le moins de leads ce mois-ci
  function suggest(lead) {
    // 1. le client des formulaires Meta d'où vient le lead ; 2. le client dont la zone exclusive contient son code postal ; 3. même métier et même zone
    if (lead.forClient) { const c = TD().clients.find(x => x.id === lead.forClient); if (c) return c; }
    const zip = String(lead.zip || "").replace(/\s/g, "").toUpperCase();
    if (zip) { const z = TD().clients.find(c => String(c.zoneCP || "").toUpperCase().split(/[,;\s]+/).filter(Boolean).some(cp => zip === cp || (cp.length === 2 && zip.startsWith(cp)))); if (z) return z; }
    const cov = TD().coverage, all = store().list;
    const ok = TD().clients.filter(c => cov[c.id] && cov[c.id].trades.includes(lead.trade) && cov[c.id].zones.includes(lead.zone));
    return ok.sort((a, b) => all.filter(l => l.to === a.id).length - all.filter(l => l.to === b.id).length)[0] || null;
  }

  // Diagramme de flux : sources → étape → client. Rubans proportionnels au nombre de leads.
  // Le chemin le plus fréquent vers un rendez-vous est en bleu, les leads écartés en rouge, le reste en gris.
  const STAGE = l => l.status === "rdv" ? "rdv" : l.status === "perdu" ? "perdu" : (l.status === "qualifie" || l.status === "attribue") ? "qualifie" : "encours";
  const STAGES = [["rdv", "Rendez-vous placé"], ["qualifie", "Qualifié"], ["encours", "En cours"], ["perdu", "Écarté"]];
  function sankey(list) {
    const esc = EM().esc, N = list.length || 1, W = 1000, BAR = 6, CW = 176, CH = 44, GAP = 14, K = 12, X = [0, 400, 800];
    const cols = [
      Object.keys(SOURCES).map(s => ({ id: "s:" + s, label: s === "Site" ? "Site d'Entremis" : s === "Google" ? "Google Ads" : "Facebook et Instagram", sub: s, v: list.filter(l => l.source === s).length })),
      STAGES.map(([k, l]) => ({ id: "g:" + k, label: l, v: list.filter(l2 => STAGE(l2) === k).length, lost: k === "perdu" })),
      TD().clients.map(c => ({ id: "c:" + c.id, label: c.name, v: list.filter(l => l.to === c.id).length })).filter(n => n.v).sort((a, b) => b.v - a.v)
        .concat([{ id: "c:none", label: "À attribuer", v: list.filter(l => !l.to && l.status !== "perdu").length, wait: true }])
    ].map(c => c.filter(n => n.v));
    const links = [];
    Object.keys(SOURCES).forEach(s => STAGES.forEach(([k]) => { const v = list.filter(l => l.source === s && STAGE(l) === k).length; if (v) links.push({ a: "s:" + s, b: "g:" + k, v, lost: k === "perdu" }); }));
    STAGES.forEach(([k]) => { if (k === "perdu") return; cols[2].forEach(n => { const v = list.filter(l => STAGE(l) === k && (n.id === "c:none" ? !l.to : "c:" + l.to === n.id)).length; if (v) links.push({ a: "g:" + k, b: n.id, v }); }); });
    // le chemin principal : la source qui donne le plus de rendez-vous, puis le client qui en reçoit le plus
    const best = (arr) => arr.sort((a, b) => b.v - a.v)[0];
    const hs = best(links.filter(l => l.b === "g:rdv").slice()), hc = best(links.filter(l => l.a === "g:rdv").slice());
    if (hs) hs.hi = true; if (hc) hc.hi = true;
    const H = Math.max(...cols.map(c => c.reduce((a, n) => a + Math.max(n.v * K, CH) + GAP, 0)));
    const pos = {};
    cols.forEach((c, ci) => { let y = 0; c.forEach(n => { const h = n.v * K; pos[n.id] = { x: X[ci], y, h, out: y, in: y, n }; y += Math.max(h, CH) + GAP; }); });
    const band = l => { const A = pos[l.a], B = pos[l.b], t = l.v * K, x0 = A.x + BAR, x1 = B.x, m = (x0 + x1) / 2, y0 = A.out, y1 = B.in; A.out += t; B.in += t;
      return `<path class="sk-link${l.hi ? " hi" : ""}${l.lost ? " lost" : ""}" d="M${x0},${y0} C${m},${y0} ${m},${y1} ${x1},${y1} L${x1},${y1 + t} C${m},${y1 + t} ${m},${y0 + t} ${x0},${y0 + t} Z"><title>${esc(A.n.label)} → ${esc(B.n.label)} : ${l.v} lead${l.v > 1 ? "s" : ""}</title></path>`; };
    const hiNodes = new Set([hs && hs.a, hs && hs.b, hc && hc.b].filter(Boolean));
    const node = p => { const n = p.n, pc = Math.round(n.v / N * 100), k = n.lost ? " lost" : hiNodes.has(n.id) ? " hi" : "";
      return `<g class="sk-node${k}"><rect class="sk-bar" x="${p.x}" y="${p.y}" width="${BAR}" height="${Math.max(p.h, 2)}" rx="2"/>
        <g transform="translate(${p.x + BAR + 6},${p.y})"><rect class="sk-card" width="${CW}" height="${CH}" rx="8"/>
        <text class="sk-t" x="12" y="19">${esc(n.label)}</text><text class="sk-v" x="${CW - 12}" y="19" text-anchor="end">${n.v}</text>
        <text class="sk-s" x="12" y="34">${pc} % des leads${n.wait ? " – à donner" : ""}</text></g></g>`; };
    return `<svg class="sankey" viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="Chemin des leads : ${cols[0].map(n => n.label + " " + n.v).join(", ")}">
      ${links.map(band).join("")}${Object.values(pos).map(node).join("")}</svg>`;
  }
  const srcIcon = s => SOURCES[s] ? EM().brand(SOURCES[s], s) : EM().icon("home");

  function view(S) {
    const esc = EM().esc, icon = EM().icon, list = store().list.slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const queue = list.filter(l => !l.to && l.status !== "perdu");
    const given = list.filter(l => l.to);
    const shown = list.filter(l => (L.status === "all" || (L.status === "queue" ? !l.to && l.status !== "perdu" : l.status === L.status)) && (L.client === "all" || l.to === L.client));
    const bySource = Object.keys(SOURCES).map(s => [s, list.filter(l => l.source === s).length]);
    const byClient = TD().clients.map(c => [c, given.filter(l => l.to === c.id).length]).sort((a, b) => b[1] - a[1]);
    const maxC = Math.max(1, ...byClient.map(x => x[1])), maxS = Math.max(1, ...bySource.map(x => x[1]));
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Leads</h1><p class="sub">Chaque lead va à un seul client.</p></div>
      <div class="head-actions">${store().source === "db" ? `<span class="sample sync">${icon("users")}Partagé avec l'équipe</span>` : EM().sampleTag}<button class="btn btn-ghost" type="button" data-live-new="sources">${icon("signal")}Faire arriver les leads</button></div></div>

    <div class="kpis kpis-4" role="list">
      <article class="kpi" role="listitem"><p class="kpi-label">Leads ce mois-ci</p><div><p class="kpi-value">${TD().trades.reduce((a, t) => a + t.value, 0).toLocaleString("fr-FR")}</p><p class="kpi-note">tous métiers, tous clients</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">À attribuer</p><div><p class="kpi-value${queue.length ? " v-warn" : ""}">${queue.length}</p><p class="kpi-note">en attente d'un client</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Livrés</p><div><p class="kpi-value">${TD().clients.reduce((a, c) => a + (c.done || 0), 0)}</p><p class="kpi-note">RDV, appels et devis</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Écartés</p><div><p class="kpi-value">${list.filter(l => l.status === "perdu").length}</p><p class="kpi-note">pas un vrai projet</p></div></article>
    </div>

    <section class="card lead-flow">
      <div class="card-head"><h2 class="h2">Le chemin des leads</h2><span class="muted tabnum">${list.length} derniers</span></div>
      <div class="sk-wrap">${sankey(list)}</div>
      <div class="flow">
        <div class="flow-col"><p class="flow-t">Sources</p>${bySource.map(([s, n]) => `<div class="flow-item">${srcIcon(s)}<span>${s === "Site" ? "Site d'Entremis" : s === "Google" ? "Google Ads" : "Facebook et Instagram"}</span><b class="tabnum">${n}</b><i style="--p:${Math.round(n / maxS * 100)}%"></i></div>`).join("")}</div>
        <div class="flow-mid" aria-hidden="true">${icon("arrow")}</div>
        <div class="flow-col flow-center"><p class="flow-t">Entremis</p><div class="flow-hub"><b class="tabnum">${list.length}</b><span>leads</span><small>${queue.length} à attribuer – ${list.filter(l => l.status === "perdu").length} écarté${list.filter(l => l.status === "perdu").length > 1 ? "s" : ""}</small></div></div>
        <div class="flow-mid" aria-hidden="true">${icon("arrow")}</div>
        <div class="flow-col"><p class="flow-t">Clients</p>${byClient.map(([c, n]) => `<a class="flow-item" href="#fiche-${c.id}">${TM().avatar(c.owner, "av")}<span>${esc(c.name)}</span><b class="tabnum">${n}</b><i style="--p:${Math.round(n / maxC * 100)}%"></i></a>`).join("")}</div>
      </div>
    </section>

    ${queue.length ? `<section class="card">
      <div class="card-head"><h2 class="h2">À attribuer</h2></div>
      <ul class="queue">${queue.map(l => { const s = suggest(l); return `<li>
        <div class="q-main">${srcIcon(l.source)}<div><button class="lead-name" type="button" data-lead-open="${l.id}">${esc(l.name)}</button><span>${esc(l.trade)} – ${esc(l.city)} – reçu ${when(l.at)}</span></div></div>
        ${(() => { const [t, k] = STATUS[l.status || "nouveau"] || [l.status, "info"]; return `<span class="state state-${k}">${t}</span>`; })()}
        <div class="q-act">${s ? `<button class="btn btn-give btn-xs" type="button" data-lead-give="${l.id}:${s.id}">${icon("check")}Donner à ${esc(s.name)}</button>` : `<span class="q-sugg muted">Aucun client sur ce métier et cette zone</span>`}
          <button class="link q-other" type="button" data-lead-pick="${l.id}" aria-expanded="${L.pick === l.id}">${s ? "Autre client" : "Choisir un client"}${icon("chev")}</button></div>
        ${L.pick === l.id ? `<div class="q-pick">${TD().clients.map(c => `<button class="pill" type="button" data-lead-give="${l.id}:${c.id}">${esc(c.name)}</button>`).join("")}<button class="pill" type="button" data-lead-lose="${l.id}">Écarter ce lead</button></div>` : ""}
      </li>`; }).join("")}</ul>
    </section>` : ""}

    <section class="card">
      <div class="card-head"><h2 class="h2">Derniers leads</h2></div>
      <div class="filters">${EM().fsel("lead-status", "Statut", [["all", "Tous"], ["queue", "À attribuer"], ["qualifie", "Qualifiés"], ["rdv", "Rendez-vous"], ["perdu", "Écartés"]], L.status)}${EM().fsel("lead-client", "Client", [["all", "Tous les clients"]].concat(TD().clients.map(c => [c.id, c.name])), L.client)}</div>
      <table class="table table-leads"><thead><tr><th>Lead</th><th>Source</th><th>Statut</th><th>Donné à</th><th></th></tr></thead>
      <tbody>${shown.map(l => { const c = client(l.to), [t, k] = STATUS[l.status || "nouveau"] || [l.status, "info"]; return `<tr>
        <td class="org"><button class="lead-name" type="button" data-lead-open="${l.id}">${esc(l.name)}</button><span>${esc(l.trade)} – ${esc(l.city)} – ${when(l.at)}</span></td>
        <td>${srcTag(l.source)}</td>
        <td><span class="state state-${k}">${t}</span>${(() => { const a = lastAct(l); return a && a.who ? `<button class="why who-trace" type="button" data-lead-open="${l.id}" title="Voir l'historique">par ${esc(TM().member(a.who).name)}, ${whenShort(a.at)}</button>` : l.why ? `<span class="why">${esc(l.why)}</span>` : ""; })()}${l.why && lastAct(l) ? `<span class="why">${esc(l.why)}</span>` : ""}</td>
        <td${c ? "" : ' class="td-empty"'}>${c ? `<a class="given" href="#fiche-${c.id}">${icon("shield")}<b>${esc(c.name)}</b></a>` : `<span class="muted">—</span>`}</td>
        <td class="${c ? "td-act" : "td-empty"}">${c ? `<button class="link" type="button" data-lead-take="${l.id}">Reprendre</button>` : ""}</td>
      </tr>`; }).join("")}</tbody></table>
      ${shown.length ? "" : `<p class="body">Aucun lead avec ces filtres.</p>`}
    </section>
    ${window.ENTREMIS_GROWTH.leadReasons()}
    ${panel()}`;
  }

  /* ---------- Traçabilité : chaque changement d'un lead garde qui, quoi, quand (Marc, 21 nov. 2026) ---------- */
  const LEVELS = { rdv: "RDV pris", qualifie: "qualifié", verifie: "vérifié" }, EXCLS = { "": "facturable", locataire: "non facturé (locataire)", "hors-zone": "non facturé (hors zone)", doublon: "non facturé (doublon)", "faux-numero": "non facturé (numéro non vérifié)" };
  function changes(a, b) {
    const out = [], cn = id => (client(id) || { name: id }).name;
    if (b.erased && !a.erased) out.push("Données effacées (RGPD)");
    if ((a.to || null) !== (b.to || null)) out.push(b.to ? `Donné à ${cn(b.to)}` : `Repris à ${cn(a.to)}`);
    if (a.status !== b.status && !(b.to && !a.to && b.status === "attribue")) out.push({ perdu: "Écarté", rdv: "Rendez-vous placé", qualifie: "Qualifié", rappele: "Rappelé", attribue: "Attribué", nouveau: "Remis en nouveau" }[b.status] || `Statut : ${b.status}`);
    if ((a.level || "") !== (b.level || "") && b.level) out.push(`Niveau : ${LEVELS[b.level] || b.level}`);
    if ((a.excl || "") !== (b.excl || "")) out.push(`Facturation : ${EXCLS[b.excl || ""] || b.excl}`);
    return out;
  }
  function tput(next) {
    const prev = store().list.find(x => x.id === next.id) || {}, who = (EM().S && EM().S.who) || "", at = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
    const what = changes(prev, next);
    const row = Object.assign({}, next);
    if (what.length) { row.hist = (prev.hist || []).concat(what.map(w => ({ at, who, what: w }))).slice(-40); row.by = who; row.byAt = at; }
    return store().put(row);
  }
  // La dernière action, pour l'afficher sous le statut : « par Marc, 20/11 à 20:36 »
  function lastAct(l) {
    const h = (l.hist || [])[l.hist ? l.hist.length - 1 : -1];
    if (h) return h;
    if (l.givenBy && l.givenAt) return { at: l.givenAt, who: l.givenBy, what: "Donné" };
    return null;
  }
  const whenShort = iso => iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)} à ${String(iso).slice(11, 16)}` : "";

  function onClick(e, S, render) {
    const t = e.target.closest("[data-lead-give],[data-lead-pick],[data-lead-lose],[data-lead-status],[data-lead-client],[data-lead-take],[data-lead-open],[data-lead-close]");
    if (!t) return false;
    const find = id => store().list.find(x => x.id === id);
    if (t.dataset.leadOpen) { L.open = t.dataset.leadOpen; L.pick = null; TM().haptic("tap"); render(); return true; }
    if ("leadClose" in t.dataset) { L.open = null; L.pick = null; render(); return true; }
    if (t.dataset.leadGive) {
      const [lid, cid] = t.dataset.leadGive.split(":"), l = find(lid), c = client(cid); if (!l || !c) return true;
      const before = Object.assign({}, l);
      tput(Object.assign({}, l, { to: cid, status: l.status === "nouveau" || l.status === "rappele" ? "attribue" : l.status, givenAt: new Date().toISOString().slice(0, 16), givenBy: S.who }));
      L.pick = null; TM().haptic("done"); render();
      EM().toast(`${l.name} est donné à ${c.name}. Le lead lui est réservé.`, () => { tput(before); render(); });
      return true;
    }
    if (t.dataset.leadPick) { L.pick = L.pick === t.dataset.leadPick ? null : t.dataset.leadPick; render(); return true; }
    if (t.dataset.leadLose) {
      const l = find(t.dataset.leadLose); if (!l) return true;
      EM().confirm({ title: `Écarter le lead ${l.name} ?`, text: "Il ne sera donné à aucun client. Vous pourrez le reprendre plus tard.", ok: "Écarter" }).then(ok => { if (!ok) return; tput(Object.assign({}, l, { status: "perdu", why: "" })); L.pick = null; render(); });
      return true;
    }
    if (t.dataset.leadTake) {
      const l = find(t.dataset.leadTake); if (!l) return true; const c = client(l.to);
      EM().confirm({ title: `Reprendre ${l.name} à ${c ? c.name : "ce client"} ?`, text: "Le lead revient dans « À attribuer ». Le client ne le verra plus.", ok: "Reprendre" }).then(ok => { if (!ok) return; tput(Object.assign({}, l, { to: null, status: "qualifie" })); render(); EM().toast("Lead repris : il est de nouveau à attribuer."); });
      return true;
    }
    if (t.dataset.leadStatus) { L.status = t.dataset.leadStatus; TM().haptic("tap"); render(); return true; }
    if (t.dataset.leadClient) { L.client = t.dataset.leadClient; TM().haptic("tap"); render(); return true; }
    return false;
  }

  // Carte courte pour Mon portail : les leads qui attendent un client
  function queueCard() {
    const esc = EM().esc, icon = EM().icon, q = store().list.filter(l => !l.to && l.status !== "perdu").sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    return `<section class="card">
      <div class="card-head"><h2 class="h2">Leads à attribuer <span class="muted tabnum">${q.length}</span></h2><a class="link" href="#leads">Tous les leads ${icon("arrow")}</a></div>
      ${q.length ? `<ul class="queue queue-mini">${q.slice(0, 3).map(l => { const s = suggest(l); return `<li><div class="q-main">${srcIcon(l.source)}<div><button class="lead-name" type="button" data-lead-open="${l.id}">${esc(l.name)}</button><span>${esc(l.trade)} – ${esc(l.city)}${s ? ` – pour ${esc(s.name)}` : ""}</span></div></div>
        ${s ? `<button class="btn btn-ghost btn-xs" type="button" data-lead-give="${l.id}:${s.id}" aria-label="Donner ${esc(l.name)} à ${esc(s.name)}">Donner</button>` : `<a class="link" href="#leads">Choisir</a>`}</li>`; }).join("")}</ul>` : `<p class="body">Tous les leads ont un client.</p>`}
    </section>`;
  }
  // Panneau de détail d'un lead, à droite (en bas sur téléphone)
  function panel() {
    const l = L.open && store().list.find(x => x.id === L.open); if (!l) return "";
    const esc = EM().esc, icon = EM().icon, c = client(l.to), s = !l.to ? suggest(l) : null, [t, k] = STATUS[l.status || "nouveau"] || [l.status, "info"];
    const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
    return `<div class="lp-scrim" data-lead-close></div><aside class="lead-panel" aria-label="Lead ${esc(l.name)}">
      <header class="lp-head"><div><h2 class="h2">${esc(l.name)}</h2><div class="lp-tags"><span class="state state-${k}">${t}</span><span class="src">${srcIcon(l.source)}${esc(l.source || "Sans source")}</span></div></div>
        <button class="icon-btn" type="button" data-lead-close aria-label="Fermer">${EM().icon("plus")}</button></header>
      <div class="lp-acts">
        ${s ? `<button class="lp-act lp-main" type="button" data-lead-give="${l.id}:${s.id}">${icon("check")}<span>Donner</span></button>` : ""}
        ${!c && l.status !== "perdu" ? `<button class="lp-act" type="button" data-lead-pick="${l.id}">${icon("users")}<span>Autre client</span></button>` : ""}
        ${c ? `<button class="lp-act" type="button" data-lead-take="${l.id}">${icon("swap")}<span>Reprendre</span></button>` : ""}
        ${l.status !== "perdu" && !l.erased ? `<button class="lp-act" type="button" data-live-rdv="${l.id}">${icon("cal")}<span>Placer le RDV</span></button>` : ""}
        ${l.status !== "perdu" ? `<button class="lp-act" type="button" data-lead-lose="${l.id}">${icon("trash")}<span>Écarter</span></button>` : ""}
      </div>
      ${L.pick === l.id ? `<div class="q-pick">${TD().clients.map(cl => `<button class="pill" type="button" data-lead-give="${l.id}:${cl.id}">${esc(cl.name)}</button>`).join("")}</div>` : ""}
      <dl class="lp-dl">
        ${l.phone ? row("Téléphone", `<a class="link" href="tel:${esc(String(l.phone).replace(/\s/g, ""))}">${esc(l.phone)}</a>`) : ""}${l.email ? row("E-mail", `<a class="link" href="mailto:${esc(l.email)}">${esc(l.email)}</a>`) : ""}
        ${l.trade ? row("Projet", esc(l.trade)) : ""}${l.city ? row("Ville", esc(l.city)) : ""}${l.zip ? row("Code postal", esc(l.zip)) : ""}${l.zone ? row("Zone", esc(l.zone)) : ""}${l.country && l.country !== "FR" ? row("Pays", esc(window.ENTREMIS_MACHINE.PAYS[l.country] || l.country)) : ""}${row("Reçu", when(l.at))}${l.source ? row("Venu de", esc(l.source)) : ""}${l.why ? row("Écarté parce que", esc(l.why)) : ""}
      </dl>
      ${l.note ? `<section class="lp-box"><p class="lp-label">Son message</p><p class="body">${esc(l.note)}</p></section>` : ""}
      ${window.ENTREMIS_SETTER ? window.ENTREMIS_SETTER.box(l) : ""}
      ${window.ENTREMIS_MACHINE.leadBox(l)}
      ${(() => { const f = window.ENTREMIS_SECTORS.forLead(l), okN = { rappele: 2, qualifie: 4, attribue: 4, rdv: 4 }[l.status] || 0;
        return `<section class="lp-box"><p class="lp-label">${esc(f.sector.name)} – ${f.parcours.name}</p><ul class="lp-checks">${f.criteria.map((q, i) => `<li class="${i < okN ? "is-ok" : ""}">${i < okN ? icon("check") : "<i></i>"}<span>${esc(q)}</span></li>`).join("")}</ul></section>`; })()}
      <section class="lp-box"><p class="lp-label">${c ? "Donné à" : "Client proposé"}</p>
        ${c ? `<a class="lp-client" href="#fiche-${c.id}">${TM().avatar(c.owner, "av")}<div><b>${esc(c.name)}</b><span>${esc(c.trade)} – réservé à lui seul</span></div>${icon("chev")}</a>`
          : s ? `<a class="lp-client" href="#fiche-${s.id}">${TM().avatar(s.owner, "av")}<div><b>${esc(s.name)}</b><span>Même métier et même zone</span></div>${icon("chev")}</a>`
          : `<p class="body">Aucun client sur ce métier et cette zone.</p>`}
      </section>
      ${(() => { const h = (l.hist || []).slice().reverse(), first = l.givenBy && !(l.hist || []).length ? [{ at: l.givenAt, who: l.givenBy, what: "Donné à " + (c ? c.name : "un client") }] : [];
        const all = h.concat(first).concat([{ at: l.at, who: "", what: "Reçu" + (l.source ? " depuis " + l.source : "") }]);
        return `<section class="lp-box"><p class="lp-label">Historique</p><ol class="lp-hist">${all.map(x => `<li>${x.who ? TM().avatar(x.who, "av") : `<span class="av lp-hist-dot">${icon("inbox")}</span>`}<div><b>${esc(x.what)}</b><span>${x.who ? esc(TM().member(x.who).name) + " · " : ""}${whenShort(x.at)}</span></div></li>`).join("")}</ol></section>`; })()}
    </aside>`;
  }
  const srcTag = s => `<span class="src">${srcIcon(s)}${EM().esc(s)}</span>`;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && L.open && !document.querySelector("#spot,.confirm")) { L.open = null; L.pick = null; EM().render(); } });
  window.ENTREMIS_LEADS = { view, onClick, init: render => store().init(render), list: () => store().list, put: l => tput(l), lastAct, client, srcTag, queueCard, focus: id => { L.open = id; }, closePanel: () => { L.open = null; L.pick = null; }, panel: () => panel(), isOpen: () => !!L.open };
})();
