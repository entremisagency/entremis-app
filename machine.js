/* Entremis — « la machine à leads » (documents de Gianni du 20/11/2026, adaptés le 21/11/2026).
   Le modèle : un lead vérifié par code SMS = 50 € HT, exclusif (un lead = un seul installateur, une zone = un seul client).
   Trois niveaux, même prix : RDV pris, qualifié, vérifié. Pas facturés : locataire, hors zone, doublon sur 90 jours, faux numéro,
   contestation acceptée (le client a 7 jours). Facture le 1er du mois : prix × leads facturables, plafond mensuel.
   Ce module ajoute : le niveau et la facturation d'un lead, la facturation du mois d'un client (fiche + espace client),
   la contestation par le client, la fiche d'appel d'un prospect (critères + 10 questions + décision),
   le simulateur de rentabilité de Gianni (Marketing › Calcul) et les chiffres suivis chaque semaine (Chiffres). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team, TM = () => window.ENTREMIS_TEAM;
  const LEADS = () => window.ENTREMIS_LEADS, LIVE = () => window.ENTREMIS_LIVE;
  let CT = null; const CONTESTS = () => CT || (CT = OPS().makeStore("contests", () => []));   // une contestation par lead (id = lead)
  const X = { month: null, call: null, open: {}, sim: null };
  const p2 = n => String(n).padStart(2, "0");
  const today = () => window.ENTREMIS_DATA.today.iso;
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const monthLabel = m => MONTHS[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);
  const shiftMonth = (m, n) => { const d = new Date(m + "-15T12:00:00"); d.setMonth(d.getMonth() + n); return d.getFullYear() + "-" + p2(d.getMonth() + 1); };
  const eur = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
  const daysBetween = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 864e5);

  /* ---------- France et pays francophones (Marc, 21 nov. 2026) ----------
     La facture d'Entremis (société française) à un installateur : TVA française en France et à Monaco ;
     autoliquidation dans l'Union européenne (Belgique, Luxembourg) ; hors UE (Suisse, Canada…) pas de TVA française.
     À faire valider par le comptable avant la première facture hors de France. */
  const PAYS = { FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg", MC: "Monaco", CA: "Canada (Québec)", XX: "Autre pays francophone" };
  function vatFor(cid) {
    const c = EM().allClients().find(x => x.id === cid) || {}, p = c.pays || "FR";
    if (p === "FR" || p === "MC") return { tva: 20, note: "" };
    if (p === "BE" || p === "LU") return { tva: 0, note: `Autoliquidation : TVA due par le preneur (article 196 de la directive 2006/112/CE).${c.tvaIntra ? " N° de TVA du client : " + c.tvaIntra + "." : ""}` };
    return { tva: 0, note: "TVA non applicable, article 259-1 du CGI (prestation à un professionnel établi hors de l'Union européenne)." };
  }

  /* ---------- Un lead : son niveau, et s'il est facturable ---------- */
  const LEVEL = { rdv: ["RDV pris", "ok"], qualifie: ["Qualifié", "info"], verifie: ["Vérifié", "neutral"] };
  const EXCL = { "": "Facturable", locataire: "Locataire", "hors-zone": "Hors zone", doublon: "Doublon (90 jours)", "faux-numero": "Numéro non vérifié", conteste: "Contestation acceptée" };
  const levelOf = l => l.level || (l.status === "rdv" ? "rdv" : ["qualifie", "attribue"].includes(l.status) ? "qualifie" : "verifie");
  const contestOf = l => CONTESTS().list.find(c => c.id === l.id);
  const exclOf = l => l.excl || ((contestOf(l) || {}).state === "accepte" ? "conteste" : "");
  const billable = l => !!l.to && l.status !== "perdu" && !l.erased && !exclOf(l);
  const givenAt = l => String(l.givenAt || l.at || "");
  const contestOpen = l => daysBetween(givenAt(l), today()) <= 7;
  const pill = l => { const [t, k] = LEVEL[levelOf(l)]; return `<span class="state state-${k}">${t}</span>`; };

  // Le contrat d'un client (fiche « Campagne et suivi ») : prix par lead, plafond, engagement, zone
  const contract = cid => { const c = EM().allClients().find(x => x.id === cid) || {}; return { price: Number(c.prixLead) || 50, cap: Number(c.plafond) || 0, months: Number(c.engagement) || 0, zone: c.zoneCP || "", rge: !!c.rge, name: c.name || cid }; };
  function billing(cid, month) {
    const all = LEADS().list().filter(l => l.to === cid && givenAt(l).slice(0, 7) === month && !l.erased);
    const ok = all.filter(billable), k = contract(cid), raw = ok.length * k.price, amount = k.cap ? Math.min(raw, k.cap) : raw;
    return { all, ok, out: all.filter(l => !billable(l)), price: k.price, cap: k.cap, raw, amount, capped: !!k.cap && raw > k.cap, contract: k,
      levels: { rdv: ok.filter(l => levelOf(l) === "rdv").length, qualifie: ok.filter(l => levelOf(l) === "qualifie").length, verifie: ok.filter(l => levelOf(l) === "verifie").length } };
  }

  /* ---------- Panneau d'un lead (agence) : niveau, facturation, contestation ---------- */
  function leadBox(l) {
    const esc = EM().esc, ct = contestOf(l);
    if (!l.to) return `<section class="lp-box"><p class="lp-label">Facturation</p><p class="body">Facturable une fois donné à un client (50 € HT si le numéro est vérifié).</p></section>`;
    return `<section class="lp-box mc-box"><p class="lp-label">Niveau et facturation</p>
      <div class="seg seg-lg" role="group" aria-label="Niveau du lead">${Object.keys(LEVEL).map(k => `<button type="button" data-mc-level="${l.id}:${k}" aria-pressed="${levelOf(l) === k}">${LEVEL[k][0]}</button>`).join("")}</div>
      <div class="field"><label for="mc-excl">Facturé au client ?</label><select id="mc-excl" data-fsel="mc-excl">${Object.keys(EXCL).filter(k => k !== "conteste").map(k => `<option value="${l.id}:${k}"${(l.excl || "") === k ? " selected" : ""}>${k ? "Non : " + EXCL[k].toLowerCase() : "Oui, facturable"}</option>`).join("")}</select></div>
      ${ct ? `<div class="mc-contest"><p><b>Contesté par le client</b> le ${esc(ct.at.slice(8, 10) + "/" + ct.at.slice(5, 7))} : « ${esc(ct.why || "")} »</p>
        ${ct.state === "ouvert" ? `<div class="form-actions"><button class="btn btn-ghost" type="button" data-mc-contest="${l.id}:accepte">Accepter (non facturé)</button><button class="btn btn-ghost" type="button" data-mc-contest="${l.id}:refuse">Refuser</button></div>` : `<span class="state state-${ct.state === "accepte" ? "ok" : "neutral"}">${ct.state === "accepte" ? "Acceptée : non facturé" : "Refusée : facturé"}</span>`}</div>` : ""}
    </section>`;
  }

  /* ---------- Facturation du mois d'un client (fiche, agence) ---------- */
  function billingCard(cid) {
    const m = X.month || today().slice(0, 7), b = billing(cid, m), esc = EM().esc, icon = EM().icon, k = b.contract;
    const row = (a, v) => `<div><dt>${a}</dt><dd>${v}</dd></div>`;
    const list = X.open[cid] ? `<ul class="ac-list mc-list">${b.all.map(l => `<li class="ac-row is-link" data-lead-open="${l.id}" tabindex="0" role="button"><span class="av av-md">${esc((l.name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span><span><b>${esc(l.name)}</b><small>${esc(givenAt(l).slice(8, 10) + "/" + givenAt(l).slice(5, 7))} · ${esc(l.trade || "")} · ${esc(l.city || l.zip || "")}</small></span><span class="ac-acts">${pill(l)}${billable(l) ? "" : `<span class="state state-neutral">${esc(EXCL[exclOf(l)] || "Non facturé")}</span>`}</span></li>`).join("") || `<li class="ac-row"><span></span><span><small>Aucun lead ce mois-ci.</small></span></li>`}</ul>` : "";
    return `<section class="card mc-bill">
      <div class="card-head"><h2 class="h2">Facturation de ${monthLabel(m)}</h2><span class="mc-month"><button class="icon-btn" type="button" data-mc-month="-1" aria-label="Mois précédent">${icon("back")}</button><button class="icon-btn" type="button" data-mc-month="1" aria-label="Mois suivant">${icon("chev")}</button></span></div>
      <dl class="lp-dl">
        ${row("Leads facturables", `${b.ok.length} <small class="muted">(${b.levels.rdv} RDV pris, ${b.levels.qualifie} qualifiés, ${b.levels.verifie} vérifiés)</small>`)}
        ${row("Non facturés", String(b.out.length))}
        ${row("Prix par lead", eur(b.price) + " HT")}
        ${row("Montant du mois", `<b>${eur(b.amount)} HT</b>${b.capped ? ` <small class="muted">(plafond ${eur(b.cap)} atteint)</small>` : ""}`)}
        ${row("Plafond mensuel", b.cap ? eur(b.cap) + " HT" : "à définir")}
        ${row("Zone exclusive", (k.zone ? esc(k.zone) : "à définir") + ((EM().allClients().find(x => x.id === cid) || {}).pays && (EM().allClients().find(x => x.id === cid) || {}).pays !== "FR" ? ` <small class="muted">(${esc(PAYS[(EM().allClients().find(x => x.id === cid) || {}).pays] || "")})</small>` : ""))}
      </dl>
      <div class="form-actions"><button class="btn btn-primary" type="button" data-mc-invoice="${esc(cid)}" ${b.ok.length ? "" : "disabled"}>${icon("euro")}Préparer la facture</button><button class="btn btn-ghost" type="button" data-mc-list="${esc(cid)}">${X.open[cid] ? "Masquer le relevé" : "Voir le relevé"}</button></div>
      ${list}
    </section>`;
  }
  // La facture du mois : une ligne « leads vérifiés exclusifs », en brouillon dans Finances
  function makeInvoice(cid, S) {
    const m = X.month || today().slice(0, 7), b = billing(cid, m); if (!b.ok.length) return;
    const due = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); })();
    const lines = [{ d: `Leads vérifiés exclusifs – ${monthLabel(m)} (${b.levels.rdv} RDV pris, ${b.levels.qualifie} qualifiés, ${b.levels.verifie} vérifiés)`, q: b.ok.length, pu: b.price }];
    if (b.capped) lines.push({ d: `Plafond mensuel convenu (${eur(b.cap)} HT)`, q: 1, pu: -(b.raw - b.cap) });
    const vat = vatFor(cid);
    const d = { id: "d" + Date.now().toString(36), kind: "facture", number: OPS().nextNumber("facture"), client: b.contract.name, to: cid, amount: Math.round(b.amount * 100) / 100, tva: vat.tva,
      lines, note: `Relevé détaillé joint. 7 jours pour contester un lead selon les exclusions prévues au contrat.${vat.note ? " " + vat.note : ""}`, date: today(), due, status: "brouillon", by: S.who, createdAt: new Date().toISOString().slice(0, 16), made: true, period: m };
    OPS().stores.DOCS.put(d); TM().haptic("done");
    location.hash = "#finances"; setTimeout(() => { window.ENTREMIS_GEN.openDoc(d.id); EM().render(); }, 80); EM().toast(`Facture de ${monthLabel(m)} prête en brouillon : vérifiez-la, puis envoyez-la.`);
  }

  /* ---------- Côté client : ses leads du mois, sa facture, contester ---------- */
  function viewClientBilling(S) {
    const cid = EM().viewId(), m = X.month || today().slice(0, 7), b = billing(cid, m), esc = EM().esc, icon = EM().icon;
    const rows = b.all.slice().sort((x, y) => givenAt(y) < givenAt(x) ? -1 : 1).map(l => {
      const ct = contestOf(l), can = billable(l) && !ct && contestOpen(l);
      return `<li class="ac-row"><span class="av av-md">${esc((l.name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>
        <span><b>${esc(l.name)}</b><small>${esc(givenAt(l).slice(8, 10) + "/" + givenAt(l).slice(5, 7))} · ${esc(l.trade || "")} · ${esc(l.city || l.zip || "")}${l.phone ? " · " + esc(l.phone) : ""}</small></span>
        <span class="ac-acts">${pill(l)}${billable(l) ? `<span class="state state-ok">Facturé</span>` : `<span class="state state-neutral">${esc(EXCL[exclOf(l)] || "Non facturé")}</span>`}
          ${ct ? `<span class="state state-${ct.state === "accepte" ? "ok" : ct.state === "refuse" ? "neutral" : "warn"}">${ct.state === "ouvert" ? "Contestation envoyée" : ct.state === "accepte" ? "Contestation acceptée" : "Contestation refusée"}</span>` : can ? `<button class="link" type="button" data-mc-dispute="${l.id}">Contester</button>` : ""}</span></li>`;
    }).join("");
    return `<div class="head"><div class="head-text"><h1 class="h1">Leads et facture</h1><p class="sub">Vos leads du mois, leur niveau, et ce qui sera facturé. 7 jours pour contester un lead.</p></div></div>
    <div class="kpis kpis-4" role="list">
      <article class="kpi" role="listitem"><p class="kpi-label">Leads facturables</p><div><p class="kpi-value">${b.ok.length}</p><p class="kpi-note">${monthLabel(m)}</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Rendez-vous pris</p><div><p class="kpi-value">${b.levels.rdv}</p><p class="kpi-note">par l'assistant</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Montant du mois</p><div><p class="kpi-value">${eur(b.amount)}</p><p class="kpi-note">HT, ${eur(b.price)} par lead${b.capped ? ", plafond atteint" : ""}</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Non facturés</p><div><p class="kpi-value">${b.out.length}</p><p class="kpi-note">locataires, hors zone, doublons…</p></div></article>
    </div>
    <section class="card"><div class="card-head"><h2 class="h2">Vos leads de ${monthLabel(m)}</h2><span class="mc-month"><button class="icon-btn" type="button" data-mc-month="-1" aria-label="Mois précédent">${icon("back")}</button><button class="icon-btn" type="button" data-mc-month="1" aria-label="Mois suivant">${icon("chev")}</button></span></div>
      ${rows ? `<ul class="ac-list">${rows}</ul>` : `<p class="body">Aucun lead ce mois-ci.</p>`}
      <p class="kpi-note">Ne sont jamais facturés : les locataires, les adresses hors de votre zone, les doublons sur 90 jours et les numéros non vérifiés. La facture part le 1er du mois avec ce relevé.</p></section>
    ${window.ENTREMIS_PILOT.flowCard(cid, true)}`;
  }

  /* ---------- Fiche d'appel d'un prospect installateur (critères, 10 questions, décision) ---------- */
  const CRIT = ["RGE QualiPAC vérifié dans l'annuaire France Rénov' (hors de France : la qualification reconnue dans son pays)", "Grosse structure, plusieurs équipes de pose", "Une personne dédiée au téléphone", "2-3 ans d'activité minimum", "Avis Google 4,5 ou plus", "Zone avec beaucoup de maisons au fioul ou au gaz", "Gère déjà les dossiers d'aides", "Aucun signal d'alerte (pubs « 1 € », démarchage, litiges, mauvais payeur)"];
  const QUEST = ["PAC posées par mois, autres métiers", "Capacité en plus", "D'où viennent ses clients", "Leads déjà achetés : prix et résultat", "Prix moyen d'un chantier PAC, marge", "Qui rappelle les prospects, en combien de temps", "Zone couverte, délai de visite", "Gestion des aides", "Budget pub mensuel possible", "D'accord pour être filmé"];
  const DECIDE = { pilote: ["Pilote", "ok"], plustard: ["Plus tard", "warn"], non: ["Non", "neutral"] };
  function callCard(pid) {
    const p = LIVE().PROSPECTS().list.find(x => x.id === pid) || TD().pipeline.find(x => x.id === pid) || {}, c = p.call || {}, icon = EM().icon, esc = EM().esc;
    const ok = (c.crit || []).filter(Boolean).length, done = (c.ans || []).filter(Boolean).length, dec = DECIDE[c.decision];
    return `<section class="card"><div class="card-head"><h2 class="h2">Fiche d'appel</h2>${dec ? `<span class="state state-${dec[1]}">${dec[0]}</span>` : ""}</div>
      ${c.at ? `<dl class="lp-dl"><div><dt>Critères du client idéal</dt><dd>${ok} sur ${CRIT.length}</dd></div><div><dt>Questions répondues</dt><dd>${done} sur ${QUEST.length}</dd></div>${c.next ? `<div><dt>Prochaine étape</dt><dd>${esc(c.next)}</dd></div>` : ""}</dl>` : `<p class="body">Pendant ou juste après le premier appel : les 8 critères, les 10 questions, la décision.</p>`}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-mc-call="${esc(pid)}">${icon("phone")}${c.at ? "Reprendre la fiche" : "Remplir la fiche d'appel"}</button></div></section>`;
  }
  function callSheet() {
    if (!X.call) return "";
    const p = LIVE().PROSPECTS().list.find(x => x.id === X.call) || TD().pipeline.find(x => x.id === X.call) || {}, c = p.call || {}, esc = EM().esc;
    return `<div class="scrim" data-mc-call-close></div>
    <form class="sheet" id="mc-call-form" aria-label="Fiche d'appel" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-mc-call-close>Annuler</button><b>Fiche d'appel – ${esc(p.name || "")}</b><button class="link strong" type="submit">Enregistrer</button></div>
      <p class="set-title">Les critères</p>
      ${CRIT.map((t, i) => `<label class="check-line"><input type="checkbox" name="c${i}" ${(c.crit || [])[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}
      <p class="set-title">Les réponses</p>
      ${QUEST.map((t, i) => `<label class="field"><span>${i + 1}. ${esc(t)}</span><input name="q${i}" maxlength="200" value="${esc((c.ans || [])[i] || "")}"></label>`).join("")}
      <div class="field"><label for="mc-dec">Décision</label><select id="mc-dec" name="decision"><option value="">À décider</option>${Object.keys(DECIDE).map(k => `<option value="${k}"${c.decision === k ? " selected" : ""}>${DECIDE[k][0]}</option>`).join("")}</select></div>
      <label class="field"><span>Prochaine étape convenue</span><input name="next" maxlength="160" value="${esc(c.next || "")}"></label>
      <p class="field-help">Les questions 4, 5 et 6 donnent les chiffres qui valident la rentabilité : marge réelle, prix payé aujourd'hui pour un lead, vitesse de rappel.</p>
    </form>`;
  }

  /* ---------- Le simulateur de rentabilité (Marketing › Calcul), d'après le tableur de Gianni ---------- */
  const SCEN = { optimiste: { cpf: 15, verif: 80, sign: 12 }, normal: { cpf: 25, verif: 70, sign: 8 }, pessimiste: { cpf: 45, verif: 55, sign: 4 } };
  const sim = () => X.sim || (X.sim = { price: 15000, margin: 30, budget: 1500, cpf: 25, verif: 70, lead: 50, sign: 8 });
  function simCalc(s) {
    const forms = s.budget / Math.max(1, s.cpf), leads = forms * s.verif / 100, leadCost = leads * s.lead, total = s.budget + leadCost;
    const perLead = leads ? total / leads : 0, deals = leads * s.sign / 100, ca = deals * s.price, marge = ca * s.margin / 100;
    return { forms, leads, leadCost, total, perLead, deals, ca, marge, profit: marge - total, perDeal: deals ? total / deals : 0, roi: total ? ca / total : 0, every: perLead ? (s.price * s.margin / 100) / perLead : 0 };
  }
  const scenOf = s => Object.keys(SCEN).find(k => Object.entries(SCEN[k]).every(([f, v]) => Number(s[f]) === v)) || "";
  function simOut(s, r) {
    const n = (v, d) => Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d || 0 }), win = r.profit >= 0;
    const cost = Math.max(1, r.total), gain = Math.max(0, r.marge), top = Math.max(cost, gain);
    const bar = (label, v, w, vivid) => `<div class="sim-bar"><span>${label}</span><i><b class="${vivid ? "is-vivid" : ""}" style="width:${Math.max(2, Math.round(w / top * 100))}%"></b></i><em>${n(v)} €</em></div>`;
    return `<p class="sim-kicker">Chaque mois, pour l'installateur</p>
      <p class="sim-hero${win ? "" : " is-neg"}">${win ? "+" : ""}${n(r.profit)} €</p>
      <p class="sim-hero-sub">de bénéfice une fois la pub et les leads payés</p>
      <div class="sim-bars">${bar("Il dépense", r.total, cost)}${bar("Il gagne en marge", r.marge, gain, true)}</div>
      <div class="sim-stats">
        <div><b>${n(r.deals, 1)}</b><span>chantiers signés</span></div>
        <div><b>${n(r.perLead)} €</b><span>coût total d'un lead</span></div>
        <div><b>${n(r.every, 1)}</b><span>leads pour couvrir un chantier</span></div>
      </div>
      <dl class="lp-dl sim-dl">
        <div><dt>Leads facturés</dt><dd>${n(r.leads)}</dd></div>
        <div><dt>Coût des leads</dt><dd>${n(r.leadCost)} € HT</dd></div>
        <div><dt>Pub + leads</dt><dd>${n(r.total)} €</dd></div>
        <div><dt>Chiffre d'affaires généré</dt><dd>${n(r.ca)} €</dd></div>
        <div><dt>Coût par chantier signé</dt><dd>${n(r.perDeal)} €</dd></div>
        <div><dt>Chiffre d'affaires pour 1 € investi</dt><dd>${n(r.roi, 1)} €</dd></div>
      </dl>`;
  }
  function simView() {
    const s = sim(), r = simCalc(s), cur = scenOf(s);
    const inp = (k, label, unit, step) => `<label class="sim-field"><span>${label}</span><span class="sim-in"><input name="${k}" type="number" inputmode="decimal" min="0" step="${step || 1}" value="${s[k]}"><small>${unit}</small></span></label>`;
    return `<div class="sim">
      <form class="card sim-form" id="mc-sim" autocomplete="off">
        <div class="card-head"><h2 class="h2">Rentabilité pour l'installateur</h2></div>
        <div class="seg seg-lg sim-seg" role="group" aria-label="Scénario">${Object.keys(SCEN).map(k => `<button type="button" data-mc-scen="${k}" aria-pressed="${cur === k}">${k.charAt(0).toUpperCase() + k.slice(1)}</button>`).join("")}</div>
        <fieldset class="sim-group"><legend>Le chantier</legend><div class="sim-row">${inp("price", "Prix moyen d'un chantier PAC", "€ TTC", 500)}${inp("margin", "Marge de l'installateur", "%")}</div></fieldset>
        <fieldset class="sim-group"><legend>La pub</legend><div class="sim-row">${inp("budget", "Budget pub par mois", "€", 50)}${inp("cpf", "Pub par formulaire rempli", "€")}</div><div class="sim-row">${inp("verif", "Formulaires vérifiés", "%")}</div></fieldset>
        <fieldset class="sim-group"><legend>Les leads</legend><div class="sim-row">${inp("lead", "Prix par lead", "€ HT")}${inp("sign", "Leads qui signent", "%", 0.5)}</div></fieldset>
        <p class="kpi-note">Estimations à valider avec les vrais chiffres des pilotes.</p>
      </form>
      <section class="card sim-out" data-sim-out aria-live="polite">${simOut(s, r)}</section>
    </div>`;
  }
  document.addEventListener("input", e => {
    const f = e.target.closest && e.target.closest("#mc-sim"); if (!f) return;
    const s = sim(); s[e.target.name] = Number(e.target.value) || 0;
    const out = document.querySelector("[data-sim-out]"); if (out) out.innerHTML = simOut(s, simCalc(s));
    const cur = scenOf(s); f.querySelectorAll("[data-mc-scen]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mcScen === cur)));
  });

  /* ---------- Les chiffres suivis chaque semaine (Chiffres) ---------- */
  function weekPanel() {
    const m = today().slice(0, 7), clients = TD().clients, esc = EM().esc;
    const all = LEADS().list().filter(l => l.to && givenAt(l).slice(0, 7) === m && !l.erased), ok = all.filter(billable);
    const meta = id => { const r = (LIVE().META && LIVE().META().list.find(x => x.id === id)) || {}; return Number((r.spend || {})[m]) || 0; };
    const spend = clients.reduce((a, c) => a + meta(c.id), 0), perLead = ok.length ? spend / ok.length : 0;
    const rdv = ok.filter(l => levelOf(l) === "rdv").length, contested = CONTESTS().list.filter(c => String(c.at).slice(0, 7) === m).length;
    const signed = (window.ENTREMIS_CPLUS ? window.ENTREMIS_CPLUS.results() : []).filter(r => r.outcome === "signe" && String(r.at || "").slice(0, 7) === m).length;
    const risk = clients.filter(c => { const b = billing(c.id, m); return c.pace === "late" || (b.all.length >= 5 && b.levels.rdv === 0); });
    const k = (label, v, note, tone) => `<article class="kpi" role="listitem"><p class="kpi-label">${label}</p><div><p class="kpi-value${tone === "danger" ? " t-danger" : ""}">${v}</p><p class="kpi-note">${note}</p></div></article>`;
    return `<section class="card"><div class="card-head"><h2 class="h2">La machine à leads – ${MONTHS[Number(m.slice(5, 7)) - 1]}</h2><span class="muted">les chiffres suivis chaque semaine</span></div>
      <div class="kpis kpis-4" role="list">
        ${k("Pub par lead facturé", spend && ok.length ? eur(perLead) : "—", "normal ≈ 36 €, alerte au-delà de 50 €", perLead > 50 ? "danger" : "")}
        ${k("Leads facturables", String(ok.length), `${all.length - ok.length} non facturés`)}
        ${k("RDV pris", ok.length ? Math.round(rdv / ok.length * 100) + " %" : "—", "attendu 30 à 50 %")}
        ${k("Chantiers signés", String(signed), `${contested} lead${contested > 1 ? "s" : ""} contesté${contested > 1 ? "s" : ""}`)}
      </div>
      ${risk.length ? `<p class="kpi-note">À surveiller : ${risk.map(c => esc(c.name)).join(", ")}.</p>` : ""}
    </section>`;
  }

  /* ---------- Clics et envois ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-mc-level],[data-mc-excl],[data-mc-contest],[data-mc-month],[data-mc-invoice],[data-mc-list],[data-mc-dispute],[data-mc-call],[data-mc-call-close],[data-mc-scen]"); if (!t) return false;
    const d = t.dataset, put = (id, patch) => { const l = LEADS().list().find(x => x.id === id); if (l) LEADS().put(Object.assign({}, l, patch)); };
    if (d.mcLevel) { const [id, lv] = d.mcLevel.split(":"); put(id, { level: lv }); TM().haptic("tap"); render(); return true; }
    if (d.mcExcl !== undefined) { const [id, ex] = d.mcExcl.split(":"); put(id, { excl: ex || "" }); TM().haptic("tap"); render(); EM().toast(ex ? "Lead non facturé." : "Lead facturable."); return true; }
    if (d.mcContest) { const [id, st] = d.mcContest.split(":"), c = CONTESTS().list.find(x => x.id === id); if (c) CONTESTS().put(Object.assign({}, c, { state: st, decidedBy: S.who, decidedAt: new Date().toISOString().slice(0, 16) })); TM().haptic(st === "accepte" ? "done" : "tap"); render(); return true; }
    if (d.mcMonth) { X.month = shiftMonth(X.month || today().slice(0, 7), Number(d.mcMonth)); render(); return true; }
    if (d.mcInvoice) { makeInvoice(d.mcInvoice, S); return true; }
    if (d.mcList) { X.open[d.mcList] = !X.open[d.mcList]; render(); return true; }
    if (d.mcDispute) {
      const l = LEADS().list().find(x => x.id === d.mcDispute); if (!l) return true;
      const why = window.prompt(`Pourquoi contester ${l.name} ? (locataire, hors zone, doublon, faux numéro…)`, ""); if (!why || !why.trim()) return true;
      CONTESTS().put({ id: l.id, client_id: EM().viewId(), lead: l.id, why: why.trim().slice(0, 200), at: new Date().toISOString().slice(0, 16), state: "ouvert" });
      TM().haptic("done"); render(); EM().toast("Contestation envoyée à Entremis."); return true;
    }
    if (d.mcCall) { X.call = d.mcCall; render(); return true; }
    if ("mcCallClose" in d) { X.call = null; render(); return true; }
    if (d.mcScen) { Object.assign(sim(), SCEN[d.mcScen]); render(); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "mc-call-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), call = { crit: CRIT.map((_, i) => !!fd.get("c" + i)), ans: QUEST.map((_, i) => String(fd.get("q" + i) || "").trim()), decision: String(fd.get("decision") || ""), next: String(fd.get("next") || "").trim(), at: new Date().toISOString().slice(0, 16), by: S.who };
    const st = LIVE().PROSPECTS(), row = st.list.find(x => x.id === X.call);
    if (row) st.put(Object.assign({}, row, { call }, call.decision === "pilote" ? { next: call.next || "Pilote : préparer le tournage" } : {}));
    else { const p = TD().pipeline.find(x => x.id === X.call); if (p) p.call = call; }   // maquette : les prospects d'exemple
    X.call = null; TM().haptic("done"); render(); EM().toast("Fiche d'appel enregistrée.");
    return true;
  }

  window.ENTREMIS_MACHINE = { PAYS, vatFor, leadBox, billingCard, callCard, callSheet, viewClientBilling, simView, weekPanel, onClick, onSubmit, billing, levelOf, billable,
    init: render => CONTESTS().init(render), reset: () => { X.call = null; } };
})();
