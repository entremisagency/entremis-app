/* Entremis — le CRM (#contacts, Marc, 21 nov. 2026) : clients et prospects au même endroit.
   - recherche, filtres, vues prêtes (à relancer, sans nouvelles depuis 30 jours…), tri par colonne ;
   - une prochaine action datée par entreprise (alerte le jour venu) et des étiquettes (collection « crm ») ;
   - actions groupées : attribuer, étiqueter, exporter en CSV ; import d'une liste de prospects en CSV, doublons écartés ;
   - dans la Prospection : glisser-déposer entre étapes, « depuis N jours », prévision pondérée. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team, TM = () => window.ENTREMIS_TEAM, LIVE = () => window.ENTREMIS_LIVE;
  let ST = null; const CRM = () => ST || (ST = OPS().makeStore("crm", () => []));
  const X = { q: "", view: "tous", owner: "", stage: "", trade: "", tag: "", sort: "next", dir: 1, sel: new Set(), sheet: null, bulk: null, drag: null };
  const today = () => window.ENTREMIS_DATA.today.iso;
  const p2 = n => String(n).padStart(2, "0");
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const days = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 864e5);
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const short = iso => { if (!iso) return ""; const d = days(today(), iso); if (d === 0) return "aujourd'hui"; if (d === 1) return "demain"; if (d === -1) return "hier"; return `${Number(iso.slice(8, 10))} ${MO[Number(iso.slice(5, 7)) - 1]}`; };
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const digits = s => String(s || "").replace(/\D/g, "").slice(-9);
  const STAGE_L = { lead: "À contacter", call: "Appel fait", quote: "Devis envoyé", won: "Signé" };
  const PROB = { lead: 0.1, call: 0.3, quote: 0.6, won: 1 };
  const crmOf = id => CRM().list.find(x => x.id === id) || { id, tags: [] };
  const putCrm = (id, patch, S) => CRM().put(Object.assign({}, crmOf(id), patch, { id, by: S ? S.who : undefined, updatedAt: new Date().toISOString().slice(0, 16) }));

  /* ---------- Les entreprises : clients + prospects, avec leur dernière activité ---------- */
  function rows() {
    const calls = OPS().stores.CALLS.list, docs = OPS().stores.DOCS.list, tasks = (TM().T && TM().T.list) || [], leads = window.ENTREMIS_LEADS ? window.ENTREMIS_LEADS.list() : [];
    const last = (id, name) => { const n = norm(name); let best = "";
      const see = at => { if (at && at > best) best = String(at).slice(0, 10); };
      calls.forEach(c => { if (norm(c.contact) === n || norm(c.about) === n || norm(c.company) === n) see(c.at); });
      docs.forEach(d => { if (d.to === id || norm(d.client) === n) see(d.date || d.createdAt); });
      tasks.forEach(t => { if (norm(t.client) === n) see(t.doneAt || t.createdAt); });
      leads.forEach(l => { if (l.to === id) see(l.givenAt || l.at); });
      see(crmOf(id).updatedAt);
      return best; };
    const info = id => (window.ENTREMIS_FICHE && window.ENTREMIS_FICHE.info(id)) || {};
    const clients = TD().clients.filter(c => !c.archived).map(c => { const f = info(c.id), m = crmOf(c.id), b = window.ENTREMIS_MACHINE ? window.ENTREMIS_MACHINE.billing(c.id, today().slice(0, 7)) : { amount: 0 };
      return { id: c.id, kind: "client", name: c.name, trade: c.trade || "", where: c.zoneCP || c.zone || f.zone || "", pays: c.pays || "FR", owner: c.owner || "marc", stage: "client", stageL: "Client", value: b.amount || 0, valueL: "ce mois",
        phone: c.phone || f.phone || "", email: c.email || f.email || "", contact: c.contact || f.contact || "", last: last(c.id, c.name), nextAt: m.nextAt || "", nextText: m.nextText || "", tags: m.tags || [], since: c.start || "" }; });
    const pros = TM().pipe().map(p => { const f = info(p.id), m = crmOf(p.id);
      return { id: p.id, kind: "prospect", name: p.name, trade: p.trade || "", where: p.city || "", pays: p.pays || "FR", owner: p.owner || "marc", stage: p.stage || "lead", stageL: STAGE_L[p.stage] || "À contacter", value: Number(p.value) || 0, valueL: "par mois",
        phone: p.phone || f.phone || "", email: p.email || f.email || "", contact: p.contact || f.contact || "", last: last(p.id, p.name), nextAt: m.nextAt || "", nextText: m.nextText || p.next || "", tags: m.tags || [], since: p.stageAt || "" }; })
      .filter(p => p.stage !== "won" || !TD().clients.some(c => norm(c.name) === norm(p.name)));
    return clients.concat(pros);
  }
  const VIEWS = [
    ["tous", "Tous", () => true],
    ["miens", "Les miens", (r, S) => r.owner === S.who],
    ["relancer", "À relancer", r => r.nextAt && r.nextAt <= today()],
    ["semaine", "Cette semaine", r => r.nextAt && r.nextAt <= addDays(today(), 7)],
    ["calme", "Sans nouvelles depuis 30 jours", r => !r.last || days(r.last, today()) >= 30],
    ["chauds", "Devis envoyés", r => r.stage === "quote"],
    ["clients", "Clients", r => r.kind === "client"],
    ["prospects", "Prospects", r => r.kind === "prospect"]
  ];
  function filtered(S) {
    const v = VIEWS.find(x => x[0] === X.view) || VIEWS[0], q = norm(X.q);
    let list = rows().filter(r => v[2](r, S));
    if (q) list = list.filter(r => norm([r.name, r.trade, r.where, r.contact, r.phone, r.email, r.tags.join(" ")].join(" ")).includes(q) || (digits(X.q).length >= 4 && digits(r.phone).includes(digits(X.q))));
    if (X.owner) list = list.filter(r => r.owner === X.owner);
    if (X.stage) list = list.filter(r => r.stage === X.stage);
    if (X.trade) list = list.filter(r => r.trade === X.trade);
    if (X.tag) list = list.filter(r => r.tags.includes(X.tag));
    const key = { name: r => norm(r.name), stage: r => ["client", "quote", "call", "lead", "won"].indexOf(r.stage), value: r => -r.value, last: r => r.last ? -Number(r.last.replace(/-/g, "")) : 0, next: r => r.nextAt || "9999", owner: r => r.owner }[X.sort] || (r => r.name);
    return list.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * X.dir || norm(a.name).localeCompare(norm(b.name)); });
  }
  const allTags = () => [...new Set(CRM().list.flatMap(x => x.tags || []))].sort((a, b) => a.localeCompare(b));

  /* ---------- La page Contacts ---------- */
  function view(S) {
    const esc = EM().esc, icon = EM().icon, all = rows(), list = filtered(S), narrow = EM().isNarrow();
    const due = all.filter(r => r.nextAt && r.nextAt <= today()).length, quiet = all.filter(r => !r.last || days(r.last, today()) >= 30).length;
    const forecast = all.filter(r => r.kind === "prospect").reduce((a, r) => a + r.value * (PROB[r.stage] || 0), 0);
    X.sel.forEach(id => { if (!all.some(r => r.id === id)) X.sel.delete(id); });
    const kpi = (l, v, n) => `<article class="kpi" role="listitem"><p class="kpi-label">${l}</p><div><p class="kpi-value">${v}</p><p class="kpi-note">${n}</p></div></article>`;
    const fs = (attr, label, opts, cur) => EM().fsel(attr, label, [["", "Tous"]].concat(opts), cur);
    const th = (k, l, cls) => `<th class="${cls || ""}"><button class="crm-sort${X.sort === k ? " is-on" : ""}" type="button" data-crm-sort="${k}">${l}${X.sort === k ? `<span aria-hidden="true">${X.dir > 0 ? "↑" : "↓"}</span>` : ""}</button></th>`;
    const nextCell = r => r.nextAt ? `<button class="crm-next${r.nextAt < today() ? " is-late" : r.nextAt === today() ? " is-today" : ""}" type="button" data-crm-plan="${esc(r.id)}"><b>${short(r.nextAt)}</b><span>${esc(r.nextText || "À faire")}</span></button>`
      : `<button class="link crm-plan" type="button" data-crm-plan="${esc(r.id)}">${icon("plus")}Planifier</button>`;
    const stagePill = r => r.kind === "client" ? `<span class="state state-ok">Client</span>` : `<span class="crm-stage crm-stage-${r.stage}">${esc(r.stageL)}</span>`;
    const tags = r => r.tags.length ? `<span class="crm-tags">${r.tags.map(t => `<span class="crm-tag">${esc(t)}</span>`).join("")}</span>` : "";
    const lastL = r => r.last ? (days(r.last, today()) <= 0 ? "aujourd'hui" : `il y a ${days(r.last, today())} j`) : "jamais";
    const body = narrow
      ? `<ul class="crm-cards">${list.map(r => `<li class="crm-card${X.sel.has(r.id) ? " is-sel" : ""}"><label class="crm-check"><input type="checkbox" data-crm-sel="${esc(r.id)}" ${X.sel.has(r.id) ? "checked" : ""} aria-label="Sélectionner ${esc(r.name)}"></label>
          <a class="crm-card-main" href="#fiche-${esc(r.id)}"><b>${esc(r.name)}</b><span>${esc([r.trade, r.where].filter(Boolean).join(" · "))}</span></a>
          <div class="crm-card-meta">${stagePill(r)}<span class="who-inline">${TM().avatar(r.owner, "av")}</span><span class="muted">${lastL(r)}</span></div>${tags(r)}<div class="crm-card-next">${nextCell(r)}</div></li>`).join("")}</ul>`
      : `<div class="crm-table-wrap"><table class="table crm-table"><thead><tr><th class="crm-c"><input type="checkbox" data-crm-all ${list.length && list.every(r => X.sel.has(r.id)) ? "checked" : ""} aria-label="Tout sélectionner"></th>
          ${th("name", "Entreprise")}${th("stage", "Étape")}${th("value", "Valeur", "num")}${th("last", "Dernière activité")}${th("next", "Prochaine action")}${th("owner", "Suivi par")}</tr></thead>
          <tbody>${list.map(r => `<tr class="${X.sel.has(r.id) ? "is-sel" : ""}"><td class="crm-c"><input type="checkbox" data-crm-sel="${esc(r.id)}" ${X.sel.has(r.id) ? "checked" : ""} aria-label="Sélectionner ${esc(r.name)}"></td>
            <td class="org"><a class="org-link" href="#fiche-${esc(r.id)}"><b>${esc(r.name)}</b></a><span>${esc([r.trade, r.where, r.pays !== "FR" ? r.pays : ""].filter(Boolean).join(" · "))}</span>${tags(r)}</td>
            <td>${stagePill(r)}</td><td class="num tabnum">${r.value ? r.value.toLocaleString("fr-FR") + " €" : "—"}<small class="crm-sub">${r.value ? r.valueL : ""}</small></td>
            <td class="muted">${lastL(r)}</td><td>${nextCell(r)}</td><td><span class="who-inline">${TM().avatar(r.owner, "av")}${esc(TM().member(r.owner).name)}</span></td></tr>`).join("")}</tbody></table></div>`;
    return `<div class="head"><div class="head-text"><h1 class="h1">Contacts</h1><p class="sub">Clients et prospects au même endroit : qui relancer, quand, et où en est chacun.</p></div>
      <div class="head-actions"><label class="btn btn-ghost crm-import">${icon("download")}Importer un CSV<input type="file" accept=".csv,text/csv" data-crm-import hidden></label><button class="btn btn-primary" type="button" data-live-new="prospect">${icon("plus")}Nouveau prospect</button></div></div>
      <div class="kpis kpis-4" role="list">${kpi("À relancer aujourd'hui", due, due ? "prochaine action dépassée ou du jour" : "rien en retard")}${kpi("Sans nouvelles", quiet, "depuis 30 jours ou plus")}${kpi("Prévision pondérée", Math.round(forecast).toLocaleString("fr-FR") + " €", "par mois, selon l'étape de chaque prospect")}${kpi("Entreprises", all.length, `${all.filter(r => r.kind === "client").length} clients, ${all.filter(r => r.kind === "prospect").length} prospects`)}</div>
      <section class="card crm">
        <div class="crm-views" role="tablist" aria-label="Vues">${VIEWS.map(([k, l, f]) => { const n = all.filter(r => f(r, S)).length; return `<button class="crm-view" type="button" role="tab" aria-selected="${X.view === k}" data-crm-view="${k}">${l}<span class="tabnum">${n}</span></button>`; }).join("")}</div>
        <div class="crm-tools"><label class="crm-search">${icon("search")}<input type="search" data-crm-q value="${esc(X.q)}" placeholder="Nom, ville, téléphone, étiquette…" aria-label="Chercher un contact"></label>
          <div class="crm-filters">${fs("crm-owner", "Suivi par", TD().members.map(m => [m.id, m.name]), X.owner)}${fs("crm-stage", "Étape", [["client", "Client"]].concat(Object.entries(STAGE_L).filter(([k]) => k !== "won")), X.stage)}
          ${fs("crm-trade", "Métier", [...new Set(all.map(r => r.trade).filter(Boolean))].sort().map(t => [t, t]), X.trade)}${allTags().length ? fs("crm-tag", "Étiquette", allTags().map(t => [t, t]), X.tag) : ""}</div>
          ${X.q || X.owner || X.stage || X.trade || X.tag ? `<button class="link" type="button" data-crm-clear>Effacer les filtres</button>` : ""}</div>
        ${X.sel.size ? `<div class="crm-bulk" role="region" aria-label="Actions groupées"><b>${X.sel.size} sélectionné${X.sel.size > 1 ? "s" : ""}</b>
          ${EM().fsel("crm-assign", "Attribuer à", [["", "Choisir"]].concat(TD().members.map(m => [m.id, m.name])), "")}
          <button class="btn btn-ghost" type="button" data-crm-bulk-tag>${icon("pin")}Étiqueter</button><button class="btn btn-ghost" type="button" data-crm-bulk-plan>${icon("cal")}Planifier une relance</button>
          <button class="btn btn-ghost" type="button" data-crm-export>${icon("download")}Exporter</button><button class="link" type="button" data-crm-unsel>Désélectionner</button></div>` : ""}
        ${list.length ? body : `<p class="body crm-empty">${all.length ? "Aucun contact ne correspond. Essayez une autre vue ou effacez les filtres." : "Aucun contact pour l'instant. Ajoutez un prospect ou importez une liste."}</p>`}
        <p class="kpi-note">${list.length} sur ${all.length} · <button class="link" type="button" data-crm-export-all>Exporter cette liste en CSV</button></p>
      </section>`;
  }

  /* ---------- La fenêtre « prochaine action et étiquettes » ---------- */
  function sheet(S) {
    if (!X.sheet) return "";
    const esc = EM().esc, ids = X.sheet === "bulk" ? [...X.sel] : [X.sheet], one = ids.length === 1 ? rows().find(r => r.id === ids[0]) : null, m = one ? crmOf(one.id) : {};
    const preset = (n, l) => `<button class="pill" type="button" data-crm-preset="${addDays(today(), n)}">${l}</button>`;
    const nextMon = (() => { const d = new Date(today() + "T12:00:00"), k = (8 - d.getDay()) % 7 || 7; return k; })();
    return `<div class="scrim" data-crm-close></div><form class="sheet" id="crm-form" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-crm-close>Annuler</button><b>${one ? esc(one.name) : `${ids.length} entreprises`}</b><button class="link strong" type="submit">Enregistrer</button></div>
      <p class="set-title">Prochaine action</p>
      <div class="crm-presets">${preset(1, "Demain")}${preset(3, "Dans 3 jours")}${preset(nextMon, "Lundi")}${preset(14, "Dans 2 semaines")}${preset(30, "Dans un mois")}</div>
      <div class="field-row"><label class="field"><span>Le</span><input name="nextAt" type="date" value="${esc(m.nextAt || "")}"></label>
        <label class="field"><span>Quoi</span><input name="nextText" maxlength="120" value="${esc(m.nextText || "")}" placeholder="Ex. : rappeler pour le devis"></label></div>
      ${one ? `<p class="set-title">Étiquettes</p><label class="field"><span>Séparées par des virgules</span><input name="tags" maxlength="200" value="${esc((m.tags || []).join(", "))}" placeholder="Ex. : Lyon, gros compte, recommandé par Red"></label>
        ${allTags().length ? `<div class="crm-presets">${allTags().map(t => `<button class="pill" type="button" data-crm-addtag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
        ${m.nextAt ? `<button class="btn btn-ghost" type="button" data-crm-done="${esc(one.id)}">${EM().icon("check")}Marquer la relance comme faite</button>` : ""}` : ""}
    </form>`;
  }

  /* ---------- Import, export, doublons ---------- */
  function dupOf(name, phone, exceptId) {
    const n = norm(name), d = digits(phone);
    return rows().find(r => r.id !== exceptId && ((n && norm(r.name) === n) || (d.length >= 8 && digits(r.phone) === d))) || null;
  }
  function parseCsv(text) {
    const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const out = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; } else cur += ch; }
    if (cur || row.length) { row.push(cur); out.push(row); }
    return out.filter(r => r.some(x => String(x).trim()));
  }
  const COLS = { name: ["nom", "entreprise", "societe", "raison sociale", "name", "company"], trade: ["metier", "activite", "trade", "secteur"], city: ["ville", "city", "commune"], phone: ["telephone", "tel", "phone", "mobile", "portable"],
    email: ["email", "e mail", "mail", "courriel"], contact: ["contact", "interlocuteur", "dirigeant", "gerant", "prenom nom"], value: ["valeur", "value", "montant", "potentiel"], source: ["source", "origine"], note: ["note", "notes", "commentaire"] };
  async function importCsv(file, S, render) {
    const text = await file.text(), table = parseCsv(text.replace(/^﻿/, "")); if (table.length < 2) { EM().toast("Le fichier est vide ou n'a pas de ligne de titres."); return; }
    const head = table[0].map(norm), idx = {}; Object.entries(COLS).forEach(([k, names]) => { const i = head.findIndex(h => names.includes(h)); if (i >= 0) idx[k] = i; });
    if (idx.name === undefined) { EM().toast("Colonne « Nom » ou « Entreprise » introuvable dans la première ligne."); return; }
    let added = 0, dup = 0; const seen = new Set();
    for (const r of table.slice(1)) {
      const g = k => idx[k] === undefined ? "" : String(r[idx[k]] || "").trim(), name = g("name"); if (!name) continue;
      const key = norm(name) + "|" + digits(g("phone")); if (seen.has(key) || dupOf(name, g("phone"))) { dup++; continue; } seen.add(key);
      const p = { id: "p" + Date.now().toString(36) + added, name: name.slice(0, 80), trade: g("trade").slice(0, 60), city: g("city").slice(0, 60), phone: g("phone").slice(0, 20), email: g("email").slice(0, 120), contact: g("contact").slice(0, 80),
        value: Number(String(g("value")).replace(/[^\d.,]/g, "").replace(",", ".")) || 0, source: g("source").slice(0, 60) || "Import", note: g("note").slice(0, 500), stage: "lead", owner: S.who, next: "Premier appel à caler", createdAt: new Date().toISOString().slice(0, 16), stageAt: today() };
      if (LIVE().on()) await LIVE().PROSPECTS().put(p); else TM().pipe().push(p);
      added++;
    }
    TM().haptic("done"); render(); EM().toast(`${added} prospect${added > 1 ? "s" : ""} importé${added > 1 ? "s" : ""}${dup ? `, ${dup} doublon${dup > 1 ? "s" : ""} écarté${dup > 1 ? "s" : ""}` : ""}.`);
  }
  function exportCsv(list, name) {
    const cell = v => { const s = String(v == null ? "" : v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Entreprise", "Type", "Étape", "Métier", "Ville ou zone", "Pays", "Contact", "Téléphone", "E-mail", "Valeur (€)", "Dernière activité", "Prochaine action", "Le", "Suivi par", "Étiquettes"]]
      .concat(list.map(r => [r.name, r.kind === "client" ? "Client" : "Prospect", r.stageL, r.trade, r.where, r.pays, r.contact, r.phone, r.email, r.value, r.last, r.nextText, r.nextAt, TM().member(r.owner).name, r.tags.join(", ")]));
    const blob = new Blob(["﻿" + lines.map(l => l.map(cell).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    EM().toast(`${list.length} contact${list.length > 1 ? "s" : ""} exporté${list.length > 1 ? "s" : ""}.`);
  }

  /* ---------- Fiche : la carte « Prochaine action » ---------- */
  function ficheCard(id) {
    const esc = EM().esc, icon = EM().icon, m = crmOf(id);
    return `<section class="card"><div class="card-head"><h2 class="h2">Prochaine action</h2>${m.nextAt ? `<span class="crm-next${m.nextAt < today() ? " is-late" : m.nextAt === today() ? " is-today" : ""}"><b>${short(m.nextAt)}</b></span>` : ""}</div>
      ${m.nextAt ? `<p class="body">${esc(m.nextText || "À faire")}</p>` : `<p class="body">Rien de prévu. Une relance datée apparaît dans Contacts et dans les notifications le jour venu.</p>`}
      ${(m.tags || []).length ? `<span class="crm-tags">${m.tags.map(t => `<span class="crm-tag">${esc(t)}</span>`).join("")}</span>` : ""}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-crm-plan="${esc(id)}">${icon("cal")}${m.nextAt ? "Modifier" : "Planifier une relance"}</button>${m.nextAt ? `<button class="btn btn-ghost" type="button" data-crm-done="${esc(id)}">${icon("check")}Faite</button>` : ""}</div></section>`;
  }
  // Les relances du jour, pour les notifications de l'équipe
  const dueList = () => rows().filter(r => r.nextAt && r.nextAt <= today());

  /* ---------- Prospection : glisser-déposer entre étapes ---------- */
  document.addEventListener("dragstart", e => { const d = e.target.closest && e.target.closest(".deal[data-deal-id]"); if (!d) return; X.drag = d.dataset.dealId; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", X.drag); } catch (_) {} d.classList.add("is-drag"); });
  document.addEventListener("dragend", e => { const d = e.target.closest && e.target.closest(".deal"); if (d) d.classList.remove("is-drag"); document.querySelectorAll(".stage.is-over").forEach(s => s.classList.remove("is-over")); });
  document.addEventListener("dragover", e => { const s = e.target.closest && e.target.closest(".stage[data-stage]"); if (!s || !X.drag) return; e.preventDefault(); document.querySelectorAll(".stage.is-over").forEach(x => x !== s && x.classList.remove("is-over")); s.classList.add("is-over"); });
  document.addEventListener("drop", e => { const s = e.target.closest && e.target.closest(".stage[data-stage]"); if (!s || !X.drag) return; e.preventDefault(); s.classList.remove("is-over");
    const id = X.drag, st = s.dataset.stage, p = TM().pipe().find(x => x.id === id); X.drag = null; if (!p || p.stage === st) return;
    const prev = p.stage; TM().setStage(id, st); TM().haptic(st === "won" ? "done" : "tap"); EM().render();
    EM().toast(st === "won" ? `${p.name} est signé.` : `${p.name} : ${STAGE_L[st].toLowerCase()}.`, () => { TM().setStage(id, prev); EM().render(); }); });

  /* ---------- Clics, saisies, envois ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-crm-view],[data-crm-sort],[data-crm-clear],[data-crm-plan],[data-crm-close],[data-crm-preset],[data-crm-addtag],[data-crm-done],[data-crm-unsel],[data-crm-export],[data-crm-export-all],[data-crm-bulk-tag],[data-crm-bulk-plan],[data-crm-owner],[data-crm-stage],[data-crm-trade],[data-crm-tag],[data-crm-assign]"); if (!t) return false;
    const d = t.dataset;
    if (d.crmView) { X.view = d.crmView; TM().haptic("tap"); render(); return true; }
    if (d.crmSort) { X.dir = X.sort === d.crmSort ? -X.dir : 1; X.sort = d.crmSort; render(); return true; }
    if ("crmClear" in d) { X.q = X.owner = X.stage = X.trade = X.tag = ""; render(); return true; }
    if (d.crmOwner !== undefined) { X.owner = d.crmOwner; render(); return true; }
    if (d.crmStage !== undefined) { X.stage = d.crmStage; render(); return true; }
    if (d.crmTrade !== undefined) { X.trade = d.crmTrade; render(); return true; }
    if (d.crmTag !== undefined) { X.tag = d.crmTag; render(); return true; }
    if (d.crmAssign !== undefined) { if (!d.crmAssign) return true; const who = d.crmAssign, ids = [...X.sel];
      ids.forEach(id => { const r = rows().find(x => x.id === id); if (!r) return;
        if (r.kind === "prospect") { if (LIVE().on()) { const row = LIVE().PROSPECTS().list.find(x => x.id === id); if (row) LIVE().PROSPECTS().put(Object.assign({}, row, { owner: who })); } else { const p = TM().pipe().find(x => x.id === id); if (p) p.owner = who; } }
        else if (LIVE().on()) { const row = LIVE().CLIENTS().list.find(x => x.id === id); if (row) LIVE().CLIENTS().put(Object.assign({}, row, { owner: who })); } });
      X.sel.clear(); TM().haptic("done"); render(); EM().toast(`${ids.length} contact${ids.length > 1 ? "s" : ""} attribué${ids.length > 1 ? "s" : ""} à ${TM().member(who).name}.`); return true; }
    if (d.crmPlan) { X.sheet = d.crmPlan; render(); return true; }
    if ("crmBulkPlan" in d) { X.sheet = "bulk"; render(); return true; }
    if ("crmBulkTag" in d) { const tag = window.prompt("Étiquette à ajouter aux contacts sélectionnés", ""); if (!tag || !tag.trim()) return true;
      [...X.sel].forEach(id => { const m = crmOf(id); putCrm(id, { tags: [...new Set((m.tags || []).concat(tag.trim().slice(0, 30)))] }, S); }); TM().haptic("done"); render(); EM().toast(`Étiquette « ${tag.trim()} » ajoutée.`); return true; }
    if ("crmClose" in d) { X.sheet = null; render(); return true; }
    if (d.crmPreset) { const i = document.querySelector('#crm-form [name="nextAt"]'); if (i) i.value = d.crmPreset; TM().haptic("tap"); return true; }
    if (d.crmAddtag) { const i = document.querySelector('#crm-form [name="tags"]'); if (i) { const cur = i.value.split(",").map(x => x.trim()).filter(Boolean); if (!cur.includes(d.crmAddtag)) cur.push(d.crmAddtag); i.value = cur.join(", "); } return true; }
    if (d.crmDone) { const m = crmOf(d.crmDone), name = (rows().find(r => r.id === d.crmDone) || {}).name || ""; putCrm(d.crmDone, { nextAt: "", nextText: "", lastDone: m.nextText || "", lastDoneAt: today() }, S); X.sheet = null; TM().haptic("done"); render(); EM().toast(`Relance faite${name ? " : " + name : ""}. Pensez à planifier la suivante.`); return true; }
    if ("crmUnsel" in d) { X.sel.clear(); render(); return true; }
    if ("crmExport" in d) { exportCsv(rows().filter(r => X.sel.has(r.id)), `Entremis – contacts ${today()}.csv`); return true; }
    if ("crmExportAll" in d) { exportCsv(filtered(S), `Entremis – contacts ${today()}.csv`); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "crm-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), nextAt = String(fd.get("nextAt") || ""), nextText = String(fd.get("nextText") || "").trim().slice(0, 120);
    const ids = X.sheet === "bulk" ? [...X.sel] : [X.sheet];
    ids.forEach(id => { const patch = { nextAt, nextText }; if (fd.has("tags")) patch.tags = [...new Set(String(fd.get("tags") || "").split(",").map(x => x.trim().slice(0, 30)).filter(Boolean))]; putCrm(id, patch, S); });
    if (X.sheet === "bulk") X.sel.clear();
    X.sheet = null; TM().haptic("done"); render(); EM().toast(nextAt ? `Relance planifiée ${short(nextAt)}.` : "Enregistré."); return true;
  }
  document.addEventListener("input", e => {
    if (!e.target.matches) return;
    if (e.target.matches("[data-crm-q]")) { X.q = e.target.value; const pos = e.target.selectionStart; EM().render(); const i = document.querySelector("[data-crm-q]"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} } }
  });
  document.addEventListener("change", e => {
    if (!e.target.matches) return;
    if (e.target.matches("[data-crm-sel]")) { const id = e.target.dataset.crmSel; e.target.checked ? X.sel.add(id) : X.sel.delete(id); EM().render(); return; }
    if (e.target.matches("[data-crm-all]")) { const ids = filtered(EM().S).map(r => r.id); e.target.checked ? ids.forEach(id => X.sel.add(id)) : X.sel.clear(); EM().render(); return; }
    if (e.target.matches("[data-crm-import]")) { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) importCsv(f, EM().S, () => EM().render()).catch(() => EM().toast("Le fichier n'a pas pu être lu.")); }
  });

  window.ENTREMIS_CRM = { nextOf: id => crmOf(id), short, view, sheet, ficheCard, dupOf, dueList, onClick, onSubmit, init: render => CRM().init(render), reset: () => { X.sheet = null; } };
})();
