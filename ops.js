/* Entremis — pilotage de l'agence (espace fondateurs) : #finances – #appels – #marketing – #plus (menu complet sur téléphone).
   Devis, factures et appels sont partagés entre les trois fondateurs dans la base de la page publiée (collections
   « documents » et « calls ») ; un devis ou une facture peut porter son fichier (PDF ou image, capacité « assets »).
   Sans base (aperçu local) : données d'exemple de data.js, gardées dans ce navigateur. SEO et publicités : exemples. */
(function () {
  "use strict";
  const EM = () => window.EM, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const p2 = n => String(n).padStart(2, "0");
  const nowIso = () => { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}T${p2(n.getHours())}:${p2(n.getMinutes())}`; };
  const todayIso = () => window.ENTREMIS_DATA.today.iso;
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const shortDate = iso => { if (!iso) return "—"; const [, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const euros = n => Math.round(n).toLocaleString("fr-FR") + " €";
  const tone = (l, k) => `<span class="state state-${k}">${l}</span>`;

  /* ---------- Une petite base partagée, la même pour les devis/factures et les appels ---------- */
  function makeStore(name, sample) {
    const st = { name, list: [], source: "local", ready: false, db: null };
    const key = "entremis-app-" + name;
    const loadLocal = () => { try { const r = localStorage.getItem(key); if (r) return JSON.parse(r); } catch (e) {} return sample().map(x => Object.assign({}, x)); };
    // Le lien vers un fichier local ne survit pas à la visite : on ne le garde pas
    const saveLocal = () => { try { localStorage.setItem(key, JSON.stringify(st.list.map(x => { const c = Object.assign({}, x); delete c.localUrl; return c; }))); } catch (e) {} };
    const clean = o => { const c = Object.assign({}, o); delete c.id; delete c.localUrl; Object.keys(c).forEach(k => c[k] === undefined && delete c[k]); return c; };
    st.init = async function (onChange) {
      const rt = typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";
      if (!rt) { st.list = loadLocal(); st.ready = true; onChange(); return; }
      let done = false;
      const fallback = () => { if (done) return; done = true; st.list = loadLocal(); st.source = "local"; st.ready = true; onChange(); };
      const timer = setTimeout(fallback, 10000);
      try {
        const db = await window.claude.use("db");
        if (!db) { clearTimeout(timer); fallback(); return; }
        st.db = db;
        db.collection(name).onSnapshot(snap => {
          done = true; clearTimeout(timer);
          const local = {}; st.list.forEach(x => { if (x.localUrl) local[x.id] = x.localUrl; });
          st.list = snap.docs.map(d => Object.assign({ id: d.id }, d.data(), local[d.id] ? { localUrl: local[d.id] } : {}));
          st.source = "db"; st.ready = true; onChange();
        }, () => { clearTimeout(timer); fallback(); });
      } catch (e) { clearTimeout(timer); fallback(); }
    };
    st.put = async function (row) {
      const i = st.list.findIndex(x => x.id === row.id); if (i >= 0) st.list[i] = row; else st.list.push(row);
      if (st.source === "db") { try { await st.db.collection(name).doc(row.id).set(clean(row)); } catch (e) { EM().toast("Pas enregistré : la base n'a pas répondu. Réessayez."); } }
      else saveLocal();
    };
    st.remove = async function (id) {
      st.list = st.list.filter(x => x.id !== id);
      if (st.source === "db") { try { await st.db.collection(name).doc(id).delete(); } catch (e) { EM().toast("Pas supprimé : la base n'a pas répondu."); } }
      else saveLocal();
    };
    return st;
  }
  const DOCS = makeStore("documents", () => TD().documents);
  // Prochain numéro : on repart du plus grand numéro du même type (F-2026-034 → F-2026-035)
  function nextNumber(kind) {
    const pre = (kind === "devis" ? "D" : "F") + "-" + todayIso().slice(0, 4) + "-";
    const max = DOCS.list.filter(d => d.kind === kind && (d.number || "").startsWith(pre)).reduce((m, d) => Math.max(m, parseInt(d.number.slice(pre.length), 10) || 0), 0);
    return pre + String(max + 1).padStart(3, "0");
  }
  // Exemples : les appels de data.js + 14 jours d'activité générés (seulement sans base partagée)
  function sampleCalls() {
    const out = TD().calls.slice(), who = ["marc", "richard", "gianni"], res = ["rdv", "qualifie", "rappeler", "messagerie", "messagerie", "pas-interesse", "rappeler", "messagerie"];
    const first = ["Pierre", "Nathalie", "Julien", "Isabelle", "Thomas", "Sandrine", "Nicolas", "Valérie", "Laurent", "Céline", "Franck", "Sophie", "Didier", "Émilie", "Pascal", "Hélène", "Sébastien", "Martine"];
    const last = ["Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefèvre", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent"];
    const pros = ["Thermik Alsace", "SolarOuest", "Habitat Confort 69", "Clim'Azur", "Blindex Annecy", "Énergie Plus Rennes"];
    const base = new Date(window.ENTREMIS_DATA.today.iso + "T12:00:00Z");
    for (let d = 1; d < 14; d++) {
      const day = new Date(base); day.setUTCDate(base.getUTCDate() - d);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      who.forEach((w, wi) => {
        const n = [6, 14, 11][wi] + ((d * 7 + wi * 3) % 9) - 4;
        for (let k = 0; k < n; k++) {
          const r = res[(d * 3 + k * 5 + wi) % res.length];
          const about = ["Solaria Habitat", "Thermo Rhône", "Isoléa", "Prospection"][(k + wi) % 4], seed = d * 31 + wi * 17 + k * 7;
          const pro = about === "Prospection";
          out.push({ id: `g${d}-${w}-${k}`, who: w, contact: pro ? pros[seed % pros.length] : first[seed % first.length] + " " + last[(seed * 3 + k) % last.length], company: pro ? "Installateur" : "Particulier", about, result: r, minutes: r === "messagerie" ? 1 : 3 + (k % 9), at: day.toISOString().slice(0, 10) + "T" + String(9 + ((k + wi * 3) % 9)).padStart(2, "0") + ":" + String((k * 7 + wi * 13 + d * 5) % 60).padStart(2, "0"), note: "" });
        }
      });
    }
    return out;
  }
  const CALLS = makeStore("calls", sampleCalls);
  document.addEventListener("change", e => { const f = e.target.closest(".dz-input"); if (!f) return; const n = f.files && f.files[0] ? f.files[0].name : "Joindre le PDF"; const b = f.closest(".dropzone").querySelector("[data-dz-name]"); if (b) b.textContent = n; const ic = f.closest(".dropzone").querySelector(".dz-ico"); if (ic) ic.innerHTML = f.files && f.files[0] ? EM().fileIcon(n, "fic-lg") : EM().icon("download"); f.closest(".dropzone").classList.toggle("has-file", !!(f.files && f.files[0])); });
  const CALL_GOAL = 20;   // appels par jour et par personne (objectif d'exemple)
  const O = { callDays: 2, docKind: "all", callWho: "all", mkTab: "seo", sheet: null, busy: false, adsOff: {} };

  const syncTag = st => st.source === "db" ? `<span class="sample sync">${EM().icon("users")}Partagé avec l'équipe</span>` : EM().sampleTag;

  /* Colonnes au sommet arrondi (même style que l'Avancement) */
  function arches(series, unit, fmt = v => v) {
    const max = Math.max(...series.map(x => x.value)), H = 150, BW = 100 / series.length;
    return `<svg class="chart" width="100%" height="${H + 56}" role="img" aria-label="${series.map(x => x.label + " " + fmt(x.value)).join(", ")}">
      <line x1="0%" x2="100%" y1="${H + 24}" y2="${H + 24}" class="grid"></line>
      ${series.map((x, i) => { const h = Math.max(20, Math.round(x.value / max * H)), y = H - h + 24, cls = x.current ? "cb-now" : "cb";
        return `<g class="cbar"><title>${x.label} : ${fmt(x.value)} ${unit}</title>
          <rect x="${i * BW + BW * 0.24}%" y="${y}" width="${BW * 0.52}%" height="${h}" rx="18" class="${cls}"></rect>
          <rect x="${i * BW + BW * 0.24}%" y="${y + h - 18}" width="${BW * 0.52}%" height="18" class="${cls}"></rect>
          <text x="${i * BW + BW / 2}%" y="${y - 8}" text-anchor="middle" class="bar-val">${fmt(x.value)}</text>
          <text x="${i * BW + BW / 2}%" y="${H + 46}" text-anchor="middle" class="bar-lab">${x.label}</text></g>`; }).join("")}
    </svg>`;
  }
  const kpi = (label, value, note, kind) => `<article class="kpi" role="listitem"><p class="kpi-label">${label}</p><div><p class="kpi-value${kind ? " v-" + kind : ""}">${value}</p><p class="kpi-note">${note}</p></div></article>`;

  /* ---------- Finances : devis, factures, chiffre d'affaires ---------- */
  const DOC_STATE = { brouillon: ["Brouillon", "replaced"], envoye: ["Envoyé", "info"], signe: ["Signé", "ok"], paye: ["Payée", "ok"], retard: ["En retard", "danger"] };
  // L'étape suivante d'un devis ou d'une facture (envoyer, faire signer, encaisser)
  const nextStep = d => { const st = docState(d); return d.kind === "facture" && ["envoye", "retard"].includes(st) ? ["paye", "Marquer payée"] : d.kind === "devis" && d.status === "envoye" ? ["signe", "Marquer signé"] : d.status === "brouillon" ? ["envoye", "Marquer envoyé"] : null; };
  const docTag = d => { const [l, k] = DOC_STATE[docState(d)] || [docState(d), "info"]; return tone(l, k); };
  const docNext = d => { const n = nextStep(d); return n ? `<div class="doc-next"><button class="btn btn-ghost" type="button" data-doc-step="${d.id}:${n[0]}">${EM().icon("check")}${n[1]}</button></div>` : ""; };
  const docState = d => {
    if (d.kind === "facture" && d.status === "envoye" && d.due && d.due < todayIso()) return "retard";
    return d.status;
  };
  function viewFinances(S) {
    const esc = EM().esc, icon = EM().icon;
    const list = DOCS.list.slice().sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);
    const fac = list.filter(d => d.kind === "facture"), dev = list.filter(d => d.kind === "devis");
    const toCash = fac.filter(d => ["envoye", "retard"].includes(docState(d)));
    const late = fac.filter(d => docState(d) === "retard");
    const waiting = dev.filter(d => d.status === "envoye");
    const rev = TD().revenue, costs = TD().costs, cur = rev[rev.length - 1].value, costSum = costs.reduce((a, c) => a + c.value, 0);
    const shown = list.filter(d => O.docKind === "all" || d.kind === O.docKind);
    const row = d => {
      const st = docState(d), [l, k] = DOC_STATE[st] || [st, "info"];
      const next = nextStep(d);
      return `<tr class="doc-row" data-doc-open="${d.id}" tabindex="0" aria-label="Ouvrir ${esc(d.number || "le document")}">
        <td class="org"><div class="doc-id">${EM().fileIcon(d.fileName || "pdf")}<div><b>${esc(d.number || "Sans numéro")}</b><span>${d.kind === "devis" ? "Devis" : "Facture"} – ${shortDate(d.date)}</span></div></div></td>
        <td class="org"><b>${esc(d.client)}</b><span>${d.due ? (d.kind === "devis" ? "valable jusqu'au " : "à payer avant le ") + shortDate(d.due) : "pas d'échéance"}</span></td>
        <td class="num tabnum"><b>${euros(d.amount || 0)}</b></td>
        <td>${tone(l, k)}</td>
        <td><div class="row-acts">
          ${next ? `<button class="btn btn-ghost btn-xs" type="button" data-doc-step="${d.id}:${next[0]}">${next[1]}</button>` : ""}
          <button class="icon-btn row-del" type="button" data-doc-del="${d.id}" aria-label="Supprimer ${esc(d.number || "")}">${icon("trash")}</button>
        </div></td></tr>`;
    };
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Finances</h1><p class="sub">Devis, factures et chiffre d'affaires.</p></div>
      <div class="head-actions">${syncTag(DOCS)}<button class="btn btn-ghost" type="button" data-ops-sheet="doc">${icon("download")}Déposer un fichier</button><a class="btn btn-primary fin-create" href="#generer" data-gen-new="devis">${icon("plus")}Créer un devis ou une facture</a></div>
    </div>
    ${quickCreate()}
    <div class="kpis kpis-4" role="list">
      ${kpi("Encaissé en novembre", euros(cur), "chiffre d'affaires, hors taxes")}
      ${kpi("À encaisser", euros(toCash.reduce((a, d) => a + d.amount, 0)), `${toCash.length} facture${toCash.length > 1 ? "s" : ""} envoyée${toCash.length > 1 ? "s" : ""}`)}
      ${kpi("En retard de paiement", euros(late.reduce((a, d) => a + d.amount, 0)), late.length ? late.map(d => esc(d.client)).join(", ") : "aucune facture", late.length ? "danger" : "ok")}
      ${kpi("Devis en attente", euros(waiting.reduce((a, d) => a + d.amount, 0)), `${waiting.length} devis envoyé${waiting.length > 1 ? "s" : ""}`, waiting.length ? "warn" : "")}
    </div>
    <section class="card">
      <div class="card-head"><h2 class="h2">Devis et factures</h2>
        ${EM().fsel("doc-kind", "Afficher", [["all", "Devis et factures"], ["facture", "Factures"], ["devis", "Devis"]], O.docKind)}
      </div>
      ${!DOCS.ready ? EM().loader("Chargement des devis et factures", "Ceux de toute l'équipe") : shown.length ? `<table class="table table-docs"><thead><tr><th>Numéro</th><th>Client</th><th class="num">Montant HT</th><th>État</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${shown.map(row).join("")}</tbody></table>`
        : `<div class="empty">${icon("download")}<p>Aucun document pour l'instant.</p><button class="btn btn-ghost" type="button" data-ops-sheet="doc">${icon("plus")}Déposer un document</button></div>`}
    </section>
    <div class="home-main">${window.ENTREMIS_GROWTH.contracts()}${window.ENTREMIS_GROWTH.cashflow()}</div>
    <div class="home-main">
      <section class="card">
        <div class="card-head"><h2 class="h2">Chiffre d'affaires par mois</h2><span class="muted">encaissé, hors taxes – exemple</span></div>
        ${arches(rev, "encaissés", v => (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k")}
        <p class="kpi-note">Le mois en cours, en noir, n'est pas terminé.</p>
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h2">Ce mois-ci</h2><span class="muted">exemple</span></div>
        <dl class="money">
          <div><dt>Encaissé</dt><dd class="tabnum">${euros(cur)}</dd></div>
          ${costs.map(c => `<div class="minus"><dt>${esc(c.label)}</dt><dd class="tabnum">− ${euros(c.value)}</dd></div>`).join("")}
          <div class="total"><dt>Reste, avant impôts</dt><dd class="tabnum">${euros(cur - costSum)}</dd></div>
        </dl>
      </section>
    </div>
    ${sheet(S)}`;
  }

  /* ---------- Appels ---------- */
  const CALL_RES = { rdv: ["Rendez-vous pris", "ok"], qualifie: ["Intéressé", "info"], rappeler: ["À rappeler", "warn"], messagerie: ["Messagerie", "replaced"], "pas-interesse": ["Pas intéressé", "danger"] };
  function viewCalls(S) {
    const esc = EM().esc, icon = EM().icon, ms = TD().members;
    const list = CALLS.list.slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const today = list.filter(c => (c.at || "").slice(0, 10) === todayIso());
    const week = list.filter(c => (c.at || "").slice(0, 10) >= weekStart());
    const shown = list.filter(c => O.callWho === "all" || c.who === O.callWho);
    const allDays = [...new Set(shown.map(c => (c.at || "").slice(0, 10)))], days = allDays.slice(0, O.callDays);
    const dayName = iso => iso === todayIso() ? "Aujourd'hui" : shortDate(iso);
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Appels</h1><p class="sub">Qui a appelé qui, et le résultat.</p></div>
      <div class="head-actions">${syncTag(CALLS)}<button class="btn btn-primary" type="button" data-ops-sheet="call">${icon("phone")}Noter un appel</button></div>
    </div>
    <div class="kpis kpis-4" role="list">
      ${kpi("Appels aujourd'hui", today.length, ms.map(m => `${m.name} ${today.filter(c => c.who === m.id).length}`).join(" – "))}
      ${kpi("Rendez-vous pris", week.filter(c => c.result === "rdv").length, "cette semaine", "ok")}
      ${kpi("À rappeler", week.filter(c => c.result === "rappeler").length, "cette semaine", week.some(c => c.result === "rappeler") ? "warn" : "")}
      ${kpi("Temps au téléphone", week.reduce((a, c) => a + (c.minutes || 0), 0) + " min", "cette semaine, toute l'équipe")}
    </div>
    ${tracker()}
    <section class="card">
      <div class="card-head"><h2 class="h2">Journal des appels</h2>
        ${EM().fsel("call-who", "Qui", [["all", "Tout le monde"]].concat(ms.map(m => [m.id, m.name])), O.callWho)}
      </div>
      ${!CALLS.ready ? EM().loader("Chargement des appels", "Ceux de Marc, Richard et Gianni") : shown.length ? days.map(dy => `<p class="day-sep">${dayName(dy)}</p><ul class="calls">${shown.filter(c => (c.at || "").slice(0, 10) === dy).map(c => {
        const [l, k] = CALL_RES[c.result] || [c.result, "info"];
        return `<li>${TM().avatar(c.who, "av av-md")}
          <div class="call-main"><b>${esc(c.contact)}</b><span>${esc(c.company || "")}${c.about ? " – " + esc(c.about) : ""}</span>${c.note ? `<p>${esc(c.note)}</p>` : ""}</div>
          <div class="call-meta">${tone(l, k)}<span class="tabnum">${(c.at || "").slice(11, 16)} – ${c.minutes || 0} min</span>
            <button class="icon-btn row-del" type="button" data-call-del="${c.id}" aria-label="Supprimer l'appel à ${esc(c.contact)}">${icon("trash")}</button></div>
        </li>`; }).join("")}</ul>`).join("")
        + (allDays.length > days.length ? `<button class="btn btn-ghost more-btn" type="button" data-call-more>Voir les jours d'avant</button>` : "")
        : `<div class="empty">${icon("phone")}<p>Aucun appel noté.</p><button class="btn btn-ghost" type="button" data-ops-sheet="call">${icon("phone")}Noter un appel</button></div>`}
    </section>
    ${sheet(S)}`;
  }
  /* Le suivi : objectif du jour, activité sur 14 jours, entonnoir de conversion */
  function tracker() {
    const esc = EM().esc, ms = TD().members, today = todayIso();
    const days = []; { const b = new Date(today + "T12:00:00Z"); for (let i = 13; i >= 0; i--) { const x = new Date(b); x.setUTCDate(b.getUTCDate() - i); days.push(x.toISOString().slice(0, 10)); } }
    const count = (w, dd) => CALLS.list.filter(c => c.who === w && (c.at || "").slice(0, 10) === dd).length;
    const maxCell = Math.max(1, ...ms.flatMap(m => days.map(dd => count(m.id, dd))));
    const shade = n => n === 0 ? 0 : Math.min(5, 1 + Math.floor(n / maxCell * 4.99));
    const DOW = ["D", "L", "M", "M", "J", "V", "S"];
    const wk = CALLS.list.filter(c => (c.at || "").slice(0, 10) >= weekStart());
    const reached = wk.filter(c => c.result !== "messagerie"), interested = wk.filter(c => ["qualifie", "rdv"].includes(c.result)), rdv = wk.filter(c => c.result === "rdv");
    const steps = [["Appels passés", wk.length], ["Joints", reached.length], ["Intéressés", interested.length], ["Rendez-vous", rdv.length]];
    return `<section class="card tracker">
      <div class="card-head"><h2 class="h2">Suivi de la prospection</h2><span class="muted">objectif ${CALL_GOAL} appels par jour et par personne</span></div>
      <div class="goals-today">${ms.map(m => { const n = count(m.id, today), p = Math.min(100, Math.round(n / CALL_GOAL * 100)); return `<div class="gt">
        ${TM().avatar(m.id, "av av-md")}<div class="gt-main"><div class="gt-top"><b>${m.name}</b><span class="tabnum"><b>${n}</b> / ${CALL_GOAL}</span></div>
        <div class="bar"><i style="--p:${p}%"></i></div><span class="muted">${n >= CALL_GOAL ? "Objectif atteint" : `Encore ${CALL_GOAL - n} appel${CALL_GOAL - n > 1 ? "s" : ""} aujourd'hui`}</span></div></div>`; }).join("")}</div>
      <div class="tracker-grid">
        <div class="heat" role="table" aria-label="Appels par jour et par personne, 14 derniers jours">
          <div class="heat-row heat-head" role="row"><span></span>${days.map(dd => `<span class="${dd === today ? "is-today" : ""}" role="columnheader">${DOW[new Date(dd + "T12:00:00Z").getUTCDay()]}</span>`).join("")}<span class="heat-total">Total</span></div>
          ${ms.map(m => `<div class="heat-row" role="row"><span class="heat-who">${TM().avatar(m.id, "av")}${m.name}</span>${days.map(dd => { const n = count(m.id, dd); return `<i class="h${shade(n)}${dd === today ? " is-today" : ""}" role="cell" title="${m.name}, ${dd.slice(8, 10)}/${dd.slice(5, 7)} : ${n} appel${n > 1 ? "s" : ""}">${n || ""}</i>`; }).join("")}<b class="heat-total tabnum">${days.reduce((a, dd) => a + count(m.id, dd), 0)}</b></div>`).join("")}
          <div class="heat-legend"><span>Moins</span>${[0, 1, 2, 3, 4, 5].map(s => `<i class="h${s}"></i>`).join("")}<span>Plus</span></div>
        </div>
        <div class="funnel-v" aria-label="Entonnoir de la semaine">
          <p class="muted">Cette semaine, toute l'équipe</p>
          ${steps.map(([l, n], i) => `<div class="fv-step"><div class="fv-top"><span>${l}</span><b class="tabnum">${n}</b></div>
            <div class="fv-bar"><i style="--p:${Math.round(n / Math.max(steps[0][1], 1) * 100)}%"></i></div>
            ${i ? `<span class="fv-rate tabnum">${steps[i - 1][1] ? Math.round(n / steps[i - 1][1] * 100) : 0} % de l'étape d'avant</span>` : ""}</div>`).join("")}
        </div>
      </div>
    </section>`;
  }
  const weekStart = () => { const x = new Date(todayIso() + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return x.toISOString().slice(0, 10); };

  /* ---------- Marketing : SEO et publicités ---------- */
  function viewMarketing() {
    const esc = EM().esc, icon = EM().icon, seo = TD().seo, ads = TD().ads;
    const tabs = `<div class="seg seg-lg" role="group" aria-label="Marketing">${[["seo", "SEO"], ["ads", "Pubs"], ["aides", "Aides"], ["calcul", "Calcul"]].map(([k, l]) => `<button type="button" data-mk-tab="${k}" aria-pressed="${O.mkTab === k}">${l}</button>`).join("")}</div>`;
    let body;
    if (O.mkTab === "calcul") body = window.ENTREMIS_CALC.view();
    else if (O.mkTab === "aides") body = window.ENTREMIS_GROWTH.simulator();
    else if (O.mkTab === "seo") {
      const t = seo.traffic, cur = t[t.length - 1].value, prev = t[t.length - 2].value;
      body = `
      <div class="kpis kpis-4" role="list">
        ${kpi("Visites depuis Google", cur, `+${Math.round((cur - prev) / prev * 100)} % sur un mois`, "ok")}
        ${kpi("Mots-clés dans le top 10", seo.keywords.filter(k => k.pos <= 10).length, `sur ${seo.keywords.length} suivis`)}
        ${kpi("En progression", seo.keywords.filter(k => k.pos < k.prev).length, "mots-clés qui montent", "ok")}
        ${kpi("En recul", seo.keywords.filter(k => k.pos > k.prev).length, "à surveiller", seo.keywords.some(k => k.pos > k.prev) ? "danger" : "")}
      </div>
      <div class="home-main">
        <section class="card"><div class="card-head"><h2 class="h2 h2-brand">${EM().brand("google", "Google")}Visites depuis Google</h2><span class="muted">par mois – exemple</span></div>${arches(t, "visites")}</section>
        <section class="card"><div class="card-head"><h2 class="h2 h2-brand">${EM().brand("google", "Google")}Positions sur Google</h2><span class="muted">exemple</span></div>
          <ul class="kw">${seo.keywords.map(k => { const d = k.prev - k.pos; return `<li><div><b>${esc(k.q)}</b><span class="tabnum">${k.volume} recherches par mois</span></div>
            <span class="kw-pos tabnum">${k.pos}<small>e</small></span>
            <span class="kw-move ${d > 0 ? "t-ok" : d < 0 ? "t-danger" : "muted"}">${d > 0 ? icon("arrow-up") + "+" + d : d < 0 ? icon("arrow-down") + d : "="}</span></li>`; }).join("")}</ul>
        </section>
      </div>
      ${window.ENTREMIS_GROWTH.seoPages()}`;
    } else {
      const on = ads.filter(a => !O.adsOff[a.id] && a.status === "on");
      const spent = ads.reduce((s, a) => s + a.spent, 0), leads = ads.reduce((s, a) => s + a.leads, 0);
      body = `
      <div class="kpis kpis-4" role="list">
        ${kpi("Dépensé ce mois-ci", euros(spent), `sur ${euros(ads.reduce((s, a) => s + a.budget, 0))} de budget`)}
        ${kpi("Demandes obtenues", leads, "toutes campagnes")}
        ${kpi("Coût par demande", euros(spent / Math.max(leads, 1)), "moyenne", "ok")}
        ${kpi("Campagnes actives", on.length, `sur ${ads.length}`)}
      </div>
      <section class="card"><div class="card-head"><h2 class="h2 h2-brand"><span class="brand-stack">${EM().brand("meta", "Meta")}${EM().brand("googleads", "Google Ads")}${EM().brand("linkedin", "LinkedIn")}</span>Campagnes</h2><span class="muted">exemple</span></div>
        <table class="table table-ads"><thead><tr><th>Campagne</th><th>Budget dépensé</th><th class="num">Demandes</th><th class="num">Coût / demande</th><th>Active</th></tr></thead>
        <tbody>${ads.map(a => { const active = a.status === "on" && !O.adsOff[a.id]; return `<tr class="${active ? "" : "is-off"}">
          <td class="org"><b>${esc(a.name)}</b><span class="chan-line">${EM().brand({ Meta: "meta", Google: "googleads", LinkedIn: "linkedin" }[a.channel] || "meta", a.channel)}${esc(a.channel === "Google" ? "Google Ads" : a.channel)} – ${esc(a.client)}</span></td>
          <td><div class="goal-cell"><span class="tabnum"><b>${euros(a.spent)}</b> / ${euros(a.budget)}</span><span class="mini-bar"><i style="--p:${Math.round(a.spent / a.budget * 100)}%"></i></span></div></td>
          <td class="num tabnum"><b>${a.leads}</b></td>
          <td class="num tabnum">${euros(a.spent / Math.max(a.leads, 1))}</td>
          <td><label class="switch"><input type="checkbox" data-ad="${a.id}" ${active ? "checked" : ""} ${a.status !== "on" ? "disabled" : ""}><span class="track" aria-hidden="true"></span><span class="sr">Campagne active : ${esc(a.name)}</span></label></td>
        </tr>`; }).join("")}</tbody></table>
      </section>
      ${window.ENTREMIS_GROWTH.creatives()}`;
    }
    return `
    <div class="head">
      <div class="head-text"><h1 class="h1">Marketing</h1><p class="sub">Référencement, publicités, aides et calculateur.</p></div>
      <div class="head-actions">${EM().sampleTag}${tabs}</div>
    </div>${body}`;
  }

  // Créer un devis ou une facture en un geste (téléphone seulement : sur ordinateur, le bouton est dans l'en-tête de Finances)
  const quickCreate = () => { const icon = EM().icon; return `<div class="quick-create">
      <a class="qc" href="#generer" data-gen-new="devis">${icon("plus")}<span><b>Nouveau devis</b><small>Prêt en une minute, PDF compris</small></span></a>
      <a class="qc" href="#generer" data-gen-new="facture">${icon("euro")}<span><b>Nouvelle facture</b><small>Numéro et mentions automatiques</small></span></a>
    </div>`; };
  /* ---------- Plus : toutes les sections (téléphone) ---------- */
  function viewMore(S) {
    const icon = EM().icon;
    const groups = [
      ["Mon espace", [["equipe", "home", "Mon portail"], ["taches", "check", "Tâches"], ["discussions", "chat", "Discussions"], ["processus", "grid", "Processus"], ["notifications", "bell", "Notifications"]]],
      ["Production", [["appel", "phone", "Poste d'appel"], ["leads", "inbox", "Leads"], ["rendez-vous", "cal", "Rendez-vous"], ["zones", "pin", "Zones"]]],
      ["Clients", [["clients", "building", "Clients"], ["sante", "gauge", "Santé et suivi"], ["scripts-equipe", "book", "Scripts"], ["secteurs", "tool", "Secteurs"]]],
      ["Trouver des clients", [["pipeline", "users", "Prospection"], ["propositions", "euro", "Propositions"], ["etudes", "check", "Études de cas"], ["appels", "phone", "Appels"], ["marketing", "signal", "Marketing"]]],
      ["Pilotage", [["chiffres", "gauge", "Chiffres"], ["avancement", "chart", "Avancement"], ["finances", "euro", "Finances"], ["marge", "chart", "Marge"], ["conformite", "shield", "Conformité"]]],
      ["Compte", [["reglages", "user", "Réglages et photo"], ["guide", "info", "Guide de l'app"]]]
    ];
    return `<div class="head"><div class="head-text"><h1 class="h1">Plus</h1><p class="sub">Toutes les pages.</p></div></div>
      ${quickCreate()}
      ${groups.map(([t, items]) => `<section class="ios-group"><p class="ios-title">${t}</p><div class="card ios-list">${items.map(([r, i, l]) => `<a href="#${r}"><span class="ios-ico">${icon(i)}</span><span>${l}</span>${icon("chev")}</a>`).join("")}</div></section>`).join("")}`;
  }

  /* ---------- Feuilles : déposer un document, noter un appel ---------- */
  function sheet(S) {
    if (!O.sheet) return "";
    const esc = EM().esc, clients = TD().clients.map(c => c.name).concat(TD().pipeline.map(p => p.name));
    if (O.sheet === "doc") {
      return `<div class="scrim" data-ops-close></div>
      <form class="sheet" id="doc-form" aria-label="Déposer un devis ou une facture">
        <div class="sheet-grab" aria-hidden="true"></div>
        <div class="sheet-head"><button class="link" type="button" data-ops-close>Annuler</button><b>Nouveau document</b><button class="link strong" type="submit">${O.busy ? "Envoi…" : "Ajouter"}</button></div>
        <fieldset class="field"><legend>Type</legend><div class="seg seg-lg">${[["facture", "Facture"], ["devis", "Devis"]].map(([v, l], i) => `<label><input type="radio" name="kind" value="${v}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
        <label class="field"><span>Client</span><select name="client" required>${S.ctxClient ? "" : `<option value="">Choisir un client</option>`}${[...new Set(clients)].map(c => `<option value="${esc(c)}" ${S.ctxClient === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <div class="field-row">
          <label class="field"><span>Montant HT (€)</span><input name="amount" type="number" min="0" step="50" required inputmode="decimal" placeholder="2400"></label>
          <label class="field"><span>Numéro</span><input name="number" placeholder="${nextNumber("facture")} (auto)"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Date</span><input name="date" type="date" value="${todayIso()}"></label>
          <label class="field"><span>Échéance</span><input name="due" type="date"></label>
        </div>
        <label class="dropzone"><input class="dz-input" name="file" type="file" accept="application/pdf,image/png,image/jpeg"><span class="dz-ico">${EM().icon("download")}</span><span><b data-dz-name>Joindre le PDF</b><small>PDF ou photo, facultatif</small></span></label>
      </form>`;
    }
    const opts = [...new Set((S.ctxClient ? [S.ctxClient] : []).concat(["Prospection"], TD().clients.map(c => c.name)))];
    return `<div class="scrim" data-ops-close></div>
    <form class="sheet" id="call-form" aria-label="Noter un appel">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-ops-close>Annuler</button><b>Noter un appel</b><button class="link strong" type="submit">Ajouter</button></div>
      <div class="field-row">
        <label class="field"><span>Qui avez-vous appelé ?</span><input name="contact" required placeholder="Nom" value="${esc(S.ctxContact || "")}"></label>
        <label class="field"><span>Ville ou entreprise</span><input name="company" placeholder="Particulier – Lyon"></label>
      </div>
      <label class="field"><span>Pour</span><select name="about">${opts.map(o => `<option>${esc(o)}</option>`).join("")}</select></label>
      <fieldset class="field"><legend>Résultat</legend><div class="res-grid">${Object.entries(CALL_RES).map(([k, [l]], i) => `<label><input type="radio" name="result" value="${k}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
      <div class="field-row">
        <label class="field"><span>Durée (minutes)</span><input name="minutes" type="number" min="0" value="5" inputmode="numeric"></label>
        <label class="field"><span>Note</span><input name="note" placeholder="Ce qu'il faut retenir"></label>
      </div>
    </form>`;
  }

  /* ---------- Interactions ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-ops-sheet],[data-ops-close],[data-doc-kind],[data-doc-step],[data-doc-del],[data-call-who],[data-call-del],[data-mk-tab],[data-call-more]");
    if (!t) return false;
    const toast = EM().toast, haptic = TM().haptic;
    if (t.dataset.opsSheet) { O.sheet = t.dataset.opsSheet; render(); setTimeout(() => { const i = document.querySelector(".sheet input:not([type=radio])"); if (i) i.focus(); }, 60); return true; }
    if ("opsClose" in t.dataset) { O.sheet = null; render(); return true; }
    if (t.dataset.docKind) { O.docKind = t.dataset.docKind; haptic("tap"); render(); return true; }
    if (t.dataset.docStep) {
      const [id, st] = t.dataset.docStep.split(":"), d = DOCS.list.find(x => x.id === id); if (!d) return true;
      const before = Object.assign({}, d);
      DOCS.put(Object.assign({}, d, { status: st, [st === "paye" ? "paidAt" : "updatedAt"]: nowIso() }));
      haptic("done"); render();
      toast(st === "paye" ? `${d.number} marquée payée.` : st === "signe" ? `${d.number} marqué signé.` : `${d.number} marqué envoyé.`, () => { DOCS.put(before); render(); });
      return true;
    }
    if (t.dataset.docDel) { const d = DOCS.list.find(x => x.id === t.dataset.docDel); if (!d) return true;
      EM().confirm({ title: `Supprimer ${d.kind === "devis" ? "le devis" : "la facture"} ${d.number || ""} ?`, text: `${d.client} – ${euros(d.amount || 0)}. Il disparaît pour toute l'équipe.` }).then(ok => { if (!ok) return; DOCS.remove(d.id); render(); toast("Document supprimé.", () => { DOCS.put(d); render(); }); });
      return true; }
    if (t.matches("[data-call-more]")) { O.callDays += 3; render(); return true; }
    if (t.dataset.callWho) { O.callWho = t.dataset.callWho; haptic("tap"); render(); return true; }
    if (t.dataset.callDel) { const c = CALLS.list.find(x => x.id === t.dataset.callDel); if (!c) return true;
      EM().confirm({ title: `Supprimer l'appel à ${c.contact} ?`, text: "Il disparaît du journal et des chiffres." }).then(ok => { if (!ok) return; CALLS.remove(c.id); render(); toast("Appel supprimé.", () => { CALLS.put(c); render(); }); });
      return true; }
    if (t.dataset.mkTab) { O.mkTab = t.dataset.mkTab; haptic("tap"); render(); return true; }
    return false;
  }
  function onChange(e) {
    const ad = e.target.closest("[data-ad]"); if (!ad) return false;
    O.adsOff[ad.dataset.ad] = !ad.checked; TM().haptic("tap");
    EM().toast(ad.checked ? "Campagne réactivée (maquette)." : "Campagne mise en pause (maquette : la vraie pub n'est pas touchée).");
    EM().render(); return true;
  }
  async function onSubmit(e, S, render) {
    const f = e.target;
    if (f.id !== "doc-form" && f.id !== "call-form") return false;
    e.preventDefault();
    const fd = new FormData(f);
    if (f.id === "call-form") {
      const contact = String(fd.get("contact") || "").trim();
      if (!contact) { EM().toast("Indiquez qui vous avez appelé."); return true; }
      const c = { id: "c" + Date.now().toString(36), who: S.who, contact, company: String(fd.get("company") || "").trim(), about: fd.get("about"), result: fd.get("result"), minutes: Number(fd.get("minutes")) || 0, note: String(fd.get("note") || "").trim(), at: nowIso() };
      CALLS.put(c); O.sheet = null; TM().haptic("done"); render();
      EM().toast("Appel noté. Toute l'équipe le voit.");
      return true;
    }
    if (O.busy) return true;
    const client = String(fd.get("client") || "").trim(), amount = Number(fd.get("amount"));
    if (!client || !(amount >= 0)) { EM().toast("Indiquez le client et le montant."); return true; }
    const kind = fd.get("kind"), file = fd.get("file");
    const d = { id: "d" + Date.now().toString(36), kind, client, amount, number: String(fd.get("number") || "").trim() || nextNumber(kind), date: fd.get("date") || todayIso(), due: fd.get("due") || "", status: "envoye", by: S.who, createdAt: nowIso() };
    if (file && file.size) {
      if (file.size > 15 * 1024 * 1024) { EM().toast("Fichier trop lourd : 15 Mo au plus."); return true; }
      O.busy = true; render();
      try {
        const assets = DOCS.source === "db" ? await window.claude.use("assets") : null;
        if (assets) { const r = await assets.upload(file, { filename: file.name }); d.asset = r.id; d.fileName = file.name; }
        else { d.localUrl = URL.createObjectURL(file); d.fileName = file.name; }
      } catch (err) {
        O.busy = false; render();
        EM().toast(err && err.code === "not_granted" ? "Vous n'avez pas le droit d'envoyer des fichiers ici. Demandez à Marc l'accès." : "Le fichier n'a pas pu être envoyé. Le document n'est pas ajouté, réessayez.");
        return true;
      }
      O.busy = false;
    }
    DOCS.put(d); O.sheet = null; TM().haptic("done"); render();
    EM().toast(`${kind === "devis" ? "Devis" : "Facture"} ${d.number} ajouté${kind === "devis" ? "" : "e"}.` + (d.localUrl ? " Aperçu local : le fichier ne reste que pendant cette visite." : ""));
    return true;
  }
  function init(render) { DOCS.init(render); CALLS.init(render); }

  window.ENTREMIS_OPS = { quickCreate, docTag, docNext,
    ROUTES: ["finances", "appels", "marketing", "plus"],
    views: { finances: viewFinances, appels: viewCalls, marketing: viewMarketing, plus: viewMore },
    onClick, onChange, onSubmit, init, resetSheet: () => { O.sheet = null; },
    stores: { DOCS, CALLS }, nextNumber, makeStore, arches, sheetHtml: S => sheet(S), sheetOpen: () => !!O.sheet
  };
})();
