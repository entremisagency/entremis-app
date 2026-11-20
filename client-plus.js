/* Entremis — espace client, ce qui fait grandir la relation (Marc, 20 nov. 2026) :
   - le résultat de chaque visite (signé et montant, devis envoyé, pas intéressé) : les preuves d'Entremis ;
   - les confirmations envoyées au particulier (SMS la veille et le matin) : moins d'absences ;
   - #resultats : ce que nos rendez-vous ont rapporté, et l'avis de fin de campagne ;
   - #dispos : les créneaux où placer les rendez-vous, et les congés ;
   - #parrainage : présenter un autre installateur.
   Collections partagées : « results » (une ligne par rendez-vous), « avis », « dispos », « referrals » (une ligne par client ou par parrainage).
   Les SMS ne partent pas pour de vrai dans la maquette : l'envoi automatique est à brancher. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, D = () => window.ENTREMIS_DATA, TD = () => window.ENTREMIS_DATA.team;
  const X = { res: null, pick: null, star: 0 };   // rendez-vous dont on saisit le résultat, choix en cours, note d'avis

  const RESULTS_SAMPLE = () => [
    { id: "thomas-leroy", outcome: "signe", amount: 13500, at: "2026-11-12" },
    { id: "ines-moreau", outcome: "devis", amount: 0, at: "2026-11-13" }
  ];
  const DISPOS_SAMPLE = () => [{ id: "solaria", slots: { "lun-m": true, "lun-a": true, "mar-m": true, "mar-a": true, "mer-m": true, "jeu-m": true, "jeu-a": true, "ven-m": true, "ven-a": true }, max: 6, off: [{ id: "o1", from: "2026-12-24", to: "2027-01-02" }] }];
  const st = {};
  const store = (name, sample) => st[name] || (st[name] = OPS().makeStore(name, sample || (() => [])));
  const RESULTS = () => store("results", RESULTS_SAMPLE), AVIS = () => store("avis"), DISPOS = () => store("dispos", DISPOS_SAMPLE), REFS = () => store("referrals");

  const OUT = { signe: ["Signé", "ok"], devis: ["Devis envoyé", "info"], perdu: ["Pas intéressé", "neutral"] };
  const p2 = n => String(n).padStart(2, "0");
  const mins = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + m; };
  const today = () => D().today.iso;
  const isPast = a => a.date < today() || (a.date === today() && mins(a.end) <= D().today.nowMinutes);
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const dlabel = iso => { const d = new Date(iso + "T12:00:00Z"); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
  const short = iso => { const d = new Date(iso + "T12:00:00Z"); return `${d.getUTCDate()}/${p2(d.getUTCMonth() + 1)}`; };
  const prevDay = iso => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const euros = n => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " €";
  const result = id => RESULTS().list.find(r => r.id === id);
  const me = () => EM().viewId();   // le client affiché : le compte client connecté, ou celui que l'équipe regarde
  // Chaque ligne porte le client concerné (client_id) : sur le site en ligne, ce client la voit, et seulement lui.
  const clientOf = rdvId => (window.ENTREMIS_GROWTH && window.ENTREMIS_GROWTH.rdvClient(rdvId)) || me();
  const companyOf = a => { const c = TD().clients.find(x => x.id === clientOf(a.id)); return c ? c.name : EM().viewUser().company; };

  /* ---------- Confirmations au particulier (partagé avec la page Rendez-vous de l'agence) ---------- */
  // Deux SMS : la veille à 18 h, le matin à 8 h. « Envoyé » si l'heure est passée, sinon « Prévu ». La réponse vient de la fiche du rendez-vous.
  const REPLY = { "karim-benali": "oui", "hugo-lambert": "oui", "sophie-marchal": "oui", "thomas-leroy": "oui", "ines-moreau": "oui", "paul-girard": "rien", "claire-fontaine": "oui", "lea-dubois": "", "antoine-rey": "" };
  function confirmations(a) {
    const now = today() + "T" + p2(Math.floor(D().today.nowMinutes / 60)) + ":" + p2(D().today.nowMinutes % 60);
    const v = prevDay(a.date) + "T18:00", m = a.date + "T08:00";
    const reply = a.reply != null ? a.reply : REPLY[a.id] != null ? REPLY[a.id] : (a.date < today() ? "oui" : "");
    return {
      veille: { at: v, sent: now >= v }, matin: { at: m, sent: now >= m },
      reply: now >= v ? (reply === "oui" ? "confirmé" : reply === "rien" ? "pas de réponse" : "en attente") : ""
    };
  }
  function smsTexts(a, company) {
    const first = String(a.name || "").split(" ")[0], what = String(a.role || a.trade || "votre projet").toLowerCase();
    return {
      veille: `Bonjour ${first}, c'est Entremis. Rappel : ${company} passe chez vous demain à ${a.start} pour votre projet (${what}). Répondez OUI pour confirmer, ou appelez-nous pour décaler.`,
      matin: `Bonjour ${first}, ${company} arrive ce matin à ${a.start}. À tout à l'heure.`
    };
  }
  function confirmCard(a) {
    if (a.state === "replaced") return "";
    const icon = EM().icon, esc = EM().esc, c = confirmations(a), t = smsTexts(a, companyOf(a));
    const item = (k, label, x) => `<li class="${x.sent ? "is-sent" : ""}"><span class="cf-dot">${x.sent ? icon("check") : ""}</span><div><b>${label} – ${x.sent ? "envoyé" : "prévu"} ${short(x.at.slice(0, 10))} à ${x.at.slice(11)}</b><span>« ${esc(t[k])} »</span></div></li>`;
    return `<section class="card f-conf"><div class="card-head"><h2 class="h2">Rappels au particulier</h2>${c.reply ? `<span class="state state-${c.reply === "confirmé" ? "ok" : c.reply === "pas de réponse" ? "warn" : "neutral"}">${c.reply === "confirmé" ? "Confirmé" : c.reply === "pas de réponse" ? "Pas de réponse" : "En attente"}</span>` : ""}</div>
      <ol class="cf-list">${item("veille", "SMS la veille", c.veille)}${item("matin", "SMS le matin", c.matin)}</ol>
      <p class="kpi-note">Moins d'absences : chaque visite est rappelée deux fois. Maquette : l'envoi des SMS est à brancher.</p></section>`;
  }

  /* ---------- Le résultat d'une visite ---------- */
  function resultCard(a) {
    if (a.state === "replaced") return "";
    const icon = EM().icon, r = result(a.id);
    if (!isPast(a)) return `<section class="card f-res"><h2 class="h2">Résultat de la visite</h2><p class="body">Après la visite, dites-nous comment ça s'est passé : 10 secondes.</p></section>`;
    return `<section class="card f-res"><div class="card-head"><h2 class="h2">Résultat de la visite</h2>${r ? `<button class="link" type="button" data-res-edit="${a.id}">Modifier</button>` : ""}</div>
      ${r && X.res !== a.id ? `<p class="res-done"><span class="state state-${OUT[r.outcome][1]}">${OUT[r.outcome][0]}</span>${r.outcome === "signe" && r.amount ? `<b class="tabnum">${euros(r.amount)} HT</b>` : ""}</p>` : resultForm(a.id, r)}
      <p class="kpi-note">Ces chiffres restent entre vous et Entremis. Ils nous aident à mieux cibler vos demandes.</p></section>`;
  }
  function resultForm(id, r) {
    const pick = X.res === id && X.pick ? X.pick : r ? r.outcome : "";
    return `<div class="res-pick" role="group" aria-label="Résultat">${Object.entries(OUT).map(([k, [l]]) => `<button type="button" class="btn btn-ghost${pick === k ? " is-on" : ""}" data-res-set="${id}:${k}" aria-pressed="${pick === k}">${l}</button>`).join("")}</div>
      ${pick === "signe" ? `<form class="res-amount" id="res-form" data-res-id="${id}"><label class="field"><span>Montant signé, hors taxes</span><input name="amount" inputmode="decimal" required placeholder="Ex. 12 500" value="${r && r.amount ? r.amount : ""}"></label><button class="btn btn-primary" type="submit">Enregistrer</button></form>` : ""}`;
  }
  // Carte de l'accueil : les visites passées sans résultat
  function homeCard() {
    const c = EM().C(), todo = c.appointments.filter(a => a.state !== "replaced" && isPast(a) && !result(a.id));
    if (!todo.length) return "";
    return `<section class="card res-todo"><span class="res-todo-ico">${EM().icon("check")}</span><div><b>${todo.length} visite${todo.length > 1 ? "s" : ""} à renseigner</b><span>Signé, devis ou pas intéressé : 10 secondes chacune.</span></div><a class="btn btn-ghost" href="#resultats">Renseigner</a></section>`;
  }

  /* ---------- #resultats ---------- */
  function viewResults(S) {
    const esc = EM().esc, icon = EM().icon, c = EM().C();
    const past = c.appointments.filter(a => a.state !== "replaced" && isPast(a));
    const done = past.filter(a => result(a.id)), signed = done.filter(a => result(a.id).outcome === "signe");
    const amount = signed.reduce((s, a) => s + (Number(result(a.id).amount) || 0), 0), todo = past.filter(a => !result(a.id));
    const kpi = (l, v, n) => `<article class="kpi" role="listitem"><p class="kpi-label">${l}</p><div><p class="kpi-value">${v}</p><p class="kpi-note">${n}</p></div></article>`;
    const row = a => { const r = result(a.id); return `<li class="res-row"><a href="#rdv-${a.id}"><b>${esc(a.name)}</b><span>${esc(a.role)} – ${dlabel(a.date)}</span></a>
      ${r && X.res !== a.id ? `<span class="res-out"><span class="state state-${OUT[r.outcome][1]}">${OUT[r.outcome][0]}</span>${r.outcome === "signe" && r.amount ? `<b class="tabnum">${euros(r.amount)}</b>` : ""}<button class="link" type="button" data-res-edit="${a.id}">Modifier</button></span>` : `<div class="res-inline">${resultForm(a.id, r)}</div>`}</li>`; };
    const av = AVIS().list.find(x => x.id === me());
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Vos résultats</h1><p class="sub">Ce que nos rendez-vous vous ont rapporté.</p></div><div class="head-actions">${EM().sampleTag}</div></div>
    <div class="kpis kpis-4" role="list">
      ${kpi("Visites faites", past.length, "hors absences remplacées")}
      ${kpi("Signées", signed.length, done.length ? `sur ${done.length} renseignée${done.length > 1 ? "s" : ""}` : "rien de renseigné")}
      ${kpi("Montant signé", euros(amount), "hors taxes, grâce aux visites")}
      ${kpi("Taux de signature", done.length ? Math.round(signed.length / done.length * 100) + " %" : "–", "parmi les visites renseignées")}
    </div>
    ${todo.length ? `<section class="card"><div class="card-head"><h2 class="h2">À renseigner <span class="muted tabnum">${todo.length}</span></h2></div><ul class="res-list">${todo.map(row).join("")}</ul></section>` : ""}
    <section class="card"><div class="card-head"><h2 class="h2">Toutes les visites</h2></div>${done.length ? `<ul class="res-list">${done.map(row).join("")}</ul>` : `<p class="body">Rien encore. Chaque visite renseignée s'ajoute ici.</p>`}</section>
    <section class="card avis-card"><div class="card-head"><h2 class="h2">Votre avis sur la campagne</h2>${av ? `<span class="state state-ok">Merci</span>` : ""}</div>
      ${av && !X.avisEdit ? `<p class="avis-done"><span class="stars" aria-label="${av.note} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= av.note ? "on" : ""}"></i>`).join("")}</span>« ${esc(av.text || "")} »</p><p class="kpi-note">${av.publish ? "Vous acceptez qu'on cite votre avis." : "Votre avis reste entre nous."} <button class="link" type="button" data-avis-edit>Modifier</button></p>`
        : `<form class="avis-form" id="avis-form"><div class="stars-pick" role="radiogroup" aria-label="Votre note">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${(X.star || (av && av.note) || 0) === i}" class="${i <= (X.star || (av && av.note) || 0) ? "on" : ""}" data-star="${i}" aria-label="${i} sur 5"><i></i></button>`).join("")}</div>
          <label class="field"><span>En une phrase</span><textarea name="text" rows="2" maxlength="280" placeholder="Ce qui a marché, ce qu'on peut faire mieux">${esc(av ? av.text || "" : "")}</textarea></label>
          <label class="check-line"><input type="checkbox" name="publish" ${av && av.publish ? "checked" : ""}><span>J'accepte qu'Entremis cite mon avis, avec le nom de mon entreprise</span></label>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Envoyer mon avis</button></div></form>`}
    </section>`;
  }

  /* ---------- #dispos ---------- */
  const DAYS_K = [["lun", "lun."], ["mar", "mar."], ["mer", "mer."], ["jeu", "jeu."], ["ven", "ven."], ["sam", "sam."]];
  const PARTS = [["m", "Matin", "8 h – 12 h"], ["a", "Après-midi", "13 h – 17 h"], ["s", "Fin de journée", "17 h – 19 h"]];
  const myDispos = () => DISPOS().list.find(x => x.id === me()) || { id: me(), slots: {}, max: 6, off: [] };
  function viewDispos(S) {
    const esc = EM().esc, icon = EM().icon, d = myDispos(), n = Object.values(d.slots || {}).filter(Boolean).length;
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Vos disponibilités</h1><p class="sub">Richard place vos rendez-vous seulement dans ces créneaux.</p></div><div class="head-actions">${EM().sampleTag}</div></div>
    <section class="card"><div class="card-head"><h2 class="h2">Vos créneaux <span class="muted tabnum">${n}</span></h2><span class="muted">touchez pour ouvrir ou fermer</span></div>
      <div class="dispo-grid" role="grid"><span></span>${DAYS_K.map(([, l]) => `<b role="columnheader">${l}</b>`).join("")}
        ${PARTS.map(([p, l, h]) => `<span class="dispo-part" role="rowheader"><b>${l}</b><small>${h}</small></span>${DAYS_K.map(([k, dl]) => { const on = !!(d.slots || {})[k + "-" + p]; return `<button type="button" class="dispo-cell${on ? " is-on" : ""}" data-dispo="${k}-${p}" aria-pressed="${on}" aria-label="${dl} ${l} : ${on ? "ouvert" : "fermé"}">${on ? icon("check") : ""}</button>`; }).join("")}`).join("")}
      </div></section>
    <div class="home-main">
      <section class="card"><div class="card-head"><h2 class="h2">Visites par semaine, au plus</h2></div>
        <div class="stepper"><button type="button" class="icon-btn" data-dispo-max="-1" aria-label="Une de moins">−</button><b class="tabnum">${d.max || 6}</b><button type="button" class="icon-btn" data-dispo-max="1" aria-label="Une de plus">+</button></div>
        <p class="kpi-note">Au-delà, Richard décale à la semaine suivante.</p></section>
      <section class="card"><div class="card-head"><h2 class="h2">Congés et absences</h2></div>
        ${(d.off || []).length ? `<ul class="off-list">${d.off.map(o => `<li><span>${icon("cal")}Du ${short(o.from)} au ${short(o.to)}</span><button class="icon-btn" type="button" data-off-del="${o.id}" aria-label="Retirer">${icon("trash")}</button></li>`).join("")}</ul>` : `<p class="body">Aucun congé prévu.</p>`}
        <form class="off-form" id="off-form"><div class="field-row"><label class="field"><span>Du</span><input name="from" type="date" required value="${today()}"></label><label class="field"><span>Au</span><input name="to" type="date" required value="${today()}"></label></div>
          <button class="btn btn-ghost" type="submit">${icon("plus")}Ajouter</button></form></section>
    </div>`;
  }
  const saveDispos = d => DISPOS().put(Object.assign({}, d, { client_id: d.id, updatedAt: new Date().toISOString().slice(0, 16) }));

  /* ---------- #parrainage ---------- */
  function viewParrainage(S) {
    const esc = EM().esc, icon = EM().icon, mine = REFS().list.filter(r => r.from === me()).sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const secs = window.ENTREMIS_SECTORS ? window.ENTREMIS_SECTORS.list() : [];
    const ST = { nouveau: ["Reçu", "neutral"], appele: ["Appelé", "info"], signe: ["Signé", "ok"] };
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Parrainer un installateur</h1><p class="sub">Vous connaissez un artisan qui cherche des chantiers ? Présentez-le-nous.</p></div></div>
    <div class="home-main">
      <section class="card"><form class="ref-form" id="ref-form">
        <label class="field"><span>Son entreprise</span><input name="name" required maxlength="80" placeholder="Ex. Chauffage Martin"></label>
        <div class="field-row"><label class="field"><span>Son métier</span><select name="trade">${secs.map(x => `<option>${esc(x.name)}</option>`).join("")}<option>Autre</option></select></label>
          <label class="field"><span>Sa ville</span><input name="city" required maxlength="60" placeholder="Ex. Villeurbanne"></label></div>
        <label class="field"><span>Son téléphone</span><input name="phone" type="tel" required maxlength="20" placeholder="06 …"></label>
        <label class="field"><span>Comment vous le connaissez</span><input name="note" maxlength="140" placeholder="Facultatif"></label>
        <p class="kpi-note">Prévenez-le avant : Richard l'appelle de votre part dans la semaine.</p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon("check")}Présenter cet installateur</button></div>
      </form></section>
      <section class="card"><div class="card-head"><h2 class="h2">Vos parrainages <span class="muted tabnum">${mine.length}</span></h2></div>
        ${mine.length ? `<ul class="ref-list">${mine.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.trade)} – ${esc(r.city)}</span></div><span class="state state-${(ST[r.status] || ST.nouveau)[1]}">${(ST[r.status] || ST.nouveau)[0]}</span></li>`).join("")}</ul>` : `<p class="body">Pas encore de parrainage. S'il signe, on vous le dit, et on vous remercie.</p>`}
      </section>
    </div>`;
  }

  /* ---------- Clics et formulaires ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-res-set],[data-res-edit],[data-star],[data-avis-edit],[data-dispo],[data-dispo-max],[data-off-del]"); if (!t) return false;
    const d = t.dataset;
    if (d.resSet) {
      const [id, out] = d.resSet.split(":");
      if (out === "signe") { X.res = id; X.pick = "signe"; render(); const i = document.querySelector('#res-form input[name="amount"]'); if (i) i.focus(); return true; }
      RESULTS().put({ id, client_id: clientOf(id), outcome: out, amount: 0, at: today(), by: "client" }); X.res = null; X.pick = null; TM().haptic("done"); render();
      EM().toast(out === "devis" ? "Noté : devis envoyé. Dites-nous s'il signe." : "Noté. Merci, ça nous aide à mieux cibler.");
      return true;
    }
    if (d.resEdit) { X.res = d.resEdit; X.pick = null; render(); return true; }
    if (d.star) { X.star = Number(d.star); render(); return true; }
    if ("avisEdit" in d) { X.avisEdit = true; const av = AVIS().list.find(x => x.id === me()); X.star = av ? av.note : 0; render(); return true; }
    if (d.dispo) { const m = myDispos(), slots = Object.assign({}, m.slots); slots[d.dispo] = !slots[d.dispo]; saveDispos(Object.assign({}, m, { slots })); TM().haptic("tap"); render(); return true; }
    if (d.dispoMax) { const m = myDispos(); saveDispos(Object.assign({}, m, { max: Math.max(1, Math.min(30, (m.max || 6) + Number(d.dispoMax))) })); render(); return true; }
    if (d.offDel) { const m = myDispos(); saveDispos(Object.assign({}, m, { off: (m.off || []).filter(o => o.id !== d.offDel) })); render(); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    const f = e.target, id = f.id;
    if (id === "res-form") {
      e.preventDefault();
      const amount = Number(String(new FormData(f).get("amount") || "").replace(/\s/g, "").replace(",", ".")) || 0;
      if (!amount) { EM().toast("Indiquez le montant signé."); return true; }
      RESULTS().put({ id: f.dataset.resId, client_id: clientOf(f.dataset.resId), outcome: "signe", amount, at: today(), by: "client" }); X.res = null; X.pick = null; TM().haptic("done"); render();
      EM().toast(`Bravo : ${euros(amount)} signés. C'est noté.`);
      return true;
    }
    if (id === "avis-form") {
      e.preventDefault();
      const fd = new FormData(f), av = AVIS().list.find(x => x.id === me()), note = X.star || (av && av.note) || 0;
      if (!note) { EM().toast("Choisissez une note, de 1 à 5."); return true; }
      AVIS().put({ id: me(), client_id: me(), note, text: String(fd.get("text") || "").trim(), publish: !!fd.get("publish"), at: today() }); X.avisEdit = false; X.star = 0; TM().haptic("done"); render();
      EM().toast("Merci pour votre avis. Richard le lit aujourd'hui.");
      return true;
    }
    if (id === "off-form") {
      e.preventDefault();
      const fd = new FormData(f), from = String(fd.get("from") || ""), to = String(fd.get("to") || "");
      if (!from || !to || to < from) { EM().toast("La date de fin doit suivre la date de début."); return true; }
      const m = myDispos(); saveDispos(Object.assign({}, m, { off: (m.off || []).concat({ id: "o" + Date.now().toString(36), from, to }) })); TM().haptic("done"); render();
      EM().toast("Congés notés : aucun rendez-vous ne sera placé ces jours-là.");
      return true;
    }
    if (id === "ref-form") {
      e.preventDefault();
      const fd = new FormData(f), r = { id: "r" + Date.now().toString(36), client_id: me(), from: me(), fromName: EM().viewUser().company, name: String(fd.get("name") || "").trim(), trade: String(fd.get("trade") || ""), city: String(fd.get("city") || "").trim(), phone: String(fd.get("phone") || "").trim(), note: String(fd.get("note") || "").trim(), at: new Date().toISOString().slice(0, 16), status: "nouveau" };
      if (!r.name || !r.city || !r.phone) return true;
      REFS().put(r); f.reset(); TM().haptic("done"); render();
      EM().toast(`Merci. Richard appelle ${r.name} de votre part dans la semaine.`);
      return true;
    }
    return false;
  }

  window.ENTREMIS_CPLUS = {
    viewResults, viewDispos, viewParrainage, resultCard, confirmCard, homeCard, onClick, onSubmit,
    confirmations, smsTexts, result: id => result(id), results: () => RESULTS().list, avis: () => AVIS().list, referrals: () => REFS(), dispos: () => DISPOS().list, OUT, isPast,
    init: render => { RESULTS().init(render); AVIS().init(render); DISPOS().init(render); REFS().init(render); }
  };
})();
