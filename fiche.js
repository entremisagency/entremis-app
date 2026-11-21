/* Entremis — #fiche-<id> : la fiche complète d'un installateur (client) ou d'un prospect (à signer).
   Coordonnées cliquables et copiables, l'entreprise, la campagne, les notes, et tout l'historique lié
   (appels, tâches, devis et factures). Les champs sont modifiables et partagés (collection « accounts »). */
(function () {
  "use strict";
  const EM = () => window.EM, TM = () => window.ENTREMIS_TEAM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team;
  const F = { edit: false };
  let ST = null;
  const store = () => ST || (ST = OPS().makeStore("accounts", () => []));

  // Valeurs d'exemple pour remplir une fiche neuve
  const CONTACTS = ["Laurent Mercier", "Nadia Benhamou", "Julien Roche", "Sandrine Kolb", "Éric Lemaire", "Claire Dumont", "Olivier Garnier", "Fatima Ouali", "Pascal Henry", "Isabelle Morel", "Thomas Guérin", "Sabine Klein", "Yann Le Floch", "Céline Barre"];
  const CERTS = { "Pompes à chaleur": "RGE QualiPAC", "Panneaux solaires": "RGE QualiPV", "Photovoltaïque": "RGE QualiPV", "Isolation": "RGE Qualibat", "Climatisation": "Attestation fluides frigorigènes", "Plomberie": "Qualibat", "Serrurerie": "A2P (serrures certifiées)", "Poêles": "RGE QualiBois" };
  function entity(id) {
    const c = TD().clients.find(x => x.id === id);
    if (c) return { id, kind: "client", name: c.name, trade: c.trade, city: { solaria: "Lyon", thermo: "Saint-Priest", ecotoit: "Vannes", isolea: "Villeurbanne", delmas: "Grenoble", blindex: "Lyon" }[c.id] || "", owner: c.owner, value: 0, c };
    const p = TD().pipeline.find(x => x.id === id);
    if (p) return { id, kind: "prospect", name: p.name, trade: p.trade, city: p.city, owner: p.owner, value: p.value, p };
    return null;
  }
  // L'unité de travail du métier (rendez-vous, interventions, demandes de devis), sans passer par la fiche elle-même
  const unitFor = trade => { const X = window.ENTREMIS_SECTORS; if (!X) return "rendez-vous"; const p = X.PARCOURS[X.sectorOf(trade).parcours]; return p ? p.many : "rendez-vous"; };
  function defaults(e, i) {
    const slug = e.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const cert = Object.keys(CERTS).find(k => e.trade.includes(k));
    return {
      contact: CONTACTS[i % CONTACTS.length], role: "Gérant", phone: `0${4 + i % 2} ${String(70 + i * 3).padStart(2, "0")} ${String(10 + i * 7).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i * 5 % 60).padStart(2, "0")}`,
      email: `contact@${slug}.fr`, website: `www.${slug}.fr`, address: `${3 + i * 4} rue de l'Industrie, ${e.city}`,
      siret: `8${String(10 + i).padStart(2, "0")} 456 789 000${10 + i}`, zone: `${e.city} et 40 km autour`,
      certs: cert ? CERTS[cert] : "À compléter", team: `${4 + i % 9} techniciens`, capacity: `${6 + i % 8} ${unitFor(e.trade)} par semaine`,
      ticket: `${(8 + i % 9) * 1000} € par chantier`, slots: i % 2 ? "Mardi et jeudi matin" : "Du lundi au vendredi, 9 h – 17 h",
      source: e.p ? e.p.source : "Recommandation", since: e.kind === "client" ? "Client depuis septembre 2026" : "Prospect depuis novembre 2026",
      notes: e.kind === "client" ? "Préfère être appelé le matin. Veut un bilan chaque vendredi. Très attentif à la qualité des rendez-vous." : "Intéressé par 10 rendez-vous par mois. Compare avec une plateforme qui revend les demandes : insister sur l'exclusivité."
    };
  }
  const data = (e, i) => Object.assign({}, defaults(e, i), (store().list.find(x => x.id === e.id) || {}));

  const FIELDS = [
    ["Contact", [["contact", "Interlocuteur"], ["role", "Fonction"], ["phone", "Téléphone", "phone"], ["email", "E-mail", "email"], ["website", "Site web", "web"], ["address", "Adresse", "address"]]],
    ["L'entreprise", [["certs", "Certifications"], ["team", "Équipe"], ["zone", "Zone d'intervention"], ["capacity", "Capacité"], ["ticket", "Chantier moyen"], ["slots", "Créneaux préférés"], ["siret", "SIRET"], ["source", "Comment on l'a connu"]]]
  ];

  function view(S, id) {
    const esc = EM().esc, icon = EM().icon, e = entity(id);
    if (!e) return `<section class="card"><h1 class="h2">Fiche introuvable</h1><a class="link" href="#clients">Retour aux clients ${icon("arrow")}</a></section>`;
    const all = TD().clients.map(c => c.id).concat(TD().pipeline.map(p => p.id));
    const d = data(e, all.indexOf(id));
    S.ctxClient = e.name; S.ctxContact = d.contact;   // pré-remplit les formulaires ouverts depuis la fiche
    const { DOCS, CALLS } = OPS().stores;
    const near = s => s && (s.toLowerCase().includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(s.toLowerCase()));
    const calls = CALLS.list.filter(c => near(c.contact) || near(c.about) || near(c.company)).sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1);
    const tasks = TM().T.list.filter(t => near(t.client));
    const docs = DOCS.list.filter(x => near(x.client));
    const fieldRow = ([k, label, kind]) => F.edit
      ? `<label class="frow"><span>${label}</span><input name="${k}" value="${esc(d[k] || "")}"></label>`
      : kind === "phone" || kind === "email" || kind === "address" ? EM().cline(kind, d[k] || "", label)
      : kind === "web" ? `<div class="cline"><span class="cline-label">${icon("arrow")}${label}</span><a class="cline-value" href="https://${esc(String(d[k] || "").replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">${esc(d[k] || "")}</a><button class="icon-btn cline-copy" type="button" data-copy="${esc(d[k] || "")}" aria-label="Copier">${icon("copy")}</button></div>`
      : `<div class="frow"><span>${label}</span><b>${esc(d[k] || "—")}</b></div>`;
    const stage = e.p ? { lead: "À contacter", call: "Appel fait", quote: "Devis envoyé", won: "Signé" }[e.p.stage] : null;
    const status = e.kind === "client" ? `<span class="state state-ok">Client</span>` : `<span class="state state-info">Prospect – ${stage}</span>`;
    return `
    <div class="head">
      <div class="fiche-id"><span class="av av-lg">${esc(e.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>
        <div class="head-text"><h1 class="h1 is-co">${esc(e.name)}</h1><p class="sub">${esc(e.trade)} – ${esc(e.city)} – ${esc(d.since)}</p></div></div>
      <div class="head-actions">${status}<span class="who-inline">${TM().avatar(e.owner, "av")}Suivi par ${TM().member(e.owner).name}</span>
        ${F.edit ? "" : `<button class="btn btn-ghost" type="button" data-fiche-edit>${icon("sliders")}Modifier la fiche</button>`}</div>
    </div>
    <div class="kpis kpis-4" role="list">
      ${(() => { if (e.kind !== "client") return `<article class="kpi" role="listitem"><p class="kpi-label">Potentiel</p><div><p class="kpi-value">${(Number(e.value) || 0).toLocaleString("fr-FR")} €</p><p class="kpi-note">par mois, hors taxes</p></div></article>`;
        const b = window.ENTREMIS_MACHINE.billing(e.id, window.ENTREMIS_DATA.today.iso.slice(0, 7));
        return `<article class="kpi" role="listitem"><p class="kpi-label">Facturé ce mois</p><div><p class="kpi-value">${Math.round(b.amount).toLocaleString("fr-FR")} €</p><p class="kpi-note">${b.ok.length} lead${b.ok.length > 1 ? "s" : ""} à ${b.price} € HT</p></div></article>`; })()}
      ${e.c ? `<article class="kpi" role="listitem"><p class="kpi-label">Campagne</p><div><p class="kpi-value">${e.c.done} / ${e.c.target}</p><p class="kpi-note">rendez-vous livrés, jour ${e.c.day} sur ${e.c.days}</p></div></article>`
        : `<article class="kpi" role="listitem"><p class="kpi-label">Prochaine étape</p><div><p class="kpi-value kpi-text">${esc(e.p.next)}</p><p class="kpi-note">${esc(stage)}</p></div></article>`}
      <article class="kpi" role="listitem"><p class="kpi-label">Appels</p><div><p class="kpi-value">${calls.length}</p><p class="kpi-note">${calls[0] ? "dernier le " + calls[0].at.slice(8, 10) + "/" + calls[0].at.slice(5, 7) : "aucun noté"}</p></div></article>
      <article class="kpi" role="listitem"><p class="kpi-label">Devis et factures</p><div><p class="kpi-value">${docs.length}</p><p class="kpi-note">${docs.reduce((a, x) => a + (Number(x.amount) || 0), 0).toLocaleString("fr-FR")} € au total</p></div></article>
    </div>
    <form class="fiche-grid" id="fiche-form" data-fiche="${e.id}">
      <div class="fcol">
        ${FIELDS.map(([title, fs]) => `<section class="card"><div class="card-head"><h2 class="h2">${title}</h2></div><div class="clines">${fs.map(fieldRow).join("")}</div></section>`).join("")}
        ${window.ENTREMIS_SECTORS.ficheCard(e.id, F.edit)}
        ${e.kind === "client" ? (() => { const ls = window.ENTREMIS_LEADS.list().filter(l => l.to === e.id).sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1); return `<section class="card">
          <div class="card-head"><h2 class="h2">Derniers leads donnés <span class="muted tabnum">${ls.length}</span></h2><a class="link" href="#leads">Tous les leads ${icon("arrow")}</a></div>
          ${ls.length ? `<ul class="history">${ls.slice(0, 5).map(l => `<li class="is-lead" data-lead-open="${l.id}" tabindex="0" role="button" aria-label="Ouvrir le lead ${esc(l.name)}">${icon("inbox")}<div><b>${esc(l.name)}</b><span>${esc(l.trade)} – ${esc(l.city)}</span></div>${window.ENTREMIS_LEADS.srcTag(l.source)}</li>`).join("")}</ul>${ls.length > 5 ? `<p class="kpi-note">et ${ls.length - 5} autres</p>` : ""}` : `<p class="body">Aucun lead donné pour l'instant.</p>`}
        </section>`; })() : ""}
        ${F.edit ? `<div class="form-actions sticky-save"><button class="btn btn-primary" type="submit">${icon("check")}Enregistrer</button><button class="btn btn-ghost" type="button" data-fiche-cancel>Annuler</button></div>` : ""}
      </div>
      <div class="fcol">
        <section class="card">
          <div class="card-head"><h2 class="h2">Notes</h2><span class="muted">visibles par l'équipe</span></div>
          <textarea class="notes" name="notes" rows="5" placeholder="Ce qu'il faut savoir sur ce client : préférences, historique, points sensibles…">${esc(d.notes || "")}</textarea>
          <div class="form-actions"><button class="btn btn-ghost btn-xs" type="submit">${icon("check")}Enregistrer les notes</button></div>
        </section>
        ${e.kind === "client" ? window.ENTREMIS_CHAT.card(e.id, S) : ""}
        <section class="card">
          <div class="card-head"><h2 class="h2">Actions</h2></div>
          <div class="fiche-actions">
            <button class="btn btn-ghost" type="button" data-ops-sheet="call">${icon("phone")}Noter un appel</button>
            <button class="btn btn-ghost" type="button" data-act="new-task">${icon("check")}Nouvelle tâche</button>
            <a class="btn btn-ghost" href="#generer" data-gen-for="${e.id}">${icon("euro")}Faire un devis</a>
            ${e.c ? `<button class="btn btn-ghost" type="button" data-open-client="${e.id}">${icon("eye")}Voir son espace client</button>` : ""}
            ${e.c ? `<button class="btn btn-ghost" type="button" data-live-new="rdv" data-live-client="${e.id}">${icon("cal")}Placer un rendez-vous</button>` : ""}
            ${window.ENTREMIS_LIVE.on() ? `<button class="btn btn-ghost" type="button" data-live-edit="${e.c ? "client" : "prospect"}:${e.id}">${icon("sliders")}${e.c ? "Campagne et suivi" : "Étape et valeur"}</button>` : ""}
          </div>
        </section>
        ${window.ENTREMIS_CRM.ficheCard(e.id)}
        ${e.kind === "client" ? window.ENTREMIS_MACHINE.billingCard(e.id) : window.ENTREMIS_MACHINE.callCard(e.id)}
        ${e.kind === "client" ? window.ENTREMIS_PILOT.flowCard(e.id) : ""}
        ${e.c ? window.ENTREMIS_LIVE.metaCard(e.id) : ""}
        ${e.c ? window.ENTREMIS_PILOT.adsCard(e.id) : ""}
        <section class="card">
          <div class="card-head"><h2 class="h2">Historique</h2></div>
          ${calls.length || tasks.length || docs.length ? `<ul class="history">
            ${calls.slice(0, 6).map(c => `<li>${icon("phone")}<div><b>Appel – ${esc(c.contact)}</b><span>${TM().member(c.who).name} – ${c.at.slice(8, 10)}/${c.at.slice(5, 7)} – ${c.minutes || 0} min${c.note ? " – " + esc(c.note) : ""}</span></div></li>`).join("")}
            ${docs.map(x => `<li class="is-link" data-doc-open="${x.id}" tabindex="0">${EM().fileIcon(x.fileName || "pdf", "fic-sm")}<div><b>${x.kind === "devis" ? "Devis" : "Facture"} ${esc(x.number || "")}</b><span>${(Number(x.amount) || 0).toLocaleString("fr-FR")} € – ${esc(x.status)}</span></div></li>`).join("")}
            ${tasks.map(t => `<li>${icon("check")}<div><b>${esc(t.title)}</b><span>${TM().member(t.who).name} – ${t.status === "done" ? "faite" : "à faire"}</span></div></li>`).join("")}
          </ul>${calls.length > 6 ? `<a class="link" href="#appels">Les ${calls.length} appels ${icon("arrow")}</a>` : ""}` : `<p class="body">Rien encore. Les appels, tâches et documents liés à ${esc(e.name)} s'afficheront ici.</p>`}
        </section>
      </div>
    </form>`;
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-fiche-edit],[data-fiche-cancel]");
    if (!t) return false;
    if ("ficheEdit" in t.dataset) { F.edit = true; render(); setTimeout(() => { const i = document.querySelector("#fiche-form input"); if (i) { i.focus(); i.select(); } }, 50); return true; }
    if ("ficheCancel" in t.dataset) { F.edit = false; render(); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    if (e.target.id !== "fiche-form") return false;
    e.preventDefault();
    const id = e.target.dataset.fiche, fd = new FormData(e.target), cur = store().list.find(x => x.id === id) || { id };
    const next = Object.assign({}, cur, { id, updatedAt: new Date().toISOString().slice(0, 16), by: S.who });
    for (const [k, v] of fd.entries()) next[k] = String(v).trim();
    store().put(next); F.edit = false; TM().haptic("done"); render();
    EM().toast("Fiche enregistrée. Toute l'équipe la voit.");
    return true;
  }

  // Pour le générateur de devis : nom, contact, adresse, SIRET d'un client ou d'un prospect
  function info(id) { const e = entity(id); if (!e) return null; const all = TD().clients.map(c => c.id).concat(TD().pipeline.map(p => p.id)); return Object.assign({ name: e.name, kind: e.kind, value: e.value, trade: e.trade }, data(e, all.indexOf(id))); }
  window.ENTREMIS_FICHE = { view, onClick, onSubmit, init: render => store().init(render), reset: () => { F.edit = false; }, info };
})();
