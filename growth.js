/* Entremis — espace agence : ce qui fait grandir la boîte (Marc, 20 nov. 2026).
   Pages : #appel (poste d'appel), #rendez-vous (tous les RDV, rappels au particulier, résultats), #zones (métier × département),
   #sante (santé des clients et fins de campagne), #propositions (proposition commerciale + PDF), #etudes (études de cas),
   #marge (marge par campagne), #conformite (preuves de consentement, effacement).
   Morceaux pour d'autres pages : motifs de rejet (Leads), visuels, pages métier + ville et questionnaire d'aides (Marketing),
   contrats et trésorerie (Finances), objectifs (Avancement), demandes du site et parrainages (Prospection).
   Tous les chiffres sont des exemples ou des estimations avec des hypothèses modifiables : rien n'est inventé comme vrai. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, D = () => window.ENTREMIS_DATA, TD = () => window.ENTREMIS_DATA.team;
  const CP = () => window.ENTREMIS_CPLUS, SEC = () => window.ENTREMIS_SECTORS, LEADS = () => window.ENTREMIS_LEADS;
  const G = { lead: null, why: null, zone: null, prop: null, rdvF: "week", erase: "" };
  const st = {};
  const store = (name, sample) => st[name] || (st[name] = OPS().makeStore(name, sample || (() => [])));
  const esc = s => EM().esc(s), icon = n => EM().icon(n);
  const p2 = n => String(n).padStart(2, "0");
  const today = () => D().today.iso;
  const nowIso = () => today() + "T" + D().today.now;
  const euros = n => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " €";
  const short = iso => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); return `${d.getUTCDate()}/${p2(d.getUTCMonth() + 1)}`; };
  const DAYS3 = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const dshort = iso => { const d = new Date(iso + "T12:00:00Z"); return `${DAYS3[d.getUTCDay()]} ${short(iso)}`; };
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const kpi = (l, v, n, k) => `<article class="kpi" role="listitem"><p class="kpi-label">${l}</p><div><p class="kpi-value${k ? " v-" + k : ""}">${v}</p><p class="kpi-note">${n}</p></div></article>`;
  const head = (title, sub, actions) => `<div class="head"><div class="head-text"><h1 class="h1">${title}</h1><p class="sub">${sub}</p></div><div class="head-actions">${EM().sampleTag}${actions || ""}</div></div>`;
  const client = id => TD().clients.find(c => c.id === id);
  const rows = () => window.ENTREMIS_METRICS.clientRows();

  /* =================== Poste d'appel =================== */
  const REASONS = ["Locataire, pas propriétaire", "Hors zone", "Pas de budget", "Pas de projet réel", "Faux numéro", "Déjà équipé"];
  const ageMin = iso => Math.max(0, Math.round((Date.parse(nowIso()) - Date.parse(iso)) / 60000));
  const ageTxt = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${p2(m % 60)}` : `${Math.floor(m / 1440)} j`;
  const fakePhone = id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100000000; return "06 " + String(h).padStart(8, "0").replace(/(\d{2})(?=\d)/g, "$1 "); };
  const queue = () => LEADS().list().filter(l => ["nouveau", "rappele"].includes(l.status))
    .sort((a, b) => a.status !== b.status ? (a.status === "nouveau" ? -1 : 1) : ((b.at || "") < (a.at || "") ? -1 : 1));
  const OPENERS = {
    rdv: (l, me) => [`« Bonjour ${l.name.split(" ")[0]}, c'est ${me} d'Entremis. Vous avez demandé une étude pour ${String(l.trade).toLowerCase()} à ${l.city}. Vous avez deux minutes ? »`, "« Parlez-moi du projet : qu'est-ce que vous voulez faire, et pourquoi maintenant ? »", "« Vous êtes propriétaire du logement ? »", "« Vous avez une idée du budget, avec les aides ? »", "« Vous aimeriez que ce soit fait pour quand ? »"],
    direct: (l, me) => [`« Bonjour ${l.name.split(" ")[0]}, c'est ${me} d'Entremis, pour votre demande de ${String(l.trade).toLowerCase()}. C'est toujours urgent ? »`, "« Qu'est-ce qui se passe exactement ? »", `« Vous êtes bien à ${l.city} ? »`, "« Je vous passe un artisan disponible tout de suite, d'accord ? »"],
    devis: (l, me) => [`« Bonjour ${l.name.split(" ")[0]}, c'est ${me} d'Entremis, pour votre demande de devis. Vous avez deux minutes ? »`, "« Qu'est-ce que vous voulez faire ? »", "« Vous êtes propriétaire ? »", "« Vous pouvez m'envoyer deux ou trois photos ? »"]
  };
  function viewAppel(S) {
    const q = queue(), fresh = q.filter(l => l.status === "nouveau"), cur = q.find(l => l.id === G.lead) || q[0];
    if (cur) G.lead = cur.id;
    const qual = LEADS().list().filter(l => l.status === "qualifie").length;
    const list = `<section class="card call-queue"><div class="card-head"><h2 class="h2">À appeler <span class="muted tabnum">${q.length}</span></h2></div>
      ${q.length ? `<ul>${q.map(l => { const m = ageMin(l.at); return `<li><button type="button" class="call-item${cur && cur.id === l.id ? " is-on" : ""}" data-call-lead="${l.id}">
        <span class="call-item-main"><b>${esc(l.name)}</b><small>${esc(l.trade)} – ${esc(l.city)}</small></span>
        <span class="call-age${l.status === "nouveau" && m > 5 ? " is-late" : ""}">${l.status === "nouveau" ? ageTxt(m) : "à rappeler"}</span></button></li>`; }).join("")}</ul>` : `<p class="body">Personne à appeler. Les nouvelles demandes arrivent ici.</p>`}</section>`;
    let desk = `<section class="card call-desk"><p class="body">Rien à faire pour l'instant.</p></section>`;
    if (cur) {
      const f = SEC().forLead(cur), me = TM().member(S.who).name, lines = (OPENERS[f.parcours.id] || OPENERS.rdv)(cur, me), m = ageMin(cur.at);
      desk = `<section class="card call-desk">
        <div class="call-head"><div><h2 class="h2">${esc(cur.name)}</h2><p class="sub">${esc(cur.trade)} – ${esc(cur.city)} – ${f.parcours.name}</p></div>${LEADS().srcTag(cur.source)}</div>
        <div class="call-bar"><a class="btn btn-primary btn-lg" href="tel:${fakePhone(cur.id).replace(/\s/g, "")}">${icon("phone")}Appeler ${fakePhone(cur.id)}</a><span class="call-timer${cur.status === "nouveau" && m > 5 ? " is-late" : ""}">${icon("clock")}Demande reçue il y a ${ageTxt(m)}</span></div>
        <div class="call-cols">
          <div><p class="lp-label">Ce qu'on dit</p><ol class="call-script">${lines.map(x => `<li>${esc(x)}</li>`).join("")}</ol><a class="link" href="#scripts-equipe">Tous les scripts ${icon("arrow")}</a></div>
          <div><p class="lp-label">Les 4 points</p><div class="call-checks">${f.criteria.map((c, i) => `<label class="check-line"><input type="checkbox" data-call-crit="${i}"><span>${esc(c)}</span></label>`).join("")}</div>
            <label class="field"><span>Note</span><textarea id="call-note" rows="3" placeholder="Ce qu'il faut retenir"></textarea></label></div>
        </div>
        <div class="call-outs">
          <button class="btn btn-ghost call-ok" type="button" data-call-out="qualifie">${icon("check")}Qualifié</button>
          <button class="btn btn-ghost" type="button" data-call-out="rappeler">${icon("clock")}À rappeler</button>
          <button class="btn btn-ghost" type="button" data-call-out="injoignable">${icon("phone")}Injoignable</button>
          <button class="btn btn-ghost" type="button" data-call-out="ecarter">${icon("trash")}Écarter</button>
        </div>
        ${G.why === cur.id ? `<div class="call-why"><p class="lp-label">Pourquoi on l'écarte</p><div class="call-why-list">${REASONS.map(r => `<button class="pill" type="button" data-call-why="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>` : ""}
      </section>`;
    }
    return `${head("Poste d'appel", "Un lead à la fois : on appelle, on vérifie, on note. Le suivant arrive tout seul.")}
    <div class="kpis kpis-4" role="list">
      ${kpi("À appeler maintenant", fresh.length, "nouvelles demandes")}
      ${kpi("À rappeler", q.length - fresh.length, "rappels prévus")}
      ${kpi("Plus ancienne", fresh.length ? ageTxt(Math.max(...fresh.map(l => ageMin(l.at)))) : "–", "demande pas encore appelée", fresh.some(l => ageMin(l.at) > 60) ? "danger" : "")}
      ${kpi("Qualifiés", qual, "à donner dans Leads")}
    </div>
    <div class="call-grid">${list}${desk}</div>`;
  }
  function callOutcome(out, why, S, render) {
    const l = LEADS().list().find(x => x.id === G.lead); if (!l) return;
    const note = (document.getElementById("call-note") || {}).value || "";
    const checked = document.querySelectorAll("[data-call-crit]:checked").length;
    const next = Object.assign({}, l, out === "qualifie" ? { status: "qualifie" } : out === "ecarter" ? { status: "perdu", why } : { status: "rappele", tries: (l.tries || 0) + 1 }, note ? { note } : {});
    LEADS().put(next);
    OPS().stores.CALLS.put({ id: "c" + Date.now().toString(36), who: S.who, contact: l.name, company: "Lead – " + l.trade, about: "Qualification", at: nowIso(), minutes: out === "injoignable" ? 1 : 6, note: { qualifie: `Qualifié (${checked}/4 points)`, rappeler: "À rappeler", injoignable: "Injoignable", ecarter: "Écarté : " + why }[out] + (note ? " – " + note : "") });
    const q = queue(); G.lead = q[0] ? q[0].id : null; G.why = null; TM().haptic("done"); render();
    EM().toast({ qualifie: `${l.name} qualifié. À donner dans Leads.`, rappeler: `${l.name} : à rappeler.`, injoignable: `${l.name} : injoignable, on réessaie plus tard.`, ecarter: `${l.name} écarté : ${why}.` }[out], () => { LEADS().put(l); G.lead = l.id; render(); });
  }

  /* =================== Rendez-vous (tous les clients) =================== */
  const OTHER_RDV = [
    { id: "x-julien-faure", client: "thermo", name: "Julien Faure", role: "Climatisation", city: "Vénissieux", date: "2026-11-17", start: "10:00", end: "11:00", state: "ok", result: { outcome: "signe", amount: 6800 } },
    { id: "x-gaelle-le-goff", client: "ecotoit", name: "Gaëlle Le Goff", role: "Panneaux solaires", city: "Vannes", date: "2026-11-18", start: "14:00", end: "15:00", state: "replaced", reply: "rien" },
    { id: "x-bruno-petit", client: "thermo", name: "Bruno Petit", role: "Climatisation", city: "Saint-Priest", date: "2026-11-19", start: "16:00", end: "17:00", state: "new", reply: "oui" },
    { id: "x-lina-martin", client: "isolea", name: "Lina Martin", role: "Isolation des combles", city: "Villeurbanne", date: "2026-11-20", start: "09:30", end: "10:30", state: "new" },
    { id: "x-nadia-ferhat", client: "blindex", name: "Nadia Ferhat", role: "Porte blindée", city: "Lyon 3e", date: "2026-11-20", start: "18:00", end: "18:45", state: "new" },
    { id: "x-paul-riviere", client: "delmas", name: "Paul Rivière", role: "Chauffe-eau", city: "Grenoble", date: "2026-11-23", start: "14:00", end: "15:00", state: "new" }
  ];
  const LIVE = () => window.ENTREMIS_LIVE, CLOUD = () => window.ENTREMIS_CLOUD.on();
  const allRdv = () => (CLOUD() ? [] : EM().baseC().appointments.map(a => Object.assign({ client: "solaria" }, a)).concat(OTHER_RDV))
    .concat(LIVE().rdvs().filter(r => r.state !== "cancel").map(LIVE().asAppt)).sort((a, b) => (a.date + a.start) < (b.date + b.start) ? -1 : 1);
  const resultOf = a => CP().result(a.id) || a.result || null;
  // Pour un rendez-vous placé dans l'app : visite faite, absent (puis remplaçant), modifier
  function liveActs(a, past) {
    const icon = EM().icon;
    if (a.state === "replaced") return a.replacedBy ? "" : `<button class="btn btn-primary btn-xs" type="button" data-live-replace="${a.id}">${icon("swap")}Placer un remplaçant</button>`;
    return `${past && a.state !== "ok" ? `<button class="btn btn-ghost btn-xs" type="button" data-rdv-state="${a.id}:ok">${icon("check")}Visite faite</button><button class="btn btn-ghost btn-xs" type="button" data-rdv-state="${a.id}:replaced">Absent</button>` : ""}<button class="btn btn-ghost btn-xs" type="button" data-gcal-rdv="${a.id}" aria-label="Ajouter à Google Agenda">${EM().brand("gcal", "Google Agenda")}Agenda</button><button class="btn btn-ghost btn-xs" type="button" data-live-edit="rdv:${a.id}">Modifier</button>`;
  }
  function viewRdvs(S) {
    const all = allRdv(), wk0 = addDays(today(), -((new Date(today() + "T12:00:00Z").getUTCDay() + 6) % 7)), wk1 = addDays(wk0, 6);
    const week = all.filter(a => a.date >= wk0 && a.date <= wk1);
    const shown = G.rdvF === "today" ? all.filter(a => a.date === today()) : G.rdvF === "todo" ? all.filter(a => a.state !== "replaced" && CP().isPast(a) && !resultOf(a)) : G.rdvF === "all" ? all : week;
    const sent = week.filter(a => a.state !== "replaced" && CP().confirmations(a).veille.sent), conf = sent.filter(a => CP().confirmations(a).reply === "confirmé");
    const signed = all.map(resultOf).filter(r => r && r.outcome === "signe");
    const row = a => {
      const c = client(a.client) || { name: a.client }, cf = CP().confirmations(a), r = resultOf(a), past = CP().isPast(a), sms = CP().smsTexts(a, c.name);
      const dot = x => `<i class="${x.sent ? "is-sent" : ""}" title="${x.sent ? "Envoyé" : "Prévu"} ${short(x.at)} à ${x.at.slice(11)}"></i>`;
      return `<li class="rv-row${a.state === "replaced" ? " is-off" : ""}">
        <span class="rv-when tabnum"><b>${a.start}</b><small>${dshort(a.date)}</small></span>
        <span class="rv-who"><b>${esc(a.name)}</b><small>${esc(a.role)} – ${esc(a.city)}</small></span>
        <a class="rv-client" href="#fiche-${a.client}">${esc(c.name)}</a>
        <span class="rv-conf" aria-label="Rappels : ${cf.reply || "pas encore envoyés"}">${a.state === "replaced" ? `<span class="state state-warn">Absent, remplacé</span>` : `<span class="rv-dots">${dot(cf.veille)}${dot(cf.matin)}</span><small>${cf.reply ? cf.reply : "rappels prévus"}</small>`}</span>
        <span class="rv-res">${a.state === "replaced" ? "" : r ? `<span class="state state-${CP().OUT[r.outcome][1]}">${CP().OUT[r.outcome][0]}</span>${r.outcome === "signe" && r.amount ? `<b class="tabnum">${euros(r.amount)}</b>` : ""}` : past ? `<span class="muted">à renseigner</span>` : `<span class="muted">à venir</span>`}</span>
        <span class="rv-acts">${a.state === "replaced" ? "" : `<button class="btn btn-ghost btn-xs" type="button" data-copy="${esc(past ? sms.matin : sms.veille)}">${icon("copy")}SMS</button>`}${past && !r && a.state !== "replaced" ? `<button class="btn btn-ghost btn-xs" type="button" data-rv-ask="${a.id}">Demander le résultat</button>` : ""}${a.by !== undefined ? liveActs(a, past) : ""}</span>
      </li>`;
    };
    return `${head("Rendez-vous", "Tous les clients : rappels au particulier, présence, résultat.", `<button class="btn btn-primary" type="button" data-live-new="rdv">${EM().icon("plus")}Placer un rendez-vous</button>`)}
    <div class="kpis kpis-4" role="list">
      ${kpi("Cette semaine", week.filter(a => a.state !== "replaced").length, "rendez-vous placés")}
      ${kpi("Confirmés", sent.length ? Math.round(conf.length / sent.length * 100) + " %" : "–", "par SMS, parmi les rappels envoyés")}
      ${kpi("Absents", all.filter(a => a.state === "replaced").length, "tous remplacés ou à remplacer", "warn")}
      ${kpi("Signés", signed.length, euros(signed.reduce((s, r) => s + (Number(r.amount) || 0), 0)) + " hors taxes")}
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Les rendez-vous <span class="muted tabnum">${shown.length}</span></h2>${EM().fsel("rv-f", "Afficher", [["week", "Cette semaine"], ["today", "Aujourd'hui"], ["todo", "Résultat à demander"], ["all", "Tous"]], G.rdvF)}</div>
      ${shown.length ? `<ul class="rv-list">${shown.map(row).join("")}</ul>` : `<p class="body">Rien avec ce filtre.</p>`}
      <p class="kpi-note">Rappels : SMS la veille à 18 h et le matin à 8 h. Maquette : l'envoi automatique est à brancher.</p></section>`;
  }

  /* =================== Zones : métier × département =================== */
  const DEPTS = [["69", "Rhône"], ["38", "Isère"], ["42", "Loire"], ["01", "Ain"], ["74", "Haute-Savoie"], ["73", "Savoie"], ["56", "Morbihan"], ["29", "Finistère"], ["44", "Loire-Atlantique"], ["35", "Ille-et-Vilaine"], ["06", "Alpes-Maritimes"], ["68", "Haut-Rhin"]];
  const CITY_DEPT = { "Lyon": "Rhône", "Villeurbanne": "Rhône", "Saint-Priest": "Rhône", "Grenoble": "Isère", "Vannes": "Morbihan", "Nantes": "Loire-Atlantique", "Rennes": "Ille-et-Vilaine", "Nice": "Alpes-Maritimes", "Annecy": "Haute-Savoie", "Colmar": "Haut-Rhin" };
  const ZONES = () => store("zones");
  function zone(sec, dept) {
    const cov = TD().coverage || {}, taken = TD().clients.filter(c => { const z = cov[c.id]; return z && z.zones.includes(dept) && z.trades.some(t => SEC().sectorOf(t).id === sec.id); });
    const talks = TD().pipeline.filter(p => p.stage !== "won" && CITY_DEPT[p.city] === dept && SEC().sectorsOf(p.trade).some(x => x.id === sec.id));
    const w = ZONES().list.find(z => z.id === sec.id + "|" + dept), wait = w ? (w.names || []) : [];
    return { taken, talks, wait, state: taken.length > 1 ? "conflit" : taken.length ? "pris" : talks.length ? "discussion" : wait.length ? "attente" : "libre" };
  }
  function viewZones(S) {
    const secs = SEC().list(); let n = { conflit: 0, pris: 0, discussion: 0, attente: 0, libre: 0 };
    const cells = secs.map(s => DEPTS.map(([code, d]) => { const z = zone(s, d); n[z.state]++; return [s, code, d, z]; }));
    const lab = { conflit: "2 clients sur la même zone", pris: "Pris", discussion: "En discussion", attente: "En attente", libre: "Libre" };
    const cell = ([s, code, d, z]) => `<td><button type="button" class="zc zc-${z.state}" data-zone="${s.id}|${d}" title="${esc(s.name)} – ${d} : ${lab[z.state]}${z.taken.length ? " (" + esc(z.taken.map(c => c.name).join(", ")) + ")" : ""}">${z.state === "conflit" ? z.taken.length : z.state === "pris" ? esc(z.taken[0].name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()) : z.state === "attente" ? z.wait.length : z.state === "discussion" ? "…" : ""}</button></td>`;
    const sheet = G.zone ? (() => { const [sid, d] = G.zone.split("|"), s = secs.find(x => x.id === sid); if (!s) return ""; const z = zone(s, d), code = (DEPTS.find(x => x[1] === d) || [""])[0];
      return `<div class="scrim" data-zone-close></div><form class="sheet" id="zone-form" aria-label="${esc(s.name)} – ${d}">
        <div class="sheet-grab" aria-hidden="true"></div>
        <div class="sheet-head"><button class="link" type="button" data-zone-close>Fermer</button><b>${esc(s.name)} – ${d} (${code})</b><span></span></div>
        <p><span class="state state-${{ conflit: "danger", pris: "ok", discussion: "info", attente: "warn", libre: "neutral" }[z.state]}">${lab[z.state]}</span></p>
        ${z.state === "conflit" ? `<p class="kpi-note">Deux clients ont l'exclusivité ici : à régler avec l'un des deux (autre zone, autre métier).</p>` : ""}
        ${z.taken.length ? `<ul class="zone-who">${z.taken.map(c => `<li><a href="#fiche-${c.id}">${esc(c.name)}</a><span>Exclusif sur ce métier et ce département</span></li>`).join("")}</ul>` : ""}
        ${z.talks.length ? `<ul class="zone-who">${z.talks.map(p => `<li><a href="#fiche-${p.id}">${esc(p.name)}</a><span>En prospection</span></li>`).join("")}</ul>` : ""}
        ${z.wait.length ? `<ul class="zone-who">${z.wait.map(x => `<li><b>${esc(x)}</b><span>En liste d'attente</span></li>`).join("")}</ul>` : ""}
        ${z.taken.length ? `<p class="kpi-note">Zone prise : un autre installateur de ce métier passe en liste d'attente.</p>` : `<p class="kpi-note">Zone ${z.talks.length ? "en discussion" : "libre"} : c'est ici qu'on prospecte.</p>`}
        <label class="field"><span>Ajouter en liste d'attente</span><input name="name" maxlength="60" placeholder="Nom de l'installateur"></label>
        <div class="form-actions"><button class="btn btn-ghost" type="submit">${icon("plus")}Ajouter</button>${z.taken.length ? "" : `<a class="btn btn-ghost" href="#pipeline">${icon("users")}Prospection</a>`}</div>
      </form>`; })() : "";
    return `${head("Zones", "Un seul installateur par métier et par département. Voici qui a quoi, et où prospecter.")}
    <div class="kpis kpis-4" role="list">${kpi("Zones prises", n.pris + n.conflit, n.conflit ? `dont ${n.conflit} en double, à régler` : "exclusives", n.conflit ? "danger" : "")}${kpi("En discussion", n.discussion, "avec un prospect")}${kpi("Liste d'attente", n.attente, "zones demandées")}${kpi("Libres", n.libre, "où prospecter")}</div>
    <section class="card"><div class="card-head"><h2 class="h2">Métier × département</h2><span class="zone-key"><i class="zc-conflit"></i>En double<i class="zc-pris"></i>Pris<i class="zc-discussion"></i>En discussion<i class="zc-attente"></i>En attente<i class="zc-libre"></i>Libre</span></div>
      <div class="table-scroll"><table class="zone-table"><thead><tr><th>Métier</th>${DEPTS.map(([c, d]) => `<th title="${d}">${c}<small>${d}</small></th>`).join("")}</tr></thead>
      <tbody>${cells.map(r => `<tr><th scope="row"><span class="zone-sec">${SEC().art(r[0][0].art)}</span>${esc(r[0][0].name)}</th>${r.map(cell).join("")}</tr>`).join("")}</tbody></table></div></section>
    ${sheet}`;
  }

  /* =================== Santé des clients et fins de campagne =================== */
  const daysSince = iso => Math.round((Date.parse(today() + "T12:00:00") - Date.parse(String(iso).slice(0, 10) + "T12:00:00")) / 86400000);
  function health(c) {
    const reasons = []; let level = 0;
    if (c.pace === "late") { reasons.push(`En retard sur l'objectif (${c.done}/${c.target})`); level = 2; }
    else reasons.push(c.pace === "ahead" ? `En avance (${c.done}/${c.target})` : `Dans les temps (${c.done}/${c.target})`);
    if (c.absences) { reasons.push(`${c.absences} absence${c.absences > 1 ? "s" : ""} cette campagne`); level = Math.max(level, 1); }
    const late = OPS().stores.DOCS.list.filter(d => d.kind === "facture" && d.client === c.name && d.status === "envoye" && d.due && d.due < today());
    if (late.length) { reasons.push("Facture en retard de paiement"); level = Math.max(level, 2); }
    const near = s => s && String(s).toLowerCase().includes(c.name.toLowerCase());
    const calls = OPS().stores.CALLS.list.filter(x => near(x.contact) || near(x.company) || near(x.about)).sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const last = calls[0] ? daysSince(calls[0].at) : null;
    if (last === null || last > 7) { reasons.push(last === null ? "Aucun appel noté" : `Pas d'appel depuis ${last} jours`); level = Math.max(level, 1); }
    const av = CP().avis().find(a => a.id === c.id);
    if (av) { reasons.push(`Avis ${av.note}/5`); if (av.note <= 3) level = Math.max(level, 1); }
    return { level, reasons, left: c.days - c.day, av };
  }
  function viewSante(S) {
    const cs = TD().clients.map(c => Object.assign({ c }, health(c)));
    const todo = cs.filter(x => x.level > 0 || x.left <= 5), ok = cs.filter(x => !todo.includes(x));
    const LV = [["Bonne santé", "ok"], ["À surveiller", "warn"], ["À risque", "danger"]];
    const tile = x => { const c = x.c, f = window.ENTREMIS_FICHE.info(c.id) || {}, bilan = `Bonjour ${String(f.contact || "").split(" ")[0]},\n\nVoici où en est votre campagne : ${c.done} rendez-vous livrés sur ${c.target}, jour ${c.day} sur ${c.days}.\nOn en parle cette semaine ?\n\n${TM().member(S.who).name} – Entremis`;
      return `<li class="hs-tile">
        <div class="hs-top"><a class="hs-name" href="#fiche-${c.id}">${esc(c.name)}</a><span class="state state-${LV[x.level][1]}">${LV[x.level][0]}</span></div>
        <ul class="hs-why">${x.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
        ${x.av && x.av.text ? `<p class="hs-avis">« ${esc(x.av.text)} »</p>` : ""}
        <div class="hs-camp"><span>Jour ${c.day} sur ${c.days}</span><b>${x.left <= 0 ? "Campagne terminée" : `fin dans ${x.left} jour${x.left > 1 ? "s" : ""}`}</b></div>
        <div class="camp-bar"><i style="--p:${Math.round(c.day / c.days * 100)}%"></i></div>
        <div class="hs-acts"><a class="btn btn-ghost btn-xs" href="mailto:${esc(f.email || "")}?subject=${encodeURIComponent("Votre campagne Entremis")}&body=${encodeURIComponent(bilan)}" target="_blank" rel="noopener">${icon("mail")}Envoyer le bilan</a>
          <a class="btn btn-ghost btn-xs" href="#propositions" data-prop-for="${c.id}">${icon("arrow")}Proposer la suite</a></div>
      </li>`; };
    const avs = CP().avis();
    return `${head("Santé et renouvellements", "Agir avant qu'un client parte, et proposer la suite avant la fin de sa campagne.")}
    <div class="kpis kpis-4" role="list">
      ${kpi("À risque", cs.filter(x => x.level === 2).length, "retard ou impayé", cs.some(x => x.level === 2) ? "danger" : "")}
      ${kpi("À surveiller", cs.filter(x => x.level === 1).length, "absences, silence, avis moyen")}
      ${kpi("Fins de campagne", cs.filter(x => x.left <= 7).length, "dans les 7 jours")}
      ${kpi("Avis moyen", avs.length ? (avs.reduce((s, a) => s + a.note, 0) / avs.length).toFixed(1).replace(".", ",") + " / 5" : "–", avs.length ? `${avs.length} avis reçu${avs.length > 1 ? "s" : ""}` : "pas encore d'avis")}
    </div>
    ${todo.length ? `<section class="card"><div class="card-head"><h2 class="h2">À traiter cette semaine <span class="muted tabnum">${todo.length}</span></h2></div><ul class="hs-list">${todo.map(tile).join("")}</ul></section>` : ""}
    ${ok.length ? `<section class="card"><div class="card-head"><h2 class="h2">Tout va bien <span class="muted tabnum">${ok.length}</span></h2></div><ul class="hs-list">${ok.map(tile).join("")}</ul></section>` : ""}`;
  }

  /* =================== Propositions commerciales =================== */
  const PROPS = () => store("proposals");
  const ticketOf = id => { const t = (window.ENTREMIS_FICHE.info(id) || {}).ticket || ""; const n = parseInt(String(t).replace(/\s/g, ""), 10); return isFinite(n) && n > 0 ? n : 8000; };
  function propFor(id) {
    const p = TD().pipeline.find(x => x.id === id), c = client(id), who = p || c || TD().pipeline[0];
    const r = c ? rows().find(x => x.c.id === c.id) : null;
    return { to: who.id, rdv: c ? c.target : 10, days: 21, price: c ? (r ? r.mrr : 2400) : (p ? p.value : 2400), rate: 25, ticket: ticketOf(who.id), renew: !!c };
  }
  function propCalc(p) {
    const who = TD().pipeline.find(x => x.id === p.to) || client(p.to) || { name: "", trade: "", city: "" };
    const sec = SEC().sectorOf(who.trade || ""), par = SEC().PARCOURS[sec.parcours] || SEC().PARCOURS.rdv;
    const n = Math.round(p.rdv * p.rate / 100 * 10) / 10, ca = Math.round(n * p.ticket), ratio = p.price ? ca / p.price : 0;
    return { who, sec, par, n, ca, ratio };
  }
  function propText(p) {
    const x = propCalc(p), nb = String(x.n).replace(".", ",");
    return `Proposition pour ${x.who.name}${x.who.city ? " (" + x.who.city + ")" : ""}

Ce qu'on fait : on trouve des particuliers qui ont un projet de ${x.sec.name.toLowerCase()}, on les rappelle tout de suite, on vérifie 4 points (${x.par.criteria.join(", ").toLowerCase()}), puis on vous les livre : ${x.par.long.toLowerCase()}.
Ce qu'on livre : ${p.rdv} ${x.par.many} en ${p.days} jours. Garantis ou remplacés.
Demandes exclusives : réservées à vous seul, jamais revendues ni partagées.
Votre investissement : ${euros(p.price)} HT par mois.
Ce que ça peut rapporter (estimation avec vos chiffres) : ${p.rdv} × ${p.rate} % signés = ${nb} chantiers × ${euros(p.ticket)} = ${euros(x.ca)} de chantiers, soit ${x.ratio.toFixed(1).replace(".", ",")} € pour 1 € investi.
Prochaine étape : on signe, et la campagne démarre sous 2 jours.`;
  }
  function propPreview(p) {
    const x = propCalc(p), nb = String(x.n).replace(".", ",");
    return `<article class="pp-paper"><header><p class="paper-brand">ENTREMIS</p><p class="pp-kind">${p.renew ? "Proposition de suite" : "Proposition"}</p></header>
      <h3 class="pp-title">Pour ${esc(x.who.name)}</h3><p class="pp-sub">${esc(x.sec.name)}${x.who.city ? " – " + esc(x.who.city) : ""}</p>
      <dl class="pp-dl"><div><dt>On livre</dt><dd><b class="tabnum">${p.rdv}</b> ${esc(x.par.many)} en ${p.days} jours, garantis ou remplacés</dd></div>
        <div><dt>Comment</dt><dd>Rappel tout de suite, 4 points vérifiés (${esc(x.par.criteria.join(", ").toLowerCase())}), demandes exclusives</dd></div>
        <div><dt>Prix</dt><dd><b class="tabnum">${euros(p.price)}</b> HT par mois</dd></div></dl>
      <div class="pp-roi"><p class="lp-label">Ce que ça peut rapporter – estimation avec vos chiffres</p>
        <p class="pp-calc tabnum">${p.rdv} × ${p.rate} % = ${nb} chantiers × ${euros(p.ticket)}</p>
        <p class="pp-big tabnum">${euros(x.ca)}</p><p class="pp-note">de chantiers, soit ${x.ratio.toFixed(1).replace(".", ",")} € pour 1 € investi</p></div>
      <p class="pp-next">Prochaine étape : on signe, la campagne démarre sous 2 jours.</p></article>`;
  }
  function viewPropositions(S) {
    const first = TD().pipeline.find(p => p.stage !== "won") || TD().pipeline[0] || TD().clients[0];
    if (!first) return `${head("Propositions", "Une proposition claire pour chaque prospect : ce qu'on livre, le prix, et ce que ça peut lui rapporter.")}<section class="card"><p class="body">Ajoutez d'abord un prospect : la proposition se prépare pour lui.</p><div class="form-actions"><button class="btn btn-primary" type="button" data-live-new="prospect">${EM().icon("plus")}Nouveau prospect</button></div></section>`;
    if (!G.prop) G.prop = propFor(first.id);
    const p = G.prop, opts = TD().pipeline.filter(x => x.stage !== "won").map(x => [x.id, x.name + " – prospect"]).concat(TD().clients.map(c => [c.id, c.name + " – client, renouvellement"]));
    const saved = PROPS().list.slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const num = (k, l, step, suffix) => `<label class="field"><span>${l}</span><div class="pp-num"><input name="${k}" type="number" inputmode="decimal" min="0" step="${step}" value="${p[k]}">${suffix ? `<small>${suffix}</small>` : ""}</div></label>`;
    return `${head("Propositions", "Une proposition claire pour chaque prospect : ce qu'on livre, le prix, et ce que ça peut lui rapporter.")}
    <div class="gen">
      <form class="card gen-form" id="prop-form" autocomplete="off">
        <div class="field"><label for="prop-to">Pour</label><select id="prop-to" name="to">${opts.map(([v, l]) => `<option value="${v}" ${p.to === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="field-row">${num("rdv", "Rendez-vous livrés", 1, "")}${num("days", "En combien de jours", 1, "jours")}</div>
        <div class="field-row">${num("price", "Prix par mois, hors taxes", 50, "€")}${num("ticket", "Chantier moyen du client", 500, "€")}</div>
        <div class="field-row">${num("rate", "Visites signées (estimation)", 1, "%")}<div></div></div>
        <p class="kpi-note">L'estimation n'est pas une promesse : elle se fait avec les chiffres du client (son chantier moyen, son taux de signature).</p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon("check")}Enregistrer</button><button class="btn btn-ghost" type="button" data-prop-pdf>${icon("download")}PDF</button><button class="btn btn-ghost" type="button" data-copy="${esc(propText(p))}" data-prop-copy>${icon("copy")}Copier le texte</button></div>
      </form>
      <div class="gen-preview" data-prop-preview>${propPreview(p)}</div>
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Propositions enregistrées <span class="muted tabnum">${saved.length}</span></h2></div>
      ${saved.length ? `<ul class="pp-list">${saved.map(x => `<li><button type="button" data-prop-open="${x.id}"><b>${esc(x.name)}</b><small>${short(x.at)} – ${euros(x.price)} par mois – ${x.rdv} RDV</small></button></li>`).join("")}</ul>` : `<p class="body">Aucune pour l'instant.</p>`}</section>`;
  }
  async function propPdf() {
    const p = G.prop, x = propCalc(p);
    let jsPDF; try { jsPDF = await window.ENTREMIS_GEN.loadPdf(); } catch (_) { EM().toast("Le PDF n'a pas pu être préparé : pas de connexion. Réessayez."); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" }), L = 20, R = 190, ink = [13, 13, 16], mute = [124, 124, 134];
    // La police intégrée de jsPDF donne au « € » une largeur trop courte : sans espace en plus, il colle au mot suivant
    const fx = v => String(v).replace(/€(?=\s\S)/g, "€ "), t0 = doc.text.bind(doc);
    doc.text = (v, ...a) => t0(Array.isArray(v) ? v.map(fx) : fx(v), ...a);
    let y = 26;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...ink); doc.text("ENTREMIS", L, y);
    doc.setFontSize(11); doc.setTextColor(...mute); doc.text(p.renew ? "Proposition de suite" : "Proposition", R, y, { align: "right" });
    y = 48; doc.setTextColor(...ink); doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.text("Pour " + x.who.name, L, y);
    doc.setFontSize(11); doc.setTextColor(...mute); doc.text(`${x.sec.name}${x.who.city ? " – " + x.who.city : ""}`, L, y + 8);
    y = 74;
    const block = (k, v) => { doc.setFontSize(9); doc.setTextColor(...mute); doc.text(k, L, y); doc.setFontSize(11); doc.setTextColor(...ink); const t = doc.splitTextToSize(v, 130); doc.text(t, 60, y); y += Math.max(8, t.length * 5.5) + 3; };
    block("On livre", `${p.rdv} ${x.par.many} en ${p.days} jours, garantis ou remplacés.`);
    block("Comment", `Rappel tout de suite, 4 points vérifiés (${x.par.criteria.join(", ").toLowerCase()}). Demandes exclusives : jamais revendues ni partagées.`);
    block("Prix", `${euros(p.price)} HT par mois.`);
    y += 6; doc.setDrawColor(226, 226, 230); doc.line(L, y, R, y); y += 10;
    doc.setFontSize(9); doc.setTextColor(...mute); doc.text("Ce que ça peut rapporter – estimation avec vos chiffres", L, y); y += 8;
    doc.setFontSize(11); doc.setTextColor(...ink); doc.text(`${p.rdv} × ${p.rate} % = ${String(x.n).replace(".", ",")} chantiers × ${euros(p.ticket)}`, L, y); y += 14;
    doc.setFontSize(30); doc.text(euros(x.ca), L, y); y += 8;
    doc.setFontSize(10); doc.setTextColor(...mute); doc.text(`de chantiers, soit ${x.ratio.toFixed(1).replace(".", ",")} € pour 1 € investi.`, L, y); y += 16;
    doc.setTextColor(...ink); doc.setFontSize(11); doc.text("Prochaine étape : on signe, la campagne démarre sous 2 jours.", L, y);
    doc.setFontSize(8); doc.setTextColor(...mute); doc.text(doc.splitTextToSize("L'estimation n'est pas une promesse : elle repose sur le chantier moyen et le taux de signature indiqués.", 170), L, 280);
    await window.ENTREMIS_GEN.save(doc.output("blob"), `Proposition ${x.who.name}.pdf`.replace(/[\\/:]/g, "-"));
  }
  // Frappe dans la proposition : l'aperçu et le texte suivent, sans redessiner le formulaire
  document.addEventListener("input", e => {
    const f = e.target.closest && e.target.closest("#prop-form"); if (!f || !G.prop) return;
    const k = e.target.name, v = Number(e.target.value);
    if (["rdv", "days", "price", "ticket", "rate"].includes(k) && isFinite(v)) G.prop[k] = Math.max(0, v);
    const pv = document.querySelector("[data-prop-preview]"); if (pv) pv.innerHTML = propPreview(G.prop);
    const cp = document.querySelector("[data-prop-copy]"); if (cp) cp.dataset.copy = propText(G.prop);
  });
  document.addEventListener("change", e => {
    if (!(e.target.id === "prop-to")) return;
    G.prop = propFor(e.target.value); EM().render();
  });

  /* =================== Études de cas =================== */
  const CASES = () => store("cases");
  function caseOf(c) {
    const rs = c.id === "solaria" ? EM().baseC().appointments.map(a => CP().result(a.id)).filter(Boolean) : OTHER_RDV.filter(a => a.client === c.id).map(resultOf).filter(Boolean);
    const signed = rs.filter(r => r.outcome === "signe"), amount = signed.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const mrr = (rows().find(x => x.c.id === c.id) || {}).mrr || 2400, sec = SEC().sectorOf(c.trade), f = window.ENTREMIS_FICHE.info(c.id) || {};
    const av = CP().avis().find(a => a.id === c.id && a.publish);
    const city = String(f.zone || "").split(" et ")[0];
    const text = `${c.name} (${sec.name.toLowerCase()}${city ? ", " + city : ""}) : en ${c.day} jours, Entremis a livré ${c.done} ${(SEC().forClient(c.id).parcours.many)}. ${signed.length} chantier${signed.length > 1 ? "s" : ""} signé${signed.length > 1 ? "s" : ""} pour ${euros(amount)} HT, soit ${(amount / mrr).toFixed(1).replace(".", ",")} € de chantiers pour 1 € d'abonnement.${av && av.text ? ` « ${av.text} »` : ""}`;
    return { rs, signed, amount, mrr, text, av };
  }
  function viewEtudes(S) {
    const cs = TD().clients.map(c => Object.assign({ c }, caseOf(c))), ready = cs.filter(x => x.signed.length), wait = cs.filter(x => !x.signed.length);
    const ok = id => !!(CASES().list.find(x => x.id === id) || {}).ok;
    return `${head("Études de cas", "Les preuves pour vendre : les vrais résultats de nos clients, avec leur accord.")}
    <div class="kpis kpis-4" role="list">
      ${kpi("Clients avec un résultat", ready.length, `sur ${cs.length}`)}
      ${kpi("Montant signé", euros(ready.reduce((s, x) => s + x.amount, 0)), "hors taxes, déclaré par les clients")}
      ${kpi("Prêtes pour le site", cs.filter(x => ok(x.c.id) && x.signed.length).length, "avec l'accord du client")}
      ${kpi("Avis publiables", CP().avis().filter(a => a.publish).length, "le client a dit oui")}
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Avec des résultats</h2></div>
      ${ready.length ? `<ul class="cs-list">${ready.map(x => `<li class="cs-tile">
        <div class="cs-top"><a class="cs-name" href="#fiche-${x.c.id}">${esc(x.c.name)}</a>${ok(x.c.id) ? `<span class="state state-ok">Prête pour le site</span>` : `<span class="state state-neutral">Accord à demander</span>`}</div>
        <p class="cs-nums"><b class="tabnum">${euros(x.amount)}</b><span>${x.signed.length} signé${x.signed.length > 1 ? "s" : ""} sur ${x.rs.length} visite${x.rs.length > 1 ? "s" : ""} renseignée${x.rs.length > 1 ? "s" : ""}</span></p>
        <p class="cs-text">${esc(x.text)}</p>
        <div class="cs-acts"><label class="check-line"><input type="checkbox" data-case-ok="${x.c.id}" ${ok(x.c.id) ? "checked" : ""}><span>Le client est d'accord pour qu'on le cite</span></label>${ok(x.c.id) ? `<button class="btn btn-ghost btn-xs" type="button" data-copy="${esc(x.text)}">${icon("copy")}Copier pour le site</button>` : ""}</div>
      </li>`).join("")}</ul>` : `<p class="body">Pas encore de résultat. Ils arrivent quand les clients renseignent leurs visites.</p>`}</section>
    ${wait.length ? `<section class="card"><div class="card-head"><h2 class="h2">Pas encore de résultat <span class="muted tabnum">${wait.length}</span></h2></div><ul class="cs-wait">${wait.map(x => `<li><a href="#fiche-${x.c.id}">${esc(x.c.name)}</a><span>${x.c.done} livrés – aucun résultat renseigné</span></li>`).join("")}</ul></section>` : ""}`;
  }

  /* =================== Marge par campagne =================== */
  const HYP_KEY = "entremis-app-marge";
  const SETS = () => store("reglages");   // réglages partagés de l'agence (une ligne par sujet)
  const hyp = () => { const r = SETS().list.find(x => x.id === "marge"); if (r) return Object.assign({ hour: 30, minutes: 8 }, r); try { return Object.assign({ hour: 30, minutes: 8 }, JSON.parse(localStorage.getItem(HYP_KEY) || "{}")); } catch (_) { return { hour: 30, minutes: 8 }; } };
  // Pub : le budget pub du mois (Finances) réparti selon les demandes reçues par chaque client. Frais fixes (outils, envois, comptable) : partagés à parts égales.
  function margins() {
    const h = hyp(), rs = rows(), costs = TD().costs || [], ads = (costs.find(c => /publicit/i.test(c.label)) || { value: 0 }).value;
    const fixed = costs.filter(c => !/publicit/i.test(c.label)).reduce((s, c) => s + c.value, 0) / Math.max(1, rs.length), reqs = rs.reduce((s, r) => s + r.req, 0) || 1;
    return rs.map(r => { const pub = ads * r.req / reqs, calls = r.q * h.minutes / 60 * h.hour, perRdv = r.c.done ? pub / r.c.done : 0, repl = (r.c.absences || 0) * perRdv, m = r.mrr - pub - calls - repl - fixed;
      return { c: r.c, mrr: r.mrr, pub, calls, repl, fixed, m, pct: r.mrr ? m / r.mrr * 100 : 0 }; });
  }
  function viewMarge(S) {
    if (!margins().length) return `${head("Marge", "Ce que rapporte chaque client, une fois payés la publicité et le temps passé.")}<section class="card"><p class="body">La marge se calcule dès qu'un client est enregistré.</p><div class="form-actions"><button class="btn btn-primary" type="button" data-live-new="client">${EM().icon("plus")}Nouveau client</button></div></section>`;
    const ms = margins(), h = hyp(), total = ms.reduce((s, x) => s + x.m, 0), best = ms.slice().sort((a, b) => b.pct - a.pct)[0], worst = ms.slice().sort((a, b) => a.pct - b.pct)[0];
    return `${head("Marge par campagne", "Ce que paie le client, moins la pub, le temps d'appel et les remplacements.")}
    <div class="kpis kpis-4" role="list">
      ${kpi("Marge du mois", euros(total), "estimation, tous clients")}
      ${kpi("Marge moyenne", Math.round(ms.reduce((s, x) => s + x.pct, 0) / ms.length) + " %", "de l'abonnement")}
      ${kpi("La meilleure", Math.round(best.pct) + " %", esc(best.c.name))}
      ${kpi("La plus faible", Math.round(worst.pct) + " %", esc(worst.c.name), worst.pct < 0 ? "danger" : "")}
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Par client</h2><span class="muted">estimation – exemple</span></div>
      <ul class="mg-list">${ms.map(x => `<li class="mg-row">
        <a class="mg-name" href="#fiche-${x.c.id}">${esc(x.c.name)}</a>
        <dl class="mg-dl"><div><dt>Abonnement</dt><dd class="tabnum">${euros(x.mrr)}</dd></div><div><dt>Pub</dt><dd class="tabnum">− ${euros(x.pub)}</dd></div><div><dt>Appels</dt><dd class="tabnum">− ${euros(x.calls)}</dd></div><div><dt>Remplacements</dt><dd class="tabnum">− ${euros(x.repl)}</dd></div><div><dt>Frais fixes</dt><dd class="tabnum">− ${euros(x.fixed)}</dd></div></dl>
        <div class="mg-res"><b class="tabnum${x.m < 0 ? " t-danger" : ""}">${euros(x.m)}</b><span class="tabnum">${Math.round(x.pct)} %</span><div class="camp-bar"><i style="--p:${Math.max(0, Math.min(100, Math.round(x.pct)))}%"></i></div></div>
      </li>`).join("")}</ul></section>
    <section class="card"><div class="card-head"><h2 class="h2">Les hypothèses</h2><span class="muted">à vérifier</span></div>
      <form class="mg-hyp" id="marge-form"><label class="field"><span>Coût d'une heure d'appel</span><div class="pp-num"><input name="hour" type="number" min="0" step="1" value="${h.hour}"><small>€</small></div></label>
        <label class="field"><span>Minutes d'appel par demande qualifiée</span><div class="pp-num"><input name="minutes" type="number" min="0" step="1" value="${h.minutes}"><small>min</small></div></label>
        <button class="btn btn-ghost" type="submit">${icon("check")}Recalculer</button></form>
      <p class="kpi-note">Pub : le budget pub du mois (Finances), réparti selon les demandes reçues par chaque client. Remplacements : absences × coût en pub d'un rendez-vous. Frais fixes : outils, envois et comptable, à parts égales.</p></section>`;
  }

  /* =================== Conformité =================== */
  const ERAS = () => store("erasures");
  // Le texte exact de la case à cocher de la page de demande (demande.html) : à changer aux deux endroits ensemble
  const CONSENT = "J'accepte qu'Entremis me rappelle au sujet de ce projet et transmette ma demande à un installateur partenaire de ma région. Mes coordonnées ne sont pas vendues.";
  function viewConformite(S) {
    const ls = LEADS().list().slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1), er = ERAS().list.slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const live = ls.filter(l => !l.erased);
    return `${head("Conformité", "La preuve que chaque particulier a demandé à être rappelé, et l'effacement de ses données s'il le demande.")}
    <div class="kpis kpis-4" role="list">
      ${kpi("Preuves gardées", live.length, "une par demande")}
      ${kpi("Effacements faits", er.length, "à la demande des personnes")}
      ${kpi("Délai pour effacer", "1 mois", "au plus, après la demande")}
      ${kpi("Appels à froid", 0, "on n'appelle que ceux qui demandent", "ok")}
    </div>
    <div class="home-main">
      <section class="card"><div class="card-head"><h2 class="h2">Preuves de consentement <span class="muted tabnum">${live.length}</span></h2></div>
        <ul class="lg-list">${live.slice(0, 12).map(l => `<li><div><b>${esc(l.name)}</b><span>${esc(l.source)} – ${short(l.at)} à ${String(l.at).slice(11, 16)}</span></div><span class="state state-ok">Preuve gardée</span></li>`).join("")}</ul>
        ${live.length > 12 ? `<p class="kpi-note">et ${live.length - 12} autres</p>` : ""}
        <p class="kpi-note">Texte accepté par chaque personne : « ${esc(CONSENT)} »</p></section>
      <section class="card"><div class="card-head"><h2 class="h2">Effacer les données d'une personne</h2></div>
        <form class="lg-form" id="erase-form"><label class="field"><span>La personne qui le demande</span><select name="lead">${live.map(l => `<option value="${l.id}">${esc(l.name)} – ${esc(l.city)}</option>`).join("")}</select></label>
          <button class="btn btn-ghost pr-danger" type="submit">${icon("trash")}Effacer ses données</button></form>
        ${er.length ? `<ul class="lg-list">${er.map(x => `<li><div><b>Demande du ${short(x.at)}</b><span>Effacée par ${esc(TM().member(x.by).name)}</span></div><span class="state state-neutral">Effacé</span></li>`).join("")}</ul>` : `<p class="kpi-note">Aucun effacement pour l'instant.</p>`}
      </section>
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Nos règles</h2></div>
      <ul class="lg-rules">${["On n'appelle que les particuliers qui ont demandé à être rappelés.", "Chaque demande garde sa preuve : date, source, texte accepté.", "Une personne peut demander l'effacement de ses données : c'est fait ici, en un mois au plus.", "Durée de conservation des demandes : à fixer avec un juriste."].map(x => `<li>${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul></section>`;
  }

  /* =================== Morceaux pour les autres pages =================== */
  // Leads : pourquoi on écarte
  function leadReasons() {
    const lost = LEADS().list().filter(l => l.status === "perdu"), by = {};
    lost.forEach(l => { const k = l.why || "Sans motif"; by[k] = (by[k] || 0) + 1; });
    const list = Object.entries(by).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...list.map(x => x[1]));
    return `<section class="card"><div class="card-head"><h2 class="h2">Pourquoi on écarte <span class="muted tabnum">${lost.length}</span></h2><span class="muted">pour mieux cibler les pubs</span></div>
      ${list.length ? `<ul class="why-list">${list.map(([k, n]) => `<li><span>${esc(k)}</span><div class="camp-bar"><i style="--p:${Math.round(n / max * 100)}%"></i></div><b class="tabnum">${n}</b></li>`).join("")}</ul>` : `<p class="body">Rien d'écarté pour l'instant.</p>`}</section>`;
  }
  // Marketing : les visuels qui marchent
  const CREAS = [
    { id: "k1", name: "Facture de fioul", sec: "pac", channel: "Meta", spent: 420, leads: 63, qual: 14 },
    { id: "k2", name: "Toit plein sud", sec: "solaire", channel: "Meta", spent: 380, leads: 41, qual: 6 },
    { id: "k3", name: "Maison froide l'hiver", sec: "isolation", channel: "Meta", spent: 260, leads: 37, qual: 8 },
    { id: "k4", name: "Clim avant l'été", sec: "clim", channel: "Google", spent: 190, leads: 18, qual: 5 },
    { id: "k5", name: "Porte claquée", sec: "serrurerie", channel: "Google", spent: 140, leads: 22, qual: 9 }
  ];
  function creatives() {
    const secs = SEC().list(), cs = CREAS.map(c => Object.assign({}, c, { cpl: c.spent / Math.max(1, c.leads), cpq: c.spent / Math.max(1, c.qual) })).sort((a, b) => a.cpq - b.cpq);
    return `<section class="card"><div class="card-head"><h2 class="h2">Les visuels qui marchent</h2><span class="muted">classés par coût d'un lead qualifié – exemple</span></div>
      <ul class="cr-list">${cs.map((c, i) => { const s = secs.find(x => x.id === c.sec) || { art: "house", name: "" }; return `<li class="cr-row">
        <span class="cr-thumb">${SEC().art(s.art)}</span>
        <span class="cr-main"><b>${esc(c.name)}</b><small>${esc(s.name)} – ${c.channel === "Meta" ? "Facebook et Instagram" : "Google"}</small></span>
        <dl class="cr-dl"><div><dt>Demandes</dt><dd class="tabnum">${c.leads}</dd></div><div><dt>Coût/demande</dt><dd class="tabnum">${euros(c.cpl)}</dd></div><div><dt>Coût/qualifié</dt><dd class="tabnum"><b>${euros(c.cpq)}</b></dd></div></dl>
        ${i === 0 ? `<span class="state state-ok">Le meilleur</span>` : ""}</li>`; }).join("")}</ul></section>`;
  }
  // Marketing : les pages « métier + ville » du site
  const SEOP = () => store("seo-pages", () => [{ id: "pac|Lyon", st: "ligne" }, { id: "solaire|Lyon", st: "ligne" }, { id: "pac|Villeurbanne", st: "cours" }, { id: "isolation|Lyon", st: "cours" }]);
  const CITIES = ["Lyon", "Villeurbanne", "Saint-Priest", "Grenoble", "Vannes"];
  function seoPages() {
    const secs = SEC().list().filter(s => ["pac", "solaire", "isolation", "clim", "serrurerie", "plomberie"].includes(s.id)), lab = { ligne: "En ligne", cours: "En cours", ecrire: "À écrire" };
    const stOf = id => (SEOP().list.find(x => x.id === id) || {}).st || "ecrire";
    let n = { ligne: 0, cours: 0, ecrire: 0 }; secs.forEach(s => CITIES.forEach(v => n[stOf(s.id + "|" + v)]++));
    return `<section class="card"><div class="card-head"><h2 class="h2">Pages « métier + ville » du site</h2><span class="muted">${n.ligne} en ligne – ${n.cours} en cours – ${n.ecrire} à écrire</span></div>
      <div class="table-scroll"><table class="zone-table sp-table"><thead><tr><th>Métier</th>${CITIES.map(v => `<th>${v}</th>`).join("")}</tr></thead>
      <tbody>${secs.map(s => `<tr><th scope="row">${esc(s.name)}</th>${CITIES.map(v => { const k = s.id + "|" + v, x = stOf(k); return `<td><button type="button" class="sp sp-${x}" data-seo="${k}" title="${esc(s.name)} à ${v} : ${lab[x]}">${lab[x]}</button></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="kpi-note">Une page par métier et par ville, pour recevoir des demandes depuis Google sans payer de pub. Touchez une case pour changer son état.</p></section>`;
  }
  // Marketing : le questionnaire d'aides (aimant à demandes pour le site)
  function simulator() {
    const q = G.sim || (G.sim = { step: 0, projet: "", logement: "", revenus: "", cp: "" });
    const STEPS = [
      ["projet", "Votre projet", ["Pompe à chaleur", "Isolation", "Panneaux solaires", "Chauffe-eau"]],
      ["logement", "Votre logement", ["Maison de plus de 15 ans", "Maison récente", "Appartement"]],
      ["revenus", "Vos revenus (avis d'imposition)", ["Très modestes", "Modestes", "Intermédiaires", "Supérieurs"]]
    ];
    const cur = STEPS[q.step];
    return `<div class="home-main"><section class="card sim-card"><div class="card-head"><h2 class="h2">Questionnaire d'aides</h2><span class="muted">aperçu du module pour le site</span></div>
      ${q.step < STEPS.length ? `<p class="sim-step">Étape ${q.step + 1} sur ${STEPS.length + 1}</p><p class="sim-q">${cur[1]}</p><div class="sim-opts">${cur[2].map(o => `<button type="button" class="sim-opt${q[cur[0]] === o ? " is-on" : ""}" data-sim="${cur[0]}|${esc(o)}">${esc(o)}</button>`).join("")}</div>`
        : `<p class="sim-step">Dernière étape</p><p class="sim-q">Vous pourriez avoir droit à des aides.</p><p class="body">Un conseiller vous rappelle pour le calcul exact, avec vos chiffres. ${esc(q.projet)} – ${esc(q.logement)} – revenus ${esc(String(q.revenus).toLowerCase())}.</p>
          <div class="sim-form"><input placeholder="Votre prénom" aria-label="Prénom"><input placeholder="Votre téléphone" aria-label="Téléphone" inputmode="tel"><label class="check-line"><input type="checkbox"><span>${esc(CONSENT)}</span></label><button class="btn btn-primary" type="button" data-sim-done>Être rappelé</button></div>`}
      ${q.step ? `<button class="link" type="button" data-sim-back>${icon("back")}Retour</button>` : ""}</section>
      <section class="card"><div class="card-head"><h2 class="h2">Comment ça marche</h2></div>
        <ul class="lg-rules">${["3 questions simples, puis le prénom et le téléphone : la demande arrive dans Leads, avec sa preuve de consentement.", "Les montants d'aides ne s'affichent pas ici : ils changent chaque année. Le calcul exact se fait au téléphone, avec le barème officiel (France Rénov').", "À brancher sur le site par le dev."].map(x => `<li>${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul></section></div>`;
  }
  // Finances : abonnements et contrats, trésorerie prévue
  const CONTRACT = { solaria: ["signe", "actif", "2026-09-01"], thermo: ["signe", "actif", "2026-09-15"], ecotoit: ["signe", "afaire", "2026-10-03"], isolea: ["signe", "actif", "2026-10-20"], delmas: ["asigner", "afaire", ""], blindex: ["signe", "actif", "2026-10-28"] };
  const CTS = () => store("contracts");
  const ctOf = id => { const o = CTS().list.find(x => x.id === id), d = CONTRACT[id] || ["asigner", "afaire", ""]; return o ? [o.sign, o.mandat, o.since] : d; };
  function contracts() {
    const rs = rows();
    return `<section class="card"><div class="card-head"><h2 class="h2">Abonnements et contrats</h2><span class="muted">prélèvement le 1er du mois – exemple</span></div>
      <ul class="ct-list">${rs.map(r => { const [sign, mandat, since] = ctOf(r.c.id); return `<li class="ct-row">
        <a class="ct-name" href="#fiche-${r.c.id}">${esc(r.c.name)}</a><b class="tabnum">${euros(r.mrr)}<small> HT/mois</small></b>
        <span class="state state-${sign === "signe" ? "ok" : "warn"}">${sign === "signe" ? "Contrat signé" + (since ? " le " + short(since) : "") : "Contrat à signer"}</span>
        <span class="state state-${mandat === "actif" ? "ok" : "neutral"}">${mandat === "actif" ? "Prélèvement actif" : "Prélèvement à mettre en place"}</span>
        ${sign !== "signe" ? `<button class="btn btn-ghost btn-xs" type="button" data-ct="${r.c.id}:sign">Envoyer à signer</button>` : mandat !== "actif" ? `<button class="btn btn-ghost btn-xs" type="button" data-ct="${r.c.id}:mandat">Demander le mandat</button>` : ""}
      </li>`; }).join("")}</ul>
      <p class="kpi-note">Maquette : signature en ligne et prélèvement automatique à brancher (par exemple Yousign et GoCardless).</p></section>`;
  }
  function cashflow() {
    const rs = rows(), inc = rs.filter(r => ctOf(r.c.id)[0] === "signe").reduce((s, r) => s + r.mrr, 0), out = (TD().costs || []).reduce((s, c) => s + c.value, 0);
    const months = ["déc.", "janv.", "févr."], max = Math.max(inc, out, 1);
    return `<section class="card"><div class="card-head"><h2 class="h2">Trésorerie prévue</h2><span class="muted">3 prochains mois – estimation</span></div>
      <ul class="cash-list">${months.map((m, i) => `<li><span class="cash-m">${m}</span><div class="cash-bars"><i class="cash-in" style="--p:${Math.round(inc / max * 100)}%"></i><i class="cash-out" style="--p:${Math.round(out / max * 100)}%"></i></div><span class="cash-v tabnum"><b>+ ${euros(inc - out)}</b><small>${euros(inc)} entrent – ${euros(out)} sortent</small></span></li>`).join("")}</ul>
      <p class="kpi-note">Entrées : abonnements des contrats signés. Sorties : publicités, outils, boîtes d'envoi, comptable. Sans les nouveaux clients.</p></section>`;
  }
  // Avancement : les objectifs de la semaine, par personne
  const GOALS = () => store("goals");
  const GOAL_DEF = { marc: ["Pubs en ligne", 5], richard: ["RDV placés", 8], gianni: ["Rappels", 150] };
  function goals() {
    const pp = TD().perPerson || {};
    return `<section class="card"><div class="card-head"><h2 class="h2">Objectifs de la semaine</h2><span class="muted">touchez − ou + pour changer l'objectif</span></div>
      <ul class="obj-list">${TD().members.map(m => { const [label, def] = GOAL_DEF[m.id] || ["Tâches faites", 10], g = (GOALS().list.find(x => x.id === m.id) || {}).target || def;
        const row = (pp[m.id] || []).find(([k]) => k === label), v = row ? parseInt(row[1], 10) || 0 : 0, pct = Math.min(100, Math.round(v / g * 100));
        return `<li class="obj-row">${TM().avatar(m.id, "av")}<div class="obj-main"><b>${m.name} – ${esc(label)}</b><div class="camp-bar"><i style="--p:${pct}%"></i></div></div>
          <span class="obj-num tabnum"><b>${v}</b>/${g}</span><span class="obj-step"><button class="icon-btn" type="button" data-goal="${m.id}:-1" aria-label="Objectif moins un">−</button><button class="icon-btn" type="button" data-goal="${m.id}:1" aria-label="Objectif plus un">+</button></span></li>`; }).join("")}</ul></section>`;
  }
  // Prospection : les demandes du site et les parrainages
  const SITE = [
    { id: "s1", name: "Chauffage Morel", trade: "Pompes à chaleur", zone: "Loire (42)", volume: "10 rendez-vous par mois", who: "Julien Morel", phone: "06 12 44 80 21", when: "Demain matin", at: "2026-11-19T09:12" },
    { id: "s2", name: "Alu Fenêtres 38", trade: "Fenêtres et volets", zone: "Isère (38)", volume: "5 rendez-vous par mois", who: "Sarah Benali", phone: "06 77 10 32 54", when: "Après 17 h", at: "2026-11-18T16:40" }
  ];
  const SITEST = () => store("site-requests");
  // En ligne : les vraies demandes du formulaire du site (fonction demande_site) ; dans la maquette : deux exemples
  const siteRequests = () => CLOUD() ? SITEST().list.filter(r => r && r.name).sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1) : SITE;
  function prospectExtras() {
    const done = id => !!(SITEST().list.find(x => x.id === id) || {}).called;
    const SITE_ = siteRequests();
    const refs = CP().referrals().list.slice().sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const RS = { nouveau: ["Reçu", "neutral"], appele: ["Appelé", "info"], signe: ["Signé", "ok"] };
    return `<div class="home-main">
      <section class="card"><div class="card-head"><h2 class="h2">Demandes du site <span class="muted tabnum">${SITE_.filter(s => !done(s.id)).length}</span></h2><span class="muted">rappel promis sous 24 h</span></div>
        <ul class="sr-list">${SITE_.length ? SITE_.map(s => { const due = new Date(Date.parse(s.at) + 86400000), left = Math.round((due - Date.parse(nowIso())) / 3600000), called = done(s.id);
          return `<li class="sr-row${called ? " is-done" : ""}"><div><b>${esc(s.name)}</b><span>${esc(s.trade)} – ${esc(s.zone)} – ${esc(s.volume)}</span><span>${esc(s.who)}, rappel souhaité : ${esc(s.when)}</span></div>
            ${called ? `<span class="state state-ok">Rappelé</span>` : `<span class="state state-${left < 0 ? "danger" : left < 6 ? "warn" : "info"}">${left < 0 ? "En retard" : `Encore ${left} h`}</span><span class="sr-acts"><a class="icon-btn" href="tel:${s.phone.replace(/\s/g, "")}" aria-label="Appeler ${esc(s.who)}">${icon("phone")}</a><button class="btn btn-ghost btn-xs" type="button" data-site-done="${s.id}">Rappelé</button>${CLOUD() && !s.prospect ? `<button class="btn btn-ghost btn-xs" type="button" data-site-prospect="${s.id}">En prospect</button>` : ""}</span>`}</li>`; }).join("") : `<li class="sr-row"><div><span>Aucune demande pour l'instant. Elles arrivent ici dès qu'un installateur remplit le formulaire du site.</span></div></li>`}</ul>
        ${CLOUD() ? "" : `<p class="kpi-note">Maquette : ces deux demandes sont des exemples. En ligne, le formulaire du site les envoie ici.</p>`}</section>
      <section class="card"><div class="card-head"><h2 class="h2">Parrainages <span class="muted tabnum">${refs.length}</span></h2><span class="muted">présentés par nos clients</span></div>
        ${refs.length ? `<ul class="sr-list">${refs.map(r => { const s = RS[r.status] || RS.nouveau; return `<li class="sr-row"><div><b>${esc(r.name)}</b><span>${esc(r.trade)} – ${esc(r.city)}</span><span>De la part de ${esc(r.fromName || r.from)}${r.note ? " – " + esc(r.note) : ""}</span></div><span class="state state-${s[1]}">${s[0]}</span>
          <span class="sr-acts">${r.phone ? `<a class="icon-btn" href="tel:${esc(r.phone.replace(/\s/g, ""))}" aria-label="Appeler">${icon("phone")}</a>` : ""}${r.status !== "signe" ? `<button class="btn btn-ghost btn-xs" type="button" data-ref-step="${r.id}">${r.status === "appele" ? "Signé" : "Appelé"}</button>` : ""}</span></li>`; }).join("")}</ul>` : `<p class="body">Pas encore de parrainage. Les clients présentent un installateur depuis leur espace (page Parrainer).</p>`}
        <p class="kpi-note">Le geste offert au client qui parraine est à décider.</p></section>
    </div>`;
  }

  /* =================== Clics et formulaires =================== */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-call-lead],[data-call-out],[data-call-why],[data-rv-f],[data-rv-ask],[data-zone],[data-zone-close],[data-prop-for],[data-prop-pdf],[data-prop-open],[data-case-ok],[data-seo],[data-sim],[data-sim-back],[data-sim-done],[data-ct],[data-goal],[data-site-done],[data-site-prospect],[data-ref-step]");
    // <html> porte data-zone (l'espace affiché) : ce n'est pas une zone. Sans ce garde-fou, ce module avalait tous les clics de l'équipe.
    if (!t || t === document.documentElement) return false;
    const d = t.dataset;
    if (d.callLead) { G.lead = d.callLead; G.why = null; render(); return true; }
    if (d.callOut) { if (d.callOut === "ecarter") { G.why = G.why ? null : G.lead; render(); } else callOutcome(d.callOut, "", S, render); return true; }
    if (d.callWhy) { callOutcome("ecarter", d.callWhy, S, render); return true; }
    if (d.rvF) { G.rdvF = d.rvF; render(); return true; }
    if (d.rvAsk) { TM().haptic("tap"); EM().toast("Demande envoyée au client : il renseigne le résultat dans son espace (maquette)."); return true; }
    if (d.zone) { G.zone = d.zone; render(); const i = document.querySelector('#zone-form input[name="name"]'); if (i) i.focus(); return true; }
    if ("zoneClose" in d) { G.zone = null; render(); return true; }
    if (d.propFor) { G.prop = propFor(d.propFor); return false; }   // le lien continue vers #propositions
    if ("propPdf" in d) { propPdf(); return true; }
    if (d.propOpen) { const x = PROPS().list.find(y => y.id === d.propOpen); if (x) { G.prop = { to: x.to, rdv: x.rdv, days: x.days, price: x.price, rate: x.rate, ticket: x.ticket, renew: x.renew }; render(); window.scrollTo(0, 0); } return true; }
    if (d.caseOk) { const ok = t.checked; CASES().put({ id: d.caseOk, ok, by: S.who, at: today() }); render(); EM().toast(ok ? "Accord noté : l'étude de cas est prête pour le site." : "Accord retiré."); return true; }
    if (d.seo) { const cur = (SEOP().list.find(x => x.id === d.seo) || {}).st || "ecrire", nx = { ecrire: "cours", cours: "ligne", ligne: "ecrire" }[cur]; SEOP().put({ id: d.seo, st: nx }); TM().haptic("tap"); render(); return true; }
    if (d.sim) { const [k, v] = d.sim.split("|"); G.sim[k] = v; G.sim.step++; render(); return true; }
    if ("simBack" in d) { G.sim.step = Math.max(0, G.sim.step - 1); render(); return true; }
    if ("simDone" in d) { EM().toast("Aperçu : sur le site, la demande arriverait dans Leads, avec sa preuve de consentement."); G.sim = null; render(); return true; }
    if (d.ct) { const [id, what] = d.ct.split(":"), cur = ctOf(id); CTS().put({ id, sign: what === "sign" ? "envoye" : cur[0], mandat: what === "mandat" ? "envoye" : cur[1], since: cur[2] }); render(); EM().toast(what === "sign" ? "Contrat envoyé pour signature (maquette)." : "Demande de mandat envoyée (maquette)."); return true; }
    if (d.goal) { const [id, dv] = d.goal.split(":"), cur = (GOALS().list.find(x => x.id === id) || {}).target || (GOAL_DEF[id] || ["", 10])[1]; GOALS().put({ id, target: Math.max(1, cur + Number(dv) * (cur >= 50 ? 10 : 1)) }); render(); return true; }
    if (d.siteProspect) { const r = SITEST().list.find(x => x.id === d.siteProspect); if (!r) return true;
      LIVE().PROSPECTS().put({ id: "p" + Date.now().toString(36), name: r.name, trade: r.trade || "", city: r.zone || "", owner: S.who, value: 0, stage: "lead", source: "Site", phone: r.phone || "", next: "Rappeler " + (r.who || ""), createdAt: nowIso() });
      SITEST().put(Object.assign({}, r, { prospect: true })); TM().haptic("done"); render(); EM().toast(`${r.name} ajouté à la prospection.`); return true; }
    if (d.siteDone) { const cur = SITEST().list.find(x => x.id === d.siteDone) || {}; SITEST().put(Object.assign({}, cur, { id: d.siteDone, called: true, by: S.who, calledAt: nowIso() })); TM().haptic("done"); render(); EM().toast("Noté : rappelé dans les temps."); return true; }
    if (d.refStep) { const r = CP().referrals().list.find(x => x.id === d.refStep); if (r) { CP().referrals().put(Object.assign({}, r, { status: r.status === "appele" ? "signe" : "appele" })); render(); } return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    const f = e.target;
    if (f.id === "zone-form") {
      e.preventDefault(); const name = String(new FormData(f).get("name") || "").trim(); if (!name) return true;
      const cur = ZONES().list.find(z => z.id === G.zone) || { id: G.zone, names: [] };
      ZONES().put({ id: G.zone, names: (cur.names || []).concat(name) }); TM().haptic("done"); render(); EM().toast(`${name} : en liste d'attente.`);
      return true;
    }
    if (f.id === "prop-form") {
      e.preventDefault(); const p = G.prop, x = propCalc(p);
      PROPS().put(Object.assign({ id: "pp" + Date.now().toString(36), name: x.who.name, at: today(), by: S.who }, p)); TM().haptic("done"); render();
      EM().toast(`Proposition pour ${x.who.name} enregistrée.`);
      return true;
    }
    if (f.id === "marge-form") {
      e.preventDefault(); const fd = new FormData(f);
      SETS().put({ id: "marge", hour: Math.max(0, Number(fd.get("hour")) || 0), minutes: Math.max(0, Number(fd.get("minutes")) || 0) });
      render(); EM().toast("Marges recalculées.");
      return true;
    }
    if (f.id === "erase-form") {
      e.preventDefault(); const id = new FormData(f).get("lead"), l = LEADS().list().find(x => x.id === id); if (!l) return true;
      EM().confirm({ title: `Effacer les données de ${l.name} ?`, text: "Son nom, sa ville et ses coordonnées disparaissent pour toute l'équipe. On ne garde que la trace de l'effacement.", ok: "Effacer" }).then(ok => {
        if (!ok) return;
        LEADS().put(Object.assign({}, l, { name: "Personne effacée", city: "", zone: "", phone: "", email: "", note: "", erased: true }));
        LIVE().rdvs().filter(r => r.lead === l.id || r.name === l.name).forEach(r => LIVE().RDV().put(Object.assign({}, r, { name: "Personne effacée", phone: "", address: "", note: "" })));
        OPS().stores.CALLS.list.filter(c => c.contact === l.name).forEach(c => OPS().stores.CALLS.put(Object.assign({}, c, { contact: "Personne effacée", note: "" })));
        ERAS().put({ id: "e" + Date.now().toString(36), lead: l.id, at: today(), by: S.who }); TM().haptic("done"); render(); EM().toast("Données effacées.");
      });
      return true;
    }
    return false;
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && G.zone && !document.querySelector(".confirm")) { G.zone = null; EM().render(); } });

  window.ENTREMIS_GROWTH = {
    views: { appel: viewAppel, "rendez-vous": viewRdvs, zones: viewZones, sante: viewSante, propositions: viewPropositions, etudes: viewEtudes, marge: viewMarge, conformite: viewConformite },
    leadReasons, creatives, seoPages, simulator, contracts, cashflow, goals, prospectExtras, onClick, onSubmit,
    riskCount: () => TD().clients.filter(c => health(c).level === 2).length,
    siteRequests: () => siteRequests(),
    otherRdv: id => OTHER_RDV.filter(a => a.client === id),                                  // les rendez-vous d'exemple d'un client (sa vue client)
    rdvClient: id => { const a = allRdv().find(x => x.id === id); return a ? a.client : null; },   // à quel client appartient ce rendez-vous
    reset: () => { G.zone = null; G.why = null; },
    init: render => [ZONES, PROPS, CASES, ERAS, SEOP, CTS, GOALS, SITEST, SETS].forEach(f => f().init(render))
  };
})();
