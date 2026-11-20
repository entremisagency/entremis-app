/* Entremis — le portail de scripts.
   Côté client  : #scripts (la liste) et #script-<id> (un script, à préparer point par point). Ouvert depuis une fiche de
                  rendez-vous, le script est rempli avec les infos du prospect ({prenom}, {projet}, {budget}, {delai}, {ville}).
   Côté équipe  : #scripts-equipe : écrire et modifier les scripts, et voir où chaque client en est de sa préparation.
   Partagé : collection « scripts » (le contenu) et « prep » (ce que le client a coché). Sans base : exemples, dans ce navigateur. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const X = { sheet: null, rdv: null, editId: null };
  const TYPES = { visite: "Visite technique", appel: "Appel", objections: "Objections" };

  const SAMPLE = () => [
    { id: "s1", title: "Visite technique pompe à chaleur", type: "visite", trades: "Pompes à chaleur", minutes: 60, by: "richard",
      body: `# Avant d'arriver
- Relire la fiche : {prenom} veut {projet}.
- Budget annoncé : {budget}. Délai : {delai}.
- Préparer le simulateur d'aides et une plaquette avec 2 chantiers près de {ville}.
# Ouverture (2 minutes)
- Se présenter, remercier pour le rendez-vous, annoncer la durée : « J'en ai pour une heure, ça vous va ? »
- Rappeler pourquoi on est là : « Vous voulez {projet}, c'est bien ça ? »
# Questions à poser
- Comment vous chauffez-vous aujourd'hui, et combien ça vous coûte par an ?
- Qu'est-ce qui vous gêne le plus avec votre chauffage actuel ?
- Qui d'autre décide avec vous ?
- Si tout vous convient, quand voudriez-vous que les travaux soient faits ?
# Présenter la solution
- Montrer le relevé du logement, puis la solution adaptée, en mots simples.
- Chiffrer les aides ligne par ligne : le reste à charge, pas le prix brut.
# Conclure
- « Qu'est-ce qui vous empêcherait de lancer le projet aujourd'hui ? »
- Fixer la suite : devis signé, ou rappel à une date précise.` },
    { id: "s2", title: "Appel de confirmation la veille", type: "appel", trades: "Tous les métiers", minutes: 5, by: "gianni",
      body: `# Avant l'appel
- Avoir l'heure du rendez-vous et l'adresse sous les yeux.
# L'appel
- « Bonjour {prenom}, c'est [votre prénom] de [votre entreprise]. Je vous appelle pour confirmer notre rendez-vous de demain. »
- Vérifier l'adresse et le code d'accès, s'il y en a un.
- Demander que les deux décideurs soient là.
- « Pensez à garder une facture d'énergie récente, on la regardera ensemble. »
# Après l'appel
- Absent ou injoignable ? Le signaler dans l'app : le remplacement est gratuit.` },
    { id: "s3", title: "Réponses aux objections fréquentes", type: "objections", trades: "Tous les métiers", minutes: 10, by: "marc",
      body: `# « C'est trop cher »
- « Je comprends. On regarde ensemble le reste à charge, après les aides ? »
- Comparer avec la facture actuelle sur 10 ans.
# « Je vais réfléchir »
- « Bien sûr. À quoi voulez-vous réfléchir précisément : le prix, le moment, ou le choix de l'entreprise ? »
- Fixer un rappel à une date précise.
# « J'ai déjà d'autres devis »
- « Très bien. Qu'est-ce qui manque dans ces devis pour vous décider ? »
- Mettre en avant la clarté : aides détaillées ligne par ligne.
# « Les aides, c'est compliqué »
- « C'est nous qui montons le dossier. Vous signez, on s'occupe du reste. »` }
  ];
  let SC = null, PR = null;
  const scripts = () => SC || (SC = OPS().makeStore("scripts", SAMPLE));
  const prep = () => PR || (PR = OPS().makeStore("prep", () => [{ id: "solaria-s1", client: "Solaria Habitat", script: "s1", done: ["0-0", "0-1", "1-0", "1-1", "2-0"] }, { id: "solaria-s2", client: "Solaria Habitat", script: "s2", done: ["0-0", "1-0", "1-1", "1-2", "1-3", "2-0"] }]));

  // Le texte d'un script : « # Titre » ouvre une étape, « - point » ajoute un point à préparer
  function parse(body) {
    const secs = [];
    String(body || "").split("\n").forEach(l => {
      const t = l.trim(); if (!t) return;
      if (t.startsWith("#")) secs.push({ title: t.replace(/^#+\s*/, ""), items: [] });
      else { if (!secs.length) secs.push({ title: "À préparer", items: [] }); secs[secs.length - 1].items.push(t.replace(/^[-•]\s*/, "")); }
    });
    return secs;
  }
  const total = s => parse(s.body).reduce((a, x) => a + x.items.length, 0);
  const CLIENT = () => window.ENTREMIS_DATA.user.company;
  const prepFor = (client, sid) => prep().list.find(p => p.client === client && p.script === sid);
  const pct = (client, s) => { const p = prepFor(client, s.id), t = total(s); return t ? Math.round(((p && p.done.length) || 0) / t * 100) : 0; };

  // Remplace {prenom}, {projet}… avec les infos du rendez-vous choisi
  function fill(text, a, c) {
    if (!a) return EM().esc(text).replace(/\{(\w+)\}/g, (m, k) => `<span class="ph">${{ prenom: "le prospect", projet: "son projet", budget: "le budget", delai: "le délai", ville: "sa ville" }[k] || k}</span>`);
    const v = { prenom: a.name.split(" ")[0], projet: a.criteria.besoin.charAt(0).toLowerCase() + a.criteria.besoin.slice(1), budget: a.criteria.budget, delai: a.criteria.delai.charAt(0).toLowerCase() + a.criteria.delai.slice(1), ville: a.city };
    return EM().esc(text).replace(/\{(\w+)\}/g, (m, k) => v[k] ? `<b class="ph-on">${EM().esc(v[k])}</b>` : m);
  }

  /* ---------- Côté client ---------- */
  function viewList(S) {
    const esc = EM().esc, icon = EM().icon, list = scripts().list;
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Scripts</h1><p class="sub">Cochez chaque point quand il est prêt.</p></div>
      <div class="head-actions">${EM().sampleTag}</div></div>
    ${!scripts().ready ? EM().loader("Chargement de vos scripts") : `<div class="script-grid">${list.map(s => { const p = pct(CLIENT(), s); return `<a class="card script-card" href="#script-${s.id}">
      <div class="card-head"><span class="chan-chip">${icon(s.type === "appel" ? "phone" : s.type === "objections" ? "chat" : "home")}${TYPES[s.type] || "Script"}</span><span class="muted tabnum">${s.minutes || ""}${s.minutes ? " min" : ""}</span></div>
      <h2 class="h2">${esc(s.title)}</h2>
      <p class="body">${esc(s.trades || "")} – ${parse(s.body).length} étapes – ${total(s)} points</p>
      <div class="prep-line"><div class="bar"><i style="--p:${p}%"></i></div><span class="tabnum">${p === 100 ? "Prêt" : p ? `Préparé à ${p} %` : "Pas encore préparé"}</span></div>
    </a>`; }).join("")}</div>`}`;
  }
  function viewScript(S, id) {
    const esc = EM().esc, icon = EM().icon, s = scripts().list.find(x => x.id === id);
    if (!s) return `<section class="card"><h1 class="h2">Script introuvable</h1><a class="link" href="#scripts">Tous les scripts ${icon("arrow")}</a></section>`;
    const c = EM().C(), a = X.rdv ? c.appointments.find(x => x.id === X.rdv) : null;
    const secs = parse(s.body), p = prepFor(CLIENT(), s.id), done = new Set((p && p.done) || []), t = total(s), n = done.size, pc = t ? Math.round(n / t * 100) : 0;
    const plain = secs.map(x => x.title.toUpperCase() + "\n" + x.items.map(i => "- " + i).join("\n")).join("\n\n");
    return `
    <div class="head"><div class="head-text"><h1 class="h1">${esc(s.title)}</h1><p class="sub">${TYPES[s.type] || "Script"} – ${esc(s.trades || "")}${s.minutes ? " – environ " + s.minutes + " min" : ""}</p></div>
      <div class="head-actions"><button class="btn btn-ghost" type="button" data-copy="${esc(plain)}">${icon("copy")}Copier le script</button></div></div>
    ${a ? `<section class="script-for"><span class="av av-md">${a.initials}</span><div><b>Préparé pour ${esc(a.name)}</b><span>${dayLabel(a)} – ${esc(a.role)} – ${esc(a.city)}</span></div><a class="link" href="#rdv-${a.id}">Voir la fiche ${icon("arrow")}</a></section>`
      : `<p class="steps-help">${icon("info")}<span>Ouvert depuis un rendez-vous, il se remplit avec les infos du prospect.</span></p>`}
    <div class="script-layout">
      <ol class="script-steps">${secs.map((sec, si) => { const sd = sec.items.filter((_, ii) => done.has(si + "-" + ii)).length; return `<li class="card script-step${sd === sec.items.length ? " is-done" : ""}">
        <div class="card-head"><h2 class="h2"><span class="step-n">${si + 1}</span>${esc(sec.title)}</h2><span class="muted tabnum">${sd} / ${sec.items.length}</span></div>
        <ul class="script-items">${sec.items.map((it, ii) => { const k = si + "-" + ii; return `<li><label class="script-item${done.has(k) ? " is-on" : ""}"><input type="checkbox" data-prep="${s.id}:${k}" ${done.has(k) ? "checked" : ""}><span class="tick" aria-hidden="true">${icon("check")}</span><span class="txt">${fill(it, a, c)}</span></label></li>`; }).join("")}</ul>
      </li>`; }).join("")}</ol>
      <aside class="card script-side">
        <h2 class="h2">Ma préparation</h2>
        <p class="script-pct tabnum">${pc} %</p>
        <div class="bar"><i style="--p:${pc}%"></i></div>
        <p class="body">${n} point${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""} sur ${t}.</p>
        ${n ? `<button class="link" type="button" data-prep-reset="${s.id}">Tout décocher</button>` : ""}
      </aside>
    </div>`;
  }
  function dayLabel(a) { const d = new Date(a.date + "T12:00:00Z"); return ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][d.getUTCDay()] + " " + d.getUTCDate() + " nov. à " + a.start; }

  /* ---------- Côté équipe ---------- */
  function viewTeam(S) {
    const esc = EM().esc, icon = EM().icon, list = scripts().list, clients = TD().clients;
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Scripts</h1><p class="sub">Ce que les clients utilisent, et où ils en sont.</p></div>
      <div class="head-actions">${scripts().source === "db" ? `<span class="sample sync">${icon("users")}Partagé avec les clients</span>` : EM().sampleTag}<button class="btn btn-primary" type="button" data-script-new>${icon("plus")}Nouveau script</button></div></div>
    <section class="card">
      <div class="card-head"><h2 class="h2">Bibliothèque</h2><span class="muted tabnum">${list.length} script${list.length > 1 ? "s" : ""}</span></div>
      ${list.length ? `<ul class="script-lib">${list.map(s => `<li>
        <div class="sl-main"><b>${esc(s.title)}</b><span>${TYPES[s.type] || "Script"} – ${esc(s.trades || "")} – ${parse(s.body).length} étapes – ${total(s)} points</span></div>
        <span class="who-inline">${TM().avatar(s.by || "marc", "av")}${TM().member(s.by || "marc").name}</span>
        <div class="row-acts"><a class="btn btn-ghost btn-xs" href="#script-${s.id}" data-script-preview>Voir comme le client</a><button class="btn btn-ghost btn-xs" type="button" data-script-edit="${s.id}">Modifier</button><button class="icon-btn row-del" type="button" data-script-del="${s.id}" aria-label="Supprimer ${esc(s.title)}">${icon("trash")}</button></div>
      </li>`).join("")}</ul>` : `<p class="body">Aucun script pour l'instant.</p>`}
    </section>
    <section class="card">
      <div class="card-head"><h2 class="h2">Préparation des clients</h2></div>
      <div class="table-scroll"><table class="table table-prep"><thead><tr><th>Client</th>${list.map(s => `<th>${esc(s.title)}</th>`).join("")}</tr></thead>
      <tbody>${clients.map(cl => `<tr><td class="org"><a class="org-link" href="#fiche-${cl.id}"><b>${esc(cl.name)}</b></a><span>${esc(cl.trade)}</span></td>${list.map(s => { const p = pct(cl.name, s); return `<td><div class="prep-cell"><div class="bar"><i style="--p:${p}%"></i></div><span class="tabnum ${p === 100 ? "t-ok" : p ? "" : "muted"}">${p === 100 ? "Prêt" : p ? p + " %" : "—"}</span></div></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="kpi-note">Exemple : seule Solaria Habitat a un espace client.</p>
    </section>
    ${sheet(S)}`;
  }
  // Éditeur d'étapes : chaque étape est une carte, chaque point une ligne. Le texte « # / - » reste le format enregistré.
  const VARS = [["prenom", "Prénom"], ["projet", "Projet"], ["budget", "Budget"], ["delai", "Délai"], ["ville", "Ville"]];
  const toBody = d => d.secs.filter(x => x.title.trim() || x.items.some(i => i.trim())).map(x => "# " + (x.title.trim() || "Étape") + "\n" + x.items.filter(i => i.trim()).map(i => "- " + i.trim()).join("\n")).join("\n");
  function syncDraft() {
    const f = document.querySelector("#script-form"), d = X.draft; if (!f || !d) return;
    d.title = f.elements.title.value; d.type = f.elements.type.value; d.trades = f.elements.trades.value;
    f.querySelectorAll("[data-sec-title]").forEach(i => { const sec = d.secs[+i.dataset.secTitle]; if (sec) sec.title = i.value; });
    f.querySelectorAll("[data-item]").forEach(i => { const [a, b] = i.dataset.item.split(":").map(Number); if (d.secs[a]) d.secs[a].items[b] = i.value; });
  }
  function sheet(S) {
    if (!X.sheet) return "";
    const esc = EM().esc, icon = EM().icon, s = X.editId ? scripts().list.find(x => x.id === X.editId) : null;
    if (!X.draft) X.draft = { title: s ? s.title : "", type: s ? s.type : "visite", trades: s ? s.trades : "Tous les métiers",
      secs: parse(s ? s.body : "# Avant le rendez-vous\n- Relire la fiche de {prenom}\n# Pendant\n- Première question à poser\n# Conclure\n- Fixer la suite").map(x => ({ title: x.title, items: x.items.slice() })) };
    const d = X.draft;
    return `<div class="scrim" data-script-close></div>
    <form class="sheet sheet-wide script-sheet" id="script-form" aria-label="${s ? "Modifier le script" : "Nouveau script"}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-script-close>Annuler</button><b>${s ? "Modifier le script" : "Nouveau script"}</b><button class="link strong" type="submit">Enregistrer</button></div>
      <label class="field"><span>Titre</span><input name="title" required maxlength="80" value="${esc(d.title)}" placeholder="Ex. Visite technique panneaux solaires"></label>
      <div class="field-row">
        <label class="field"><span>Type</span><select name="type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${d.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>Pour quels métiers</span><input name="trades" value="${esc(d.trades)}"></label>
      </div>
      <div class="se-vars"><span>Insérer dans le point choisi :</span>${VARS.map(([k, l]) => `<button class="pill" type="button" data-se-var="${k}">${l}</button>`).join("")}</div>
      <ol class="se-steps">${d.secs.map((sec, si) => `<li class="se-step">
        <div class="se-step-head"><span class="pr-n tabnum">${si + 1}</span><input data-sec-title="${si}" value="${esc(sec.title)}" placeholder="Nom de l'étape" aria-label="Nom de l'étape ${si + 1}">
          <button class="icon-btn" type="button" data-se-delsec="${si}" aria-label="Retirer l'étape ${si + 1}" ${d.secs.length < 2 ? "disabled" : ""}>${icon("trash")}</button></div>
        <ul class="se-items">${sec.items.map((it, ii) => `<li><span class="se-dot" aria-hidden="true"></span><input data-item="${si}:${ii}" value="${esc(it)}" placeholder="Un point à préparer" aria-label="Point ${ii + 1} de l'étape ${si + 1}">
          <button class="icon-btn" type="button" data-se-delitem="${si}:${ii}" aria-label="Retirer ce point">${icon("plus")}</button></li>`).join("")}</ul>
        <button class="link se-add" type="button" data-se-additem="${si}">${icon("plus")}Ajouter un point</button>
      </li>`).join("")}</ol>
      <button class="btn btn-ghost se-addsec" type="button" data-se-addsec>${icon("plus")}Ajouter une étape</button>
    </form>`;
  }
  let lastInput = null;
  document.addEventListener("focusin", e => { if (e.target.matches && e.target.matches("#script-form [data-item], #script-form [data-sec-title]")) lastInput = e.target.dataset.item ? "item:" + e.target.dataset.item : "sec:" + e.target.dataset.secTitle; });

  /* ---------- Interactions ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-script-new],[data-script-edit],[data-script-del],[data-script-close],[data-prep-reset],[data-prep-for],[data-script-preview],[data-se-var],[data-se-delsec],[data-se-delitem],[data-se-additem],[data-se-addsec]");
    if (!t) return false;
    const reopen = focusSel => { render(); if (focusSel) { const i = document.querySelector(focusSel); if (i) { i.focus(); const n = i.value.length; i.setSelectionRange && i.setSelectionRange(n, n); } } };
    if (t.dataset.seVar) {
      syncDraft(); const tag = "{" + t.dataset.seVar + "}";
      if (!lastInput) { EM().toast("Cliquez d'abord dans un point du script."); return true; }
      const [kind, ref] = [lastInput.split(":")[0], lastInput.slice(lastInput.indexOf(":") + 1)];
      const sel = kind === "item" ? `#script-form [data-item="${ref}"]` : `#script-form [data-sec-title="${ref}"]`, inp = document.querySelector(sel);
      if (inp) { const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a; inp.value = inp.value.slice(0, a) + tag + inp.value.slice(b); inp.focus(); inp.setSelectionRange(a + tag.length, a + tag.length); syncDraft(); }
      return true;
    }
    if (t.dataset.seAdditem) { syncDraft(); const si = +t.dataset.seAdditem; X.draft.secs[si].items.push(""); reopen(`#script-form [data-item="${si}:${X.draft.secs[si].items.length - 1}"]`); return true; }
    if (t.dataset.seDelitem) { syncDraft(); const [si, ii] = t.dataset.seDelitem.split(":").map(Number); X.draft.secs[si].items.splice(ii, 1); reopen(); return true; }
    if ("seAddsec" in t.dataset) { syncDraft(); X.draft.secs.push({ title: "", items: [""] }); reopen(`#script-form [data-sec-title="${X.draft.secs.length - 1}"]`); return true; }
    if (t.dataset.seDelsec) { syncDraft(); if (X.draft.secs.length > 1) X.draft.secs.splice(+t.dataset.seDelsec, 1); reopen(); return true; }
    if ("scriptPreview" in t.dataset) { S.space = "client"; EM().store.set("space", "client"); X.rdv = null; return false; }
    if (t.dataset.prepFor) { X.rdv = t.dataset.prepFor; location.hash = "#script-s1"; return true; }
    if ("scriptNew" in t.dataset) { X.sheet = true; X.editId = null; X.draft = null; render(); return true; }
    if (t.dataset.scriptEdit) { X.sheet = true; X.editId = t.dataset.scriptEdit; X.draft = null; render(); return true; }
    if ("scriptClose" in t.dataset) { X.sheet = null; X.draft = null; render(); return true; }
    if (t.dataset.scriptDel) { const s = scripts().list.find(x => x.id === t.dataset.scriptDel); if (!s) return true;
      EM().confirm({ title: `Supprimer le script « ${s.title} » ?`, text: "Il disparaît aussi de l'espace de vos clients." }).then(ok => { if (!ok) return; scripts().remove(s.id); render(); EM().toast("Script supprimé.", () => { scripts().put(s); render(); }); });
      return true; }
    if (t.dataset.prepReset) { const p = prepFor(CLIENT(), t.dataset.prepReset); if (p) { prep().put(Object.assign({}, p, { done: [] })); render(); } return true; }
    return false;
  }
  function onChange(e, render) {
    const el = e.target.closest("[data-prep]"); if (!el) return false;
    const [sid, k] = el.dataset.prep.split(":"), cur = prepFor(CLIENT(), sid) || { id: CLIENT().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "") + "-" + sid, client: CLIENT(), script: sid, done: [] };
    const done = new Set(cur.done); el.checked ? done.add(k) : done.delete(k);
    prep().put(Object.assign({}, cur, { done: [...done], updatedAt: new Date().toISOString().slice(0, 16) }));
    TM().haptic(el.checked ? "done" : "tap"); render();
    return true;
  }
  function onSubmit(e, S, render) {
    if (e.target.id !== "script-form") return false;
    e.preventDefault();
    syncDraft();
    const fd = new FormData(e.target), title = String(fd.get("title") || "").trim(), body = toBody(X.draft);
    if (!title || !body.trim()) { EM().toast("Donnez un titre et un contenu au script."); return true; }
    const old = X.editId ? scripts().list.find(x => x.id === X.editId) : null;
    const s = Object.assign({}, old || { id: "s" + Date.now().toString(36), by: S.who, minutes: 10 }, { title, type: fd.get("type"), trades: String(fd.get("trades") || "").trim(), body });
    scripts().put(s); X.sheet = null; X.draft = null; TM().haptic("done"); render();
    EM().toast(old ? "Script mis à jour. Les clients voient la nouvelle version." : "Script créé. Il apparaît dans l'espace des clients.");
    return true;
  }

  window.ENTREMIS_SCRIPTS = {
    viewList, viewScript, viewTeam, onClick, onChange, onSubmit,
    init: render => { scripts().init(render); prep().init(render); },
    setRdv: id => { X.rdv = id; }, reset: () => { X.sheet = null; X.draft = null; }
  };
})();
