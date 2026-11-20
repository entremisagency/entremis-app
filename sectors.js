/* Entremis — secteurs et parcours (#secteurs, espace agence), et les cartes des campagnes (page Clients).
   Un seul chemin pour tous les métiers : on rappelle, on vérifie 4 points, on livre, c'est garanti.
   Ce qui change d'un métier à l'autre tient dans la « façon de livrer » (le parcours) :
   - rdv    : projets planifiés (pompe à chaleur, solaire, isolation, clim…) → une visite dans l'agenda de l'installateur ;
   - direct : dépannages urgents (serrurerie, plomberie, électricité…) → l'appel est passé à l'artisan tout de suite ;
   - devis  : chantiers chiffrés sur photos (toiture, fenêtres…) → la demande arrive complète, prête à chiffrer.
   Un nouveau métier = une ligne (nom, mots reconnus, parcours, dessin, et si besoin ses 4 questions à lui).
   L'app suit d'elle-même : textes de l'espace client, questions des leads, unité des objectifs, dessin des cartes.
   Partagé : collection « sectors » (seulement ce qui a été ajouté ou modifié ; la liste de départ est ici).
   La façon de livrer d'un client peut être changée sur sa fiche (champ « parcours », collection « accounts »). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;

  const PARCOURS = {
    rdv: { id: "rdv", name: "Rendez-vous", long: "Rendez-vous chez le client", for: "Projets planifiés. On vérifie le projet, puis une visite arrive dans l'agenda de l'installateur.",
      many: "rendez-vous", abbr: "RDV", path: ["Demande", "RDV"], doneLabel: "RDV livrés", nextLabel: "Prochain",
      delivered: "rendez-vous livrés", next: "Votre prochain rendez-vous", nextShort: "Prochain RDV", none: "Pas de rendez-vous prévu",
      presence: "Présence aux RDV", presenceHelp: "Rendez-vous où le client était là", ok: "Présents", bad: "Remplacés",
      guarantee: "Un rendez-vous manqué ? On en place un autre.",
      criteria: ["Projet", "Budget", "Propriétaire", "Délai"],
      steps: [
        { icon: "phone", title: "On rappelle", text: "Chaque demande est rappelée tout de suite." },
        { icon: "check", title: "On vérifie", text: "Projet, budget, propriétaire, délai." },
        { icon: "cal", title: "Vous recevez", text: "Le rendez-vous arrive dans votre agenda." },
        { icon: "shield", title: "Garanti", text: "Absent ? On le remplace, sans frais." }] },
    direct: { id: "direct", name: "Transfert direct", long: "Appel transféré en direct", for: "Dépannages urgents. L'appel est vérifié, puis passé à l'artisan tout de suite.",
      many: "interventions", abbr: "interv.", path: ["Appel", "Transfert"], doneLabel: "Interv. livrées", nextLabel: "Prochaine",
      delivered: "interventions livrées", next: "Votre prochaine intervention", nextShort: "Prochaine interv.", none: "Pas d'intervention prévue",
      presence: "Appels valides", presenceHelp: "Appels où l'urgence était réelle", ok: "Valides", bad: "Remplacés",
      guarantee: "Un faux appel ? On vous en passe un autre.",
      criteria: ["Urgence réelle", "Dans la zone", "Type de panne", "Joignable"],
      steps: [
        { icon: "phone", title: "On décroche", text: "Chaque appel est pris tout de suite, même le soir." },
        { icon: "check", title: "On vérifie", text: "Urgence, zone, type de panne." },
        { icon: "swap", title: "On vous le passe", text: "Le particulier vous est transféré en direct." },
        { icon: "shield", title: "Garanti", text: "Faux appel ou hors zone ? Remplacé, sans frais." }] },
    devis: { id: "devis", name: "Devis", long: "Demande de devis complète", for: "Chantiers chiffrés sur photos. La demande arrive avec photos, mesures et budget.",
      many: "demandes de devis", abbr: "devis", path: ["Demande", "Devis"], doneLabel: "Devis livrés", nextLabel: "Dernière",
      delivered: "demandes livrées", next: "Votre dernière demande", nextShort: "Dernière demande", none: "Pas de demande cette semaine",
      presence: "Demandes valides", presenceHelp: "Demandes complètes et sérieuses", ok: "Valides", bad: "Remplacées",
      guarantee: "Une fausse demande ? On en livre une autre.",
      criteria: ["Projet", "Budget", "Propriétaire", "Photos et mesures"],
      steps: [
        { icon: "phone", title: "On rappelle", text: "Chaque demande est rappelée tout de suite." },
        { icon: "check", title: "On vérifie", text: "Projet, budget, propriétaire, photos." },
        { icon: "inbox", title: "Vous chiffrez", text: "La demande arrive complète, prête à chiffrer." },
        { icon: "shield", title: "Garanti", text: "Fausse demande ? Remplacée, sans frais." }] }
  };

  // Les métiers de départ. Ce qui est ajouté ou modifié dans l'app passe dans la collection « sectors » et prend le dessus.
  const BASE = [
    { id: "pac", name: "Pompes à chaleur", short: "PAC", keys: "pompe à chaleur, pompes à chaleur, pac", parcours: "rdv", art: "pac", order: 1 },
    { id: "solaire", name: "Panneaux solaires", short: "Solaire", keys: "solaire, photovoltaïque", parcours: "rdv", art: "solar", order: 2 },
    { id: "isolation", name: "Isolation", keys: "isolation, combles", parcours: "rdv", art: "insul", order: 3 },
    { id: "clim", name: "Climatisation", short: "Clim", keys: "climatisation, clim", parcours: "rdv", art: "clim", order: 4 },
    { id: "chauffe-eau", name: "Chauffe-eau", keys: "chauffe-eau, ballon", parcours: "rdv", art: "heater", order: 5 },
    { id: "plomberie", name: "Plomberie", keys: "plomberie, fuite, canalisation", parcours: "direct", art: "tap", order: 6 },
    { id: "serrurerie", name: "Serrurerie", keys: "serrurerie, serrure, porte blindée, portes blindées", parcours: "direct", art: "door", order: 7 },
    { id: "electricite", name: "Électricité", keys: "électricité, électricien, tableau électrique", parcours: "direct", art: "elec", order: 8 },
    { id: "fenetres", name: "Fenêtres et volets", short: "Fenêtres", keys: "fenêtre, fenêtres, menuiserie, volet", parcours: "devis", art: "window", order: 9 },
    { id: "toiture", name: "Toiture", keys: "toiture, couverture, charpente, gouttière", parcours: "devis", art: "roof", order: 10 }
  ];
  const ARTS = [["pac", "Pompe à chaleur"], ["solar", "Panneau solaire"], ["clim", "Climatiseur"], ["insul", "Isolant"], ["heater", "Chauffe-eau"], ["tap", "Robinet"], ["door", "Porte blindée"], ["elec", "Tableau électrique"], ["window", "Fenêtre"], ["roof", "Toiture"], ["house", "Maison"]];

  let ST = null;
  const store = () => ST || (ST = OPS().makeStore("sectors", () => []));
  function list() {
    const byId = {};
    BASE.forEach(x => { byId[x.id] = Object.assign({}, x); });
    store().list.forEach(x => { byId[x.id] = Object.assign({}, byId[x.id] || {}, x); });
    return Object.values(byId).filter(x => !x.removed && x.name).sort((a, b) => (a.order || 99) - (b.order || 99) || a.name.localeCompare(b.name, "fr"));
  }

  // Reconnaître un métier dans un texte libre (« Pompes à chaleur et solaire », « Serrurerie »). Le premier cité est le principal.
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function sectorsOf(text) {
    const t = " " + norm(text) + " ", hits = [];
    list().forEach(x => {
      let best = -1;
      String(x.keys || "").split(",").concat([x.name]).map(k => norm(k).trim()).filter(Boolean).forEach(k => {
        const i = t.search(new RegExp("[^a-z0-9]" + reEsc(k)));
        if (i >= 0 && (best < 0 || i < best)) best = i;
      });
      if (best >= 0) hits.push([best, x]);
    });
    return hits.sort((a, b) => a[0] - b[0]).map(h => h[1]);
  }
  const generic = text => ({ id: "autre", name: text || "Autre métier", parcours: "rdv", art: "house" });
  const sectorOf = text => sectorsOf(text)[0] || generic(text);
  const criteriaOf = (sec, pid) => {
    const own = (sec.criteria || []).map(x => String(x || "").trim());
    const base = PARCOURS[pid].criteria;
    return sec.parcours === pid && own.some(Boolean) ? base.map((b, i) => own[i] || b) : base;
  };

  // Un client : son métier (d'après son activité), sa façon de livrer (choisie sur sa fiche, sinon celle du métier) et ses 4 questions
  function forClient(id) {
    const c = TD().clients.find(x => x.id === id) || TD().pipeline.find(x => x.id === id);
    const trade = c ? c.trade : "";
    const sec = sectorOf(trade);
    let chosen = "";
    try { const info = window.ENTREMIS_FICHE && window.ENTREMIS_FICHE.info(id); chosen = info && PARCOURS[info.parcours] ? info.parcours : ""; } catch (_) {}
    const pid = chosen || (PARCOURS[sec.parcours] ? sec.parcours : "rdv");
    return { parcours: PARCOURS[pid], sector: sec, sectors: sectorsOf(trade), criteria: criteriaOf(sec, pid), chosen: !!chosen };
  }
  function forLead(l) {
    const sec = sectorOf(l.trade);
    const pid = l.to ? forClient(l.to).parcours.id : (PARCOURS[sec.parcours] ? sec.parcours : "rdv");
    return { parcours: PARCOURS[pid], sector: sec, criteria: criteriaOf(sec, pid) };
  }

  /* ---------- Les dessins : l'objet du métier, en gris clair, posé sur une ombre. La couleur vient de l'objet (panneau, laine, tuiles). ---------- */
  function joints(rows) {   // joints des tuiles, en quinconce
    return rows.map(([y0, y1, l, r], j) => { let d = ""; for (let x = l + (j % 2 ? 5 : 10); x < r - 3; x += 10) d += `M${x.toFixed(1)} ${y0} V${y1} `; return d; }).join("");
  }
  function breakers() {
    let s = "";
    [24, 52].forEach(y => { for (let i = 0; i < 7; i++) { const x = 53 + i * 7.6; s += `<rect class="w" x="${x.toFixed(1)}" y="${y}" width="6.4" height="18" rx="1"/><rect class="d2" x="${(x + 2).toFixed(1)}" y="${y + (i === 5 ? 9 : 5)}" width="2.4" height="5" rx=".8"/>`; } });
    return s;
  }
  const ART = {
    pac: () => `<ellipse class="sh" cx="84" cy="91" rx="62" ry="4"/><rect class="d1" x="34" y="85" width="12" height="5" rx="1"/><rect class="d1" x="116" y="85" width="12" height="5" rx="1"/>
      <path class="l2" d="M138 23 L148 17 L148 80 L138 86 Z"/><path class="l1" d="M22 23 L32 17 H148 L138 23 Z"/><rect class="w" x="22" y="23" width="116" height="63" rx="3"/><rect class="ln" x="22.5" y="23.5" width="115" height="62" rx="3"/>
      <circle class="d1" cx="58" cy="54.5" r="24"/><g class="lnd"><circle cx="58" cy="54.5" r="18"/><circle cx="58" cy="54.5" r="12"/><circle cx="58" cy="54.5" r="6"/><path d="M34 54.5 H82 M58 30.5 V78.5"/></g><circle class="l3" cx="58" cy="54.5" r="3"/>
      <path class="ln" d="M94 33 H130 M94 38 H130 M94 43 H130 M94 48 H130 M94 53 H130 M94 58 H130 M94 63 H130 M94 68 H130 M94 73 H130 M94 78 H130"/><rect class="l2" x="94" y="27" width="14" height="2.5" rx="1"/><path class="cu" d="M148 62 H156 M148 69 H156"/>`,
    solar: () => `<ellipse class="sh" cx="82" cy="92" rx="62" ry="4"/><path class="leg" d="M36 76 V90 M98 76 V90 M70 42 L74 90 M126 42 L122 90"/>
      <path class="l3" d="M18 72 H114 V76 H18 Z"/><path class="l2" d="M114 72 L146 20 V24 L114 76 Z"/><path class="sol" d="M18 72 L50 20 H146 L114 72 Z"/>
      <path class="sol-ln" d="M34 72 L66 20 M50 72 L82 20 M66 72 L98 20 M82 72 L114 20 M98 72 L130 20 M26 59 H122 M34 46 H130 M42 33 H138"/><path class="glare" d="M58 20 H74 L42 72 H26 Z"/><path class="frame" d="M18 72 L50 20 H146 L114 72 Z"/>`,
    clim: () => `<rect class="sh" x="19" y="30" width="128" height="40" rx="13"/><rect class="w" x="16" y="26" width="128" height="40" rx="13"/><path class="l1" d="M16 52 H144 V53 A13 13 0 0 1 131 66 H29 A13 13 0 0 1 16 53 Z"/>
      <rect class="ln" x="16.5" y="26.5" width="127" height="39" rx="12.5"/><path class="ln" d="M30 32 H130 M30 35.5 H130"/><path class="lnd2" d="M28 58.5 H132"/><rect class="l2" x="110" y="41" width="20" height="6" rx="3"/><circle class="led" cx="114" cy="44" r="1.5"/>
      <path class="air" d="M48 74 q7 5 0 10 M80 74 q7 5 0 10 M112 74 q7 5 0 10"/>`,
    insul: () => `<ellipse class="sh" cx="88" cy="92" rx="56" ry="4"/><path class="kraft" d="M48 30 H124 A14 30 0 0 1 124 90 H48 Z"/><path class="shade" d="M48 78 H135.2 A14 30 0 0 1 124 90 H48 Z"/>
      <rect class="w" x="84" y="30" width="18" height="60"/><path class="ln" d="M84 30 V90 M102 30 V90"/><path class="hl" d="M50 34 H124"/>
      <ellipse class="wool" cx="48" cy="60" rx="16" ry="30"/><ellipse class="wool-ln" cx="49" cy="60.5" rx="12" ry="23"/><ellipse class="wool-ln" cx="50" cy="61" rx="8" ry="15.5"/><ellipse class="wool-ln" cx="50.5" cy="61.5" rx="4" ry="8"/><ellipse class="kraft-ln" cx="48" cy="60" rx="16" ry="30"/>`,
    heater: () => `<ellipse class="sh" cx="80" cy="92" rx="34" ry="3.6"/><path class="cu" d="M71 84 V91 M89 84 V91"/><rect class="l1" x="56" y="10" width="48" height="76" rx="18"/>
      <path class="l2" d="M92 12.5 A18 18 0 0 1 104 28 V68 A18 18 0 0 1 92 83.5 Z"/><rect class="w" x="61" y="22" width="4" height="52" rx="2"/><rect class="ln" x="56.5" y="10.5" width="47" height="75" rx="17.5"/>
      <path class="ln" d="M57 24 H103 M57 72 H103"/><rect class="l2" x="70" y="34" width="20" height="9" rx="2"/><circle class="l3" cx="80" cy="60" r="5.5"/><circle class="d2" cx="80" cy="60" r="2.2"/>`,
    tap: () => `<ellipse class="sh" cx="80" cy="92" rx="58" ry="3.6"/><rect class="l2" x="18" y="76" width="124" height="10" rx="2"/><rect class="l1" x="18" y="73" width="124" height="5" rx="2"/>
      <rect class="l3" x="62" y="64" width="22" height="10" rx="2"/><rect class="l2" x="67" y="34" width="12" height="32" rx="4"/><rect class="w" x="69" y="38" width="2.5" height="24" rx="1.2"/>
      <path class="chrome-s" d="M73 36 Q73 20 90 20 H106 Q114 20 114 28 V34"/><path class="chrome-hl" d="M75 33 Q76 23 90 23 H105"/><rect class="d2" x="58" y="28" width="24" height="5" rx="2.5"/>
      <path class="drop" d="M114 44 q-3.2 5 0 7.5 q3.2 -2.5 0 -7.5z"/><path class="drop" d="M114 58 q-2.4 3.8 0 5.6 q2.4 -1.8 0 -5.6z"/>`,
    door: () => `<ellipse class="sh" cx="80" cy="92" rx="44" ry="3.4"/><rect class="l2" x="46" y="6" width="68" height="86" rx="2"/><rect class="d1" x="52" y="11" width="56" height="81" rx="1.5"/>
      <g class="lnd"><rect x="58" y="17" width="44" height="32" rx="1.5"/><rect x="58" y="55" width="44" height="31" rx="1.5"/></g>
      <rect class="l3" x="96" y="46" width="6" height="16" rx="2"/><rect class="w" x="86" y="49.5" width="14" height="3.4" rx="1.7"/><circle class="l3" cx="99" cy="40" r="2.6"/><rect class="d1" x="98.5" y="39" width="1" height="2.4"/>
      <circle class="l3" cx="55.5" cy="26" r="1.3"/><circle class="l3" cx="55.5" cy="51" r="1.3"/><circle class="l3" cx="55.5" cy="76" r="1.3"/><rect class="l3" x="43" y="90" width="74" height="3" rx="1"/>`,
    elec: () => `<ellipse class="sh" cx="80" cy="92" rx="40" ry="3.4"/><rect class="w" x="44" y="10" width="72" height="80" rx="4"/><rect class="ln" x="44.5" y="10.5" width="71" height="79" rx="3.5"/><rect class="l1" x="50" y="17" width="60" height="66" rx="2"/>
      ${breakers()}<rect class="l2" x="53" y="45" width="52" height="3" rx="1"/><rect class="l2" x="53" y="73" width="52" height="3" rx="1"/>`,
    window: () => `<ellipse class="sh" cx="80" cy="93" rx="48" ry="3.4"/><rect class="l3" x="34" y="84" width="92" height="5" rx="1.5"/><rect class="w" x="40" y="8" width="80" height="77" rx="2"/><rect class="ln" x="40.5" y="8.5" width="79" height="76" rx="2"/>
      <rect class="glass" x="46" y="14" width="30" height="64" rx="1"/><rect class="glass" x="84" y="14" width="30" height="64" rx="1"/><path class="refl" d="M49 44 L65 16 H70 L53 47 Z M87 66 L106 32 H110 L91 70 Z"/>
      <g class="ln"><rect x="46.5" y="14.5" width="29" height="63" rx="1"/><rect x="84.5" y="14.5" width="29" height="63" rx="1"/></g><rect class="l1" x="76" y="14" width="8" height="64"/>
      <rect class="l3" x="72" y="43" width="2.6" height="9" rx="1.2"/><rect class="l3" x="85.4" y="43" width="2.6" height="9" rx="1.2"/>`,
    roof: () => `<ellipse class="sh" cx="80" cy="93" rx="62" ry="3.4"/><rect class="w" x="26" y="58" width="108" height="32"/><rect class="ln" x="26.5" y="58.5" width="107" height="31"/>
      <rect class="glass" x="40" y="66" width="16" height="14" rx="1"/><rect class="glass" x="104" y="66" width="16" height="14" rx="1"/><rect class="l3" x="72" y="68" width="16" height="22" rx="1"/>
      <rect class="brick" x="104" y="10" width="12" height="22"/><rect class="d2" x="102" y="8" width="16" height="3" rx="1"/><path class="roof" d="M14 60 L40 18 H120 L146 60 Z"/>
      <path class="roof-ln" d="M33.5 28.5 H126.5 M27 39 H133 M20.5 49.5 H139.5 ${joints([[18, 28.5, 40, 120], [28.5, 39, 33.5, 126.5], [39, 49.5, 27, 133], [49.5, 60, 20.5, 139.5]])}"/>
      <rect class="brick" x="40" y="16.5" width="80" height="3" rx="1"/><rect class="l3" x="12" y="59" width="136" height="3" rx="1"/>`,
    house: () => `<ellipse class="sh" cx="80" cy="93" rx="60" ry="3.4"/><path class="l2" d="M84 50 L136 44 V86 L84 90 Z"/><path class="d2" d="M56 22 L112 16 L142 46 L86 52 Z"/>
      <path class="w" d="M28 50 L56 24 L84 50 V90 H28 Z"/><path class="edge" d="M24 53 L56 21 L88 53"/><rect class="l3" x="48" y="66" width="14" height="24" rx="1"/>
      <rect class="glass" x="98" y="58" width="14" height="12" rx="1"/><rect class="glass" x="118" y="56" width="10" height="12" rx="1"/><circle class="glass" cx="56" cy="43" r="5"/>`
  };
  const art = (key, label) => `<svg class="art" viewBox="0 0 160 100" ${label ? `role="img" aria-label="${EM().esc(label)}"` : 'aria-hidden="true"'}>${(ART[key] || ART.house)()}</svg>`;

  /* ---------- Cartes des campagnes (page Clients), façon « camions au dépôt » ---------- */
  const PACE = { ahead: ["En avance", "ok"], ontrack: ["Dans les temps", "info"], late: ["En retard", "danger"] };
  function campCard(c) {
    const esc = EM().esc, icon = EM().icon, f = forClient(c.id), p = f.parcours, pct = Math.round(c.done / c.target * 100), pace = PACE[c.pace] || PACE.ontrack;
    return `<article class="camp" role="listitem">
      <a class="camp-top" href="#fiche-${c.id}" aria-label="Fiche ${esc(c.name)}">
        <span class="camp-tags"><span class="state state-${pace[1]}">${pace[0]}</span>${c.absences ? `<span class="state state-warn">${c.absences} absence</span>` : ""}</span>
        <span class="camp-id"><b class="camp-name">${esc(c.name)}</b><span class="camp-sub"><span class="camp-num tabnum">${c.done}/${c.target}</span> ${p.abbr} – ${esc(f.sector.short || f.sector.name)}</span></span>
        <span class="camp-art">${art(f.sector.art)}</span>
      </a>
      <div class="camp-foot">
        <div class="camp-route"><span class="camp-path"><b>${p.path[0]}</b>${icon("arrow")}<b>${p.path[1]}</b></span><span class="camp-who">${TM().avatar(c.owner, "av")}<span>${TM().member(c.owner).name} – J${c.day}/${c.days}</span></span></div>
        <div class="camp-prog"><span>Objectif</span><span class="tabnum">${pct} %</span></div>
        <div class="camp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Objectif de ${esc(c.name)}"><i style="--p:${pct}%"></i></div>
      </div>
    </article>`;
  }
  function campSection(S, table) {
    const cs = TD().clients, pace = S.ccPace || "all", sec = S.ccSector || "all", mode = S.ccView || "cards";
    const secs = []; cs.forEach(c => { const x = sectorOf(c.trade); if (!secs.some(y => y.id === x.id)) secs.push(x); });
    const shown = cs.filter(c => (pace === "all" || c.pace === pace) && (sec === "all" || sectorOf(c.trade).id === sec));
    const fsel = EM().fsel;
    return `<section class="card camps-card">
      <div class="card-head camps-head"><h2 class="h2">Campagnes en cours <span class="muted tabnum">${shown.length}</span></h2>
        <div class="filters">${fsel("cc-pace", "Rythme", [["all", "Tous"], ["ahead", "En avance"], ["ontrack", "Dans les temps"], ["late", "En retard"]], pace)}${fsel("cc-sector", "Métier", [["all", "Tous"]].concat(secs.map(x => [x.id, x.name])), sec)}${fsel("cc-view", "Vue", [["cards", "Cartes"], ["list", "Liste"]], mode)}</div></div>
      ${!shown.length ? `<p class="body">Aucune campagne avec ces filtres.</p>` : mode === "list" ? table(shown) : `<div class="camps" role="list">${shown.map(campCard).join("")}</div>`}
    </section>`;
  }

  /* ---------- Fiche d'un client : son métier et sa façon de livrer ---------- */
  function ficheCard(id, edit) {
    const esc = EM().esc, f = forClient(id), p = f.parcours, names = (f.sectors.length ? f.sectors : [f.sector]).map(x => x.name).join(" + ");
    const def = PARCOURS[f.sector.parcours] || PARCOURS.rdv;
    return `<section class="card sec-card">
      <div class="card-head"><h2 class="h2">Métier et parcours</h2></div>
      <div class="sec-card-top"><span class="sec-thumb">${art(f.sector.art)}</span><div><b>${esc(names)}</b><span>${p.long}${f.chosen ? " – choisi pour ce client" : ""}</span></div></div>
      ${edit ? `<label class="frow"><span>Façon de livrer</span><select name="parcours"><option value="">Selon le métier (${def.name})</option>${Object.values(PARCOURS).map(x => `<option value="${x.id}" ${f.chosen && p.id === x.id ? "selected" : ""}>${x.long}</option>`).join("")}</select></label>`
        : `<dl class="par-dl"><div><dt>On livre</dt><dd>${esc(p.many)}</dd></div><div><dt>4 questions</dt><dd>${esc(f.criteria.join(", "))}</dd></div><div><dt>Garantie</dt><dd>${esc(p.steps[3].text)}</dd></div></dl>`}
    </section>`;
  }

  /* ---------- Page Secteurs ---------- */
  const X = { par: "rdv", sheet: null };   // sheet : null | { id? }
  function parCard(p, all) {
    const esc = EM().esc, icon = EM().icon, on = X.par === p.id, secs = all.filter(x => x.parcours === p.id);
    return `<button type="button" class="par${on ? " scope-blue is-on" : ""}" data-sec-par="${p.id}" aria-pressed="${on}">
      <span class="par-path">${p.path[0]}${icon("arrow")}${p.path[1]}</span>
      <b class="par-name">${p.long}</b>
      <span class="par-for">${p.for}</span>
      <span class="par-secs">${secs.map(x => `<span class="par-chip">${esc(x.name)}</span>`).join("")}</span>
    </button>`;
  }
  function sheet(all) {
    if (!X.sheet) return "";
    const esc = EM().esc, icon = EM().icon, ex = X.sheet.id ? all.find(x => x.id === X.sheet.id) : null;
    const cur = ex || { name: "", keys: "", parcours: "rdv", art: "house", criteria: [] };
    const base = PARCOURS[cur.parcours] || PARCOURS.rdv;
    return `<div class="scrim" data-sec-close></div>
    <form class="sheet sheet-wide" id="sec-form" aria-label="${ex ? "Modifier le métier" : "Nouveau métier"}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-sec-close>Annuler</button><b>${ex ? esc(ex.name) : "Nouveau métier"}</b><button class="link strong" type="submit">${ex ? "Enregistrer" : "Ajouter"}</button></div>
      <label class="field"><span>Métier</span><input name="name" required maxlength="40" value="${esc(cur.name)}" placeholder="Ex. : Piscines"></label>
      <label class="field"><span>Mots reconnus</span><input name="keys" maxlength="160" value="${esc(cur.keys || "")}" placeholder="piscine, bassin, spa"><small class="field-help">Séparés par des virgules. Servent à reconnaître ce métier dans un lead ou un client.</small></label>
      <fieldset class="field"><legend>Façon de livrer</legend><div class="par-pick">${Object.values(PARCOURS).map(p => `<label><input type="radio" name="parcours" value="${p.id}" ${cur.parcours === p.id ? "checked" : ""}><span><b>${p.long}</b><small>${p.path[0]} → ${p.path[1]}</small></span></label>`).join("")}</div></fieldset>
      <fieldset class="field"><legend>Dessin sur les cartes</legend><div class="art-pick">${ARTS.map(([k, l]) => `<label title="${l}"><input type="radio" name="art" value="${k}" ${cur.art === k ? "checked" : ""}>${art(k)}<span>${l}</span></label>`).join("")}</div></fieldset>
      <fieldset class="field"><legend>Ses 4 questions, si elles changent</legend><div class="crit-grid">${[0, 1, 2, 3].map(i => `<input name="c${i}" maxlength="30" value="${esc((cur.criteria || [])[i] || "")}" placeholder="${esc(base.criteria[i])}" aria-label="Question ${i + 1}">`).join("")}</div><small class="field-help">Vide : on garde les questions de la façon de livrer.</small></fieldset>
      ${ex ? `<button class="btn btn-ghost pr-danger" type="button" data-sec-del="${ex.id}">${icon("trash")}Retirer ce métier</button>` : ""}
    </form>`;
  }
  function view(S) {
    const esc = EM().esc, icon = EM().icon, all = list(), leads = window.ENTREMIS_LEADS.list();
    const clientsN = id => TD().clients.filter(c => sectorsOf(c.trade).some(x => x.id === id)).length;
    const leadsN = id => leads.filter(l => sectorOf(l.trade).id === id).length;
    const p = PARCOURS[X.par] || PARCOURS.rdv;
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Secteurs</h1><p class="sub">Un seul parcours pour tous les métiers. Seule la façon de livrer change.</p></div>
      <div class="head-actions">${store().source === "db" ? `<span class="sample sync">${icon("users")}Partagé</span>` : EM().sampleTag}<button class="btn btn-primary" type="button" data-sec-new>${icon("plus")}Ajouter un métier</button></div></div>
    <div class="par-grid">${Object.values(PARCOURS).map(x => parCard(x, all)).join("")}</div>
    <section class="card guide-flow">
      <div class="card-head"><h2 class="h2">Ce que voit le client <span class="soft">– ${p.name}</span></h2></div>
      ${EM().nodeFlow(p.steps.map(s => ({ icon: s.icon, title: s.title, text: s.text })), "Parcours " + p.name)}
    </section>
    <section class="card">
      <div class="card-head"><h2 class="h2">Métiers <span class="muted tabnum">${all.length}</span></h2></div>
      <ul class="sec-list">${all.map(x => { const n = clientsN(x.id), m = leadsN(x.id); return `<li><button type="button" class="sec-tile" data-sec-edit="${x.id}"><span class="sec-thumb">${art(x.art)}</span><span class="sec-main"><b>${esc(x.name)}</b><small>${(PARCOURS[x.parcours] || PARCOURS.rdv).name} – ${n ? n + " client" + (n > 1 ? "s" : "") : "aucun client"} – ${m} lead${m > 1 ? "s" : ""}</small></span>${icon("chev")}</button></li>`; }).join("")}</ul>
    </section>
    ${sheet(all)}`;
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-sec-par],[data-sec-new],[data-sec-edit],[data-sec-close],[data-sec-del],[data-cc-pace],[data-cc-sector],[data-cc-view]"); if (!t) return false;
    const d = t.dataset;
    if (d.ccPace) { S.ccPace = d.ccPace; render(); return true; }
    if (d.ccSector) { S.ccSector = d.ccSector; render(); return true; }
    if (d.ccView) { S.ccView = d.ccView; render(); return true; }
    if (d.secPar) { X.par = d.secPar; TM().haptic("tap"); render(); return true; }
    const open = sh => { X.sheet = sh; render(); const i = document.querySelector("#sec-form input[name=name]"); if (i) i.focus(); };
    if ("secNew" in d) { open({}); return true; }
    if (d.secEdit) { open({ id: d.secEdit }); return true; }
    if ("secClose" in d) { X.sheet = null; render(); return true; }
    if (d.secDel) {
      const x = list().find(y => y.id === d.secDel); if (!x) return true;
      X.sheet = null; render();
      EM().confirm({ title: `Retirer « ${x.name} » ?`, text: "Les leads et les clients de ce métier suivront le parcours par défaut (rendez-vous).", ok: "Retirer" }).then(ok => {
        if (!ok) return;
        store().put(Object.assign({}, x, { removed: true })); TM().haptic("done"); render();
        EM().toast("Métier retiré.", () => { store().put(Object.assign({}, x, { removed: false })); render(); });
      });
      return true;
    }
    return false;
  }
  function onSubmit(e, S, render) {
    if (e.target.id !== "sec-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), name = String(fd.get("name") || "").trim(); if (!name) return true;
    const ex = X.sheet && X.sheet.id ? list().find(x => x.id === X.sheet.id) : null;
    const id = ex ? ex.id : norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4);
    const row = Object.assign({}, ex || { order: 50 }, { id, name, keys: String(fd.get("keys") || "").trim(), parcours: PARCOURS[fd.get("parcours")] ? fd.get("parcours") : "rdv", art: fd.get("art") || "house",
      criteria: [0, 1, 2, 3].map(i => String(fd.get("c" + i) || "").trim()), removed: false, by: S.who });
    store().put(row); X.sheet = null; TM().haptic("done"); render();
    EM().toast(ex ? "Métier modifié. L'app suit." : "Métier ajouté. Ses leads suivront ce parcours.");
    return true;
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && X.sheet && !document.querySelector(".confirm")) { X.sheet = null; EM().render(); } });
  // Quand on change la façon de livrer, les questions proposées suivent
  document.addEventListener("change", e => {
    const r = e.target.closest && e.target.closest('#sec-form input[name="parcours"]'); if (!r || !PARCOURS[r.value]) return;
    PARCOURS[r.value].criteria.forEach((q, i) => { const inp = document.querySelector(`#sec-form input[name="c${i}"]`); if (inp) inp.placeholder = q; });
  });

  window.ENTREMIS_SECTORS = { PARCOURS, list, sectorOf, sectorsOf, forClient, forLead, art, campSection, ficheCard, view, onClick, onSubmit, init: render => store().init(render) };
})();
