/* Entremis — les vraies données (Marc, 20 nov. 2026 : « fais tout sauf les e-mails »).
   Sur le site en ligne, plus aucun exemple : clients, prospects, rendez-vous, dépenses viennent de la base,
   et tout le reste en est tiré (objectifs, rythme, remplacements, semaine, finances, alertes).
   Dans la maquette (aperçu, claude.ai), les exemples restent ; les rendez-vous placés s'y ajoutent.
   Collections : « clients », « prospects », « rdv » (un rendez-vous porte son client : client_id), « costs ».
   Astuce : les tableaux de data.js (team.clients, team.pipeline…) sont réécrits sur place, si bien que toutes les pages
   existantes lisent les vraies données sans changer. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, D = () => window.ENTREMIS_DATA, TD = () => window.ENTREMIS_DATA.team;
  const on = () => !!(window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on());
  const st = {};
  const store = name => st[name] || (st[name] = OPS().makeStore(name, () => []));
  const CLIENTS = () => store("clients"), PROSPECTS = () => store("prospects"), RDV = () => store("rdv"), COSTS = () => store("costs"), MKT = () => store("marketing"), META = () => store("meta");
  const LEADS = () => window.ENTREMIS_LEADS, DOCS = () => window.ENTREMIS_OPS.stores.DOCS, CALLS = () => window.ENTREMIS_OPS.stores.CALLS, TASKS = () => window.ENTREMIS_TEAM.T;

  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const MONTHS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const p2 = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const today = () => on() ? iso(new Date()) : D().today.iso;
  const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const between = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
  const short = s => { const d = new Date(String(s).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()]; };
  const dayLabel = s => { const d = new Date(s + "T12:00:00"); return s === today() ? "aujourd'hui" : s === addDays(today(), 1) ? "demain" : `${DAYS[d.getDay()]} ${d.getDate()}`; };
  const nowHm = () => { const n = new Date(); return p2(n.getHours()) + ":" + p2(n.getMinutes()); };
  const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const isPast = a => a.date < today() || (a.date === today() && (a.end || a.start || "00:00") <= nowHm());

  /* ---------- Les rendez-vous ---------- */
  const rdvs = () => RDV().list.filter(r => r && r.date && r.client_id);
  const rdvFor = id => rdvs().filter(r => r.client_id === id);
  // Le format des rendez-vous d'exemple (pages Rendez-vous, agenda du client)
  const asAppt = r => Object.assign({ client: r.client_id, role: r.role || "Projet à préciser", city: r.city || "", end: r.end || r.start, state: r.state || "new" }, r);

  /* ---------- Les clients : la fiche saisie, plus ce qu'on calcule ---------- */
  function clientRow(c) {
    const start = c.start || (c.createdAt ? String(c.createdAt).slice(0, 10) : today()), days = Math.max(1, Number(c.days) || 30), target = Math.max(0, Number(c.target) || 0);
    const mine = rdvFor(c.id), inCamp = mine.filter(r => r.date >= start);
    const done = inCamp.filter(r => r.state === "ok").length, day = Math.min(days, Math.max(1, between(start, today()) + 1));
    const expected = target * day / days;
    const pace = !target ? "ontrack" : done >= expected + 1 ? "ahead" : done + 1 < expected ? "late" : "ontrack";
    const up = mine.filter(r => r.state !== "replaced" && r.state !== "cancel" && !isPast(r)).sort((a, b) => (a.date + a.start) < (b.date + b.start) ? -1 : 1)[0];
    return Object.assign({ trade: "", offer: "Rendez-vous", owner: "marc", contact: "", contactRole: "Gérant" }, c, {
      done, target, day, days, pace, start,
      next: up ? `${up.name} – ${dayLabel(up.date)} ${up.start}` : "À placer",
      absences: mine.filter(r => r.state === "replaced").length
    });
  }

  /* ---------- Réécrire les tableaux de la maquette avec les vraies données ---------- */
  function rebuild() {
    if (!on()) return;
    const T = TD(), put = (k, arr) => { if (Array.isArray(T[k])) T[k].splice(0, T[k].length, ...arr); else T[k] = arr; };
    const clients = CLIENTS().list.filter(c => c && c.id && c.name && !c.archived).map(clientRow);
    put("clients", clients);
    put("pipeline", PROSPECTS().list.filter(p => p && p.id && p.name).map(p => Object.assign({ trade: "", city: "", stage: "lead", owner: "marc", value: 0, next: "Premier appel à caler", source: "" }, p, { value: Number(p.value) || 0 })));
    const nameOf = id => (clients.find(c => c.id === id) || { name: id }).name;
    put("replacements", rdvs().filter(r => r.state === "replaced").map(r => ({ client: nameOf(r.client_id), person: [r.name, r.role, r.city].filter(Boolean).join(", "), reported: short(r.absentAt || r.date), due: short(addDays(r.date, 7)), owner: r.by || "marc", status: r.replacedBy ? "placed" : "searching", by: (rdvs().find(x => x.id === r.replacedBy) || {}).name || "" })));
    // Les 8 dernières semaines : rendez-vous livrés, appels, devis et factures
    const mon = addDays(today(), -((new Date(today() + "T12:00:00").getDay() + 6) % 7));
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(mon, -7 * (7 - i)));
    const inWeek = (s, w) => s && String(s).slice(0, 10) >= w && String(s).slice(0, 10) <= addDays(w, 6);
    put("weekly", weeks.map(w => ({ label: short(w), value: rdvs().filter(r => r.state === "ok" && inWeek(r.date, w)).length + CALLS().list.filter(c => inWeek(c.at, w)).length + DOCS().list.filter(d => inWeek(d.date, w)).length })));
    // Objectifs du mois
    const m = today().slice(0, 7), month = MONTHS_L[Number(m.slice(5, 7)) - 1];
    const okMonth = rdvs().filter(r => r.state === "ok" && r.date.slice(0, 7) === m).length, targets = clients.reduce((a, c) => a + c.target, 0);
    const fac = DOCS().list.filter(d => d.kind === "facture" && String(d.date || "").slice(0, 7) === m), billed = fac.reduce((a, d) => a + (Number(d.amount) || 0), 0), paid = fac.filter(d => d.status === "paye").reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const won = PROSPECTS().list.filter(p => p.stage === "won").length;
    put("goals", [
      { label: `Rendez-vous livrés en ${month}`, done: okMonth, target: Math.max(1, targets) },
      { label: "Prospects signés", done: won, target: Math.max(1, PROSPECTS().list.length) },
      { label: `Factures payées en ${month}`, done: Math.round(paid), target: Math.max(1, Math.round(billed)) }
    ]);
    // Les leads par métier
    const byTrade = {}; LEADS().list().forEach(l => { if (l.trade) byTrade[l.trade] = (byTrade[l.trade] || 0) + 1; });
    put("trades", Object.keys(byTrade).map(k => ({ label: k, value: byTrade[k] })).sort((a, b) => b.value - a.value));
    // Ce que couvre chaque client (métiers et zones)
    T.coverage = {}; clients.forEach(c => { T.coverage[c.id] = { trades: String(c.trade || "").split(/,| et /).map(s => s.trim()).filter(Boolean), zones: String(c.zone || c.city || "").split(",").map(s => s.trim()).filter(Boolean) }; });
    // Le travail de chacun ce mois-ci
    T.perPerson = {}; T.members.forEach(mb => {
      T.perPerson[mb.id] = [["RDV placés", String(rdvs().filter(r => r.by === mb.id && String(r.at || r.date).slice(0, 7) === m).length)], ["Appels", String(CALLS().list.filter(c => c.who === mb.id && String(c.at).slice(0, 7) === m).length)]];
    });
    // Finances : les factures des 6 derniers mois, les dépenses saisies
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(today() + "T12:00:00"); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return iso(d).slice(0, 7); });
    put("revenue", months.map(k => ({ label: MONTHS_L[Number(k.slice(5, 7)) - 1], value: Math.round(DOCS().list.filter(d => d.kind === "facture" && String(d.date || "").slice(0, 7) === k).reduce((a, d) => a + (Number(d.amount) || 0), 0)), current: k === m || undefined })));
    put("costs", COSTS().list.filter(c => c && c.label).map(c => ({ id: c.id, label: c.label, value: Number(c.value) || 0 })));
    const mk = id => MKT().list.find(r => r.id === id) || {};
    if (T.seo) { T.seo.traffic = months.map(k => ({ label: MONTHS_L[Number(k.slice(5, 7)) - 1], value: Number(mk(k).traffic) || 0, current: k === m || undefined })); T.seo.keywords = []; }
    const leadsMonth = LEADS().list().filter(l => String(l.at || "").slice(0, 7) === m);
    const chan = [["meta", "Meta (Facebook, Instagram)", "Meta", /facebook|instagram|meta/i], ["google", "Google Ads", "Google", /google/i], ["site", "Site et page de demande", "Site", /site|page/i], ["autre", "Autres sources", "Autre", null]];
    const used = new Set();
    put("ads", chan.map(([id, name, channel, re]) => {
      const n = leadsMonth.filter(l => { if (used.has(l.id)) return false; const ok = re ? re.test(l.source || "") : true; if (ok) used.add(l.id); return ok; }).length;
      const spent = Number((mk(m).spend || {})[id]) || 0;
      return { id, name, channel, client: "", budget: spent, spent, leads: n, status: spent || n ? "on" : "off" };
    }));
  }

  /* ---------- Les alertes, tirées des vraies données ---------- */
  function notifs(space) {
    const out = [], t = today(), clients = TD().clients, nameOf = id => (clients.find(c => c.id === id) || { name: id }).name;
    const add = (id, kind, icon, text, day, at, act) => out.push({ id, kind, icon, text, who: "", at, day, act });
    if (space === "client") {
      const id = EM().viewId();
      rdvFor(id).filter(r => r.state !== "cancel" && r.date >= t && r.date <= addDays(t, 7)).sort((a, b) => (a.date + a.start) < (b.date + b.start) ? -1 : 1)
        .forEach(r => add("r-" + r.id, r.date === t ? "warn" : "info", "cal", `Rendez-vous : ${r.name}, ${r.role || "projet"}, ${dayLabel(r.date)} à ${r.start}`, r.date === t ? "Aujourd'hui" : "Bientôt", short(r.at || r.date), { label: "Voir le RDV", href: "#rdv-" + r.id }));
      const res = window.ENTREMIS_CPLUS ? window.ENTREMIS_CPLUS.results() : [];
      rdvFor(id).filter(r => r.state !== "replaced" && r.state !== "cancel" && isPast(r) && !res.some(x => x.id === r.id))
        .forEach(r => add("f-" + r.id, "warn", "check", `Comment s'est passée la visite chez ${r.name} ? Notez le résultat en 10 secondes.`, "À faire", short(r.date), { label: "Renseigner", href: "#resultats" }));
      return out;
    }
    const free = LEADS().list().filter(l => !l.to && l.status !== "perdu" && !l.erased);
    if (free.length) add("leads-" + free.length, "info", "inbox", `${free.length} lead${free.length > 1 ? "s" : ""} à donner à un client`, "Aujourd'hui", "maintenant", { label: "Voir les leads", href: "#leads" });
    rdvs().filter(r => r.date === t && r.state !== "cancel" && r.state !== "replaced").forEach(r => add("t-" + r.id, "info", "cal", `Rendez-vous aujourd'hui chez ${nameOf(r.client_id)} : ${r.name} à ${r.start}`, "Aujourd'hui", r.start, { label: "Rendez-vous", href: "#rendez-vous" }));
    rdvs().filter(r => r.state === "replaced" && !r.replacedBy).forEach(r => add("a-" + r.id, "warn", "swap", `Absence chez ${nameOf(r.client_id)} : ${r.name}. Un remplaçant à placer.`, "À faire", short(r.absentAt || r.date), { label: "Placer un RDV", href: "#rendez-vous" }));
    { const me = EM().S.who, M = id => window.ENTREMIS_TEAM.member(id).name, since = addDays(t, -2);
      TASKS().list.filter(k => k.by && k.by !== me && String(k.createdAt || "").slice(0, 10) >= since).forEach(k => { const pour = [k.who].concat(k.also || []).filter(Boolean);
        add("nt-" + k.id, "info", "check", `${M(k.by)} a ajouté « ${k.title} »${pour.length ? " pour " + pour.map(M).join(", ") : ""}`, "Nouveau", short(String(k.createdAt).slice(0, 10)), { label: "Voir la tâche", task: k.id }); }); }
    TASKS().list.filter(k => k.status !== "done" && k.due && k.due < t).forEach(k => add("k-" + k.id, "danger", "alert", `Tâche en retard : « ${k.title} »`, "À faire", short(k.due), { label: "Voir la tâche", task: k.id }));
    DOCS().list.filter(d => d.kind === "facture" && d.status !== "paye" && d.due && d.due < t).forEach(d => add("d-" + d.id, "warn", "euro", `Facture ${d.number || ""} de ${d.client || ""} : échéance passée le ${short(d.due)}`, "À faire", short(d.due), { label: "Relancer", doc: d.id }));
    (window.ENTREMIS_CRM ? window.ENTREMIS_CRM.dueList() : []).forEach(r => add("crm-" + r.id + "-" + r.nextAt, r.nextAt < t ? "warn" : "info", "phone", `Relancer ${r.name}${r.nextText ? " : " + r.nextText : ""}`, r.nextAt < t ? "En retard" : "Aujourd'hui", short(r.nextAt), { label: "Voir la fiche", href: "#fiche-" + r.id }));
    const bd = window.ENTREMIS_PILOT && window.ENTREMIS_PILOT.backupDue();
    if (bd !== null && bd !== undefined) add("bk-" + t, "info", "download", bd < 0 ? "Aucune sauvegarde sur le Drive commun pour l'instant" : `Dernière sauvegarde sur le Drive il y a ${bd} jours`, "À faire", "", { label: "Sauvegarder", href: "#reglages" });
    clients.filter(c => c.pace === "late").forEach(c => add("p-" + c.id + "-" + c.done, "info", "chart", `${c.name} est en retard sur son objectif : ${c.done} sur ${c.target}, jour ${c.day} sur ${c.days}`, "À suivre", "", { label: "Voir la fiche", href: "#fiche-" + c.id }));
    return out;
  }

  /* ---------- La pub Meta d'un client (Marc, 21 nov. 2026) ----------
     Entremis gère les campagnes dans le compte publicitaire du client (accès partenaire dans son Business Manager) ;
     le client garde son compte et paie Meta. Ici : le compte, l'état de l'accès, le budget, les dépenses du mois,
     et les leads venus de Meta qu'on lui a donnés, d'où le coût par lead. Réservé à l'équipe (pas de client_id). */
  const META_ST = { "": ["Pas encore relié", "neutral"], demande: ["Accès demandé", "warn"], accepte: ["Accès accepté", "ok"], refuse: ["Accès refusé", "danger"] };
  const actOf = r => String((r && r.account) || "").replace(/^act_/i, "").replace(/\D/g, "");
  function metaCard(id) {
    const esc = EM().esc, icon = EM().icon, r = META().list.find(x => x.id === id) || {}, m = today().slice(0, 7);
    const spent = Number((r.spend || {})[m]) || 0, budget = Number(r.budget) || 0, act = actOf(r);
    const leads = LEADS().list().filter(l => l.to === id && /facebook|instagram|meta/i.test(l.source || "") && String(l.at || "").slice(0, 7) === m).length;
    const [sl, sk] = META_ST[r.access || ""] || META_ST[""], eur = n => Math.round(n).toLocaleString("fr-FR") + " €";
    const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
    return `<section class="card meta-card">
      <div class="card-head"><h2 class="h2 h2-brand">${EM().brand("meta", "Meta")}Pub Meta</h2><span class="state state-${sk}">${sl}</span></div>
      ${act ? `<dl class="lp-dl">
        ${row("Compte publicitaire", `${esc(act)} <button class="icon-btn" type="button" data-copy="${esc(act)}" aria-label="Copier l'identifiant">${icon("copy")}</button>`)}
        ${row(`Budget de ${MONTHS_L[Number(m.slice(5, 7)) - 1]}`, budget ? eur(budget) : "à définir")}
        ${row("Dépensé ce mois", spent ? eur(spent) + (budget ? ` sur ${eur(budget)}` : "") : "pas encore saisi")}
        ${row("Leads Meta donnés ce mois", String(leads))}
        ${row("Coût par lead", leads && spent ? eur(spent / leads) : "—")}
      </dl>${r.note ? `<p class="kpi-note">${esc(r.note)}</p>` : ""}`
      : `<p class="body">Reliez le compte publicitaire Facebook du client : vous gérez ses campagnes depuis le Business Manager d'Entremis, il garde son compte et paie Meta.</p>`}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-live-meta="${esc(id)}">${icon("sliders")}${act ? "Modifier" : "Relier son compte pub"}</button>${act ? `<a class="btn btn-ghost" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${esc(act)}" target="_blank" rel="noopener">${icon("arrow")}Ouvrir l'Ads Manager</a>` : ""}</div>
    </section>`;
  }

  /* ---------- Les formulaires : client, prospect, rendez-vous, dépense ---------- */
  const X = { sheet: null, data: {} };
  const field = (name, label, value, attrs) => `<label class="field"><span>${label}</span><input name="${name}" value="${EM().esc(value == null ? "" : value)}" ${attrs || ""}></label>`;
  const select = (name, label, opts, cur) => `<div class="field"><label>${label}</label><select name="${name}">${opts.map(([v, l]) => `<option value="${EM().esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${EM().esc(l)}</option>`).join("")}</select></div>`;
  const members = () => TD().members.map(m => [m.id, m.name]);
  const trades = () => (window.ENTREMIS_SECTORS ? window.ENTREMIS_SECTORS.list() : []).map(s => [s.name, s.name]);
  function sheet(S) {
    if (!X.sheet) return "";
    const d = X.data || {}, esc = EM().esc, k = X.sheet;
    const titles = { meta: "Pub Meta du client", marketing: "Les chiffres du mois", sources: "Faire arriver les leads", client: d.id ? "Modifier le client" : "Nouveau client", prospect: d.id ? "Modifier le prospect" : "Nouveau prospect", rdv: d.id ? "Modifier le rendez-vous" : "Placer un rendez-vous", cost: "Nouvelle dépense" };
    let body = "";
    if (k === "client") body = `${field("name", "Nom de l'entreprise", d.name, 'required maxlength="80"')}
      <div class="field-row">${select("trade", "Métier", trades(), d.trade)}${field("zone", "Zone (ville, département)", d.zone, 'maxlength="80" placeholder="Ex. : Rhône"')}</div>
      <div class="field-row">${field("contact", "Personne à contacter", d.contact, 'maxlength="80"')}${field("phone", "Téléphone", d.phone, 'type="tel" maxlength="20"')}</div>
      <div class="field-row">${select("owner", "Suivi par", members(), d.owner || S.who)}${field("target", "Objectif (rendez-vous)", d.target || 10, 'type="number" min="0" max="500"')}</div>
      <div class="field-row">${field("start", "Début de la campagne", d.start || today(), 'type="date"')}${field("days", "Durée (jours)", d.days || 30, 'type="number" min="1" max="365"')}</div>
      <div class="field-row">${select("pays", "Pays", Object.entries(window.ENTREMIS_MACHINE.PAYS), d.pays || "FR")}${field("tvaIntra", "N° de TVA du client (hors France)", d.tvaIntra, 'maxlength="30" placeholder="Ex. : BE0123456789"')}</div>
      <div class="field-row">${field("prixLead", "Prix par lead (€ HT)", d.prixLead || 50, 'type="number" min="0" step="1"')}${field("plafond", "Plafond par mois (€ HT)", d.plafond || "", 'type="number" min="0" step="50" placeholder="Ex. : 1500"')}</div>
      <div class="field-row">${field("engagement", "Engagement (mois)", d.engagement || 3, 'type="number" min="0" max="24"')}${field("zoneCP", "Zone exclusive (codes postaux)", d.zoneCP, 'maxlength="200" placeholder="Ex. : 69001, 69002, 69003"')}</div>`;
    if (k === "prospect") body = `${field("name", "Nom de l'entreprise", d.name, 'required maxlength="80"')}
      <div class="field-row">${select("trade", "Métier", trades(), d.trade)}${field("city", "Ville", d.city, 'maxlength="60"')}</div>
      <div class="field-row">${select("owner", "Suivi par", members(), d.owner || S.who)}${field("value", "Valeur par mois (€)", d.value || "", 'type="number" min="0" step="50"')}</div>
      <div class="field-row">${select("stage", "Étape", [["lead", "À contacter"], ["call", "Appel fait"], ["quote", "Devis envoyé"], ["won", "Signé"]], d.stage || "lead")}${select("source", "Venu par", [["LinkedIn", "LinkedIn"], ["Site", "Le site"], ["Recommandation", "Recommandation"], ["Téléphone", "Appel sortant"], ["Salon", "Salon"], ["Autre", "Autre"]], d.source || "LinkedIn")}</div>
      ${field("phone", "Téléphone", d.phone, 'type="tel" maxlength="20"')}${field("next", "Prochaine étape", d.next, 'maxlength="120" placeholder="Ex. : rappeler jeudi matin"')}`;
    if (k === "rdv") body = `${select("client_id", "Chez quel client", [["", "Choisir"]].concat(EM().allClients().map(c => [c.id, c.name])), d.client_id || "")}
      <div class="field-row">${field("name", "Particulier (prénom et nom)", d.name, 'required maxlength="80"')}${field("phone", "Téléphone", d.phone, 'type="tel" maxlength="20"')}</div>
      ${field("role", "Projet", d.role, 'maxlength="80" placeholder="Ex. : pompe à chaleur air/eau"')}
      <div class="field-row">${field("address", "Adresse", d.address, 'maxlength="120"')}${field("city", "Ville", d.city, 'maxlength="60"')}</div>
      <div class="field-row">${field("date", "Date", d.date || addDays(today(), 1), 'type="date" required')}${field("start", "Heure", d.start || "10:00", 'type="time" required')}</div>
      ${field("note", "Ce qu'il faut savoir", d.note, 'maxlength="300" placeholder="Ex. : maison de 1985, chaudière fioul, disponible le matin"')}`;
    if (k === "meta") { const m = today().slice(0, 7);
      body = `${field("account", "Identifiant du compte publicitaire", d.account, 'maxlength="40" inputmode="numeric" placeholder="Ex. : act_1234567890 ou 1234567890"')}
      ${select("access", "Accès d'Entremis", [["", "Pas encore demandé"], ["demande", "Demandé, en attente du client"], ["accepte", "Accepté"], ["refuse", "Refusé"]], d.access || "")}
      <div class="field-row">${field("budget", "Budget par mois (€)", d.budget || "", 'type="number" min="0" step="10"')}${field("spent", `Dépensé en ${MONTHS_L[Number(m.slice(5, 7)) - 1]} (€)`, (d.spend || {})[m] || "", 'type="number" min="0" step="1"')}</div>
      ${field("note", "Note", d.note, 'maxlength="160" placeholder="Ex. : campagne PAC Rhône, formulaire « Étude gratuite »"')}
      <p class="field-help">Demander l'accès : dans le Business Manager d'Entremis, Paramètres de l'entreprise › Comptes › Comptes publicitaires › Ajouter › Demander l'accès à un compte publicitaire, puis collez l'identifiant. Le client accepte dans ses Paramètres de l'entreprise › Demandes.</p>`; }
    if (k === "marketing") { const r = MKT().list.find(x => x.id === (d.id || today().slice(0, 7))) || {}, sp = r.spend || {};
      body = `${field("month", "Mois", d.id || today().slice(0, 7), 'type="month" required')}
      ${field("traffic", "Visites du site venues de Google (Search Console)", r.traffic || "", 'type="number" min="0"')}
      <div class="field-row">${field("meta", "Dépense Meta (€)", sp.meta || "", 'type="number" min="0" step="10"')}${field("google", "Dépense Google Ads (€)", sp.google || "", 'type="number" min="0" step="10"')}</div>
      ${field("autre", "Autres dépenses de pub (€)", sp.autre || "", 'type="number" min="0" step="10"')}
      <p class="field-help">Les leads de chaque canal se comptent tout seuls, d'après leur source. Le coût par lead s'en déduit.</p>`; }
    if (k === "sources") { const url = location.origin + location.pathname.replace(/[^/]*$/, "") + "demande.html";
      const api = "https://cnhxrhyugghigkozfpde.supabase.co/rest/v1/rpc/nouveau_lead";
      const ex = JSON.stringify({ p_nom: "Prénom Nom", p_telephone: "06 12 34 56 78", p_ville: "Lyon", p_code_postal: "69003", p_projet: "Pompe à chaleur", p_source: "Facebook", p_email: "", p_message: "", p_consentement: true }, null, 1);
      body = `<p class="body"><b>1. La page de demande</b>, à mettre dans vos publicités et vos posts. Ajoutez la source à la fin de l'adresse pour savoir d'où vient chaque lead.</p>
      <div class="ac-share"><button class="btn btn-ghost" type="button" data-copy="${esc(url + "?source=Facebook")}">${EM().icon("copy")}Lien pour Facebook</button><button class="btn btn-ghost" type="button" data-copy="${esc(url + "?source=Google")}">${EM().icon("copy")}Lien pour Google</button><a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener">${EM().icon("eye")}Voir la page</a></div>
      <p class="body"><b>2. Make ou Zapier</b>, pour les formulaires Facebook et Google (Lead Ads) : à chaque nouveau lead, une requête HTTP POST vers cette adresse, avec les en-têtes <code>apikey</code> et <code>Content-Type: application/json</code>.</p>
      <div class="ac-share"><button class="btn btn-ghost" type="button" data-copy="${esc(api)}">${EM().icon("copy")}Adresse</button><button class="btn btn-ghost" type="button" data-copy="${esc(window.ENTREMIS_CLOUD.key ? window.ENTREMIS_CLOUD.key() : "")}">${EM().icon("copy")}Clé (apikey)</button><button class="btn btn-ghost" type="button" data-copy="${esc(ex)}">${EM().icon("copy")}Exemple de contenu</button></div>
      <p class="field-help">Le lead arrive aussitôt dans la page Leads, chez tout le monde. Un même numéro n'entre qu'une fois par mois. L'accord du particulier (p_consentement) est obligatoire.</p>`; }
    if (k === "cost") body = `${field("label", "Dépense", d.label, 'required maxlength="80" placeholder="Ex. : Publicités en ligne"')}${field("value", "Montant par mois (€)", d.value, 'type="number" min="0" step="10" required')}`;
    return `<div class="scrim" data-live-close></div>
    <form class="sheet" id="live-form" data-kind="${k}" aria-label="${esc(titles[k])}" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-live-close>${k === "sources" ? "Fermer" : "Annuler"}</button><b>${esc(titles[k])}</b>${k === "sources" ? "<span></span>" : `<button class="link strong" type="submit">Enregistrer</button>`}</div>
      ${body}
      <p class="cg-msg live-msg" role="alert" hidden></p>
      ${d.id && k !== "cost" ? `<button class="link ac-del" type="button" data-live-del="${k}:${esc(d.id)}">${k === "rdv" ? "Annuler ce rendez-vous" : k === "client" ? "Archiver ce client" : "Supprimer ce prospect"}</button>` : ""}
    </form>`;
  }
  const open = (kind, data) => { X.sheet = kind; X.data = Object.assign({}, data || {}); EM().render(); setTimeout(() => { const i = document.querySelector("#live-form input, #live-form select"); if (i) i.focus(); }, 60); };

  function onClick(e, S, render) {
    const t = e.target.closest("[data-live-new],[data-live-edit],[data-live-close],[data-live-del],[data-live-rdv],[data-live-replace],[data-live-meta],[data-rdv-state]"); if (!t) return false;
    if (t.dataset.liveMeta) { const cid = t.dataset.liveMeta; open("meta", Object.assign({}, META().list.find(x => x.id === cid) || {}, { cid })); return true; }
    const d = t.dataset;
    if (d.liveNew) { open(d.liveNew, d.liveClient ? { client_id: d.liveClient } : {}); return true; }
    if (d.liveReplace) { const r = RDV().list.find(x => x.id === d.liveReplace) || {}; open("rdv", { replaces: r.id, client_id: r.client_id, role: r.role, city: r.city }); return true; }
    if (d.liveEdit) { const [k, id] = d.liveEdit.split(":"); const src = { client: CLIENTS(), prospect: PROSPECTS(), rdv: RDV() }[k]; open(k, src ? src.list.find(x => x.id === id) : {}); return true; }
    if (d.liveRdv) { // placer un rendez-vous pour un lead (déjà donné à un client, ou à donner)
      const l = LEADS().list().find(x => x.id === d.liveRdv) || {};
      open("rdv", { lead: l.id, client_id: l.to || "", name: l.name, phone: l.phone, role: l.trade, city: l.city }); return true;
    }
    if ("liveClose" in d) { X.sheet = null; render(); return true; }
    if (d.liveDel) {
      const [k, id] = d.liveDel.split(":");
      const label = { rdv: "Annuler ce rendez-vous ?", client: "Archiver ce client ?", prospect: "Supprimer ce prospect ?" }[k];
      EM().confirm({ title: label, text: k === "client" ? "Il disparaît des listes. Ses rendez-vous, résultats et factures restent." : k === "rdv" ? "Le client ne le verra plus dans son agenda." : "Il disparaît de la prospection.", ok: k === "client" ? "Archiver" : k === "rdv" ? "Annuler le RDV" : "Supprimer" }).then(ok => {
        if (!ok) return;
        if (k === "client") { const c = CLIENTS().list.find(x => x.id === id); if (c) CLIENTS().put(Object.assign({}, c, { archived: true })); }
        if (k === "prospect") PROSPECTS().remove(id);
        if (k === "rdv") RDV().remove(id);
        X.sheet = null; render(); EM().toast("C'est fait.");
      });
      return true;
    }
    if (d.rdvState) { // présent, absent, remplacé
      const [id, state] = d.rdvState.split(":"), r = RDV().list.find(x => x.id === id); if (!r) return true;
      RDV().put(Object.assign({}, r, { state }, state === "replaced" ? { absentAt: today() } : {}));
      window.ENTREMIS_TEAM.haptic(state === "ok" ? "done" : "warn"); render();
      EM().toast(state === "ok" ? `${r.name} : visite faite.` : `${r.name} : absent. Placez un remplaçant.`, () => { RDV().put(r); render(); });
      return true;
    }
    return false;
  }

  async function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "live-form") return false;
    e.preventDefault();
    const f = e.target, k = f.dataset.kind, fd = new FormData(f), v = n => String(fd.get(n) || "").trim(), d = X.data || {};
    const say = m => { const p = f.querySelector(".live-msg"); p.textContent = m; p.hidden = false; };
    const now = new Date().toISOString().slice(0, 16);
    if (k === "client") {
      if (!v("name")) return say("Écrivez le nom de l'entreprise."), true;
      const id = d.id || slug(v("name"));
      if (!id) return say("Ce nom ne convient pas : ajoutez des lettres."), true;
      if (!d.id && (CLIENTS().list.some(c => c.id === id) || TD().clients.some(c => c.id === id))) return say("Ce client existe déjà."), true;
      await CLIENTS().put(Object.assign({}, d, { id, client_id: id, name: v("name"), trade: v("trade"), zone: v("zone"), contact: v("contact"), phone: v("phone"), owner: v("owner"), target: Number(v("target")) || 0, start: v("start") || today(), days: Number(v("days")) || 30, prixLead: Number(v("prixLead")) || 50, plafond: Number(v("plafond")) || 0, engagement: Number(v("engagement")) || 0, zoneCP: v("zoneCP"), pays: v("pays") || "FR", tvaIntra: v("tvaIntra"), createdAt: d.createdAt || now }));
    }
    if (k === "prospect") {
      if (!v("name")) return say("Écrivez le nom de l'entreprise."), true;
      // Doublon : même nom ou même téléphone qu'une entreprise déjà connue. Un second clic crée quand même.
      const dup = !d.id && window.ENTREMIS_CRM && window.ENTREMIS_CRM.dupOf(v("name"), v("phone"));
      if (dup && X.dupOk !== v("name") + v("phone")) { X.dupOk = v("name") + v("phone"); return say(`${dup.name} existe déjà (${dup.kind === "client" ? "client" : "prospect"}). Enregistrez encore pour le créer quand même.`), true; }
      X.dupOk = null;
      await PROSPECTS().put(Object.assign({}, d, { stageAt: d.stage === v("stage") ? d.stageAt : today(), id: d.id || "p" + Date.now().toString(36), name: v("name"), trade: v("trade"), city: v("city"), owner: v("owner"), value: Number(v("value")) || 0, stage: v("stage"), source: v("source"), phone: v("phone"), next: v("next") || "Premier appel à caler", createdAt: d.createdAt || now }));
    }
    if (k === "rdv") {
      if (!v("client_id")) return say("Choisissez chez quel client."), true;
      if (!v("name")) return say("Écrivez le nom du particulier."), true;
      if (!v("date") || !v("start")) return say("Choisissez la date et l'heure."), true;
      const [h, mn] = v("start").split(":").map(Number), end = p2(Math.min(23, h + 1)) + ":" + p2(mn || 0);
      const row = Object.assign({}, d, { id: d.id || "r" + Date.now().toString(36), client_id: v("client_id"), name: v("name"), phone: v("phone"), role: v("role"), address: v("address"), city: v("city"), date: v("date"), start: v("start"), end: d.end && d.start === v("start") ? d.end : end, note: v("note"), state: d.state || "new", mode: "Visite technique", by: d.by || S.who, at: d.at || now });
      // Agenda Google relié : le rendez-vous y part tout seul (lancé pendant le clic, sinon Google bloque sa fenêtre)
      if (!d.id && window.ENTREMIS_GCAL && window.ENTREMIS_GCAL.linked()) { const c = EM().allClients().find(x => x.id === row.client_id); window.ENTREMIS_GCAL.addLive(row, c ? c.name : row.client_id); }
      await RDV().put(row);
      // Le rendez-vous qui remplace une absence : on le note sur l'absence
      if (d.replaces) { const old = RDV().list.find(x => x.id === d.replaces); if (old) RDV().put(Object.assign({}, old, { replacedBy: row.id })); }
      if (d.lead) { const l = LEADS().list().find(x => x.id === d.lead); if (l) LEADS().put(Object.assign({}, l, { status: "rdv", to: row.client_id, givenAt: l.givenAt || now, givenBy: l.givenBy || S.who })); }
    }
    if (k === "meta") {
      const cid = d.cid; if (!cid) return say("Client introuvable."), true;
      const act = v("account").replace(/^act_/i, "").replace(/\D/g, ""), m = today().slice(0, 7);
      if (v("account") && act.length < 5) return say("L'identifiant du compte n'a que des chiffres (parfois précédés de « act_»)."), true;
      const cur = META().list.find(x => x.id === cid) || {};
      await META().put(Object.assign({}, cur, { id: cid, account: act, access: v("access"), budget: Number(v("budget")) || 0, note: v("note"), spend: Object.assign({}, cur.spend || {}, { [m]: Number(v("spent")) || 0 }), updatedAt: new Date().toISOString().slice(0, 16) }));
    }
    if (k === "marketing") {
      const id = v("month"); if (!/^\d{4}-\d{2}$/.test(id)) return say("Choisissez le mois."), true;
      await MKT().put({ id, traffic: Number(v("traffic")) || 0, spend: { meta: Number(v("meta")) || 0, google: Number(v("google")) || 0, autre: Number(v("autre")) || 0 } });
    }
    if (k === "sources") { X.sheet = null; render(); return true; }
    if (k === "cost") {
      if (!v("label") || !(Number(v("value")) >= 0)) return say("Écrivez la dépense et son montant."), true;
      await COSTS().put({ id: "k" + Date.now().toString(36), label: v("label"), value: Number(v("value")) || 0 });
    }
    const msg = { meta: "Pub Meta du client enregistrée.", marketing: "Chiffres du mois enregistrés.", client: "Client enregistré.", prospect: "Prospect enregistré.", rdv: "Rendez-vous placé : le client le voit dans son agenda.", cost: "Dépense ajoutée." }[k];
    X.sheet = null; window.ENTREMIS_TEAM.haptic("done"); render(); EM().toast(msg);
    return true;
  }

  const NT = { ready: false, seen: new Set() };
  const keysNow = () => {
    const out = [];
    if (EM().S.space === "client" || EM().S.lock) rdvFor(EM().viewId()).forEach(r => out.push(["rdv:" + r.id, "Nouveau rendez-vous", `${r.name}, ${dayLabel(r.date)} à ${r.start}`, "#rdv-" + r.id]));
    else {
      LEADS().list().forEach(l => out.push(["lead:" + l.id, "Nouveau lead", [l.name, l.trade, l.city].filter(Boolean).join(", "), "#leads"]));
      (window.ENTREMIS_GROWTH && window.ENTREMIS_GROWTH.siteRequests ? window.ENTREMIS_GROWTH.siteRequests() : []).forEach(s => out.push(["site:" + s.id, "Demande du site", `${s.name}${s.who ? ", " + s.who : ""}`, "#pipeline"]));
      // Une tâche ajoutée par quelqu'un d'autre : toute l'équipe est prévenue (Marc, 21 nov. 2026)
      const me = EM().S.who, M = id => window.ENTREMIS_TEAM.member(id).name;
      TASKS().list.filter(t => t.by && t.by !== me).forEach(t => { const pour = [t.who].concat(t.also || []).filter(Boolean);
        out.push(["task:" + t.id, pour.includes(me) ? "Nouvelle tâche pour vous" : `${M(t.by)} a ajouté une tâche`, `${t.title}${pour.includes(me) ? ` (de ${M(t.by)})` : pour.length ? ` (pour ${pour.map(M).join(", ")})` : ""}`, "#taches"]); });
    }
    return out;
  };
  async function alertOn(title, body, href) {
    EM().toast(`${title} : ${body}`); window.ENTREMIS_TEAM.haptic("done");
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try { if (localStorage.getItem("entremis-push") === "1") return; } catch (_) {}   // le téléphone reçoit déjà la vraie notification
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      const opts = { body, icon: "img/apple-touch-icon.png", badge: "img/favicon-32.png", tag: title + body, data: { href } };
      if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
    } catch (_) {}
  }
  function watch() {
    if (!on()) return;
    const ks = keysNow();
    if (!NT.ready) return;
    ks.forEach(([k, title, body, href]) => { if (!NT.seen.has(k)) { NT.seen.add(k); alertOn(title, body, href); } });
  }
  function startWatch() {
    window.ENTREMIS_CLOUD.ready().then(() => setTimeout(() => { keysNow().forEach(([k]) => NT.seen.add(k)); NT.ready = true; }, 6000));
  }
  async function askAlerts() {
    if (!("Notification" in window)) return "absent";
    try { const r = await Notification.requestPermission(); if (r === "granted") await window.ENTREMIS_CLOUD.pushSubscribe(); return r; } catch (_) { return "refuse"; }
  }

  window.ENTREMIS_LIVE = {
    watch, askAlerts, MKT, META, metaCard,
    on, CLIENTS, PROSPECTS, RDV, COSTS, rdvs, rdvFor, asAppt, notifs, sheet, onClick, onSubmit, open,
    sheetOpen: () => !!X.sheet,
    reset: () => { X.sheet = null; },
    init: render => {
      const go = () => { rebuild(); render(); };
      [CLIENTS, PROSPECTS, RDV, COSTS, MKT, META].forEach(s => s().init(go));
      if (on()) startWatch();
      if (on()) { const tick = () => { rebuild(); }; setInterval(() => { tick(); }, 60000); }
    },
    rebuild
  };
})();
