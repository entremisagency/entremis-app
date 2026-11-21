/* Entremis — #chiffres : le tableau de bord complet de l'agence (pour Gianni, fan de chiffres).
   - Indicateurs regroupés par domaine, comparés à la période précédente, avec leur tendance sur 12 périodes.
   - Équipe et finances : calculés EN DIRECT depuis les appels, tâches et devis/factures saisis dans l'app.
   - Le reste : exemples (non branchés aux pubs, au site ou à la banque).
   - « Mes indicateurs » : chacun crée son chiffre à suivre et saisit sa valeur chaque semaine (collection partagée « metrics »). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const P = { period: "month", sheet: false, entry: {} };
  const PERIODS = { week: ["Semaine", "cette semaine", "la semaine dernière", 1 / 4.3, "à la semaine dernière"], month: ["Mois", "ce mois-ci", "le mois dernier", 1, "au mois dernier"], quarter: ["Trimestre", "ce trimestre", "le trimestre dernier", 3, "au trimestre dernier"] };

  // Formats
  const nf = (n, d = 0) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmt = (v, kind) => kind === "money" ? nf(v) + " €" : kind === "money1" ? nf(v, 1) + " €" : kind === "rate" ? nf(v) + " %" : kind === "sec" ? nf(v) + " s" : kind === "min" ? nf(v) + " min" : kind === "score" ? nf(v, 1) : nf(v);

  // Série déterministe de 12 points qui finit sur la valeur actuelle (exemple)
  function series(name, value, prev) {
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [], start = prev * 0.7 || value * 0.6;
    for (let i = 0; i < 12; i++) {
      const base = start + (value - start) * (i / 11);
      const wobble = ((h >> (i % 16)) & 7) / 7 - 0.5;
      out.push(Math.max(0, base * (1 + wobble * 0.18)));
    }
    out[10] = prev; out[11] = value; return out;
  }

  /* ---------- Les indicateurs ---------- */
  // up : true si « plus haut, c'est mieux ». scale : true si le chiffre dépend de la durée de la période.
  const EXAMPLES = [
    ["Acquisition des demandes", [
      { name: "Demandes reçues", v: 1090, p: 860, kind: "n", up: true, scale: true, help: "Particuliers qui ont demandé une étude" },
      { name: "Coût par demande", v: 10.6, p: 12.1, kind: "money1", up: false, help: "Dépense pub ÷ demandes" },
      { name: "Rappelées en moins d'une minute", v: 92, p: 88, kind: "rate", up: true, help: "Part des demandes rappelées tout de suite" },
      { name: "Délai de rappel médian", v: 48, p: 61, kind: "sec", up: false, help: "Entre la demande et le premier appel" }
    ]],
    ["Qualification et rendez-vous", [
      { name: "Taux de qualification", v: 21, p: 19, kind: "rate", up: true, help: "Demandes qui passent les 4 critères" },
      { name: "Rendez-vous livrés", v: 41, p: 33, kind: "n", up: true, scale: true, help: "Tous clients confondus" },
      { name: "Taux de présence", v: 91, p: 87, kind: "rate", up: true, help: "Rendez-vous où le particulier était là" },
      { name: "Remplacés sous 5 jours", v: 75, p: 80, kind: "rate", up: true, help: "Absences remplacées dans le délai promis" }
    ]],
    ["Ventes d'Entremis", [
      { name: "Installateurs actifs", v: 6, p: 4, kind: "n", up: true, help: "Campagnes en cours" },
      { name: "Revenu mensuel récurrent", v: 9800, p: 8400, kind: "money", up: true, help: "Abonnements en cours, hors taxes" },
      { name: "Panier moyen", v: 2180, p: 2100, kind: "money", up: true, help: "Par installateur et par mois" },
      { name: "Coût d'acquisition d'un client", v: 420, p: 510, kind: "money", up: false, help: "Ce que coûte la signature d'un installateur" },
      { name: "Taux de signature des devis", v: 38, p: 33, kind: "rate", up: true, help: "Devis envoyés qui sont signés" },
      { name: "Clients perdus", v: 0, p: 1, kind: "n", up: false, scale: true, help: "Installateurs qui arrêtent" }
    ]]
  ];

  // Calculés en direct depuis l'app
  function live() {
    const { DOCS, CALLS } = OPS().stores, tasks = TM().T.list;
    const today = window.ENTREMIS_DATA.today.iso;
    const days = { week: 7, month: 30, quarter: 91 }[P.period];
    const iso = n => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const from = iso(days - 1), prevFrom = iso(2 * days - 1);
    const inP = s => s && s.slice(0, 10) >= from, inPrev = s => s && s.slice(0, 10) >= prevFrom && s.slice(0, 10) < from;
    const calls = CALLS.list.filter(c => inP(c.at)), callsPrev = CALLS.list.filter(c => inPrev(c.at));
    const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
    const done = tasks.filter(t => t.status === "done" && inP(t.doneAt)), donePrev = tasks.filter(t => t.status === "done" && inPrev(t.doneAt));
    const fac = DOCS.list.filter(d => d.kind === "facture");
    const paid = fac.filter(d => d.status === "paye"), open = fac.filter(d => ["envoye", "retard"].includes(d.status));
    const late = open.filter(d => d.status === "retard" || (d.due && d.due < today));
    const sum = l => l.reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const dev = DOCS.list.filter(d => d.kind === "devis");
    return [
      ["Équipe", [
        { name: "Appels passés", v: calls.length, p: callsPrev.length, kind: "n", up: true, live: true, help: "Notés dans Appels" },
        { name: "Rendez-vous pris par appel", v: rate(calls.filter(c => c.result === "rdv").length, calls.length), p: rate(callsPrev.filter(c => c.result === "rdv").length, callsPrev.length), kind: "rate", up: true, live: true, help: "Appels qui finissent en rendez-vous" },
        { name: "Temps au téléphone", v: calls.reduce((a, c) => a + (c.minutes || 0), 0), p: callsPrev.reduce((a, c) => a + (c.minutes || 0), 0), kind: "min", up: true, live: true, help: "Toute l'équipe" },
        { name: "Tâches faites", v: done.length, p: donePrev.length, kind: "n", up: true, live: true, help: "Cochées dans Tâches" },
        { name: "Tâches en retard", v: tasks.filter(t => t.status !== "done" && t.due && t.due < today).length, p: null, kind: "n", up: false, live: true, help: "À rattraper" }
      ]],
      ["Finances", [
        { name: "Factures payées", v: sum(paid), p: null, kind: "money", up: true, live: true, help: `${paid.length} facture${paid.length > 1 ? "s" : ""}` },
        { name: "À encaisser", v: sum(open), p: null, kind: "money", up: true, live: true, help: `${open.length} facture${open.length > 1 ? "s" : ""} envoyée${open.length > 1 ? "s" : ""}` },
        { name: "Impayés en retard", v: sum(late), p: null, kind: "money", up: false, live: true, help: late.length ? late.map(d => d.client).join(", ") : "aucun" },
        { name: "Devis signés", v: rate(dev.filter(d => d.status === "signe").length, dev.filter(d => d.status !== "brouillon").length), p: null, kind: "rate", up: true, live: true, help: "Sur les devis envoyés" },
        { name: "Marge du mois", v: 7600, p: 6100, kind: "money", up: true, help: "Encaissé moins les charges – exemple" }
      ]]
    ];
  }

  function tile(m) {
    const f = PERIODS[P.period][3];
    const v = m.scale ? m.v * f : m.v, p = m.p == null ? null : (m.scale ? m.p * f : m.p);
    const diff = p == null || p === 0 ? null : (v - p) / Math.abs(p) * 100;
    const good = diff == null ? null : (diff === 0 ? null : (diff > 0) === m.up);
    const s = m.live ? null : series(m.name, v, p);
    const max = s ? Math.max(...s, 1) : 1;
    return `<article class="metric">
      <p class="metric-name">${EM().esc(m.name)}${m.live ? `<span class="live" title="Calculé en direct depuis l'app">en direct</span>` : ""}</p>
      <div class="metric-row">
        <p class="metric-value tabnum">${fmt(m.kind === "n" ? Math.round(v) : v, m.kind)}</p>
        ${s ? `<span class="ticks" aria-hidden="true">${s.map(x => `<i style="--h:${Math.round(x / max * 100)}%"></i>`).join("")}</span>` : ""}
      </div>
      <p class="metric-delta">${diff == null ? `<span class="muted">${EM().esc(m.help)}</span>` : `<b class="${good ? "t-ok" : good === false ? "t-danger" : "muted"}">${EM().icon(diff >= 0 ? "arrow-up" : "arrow-down")}${diff >= 0 ? "+" : ""}${nf(diff)} %</b> <span class="muted">vs ${PERIODS[P.period][2]}</span>`}</p>
      ${diff == null ? "" : `<p class="metric-help">${EM().esc(m.help)}</p>`}
    </article>`;
  }

  /* ---------- Mes indicateurs (partagés) ---------- */
  const SAMPLE = () => [
    { id: "k1", name: "Démos réservées depuis le site", unit: "", target: 12, up: true, owner: "gianni", entries: [{ w: "2026-10-26", v: 5 }, { w: "2026-11-02", v: 7 }, { w: "2026-11-09", v: 9 }, { w: "2026-11-16", v: 8 }] },
    { id: "k2", name: "Note moyenne des installateurs", unit: "/ 5", target: 4.8, up: true, owner: "richard", entries: [{ w: "2026-10-26", v: 4.5 }, { w: "2026-11-02", v: 4.6 }, { w: "2026-11-09", v: 4.6 }, { w: "2026-11-16", v: 4.7 }] },
    { id: "k3", name: "Posts LinkedIn publiés", unit: "", target: 3, up: true, owner: "marc", entries: [{ w: "2026-11-02", v: 2 }, { w: "2026-11-09", v: 3 }, { w: "2026-11-16", v: 1 }] }
  ];
  let K = null;
  const store = () => K || (K = OPS().makeStore("metrics", SAMPLE));
  const mondayIso = () => { const d = new Date(window.ENTREMIS_DATA.today.iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };

  function custom() {
    const esc = EM().esc, icon = EM().icon, st = store(), wk = mondayIso();
    const card = k => {
      const es = (k.entries || []).slice().sort((a, b) => a.w < b.w ? -1 : 1);
      const last = es[es.length - 1], cur = es.find(e => e.w === wk), max = Math.max(k.target || 0, ...es.map(e => e.v), 1);
      const pct = last ? Math.min(100, Math.round(last.v / (k.target || 1) * 100)) : 0;
      return `<article class="metric custom">
        <div class="metric-top"><p class="metric-name">${esc(k.name)}</p>${TM().avatar(k.owner, "av")}</div>
        <div class="metric-row"><p class="metric-value tabnum">${last ? nf(last.v, String(last.v).includes(".") ? 1 : 0) : "—"}<small> ${esc(k.unit || "")}</small></p>
          <span class="ticks" aria-hidden="true">${es.slice(-12).map(e => `<i style="--h:${Math.round(e.v / max * 100)}%"></i>`).join("")}</span></div>
        ${k.target ? `<div class="target"><div class="bar"><i style="--p:${pct}%"></i></div><span class="muted">Objectif ${nf(k.target, String(k.target).includes(".") ? 1 : 0)} ${esc(k.unit || "")} par semaine</span></div>` : ""}
        <form class="entry" data-metric="${k.id}">
          <label class="sr" for="v-${k.id}">Valeur de la semaine</label>
          <input id="v-${k.id}" name="v" type="number" step="any" inputmode="decimal" placeholder="${cur ? "Cette semaine : " + cur.v : "Valeur de la semaine"}" required>
          <button class="btn btn-ghost btn-xs" type="submit">${cur ? "Corriger" : "Saisir"}</button>
          <button class="icon-btn row-del" type="button" data-metric-del="${k.id}" aria-label="Supprimer l'indicateur ${esc(k.name)}">${icon("trash")}</button>
        </form>
      </article>`;
    };
    return `<section class="metrics-group">
      <div class="group-head"><h2 class="h2">Mes indicateurs</h2>
        <span class="muted">${st.source === "db" ? "partagés avec l'équipe" : "exemple, gardé dans ce navigateur"}</span>
        <button class="btn btn-ghost" type="button" data-metric-new>${icon("plus")}Nouvel indicateur</button></div>
      ${st.list.length ? `<div class="metrics">${st.list.map(card).join("")}</div>` : `<div class="card empty"><p>Créez le chiffre que vous voulez suivre : avis Google, démos réservées, posts publiés… puis saisissez sa valeur chaque semaine.</p><button class="btn btn-ghost" type="button" data-metric-new>${icon("plus")}Nouvel indicateur</button></div>`}
    </section>`;
  }

  function sheet() {
    if (!P.sheet) return "";
    return `<div class="scrim" data-metric-close></div>
    <form class="sheet" id="metric-form" aria-label="Nouvel indicateur">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-metric-close>Annuler</button><b>Nouvel indicateur</b><button class="link strong" type="submit">Créer</button></div>
      <label class="field"><span>Ce que vous suivez</span><input name="name" required maxlength="60" placeholder="Ex. Avis Google laissés par les clients"></label>
      <div class="field-row">
        <label class="field"><span>Unité (facultatif)</span><input name="unit" maxlength="12" placeholder="€, %, / 5…"></label>
        <label class="field"><span>Objectif par semaine</span><input name="target" type="number" step="any" inputmode="decimal" placeholder="10"></label>
      </div>
      <button class="btn btn-primary btn-lg d-only-btn" type="submit">${EM().icon("plus")}Créer l'indicateur</button>
    </form>`;
  }

  /* ---------- Par client ---------- */
  // Les chiffres d'exemple par client : demandes, qualifiées, présence, coût par demande, abonnement
  const clientRows = () => TD().clients.map((c, i) => {
    const req = [312, 186, 240, 205, 64, 83][i] || 50, q = Math.round(req * ([0.21, 0.24, 0.12, 0.2, 0.18, 0.22][i] || 0.2));
    return { c, req, q, rate: Math.round(q / req * 100), pres: [91, 94, 78, 92, 100, 88][i] || 90, cpl: [6.7, 10.8, 16.8, 8.2, 12.5, 5.5][i] || 9, mrr: [2400, 2400, 2000, 1800, 2400, 2000][i] || 2000 };
  });
  function perClient() {
    const esc = EM().esc;
    const rows = clientRows();
    return `<section class="card">
      <div class="card-head"><h2 class="h2">Par client</h2><span class="muted">exemple</span></div>
      <div class="table-scroll"><table class="table table-kpi"><thead><tr><th>Installateur</th><th class="num">Demandes</th><th class="num">Qualifiées</th><th class="num">Taux</th><th class="num">RDV livrés</th><th class="num">Présence</th><th class="num">Coût/demande</th><th class="num">Revenu/mois</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="org"><b>${esc(r.c.name)}</b><span>${esc(r.c.trade)}</span></td>
        <td class="num tabnum" data-l="Demandes">${r.req}</td><td class="num tabnum" data-l="Qualifiées">${r.q}</td><td class="num tabnum" data-l="Taux">${r.rate} %</td>
        <td class="num tabnum" data-l="RDV livrés"><span><b>${r.c.done}</b>/${r.c.target}</span></td>
        <td class="num tabnum ${r.pres < 85 ? "t-danger" : ""}" data-l="Présence">${r.pres} %</td>
        <td class="num tabnum" data-l="Coût/demande">${nf(r.cpl, 1)} €</td><td class="num tabnum" data-l="Revenu/mois">${nf(r.mrr)} €</td></tr>`).join("")}</tbody></table></div>
    </section>`;
  }

  function view() {
    const icon = EM().icon;
    const groups = live().concat(EXAMPLES);
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Chiffres</h1><p class="sub">Comparé ${PERIODS[P.period][4]}.</p></div>
      <div class="head-actions">${EM().sampleTag}<div class="seg seg-lg" role="group" aria-label="Période">${Object.entries(PERIODS).map(([k, [l]]) => `<button type="button" data-metric-period="${k}" aria-pressed="${P.period === k}">${l}</button>`).join("")}</div></div>
    </div>
    <p class="steps-help">${icon("info")}<span><b>En direct</b> : calculé depuis l'app. Le reste : exemples.</span></p>
    ${window.ENTREMIS_MACHINE.weekPanel()}
    ${custom()}
    ${groups.map(([title, ms]) => `<section class="metrics-group"><div class="group-head"><h2 class="h2">${EM().esc(title)}</h2></div><div class="metrics metrics-fit" style="--n:${ms.length <= 5 ? ms.length : Math.ceil(ms.length / 2)}">${ms.map(tile).join("")}</div></section>`).join("")}
    ${perClient()}
    ${sheet()}`;
  }

  /* ---------- Interactions ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-metric-period],[data-metric-new],[data-metric-close],[data-metric-del]");
    if (!t) return false;
    if (t.dataset.metricPeriod) { P.period = t.dataset.metricPeriod; TM().haptic("tap"); render(); return true; }
    if ("metricNew" in t.dataset) { P.sheet = true; render(); setTimeout(() => { const i = document.querySelector("#metric-form input"); if (i) i.focus(); }, 60); return true; }
    if ("metricClose" in t.dataset) { P.sheet = false; render(); return true; }
    if (t.dataset.metricDel) {
      const k = store().list.find(x => x.id === t.dataset.metricDel); if (!k) return true;
      EM().confirm({ title: `Supprimer l'indicateur « ${k.name} » ?`, text: "Ses valeurs saisies sont supprimées aussi." }).then(ok => { if (!ok) return;
        store().remove(k.id); render(); EM().toast("Indicateur supprimé.", () => { store().put(k); render(); }); });
      return true;
    }
    return false;
  }
  function onSubmit(e, S, render) {
    const f = e.target;
    if (f.id === "metric-form") {
      e.preventDefault();
      const fd = new FormData(f), name = String(fd.get("name") || "").trim();
      if (!name) { EM().toast("Donnez un nom à l'indicateur."); return true; }
      const target = fd.get("target") === "" ? null : Number(fd.get("target"));
      store().put({ id: "k" + Date.now().toString(36), name, unit: String(fd.get("unit") || "").trim(), target, up: true, owner: S.who, entries: [] });
      P.sheet = false; TM().haptic("done"); render(); EM().toast("Indicateur créé. Saisissez sa valeur chaque semaine.");
      return true;
    }
    if (f.dataset.metric) {
      e.preventDefault();
      const v = Number(new FormData(f).get("v"));
      if (!isFinite(v)) { EM().toast("Entrez un nombre."); return true; }
      const k = store().list.find(x => x.id === f.dataset.metric); if (!k) return true;
      const wk = mondayIso(), entries = (k.entries || []).filter(x => x.w !== wk).concat([{ w: wk, v }]);
      store().put(Object.assign({}, k, { entries })); TM().haptic("done"); render();
      EM().toast(`« ${k.name} » : ${nf(v, String(v).includes(".") ? 1 : 0)} cette semaine.`);
      return true;
    }
    return false;
  }

  window.ENTREMIS_METRICS = { clientRows,
    route: "chiffres", view, onClick, onSubmit,
    init: render => store().init(render),
    resetSheet: () => { P.sheet = false; }
  };
})();
