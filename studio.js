/* Entremis — le Studio contenu (Marc, 23 nov. 2026) : la veille des pubs, l'écriture des scripts, la matrice des versions.
   Suit le brief de tournage de Gianni (20/11/2026) : accroches, corps de message, appels à l'action, format court ou long,
   interdits (« 1 € », « MaPrimeRénov' », montants d'aide, crédit) et mention France Rénov' obligatoire.
   - Veille : recherches prêtes dans la bibliothèque publicitaire Meta ; les pubs repérées (collection « veille »).
     Le meilleur indice d'une pub qui marche : elle tourne depuis longtemps (6 mois et plus).
   - Scripts : rédigés à partir des choix, modifiables, vérifiés ; « Envoyer au montage » crée la fiche dans Vidéos (collection « scripts-video »).
   - Matrice : accroches × corps × appels à l'action, avec le nom standard de chaque version. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  const st = {}; const store = n => st[n] || (st[n] = OPS().makeStore(n, () => []));
  const VEILLE = () => store("veille"), SCRIPTS = () => store("scripts-video"), HOOKS = () => store("accroches"), VALID = () => store("validations");
  const X = { perfClient: "", tab: "veille", q: "pompe à chaleur", pays: "FR", sheet: null, id: null, edit: null, mx: { client: "", h: [], b: [], c: [] } };
  const today = () => window.ENTREMIS_DATA.today.iso;
  const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
  const fr = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
  const months = iso => { if (!iso) return 0; const a = new Date(iso + "T12:00:00"), b = new Date(today() + "T12:00:00"); return Math.max(0, Math.round((b - a) / (30.44 * 864e5))); };
  const clients = () => EM().allClients();
  const cut = (t, n) => { t = String(t || "").replace(/[«»"]/g, "").trim(); if (t.length <= n) return t; const k = t.slice(0, n), sp = k.lastIndexOf(" "); return (sp > n / 2 ? k.slice(0, sp) : k).replace(/[\s,;:.?]+$/, "") + "…"; };
  const cname = id => (clients().find(c => c.id === id) || {}).name || "";

  /* ---------- La banque de Gianni (brief de tournage, partie 6) : modifiable, et l'équipe peut en ajouter ---------- */
  const BASE_HOOKS = [
    "Vous habitez à [ville] et vous payez plus de 150 € de chauffage par mois ?", "Votre chaudière au fioul a plus de 15 ans ? Regardez ça.",
    "Pourquoi vos voisins à [ville] remplacent leur chaudière au gaz.", "Avant de changer votre chaudière, écoutez ça 30 secondes.",
    "[Prénom du client] payait [X] € par mois. Aujourd'hui, [Y] €.", "On a installé [X] pompes à chaleur dans le [département] cette année.",
    "Une pompe à chaleur, ça marche vraiment en plein hiver ? On vous montre.", "Combien coûte vraiment une pompe à chaleur ? La réponse honnête.",
    "Vous êtes propriétaire d'une maison à [ville] ? Cette vidéo vous concerne.", "3 erreurs à éviter quand on installe une pompe à chaleur.",
    "Des aides importantes existent pour remplacer votre chaudière. Voici comment savoir si vous y avez droit.", "Les chaudières au fioul neuves sont interdites. Voilà ce qu'on propose à la place.",
    "Notre client nous a dit : « j'aurais dû le faire avant ».", "On est une entreprise familiale à [ville], on pose nous-mêmes, sans sous-traitance.", "Ce que votre facture de gaz ne vous dit pas."];
  const BODIES = [
    ["economie", "Économie", "Comment la pompe à chaleur divise la facture de chauffage, avec un vrai exemple client : [X] € par mois avant, [Y] € après."],
    ["confiance", "Confiance", "L'équipe se présente : [années] ans d'expérience, qualifiés RGE, on pose nous-mêmes, sans sous-traitance, avec la garantie."],
    ["simplicite", "Simplicité", "« On gère toutes les démarches, jusqu'au moindre papier. » Vous n'avez rien à remplir."],
    ["preuve", "Preuve", "Chez un vrai client, à [ville] : l'installation, et sa facture avant / après."]];
  const CTAS = ["Faites votre étude gratuite en 30 secondes : cliquez sous la vidéo.", "Étude offerte et sans engagement : on vous dit si votre maison est adaptée.", "Laissez votre numéro, on vous recontacte dans la journée."];
  const hooks = () => BASE_HOOKS.map((t, i) => ({ id: "g" + (i + 1), text: t, base: true })).concat(HOOKS().list.map(h => ({ id: h.id, text: h.text })));
  // Les interdits du brief et de la loi (démarchage, aides) : signalés dans le texte
  const FORBID = [[/\b1\s?€|\bun euro\b/i, "« 1 € » est interdit"], [/maprim/i, "Ne jamais citer « MaPrimeRénov' »"], [/offert par l'[ée]tat|l'[ée]tat (finance|paie|rembourse)/i, "« Offert par l'État » est interdit"],
    [/\d[\d\s]*\s?€\s?d'aide|aides? (de|jusqu'à)\s?\d/i, "Aucun montant d'aide"], [/cr[ée]dit|financement|sans avance de frais/i, "Pas de crédit ni de financement"], [/locataire/i, "Pas de « propriétaire ou locataire »"], [/derni[eè]re chance|offre limit|100 premiers|fin du dispositif/i, "Pas de fausse urgence"]];
  const checks = text => FORBID.filter(([re]) => re.test(text)).map(([, l]) => l);

  /* ---------- 1. Veille Meta ---------- */
  const PAYS = [["FR", "France"], ["BE", "Belgique"], ["CH", "Suisse"], ["LU", "Luxembourg"], ["CA", "Canada"]];
  const QUICK = ["pompe à chaleur", "chaudière fioul", "panneaux solaires", "isolation", "rénovation énergétique", "climatisation"];
  const libUrl = (q, pays) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${pays}&media_type=video&q=${encodeURIComponent(q)}&search_type=keyword_unordered`;
  const FAM = [["local", "Installateur local"], ["plateforme", "Plateforme nationale"], ["confiance", "Confiance, anti-arnaque"], ["autre", "Autre"]];
  function veille() {
    const esc = EM().esc, icon = EM().icon, list = VEILLE().list.slice().sort((a, b) => String(a.since || "9").localeCompare(String(b.since || "9")));
    return `<section class="card"><div class="card-head"><h2 class="h2 h2-brand">${EM().brand("meta", "Meta")}Chercher dans la bibliothèque Meta</h2><a class="link" href="#documents">La veille de Gianni ${icon("arrow")}</a></div>
      <div class="st-search"><label class="crm-search">${icon("search")}<input data-st-q value="${esc(X.q)}" aria-label="Mot-clé" placeholder="Mot-clé ou nom d'un annonceur"></label>
        ${EM().fsel("st-pays", "Pays", PAYS, X.pays)}<a class="btn btn-primary" href="${esc(libUrl(X.q, X.pays))}" target="_blank" rel="noopener" data-st-go>${icon("arrow")}Voir les vidéos actives</a></div>
      <div class="crm-presets">${QUICK.map(q => `<a class="pill" href="${esc(libUrl(q, X.pays))}" target="_blank" rel="noopener">${esc(q)}</a>`).join("")}</div>
      <p class="kpi-note">Le meilleur indice d'une pub qui marche : elle tourne depuis longtemps (6 mois et plus). Meta ne montre ni budget ni résultats.</p></section>
      <section class="card"><div class="card-head"><h2 class="h2">Pubs repérées <span class="muted tabnum">${list.length}</span></h2><button class="btn btn-ghost" type="button" data-st-veille="new">${icon("plus")}Ajouter une pub</button></div>
      ${list.length ? `<div class="lg-grid">${list.map(v => { const m = months(v.since); return `<article class="st-ad"><div class="vd-top"><b>${esc(v.advertiser || "Annonceur")}</b>${m >= 6 ? `<span class="state state-ok">${m} mois en ligne</span>` : v.since ? `<span class="muted">depuis ${fr(v.since)}</span>` : ""}</div>
        <span class="vd-sub">${esc([(FAM.find(f => f[0] === v.family) || [, ""])[1], v.format, v.reach ? Number(v.reach).toLocaleString("fr-FR") + " personnes touchées" : ""].filter(Boolean).join(" · "))}</span>
        ${v.hook ? `<p class="st-quote">« ${esc(v.hook)} »</p>` : ""}${v.why ? `<p class="body">${esc(v.why)}</p>` : ""}
        <div class="vd-foot"><span class="vd-acts">${v.url ? `<a class="icon-btn" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="Voir la pub dans la bibliothèque Meta" title="Voir la pub">${EM().brand("meta", "Meta")}</a>` : ""}<button class="icon-btn" type="button" data-st-veille="${esc(v.id)}" aria-label="Modifier">${icon("sliders")}</button></span><button class="btn btn-ghost btn-xs" type="button" data-st-inspire="${esc(v.id)}">S'en inspirer ${icon("arrow")}</button></div></article>`; }).join("")}</div>`
        : `<p class="body">Repérez une pub dans la bibliothèque, puis ajoutez-la ici avec son lien : qui, depuis quand, l'accroche, pourquoi elle marche.</p>`}</section>`;
  }
  function veilleSheet() {
    const v = X.id === "new" ? { since: "", family: "local", format: "Vidéo" } : VEILLE().list.find(x => x.id === X.id) || {}, esc = EM().esc;
    const f = (n, l, val, a) => `<label class="field"><span>${l}</span><input name="${n}" value="${esc(val == null ? "" : val)}" ${a || ""}></label>`;
    return `<div class="scrim" data-st-close></div><form class="sheet pl-sheet" id="st-veille-form" novalidate><div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-st-close>Annuler</button><b>${v.id ? "La pub repérée" : "Une pub repérée"}</b><button class="link strong" type="submit">Enregistrer</button></div>
      ${f("url", "Lien de la pub (bibliothèque Meta)", v.url, 'type="url" placeholder="https://www.facebook.com/ads/library/?id=…"')}
      <div class="field-row">${f("advertiser", "Annonceur", v.advertiser, 'maxlength="80" required')}${f("since", "En ligne depuis", v.since, 'type="date"')}</div>
      <div class="field-row"><div class="field"><label>Famille</label><select name="family">${FAM.map(([k, l]) => `<option value="${k}"${v.family === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>${f("reach", "Personnes touchées (couverture)", v.reach, 'type="number" min="0"')}</div>
      ${f("format", "Format", v.format, 'maxlength="40" placeholder="Vidéo 0:45, carrousel…"')}
      ${f("hook", "L'accroche (ce qu'on entend ou lit en premier)", v.hook, 'maxlength="200"')}
      <label class="field"><span>Pourquoi elle marche, ce qu'on en reprend</span><textarea name="why" rows="3" maxlength="600">${esc(v.why || "")}</textarea></label>
      ${v.id ? `<button class="btn btn-ghost pr-danger" type="button" data-st-veille-del="${esc(v.id)}">${EM().icon("trash")}Supprimer</button>` : ""}</form>`;
  }

  /* ---------- 2. Scripts ---------- */
  function fillPlaces(t, c) { const city = String((c && (c.zone || c.city)) || "").split(/,| et /)[0].trim(); return city ? t.replace(/\[ville\]/g, city) : t; }
  function draft(o) {
    const c = clients().find(x => x.id === o.client) || {}, hook = fillPlaces(o.hook || BASE_HOOKS[0], c), cta = o.cta || CTAS[0];
    const bodies = BODIES.filter(([k]) => (o.bodies || []).includes(k)).map(([, l, t]) => [l, fillPlaces(t, c)]);
    const lines = [`ACCROCHE (0-3 s, face caméra, sous-titrée) : ${hook}`];
    if (o.format === "long") {
      lines.push(`LE PRÉSENTATEUR (5-15 s) : qui il est, et combien de foyers déjà aidés dans le département : [X] foyers.`);
      bodies.forEach(([l, t]) => lines.push(`${l.toUpperCase()} : ${t}`));
      if (!(o.bodies || []).includes("confiance")) lines.push(`L'ÉQUIPE : chacun se présente en une phrase (prénom et rôle). RGE, sans sous-traitance, garantie.`);
      lines.push(`TÉMOIGNAGE : un vrai client, ses chiffres réels (facture avant / après).`);
    } else lines.push(...(bodies.length ? bodies.slice(0, 1) : [["Économie", BODIES[0][2]]]).map(([l, t]) => `${l.toUpperCase()} (un seul argument) : ${t}`));
    lines.push(`APPEL À L'ACTION : ${cta}`, `ÉCRAN DE FIN : logo de ${c.name || "l'installateur"}, « étude offerte », note Google réelle, badges RGE, et la mention France Rénov' au mot près (arrêté du 7 juillet 2026).`);
    lines.push("", `Format : ${o.format === "long" ? "long, 1 à 2 minutes" : "court, 15 à 45 secondes"}. Vertical 9:16 et 4:5. Sous-titres gros et centrés. Tous les chiffres sont réels, vérifiés avec le client.`);
    return lines.join("\n");
  }
  // La validation par le client : une copie du script dans « validations », portant le client_id (le client la voit et y répond, rien d'autre)
  const valOf = sid => VALID().list.find(v => v.script === sid);
  const VST = { attente: ["Chez le client", "warn"], valide: ["Validé par le client", "ok"], correction: ["Correction demandée", "danger"] };
  const valPill = sid => { const v = valOf(sid); return v && VST[v.status] ? `<span class="state state-${VST[v.status][1]}">${VST[v.status][0]}</span>` : ""; };
  function scripts() {
    const esc = EM().esc, icon = EM().icon, list = SCRIPTS().list.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const ST = { brouillon: ["Brouillon", "neutral"], valide: ["Validé", "ok"], montage: ["Au montage", "info"] };
    return `<section class="card"><div class="card-head"><h2 class="h2">Scripts vidéo <span class="muted tabnum">${list.length}</span></h2><button class="btn btn-primary" type="button" data-st-script="new">${icon("plus")}Écrire un script</button></div>
      ${list.length ? `<ul class="ac-list">${list.map(s => `<li class="ac-row is-link" data-st-script="${esc(s.id)}" tabindex="0" role="button"><span class="av av-md">${icon("book")}</span><span><b>${esc(s.title || "Script")}</b><small>${esc([cname(s.client), s.format === "long" ? "Long 1-2 min" : "Court 15-45 s", s.by ? "par " + TM().member(s.by).name : "", s.via === "claude" ? "écrit par Claude" : ""].filter(Boolean).join(" · "))}</small></span><span class="ac-acts">${valPill(s.id)}<span class="state state-${(ST[s.status] || ST.brouillon)[1]}">${(ST[s.status] || ST.brouillon)[0]}</span></span></li>`).join("")}</ul>`
        : `<p class="body">Choisissez un client, une accroche, les messages et l'appel à l'action : le script se rédige selon le déroulé de Gianni, et vous l'ajustez.</p>`}</section>`;
  }
  function scriptEditor() {
    const esc = EM().esc, icon = EM().icon, s = X.edit, warn = checks(s.text || "");
    const opt = (v, cur) => String(v) === String(cur) ? " selected" : "";
    return `<div class="head"><div class="head-text"><button class="link" type="button" data-st-back>${icon("back")} Tous les scripts</button><h1 class="h1">${esc(s.title || "Nouveau script")}</h1><p class="sub">Selon le brief de tournage de Gianni. Tous les chiffres doivent être réels.</p></div></div>
      <div class="lx"><form class="lx-form" id="st-script-form" autocomplete="off"><div class="lx-sec lx-first"><div class="lx-sec-body">
        <div class="field-row"><div class="field"><label>Client</label><select name="client">${clients().map(c => `<option value="${esc(c.id)}"${opt(c.id, s.client)}>${esc(c.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Format</label><select name="format"><option value="court"${opt("court", s.format)}>Court, 15 à 45 s</option><option value="long"${opt("long", s.format)}>Long, 1 à 2 min</option></select></div></div>
        <div class="field"><label>Accroche</label><select name="hookPick">${hooks().map(h => `<option value="${esc(h.text)}"${opt(h.text, s.hook)}>${esc(h.text.length > 90 ? h.text.slice(0, 87) + "…" : h.text)}</option>`).join("")}<option value="__autre"${hooks().some(h => h.text === s.hook) ? "" : " selected"}>Une autre accroche…</option></select></div>
        ${hooks().some(h => h.text === s.hook) ? "" : `<label class="field"><span>Votre accroche</span><input name="hookOwn" maxlength="200" value="${esc(s.hook || "")}"></label>`}
        <fieldset class="field"><legend class="lx-lab">Les messages (corps)</legend>${BODIES.map(([k, l]) => `<label class="check-line"><input type="checkbox" name="b_${k}" ${(s.bodies || []).includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
        <div class="field"><label>Appel à l'action</label><select name="cta">${CTAS.map(c => `<option${opt(c, s.cta)}>${esc(c)}</option>`).join("")}</select></div>
        <div class="form-actions"><button class="btn btn-ghost" type="button" data-st-redraft>${icon("swap")}Rédiger avec ces choix</button></div>
      </div></div></form>
      <section class="lx-doc"><header class="lx-bar"><div><b>Le script</b><span>${esc(cname(s.client))} · ${s.format === "long" ? "long" : "court"}</span></div>
        <div class="lx-acts"><button class="icon-btn lx-btn" type="button" data-st-copy aria-label="Copier le script">${icon("copy")}</button><button class="btn btn-ghost" type="button" data-st-save>${icon("check")}Enregistrer</button><button class="btn btn-ghost" type="button" data-st-ask>${icon("user")}${valOf(s.id) ? "Renvoyer au client" : "Faire valider par le client"}</button><button class="btn btn-primary" type="button" data-st-montage>${icon("arrow")}Envoyer au montage</button></div></header>
        <div class="lx-scroll">${(() => { const v = valOf(s.id); if (!v) return ""; const [l, k] = VST[v.status] || VST.attente;
          return `<p class="st-val"><span class="state state-${k}">${l}</span><span>${v.status === "attente" ? `Envoyé le ${fr(String(v.sentAt).slice(0, 10))}. Le client le voit dans « Votre tournage ».` : `${esc(v.answeredName || "Le client")}, le ${fr(String(v.answeredAt).slice(0, 10))}${v.comment ? ` : « ${esc(v.comment)} »` : "."}`}</span></p>`; })()}${warn.length ? `<p class="st-warn">${icon("alert")}<span><b>À corriger avant de tourner :</b> ${esc(warn.join(" · "))}.</span></p>` : `<p class="st-ok">${icon("check")}Aucun mot interdit. Mention France Rénov' prévue sur l'écran de fin.</p>`}
          <label class="field"><span>Modifiable</span><textarea class="st-text" data-st-text rows="18">${esc(s.text || "")}</textarea></label>
          <label class="field"><span>Titre</span><input data-st-title maxlength="80" value="${esc(s.title || "")}"></label></div></section></div>`;
  }
  function readEditor() {
    const f = document.getElementById("st-script-form"), s = X.edit; if (!f) return s;
    const fd = new FormData(f), pick = String(fd.get("hookPick") || "");
    s.client = String(fd.get("client") || s.client); s.format = String(fd.get("format") || "court"); s.cta = String(fd.get("cta") || CTAS[0]);
    s.hook = pick === "__autre" ? String(fd.get("hookOwn") || s.hook || "").trim() : pick;
    s.bodies = BODIES.map(([k]) => k).filter(k => fd.get("b_" + k));
    const ta = document.querySelector("[data-st-text]"), ti = document.querySelector("[data-st-title]"); if (ta) s.text = ta.value; if (ti) s.title = ti.value.trim();
    return s;
  }
  const newScript = o => Object.assign({ id: "sv" + Date.now().toString(36), client: (clients()[0] || {}).id || "", format: "court", hook: BASE_HOOKS[0], bodies: ["economie"], cta: CTAS[0], status: "brouillon" }, o || {});
  function saveScript(S, status) {
    const s = readEditor(); s.title = s.title || `${cname(s.client)} – ${cut(fillPlaces(s.hook, clients().find(x => x.id === s.client)), 44)}`; s.updatedAt = nowIso(); s.by = s.by || S.who; if (status) s.status = status;
    SCRIPTS().put(Object.assign({}, s)); return s;
  }

  /* ---------- 3. Matrice ---------- */
  function matrix() {
    const esc = EM().esc, icon = EM().icon, m = X.mx, cid = m.client || (clients()[0] || {}).id || "";
    const n = m.h.length * m.b.length * m.c.length, tag = String(cname(cid) || "CLIENT").split(/\s+/)[0].toUpperCase();
    const names = []; m.h.forEach(h => m.b.forEach(b => m.c.forEach(c => names.push(`${tag}_A${String(h + 1).padStart(2, "0")}_C${String(b + 1).padStart(2, "0")}_CTA${c + 1}_V1`))));
    const box = (k, i, label, on) => `<label class="check-line"><input type="checkbox" data-st-mx="${k}:${i}" ${on ? "checked" : ""}><span>${esc(label)}</span></label>`;
    return `<section class="card"><div class="card-head"><h2 class="h2">La matrice des versions</h2>${EM().fsel("st-mxclient", "Client", clients().map(c => [c.id, c.name]), cid)}</div>
      <p class="body">Gianni : 5 à 10 accroches × 3 à 5 corps × 2 à 3 appels à l'action = 20 à 50 vidéos à partir du même tournage.</p>
      <div class="st-mx"><div><p class="lx-lab">Accroches (${m.h.length})</p>${hooks().map((h, i) => box("h", i, `A${String(i + 1).padStart(2, "0")} · ${h.text}`, m.h.includes(i))).join("")}</div>
        <div><p class="lx-lab">Corps (${m.b.length})</p>${BODIES.map(([, l], i) => box("b", i, `C${String(i + 1).padStart(2, "0")} · ${l}`, m.b.includes(i))).join("")}<p class="lx-lab">Appels à l'action (${m.c.length})</p>${CTAS.map((c, i) => box("c", i, `CTA${i + 1} · ${c}`, m.c.includes(i))).join("")}</div></div>
      <div class="card-head"><h3 class="h2">${n} version${n > 1 ? "s" : ""}</h3>${n ? `<span class="form-actions"><button class="btn btn-ghost" type="button" data-copy="${esc(names.join("\n"))}">${icon("copy")}Copier les noms</button><button class="btn btn-primary" type="button" data-st-mxmake>${icon("plus")}Créer les ${n} fiches à monter</button></span>` : ""}</div>
      ${n ? `<p class="kpi-note st-names">${esc(names.slice(0, 12).join(" · "))}${n > 12 ? ` · et ${n - 12} autres` : ""}</p>` : ""}</section>`;
  }

  /* ---------- 4. Ce qui marche : le coût par lead selon l'accroche, le corps et l'appel à l'action ----------
     Les chiffres viennent des pubs en cours de chaque client (dépense et leads, saisis ou repris de Meta).
     Le nom standard d'une version (CLIENT_A02_C01_CTA1_V1) dit de quelle accroche, quel corps et quel appel à l'action elle est faite. */
  const CODE = /_A(\d{2})_C(\d{2})_CTA(\d)/i;
  function perfRows(cid) {
    const ads = (window.ENTREMIS_PILOT && window.ENTREMIS_PILOT.ads ? window.ENTREMIS_PILOT.ads() : []).filter(a => !cid || a.client_id === cid), H = hooks();
    const groups = { h: {}, b: {}, c: {} };
    const add = (k, key, label, a) => { const g = groups[k][key] || (groups[k][key] = { label, ads: 0, spent: 0, leads: 0, on: 0 }); g.ads++; g.spent += Number(a.spent) || 0; g.leads += Number(a.leads) || 0; if (a.state !== "off") g.on++; };
    ads.forEach(a => { const m = String(a.name || "").match(CODE);
      if (m) { const hi = Number(m[1]) - 1, bi = Number(m[2]) - 1, ci = Number(m[3]) - 1;
        add("h", "A" + m[1], (H[hi] || {}).text || "Accroche " + m[1], a); add("b", "C" + m[2], (BODIES[bi] || [, "Corps " + m[2]])[1], a); add("c", "CTA" + m[3], CTAS[ci] || "Appel " + m[3], a); }
      else add("h", "x:" + String(a.angle || a.name || "Sans nom").toLowerCase(), a.angle || a.name || "Sans nom", a); });
    const out = k => Object.entries(groups[k]).map(([key, g]) => Object.assign({ key, cpl: g.leads ? g.spent / g.leads : null }, g)).sort((x, y) => (x.cpl == null) - (y.cpl == null) || (x.cpl || 0) - (y.cpl || 0) || y.spent - x.spent);
    return { h: out("h"), b: out("b"), c: out("c"), n: ads.length };
  }
  const eur = n => n == null ? "–" : (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
  function perfBlock(title, rows) {
    const esc = EM().esc, max = Math.max(1, ...rows.map(r => r.cpl || 0)), best = rows.filter(r => r.cpl != null).length > 1 ? rows.find(r => r.cpl != null && r.leads >= 3) : null;
    if (!rows.length) return "";
    return `<section class="card"><div class="card-head"><h2 class="h2">${title}</h2></div><ul class="st-perf">${rows.map(r => `<li${best === r ? ' class="is-best"' : ""}>
      <div class="st-perf-txt"><b>${esc(r.key.startsWith("x:") ? "" : r.key + " · ")}${esc(cut(r.label, 90))}</b><span>${r.ads} pub${r.ads > 1 ? "s" : ""}${r.on ? ` dont ${r.on} en cours` : ""} · ${eur(r.spent)} dépensés · ${r.leads} lead${r.leads > 1 ? "s" : ""}</span></div>
      <div class="st-perf-num">${r.cpl == null ? `<span class="muted">${r.spent ? "aucun lead" : "pas encore de chiffres"}</span>` : `<b class="tabnum">${eur(r.cpl)}</b><span>par lead</span>`}${best === r ? `<span class="state state-ok">La moins chère</span>` : ""}</div>
      ${r.cpl != null ? `<span class="st-perf-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.round(r.cpl / max * 100))}%"></i></span>` : ""}</li>`).join("")}</ul></section>`;
  }
  function perf() {
    const cid = X.perfClient, p = perfRows(cid);
    return `<section class="card"><div class="card-head"><h2 class="h2">Le coût par lead, version par version</h2>${EM().fsel("st-perfclient", "Client", [["", "Tous les clients"]].concat(clients().map(c => [c.id, c.name])), cid)}</div>
      <p class="body">Calculé avec la dépense et les leads de chaque pub en cours (fiche client, « Pubs en cours »). Les pubs nommées comme la matrice (CLIENT_A02_C01_CTA1_V1) sont comptées par accroche, par corps et par appel à l'action. On garde ce qui coûte le moins, on coupe le reste.</p>
      ${p.n ? "" : `<p class="kpi-note">Aucune pub en cours pour l'instant. Elles arrivent ici quand une vidéo passe « En ligne », ou quand on ajoute une pub sur la fiche du client.</p>`}</section>
      ${perfBlock("Par accroche", p.h)}${perfBlock("Par corps de message", p.b)}${perfBlock("Par appel à l'action", p.c)}`;
  }

  function view(S) {
    const icon = EM().icon;
    if (X.tab === "scripts" && X.edit) return scriptEditor();
    return `<div class="head"><div class="head-text"><h1 class="h1">Studio contenu</h1><p class="sub">Voir ce qui marche dans la bibliothèque Meta, écrire les scripts, préparer les versions à monter.</p></div></div>
      <div class="crm-views" role="tablist" aria-label="Studio">${[["veille", "Veille Meta"], ["scripts", "Scripts"], ["matrice", "Matrice"], ["perf", "Ce qui marche"]].map(([k, l]) => `<button class="crm-view" type="button" role="tab" aria-selected="${X.tab === k}" data-st-tab="${k}">${l}</button>`).join("")}<a class="crm-view" href="#videos">${icon("eye")}Vidéos</a></div>
      ${X.tab === "veille" ? veille() : X.tab === "scripts" ? scripts() : X.tab === "perf" ? perf() : matrix()}`;
  }
  function sheet() { return X.sheet === "veille" ? veilleSheet() : ""; }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-st-tab],[data-st-veille],[data-st-veille-del],[data-st-close],[data-st-inspire],[data-st-script],[data-st-back],[data-st-redraft],[data-st-copy],[data-st-save],[data-st-montage],[data-st-mxmake],[data-st-pays],[data-st-mxclient],[data-st-perfclient],[data-st-ask]"); if (!t) return false;
    const d = t.dataset;
    if (d.stTab) { X.tab = d.stTab; X.edit = null; render(); return true; }
    if (d.stPays !== undefined) { X.pays = d.stPays; render(); return true; }
    if (d.stPerfclient !== undefined) { X.perfClient = d.stPerfclient; render(); return true; }
    if (d.stMxclient !== undefined) { X.mx.client = d.stMxclient; render(); return true; }
    if (d.stVeille) { X.sheet = "veille"; X.id = d.stVeille; render(); return true; }
    if ("stClose" in d) { X.sheet = null; render(); return true; }
    if (d.stVeilleDel) { EM().confirm({ title: "Supprimer cette pub repérée ?", text: "Elle disparaît de la veille.", ok: "Supprimer" }).then(y => { if (!y) return; VEILLE().remove(d.stVeilleDel); X.sheet = null; render(); }); return true; }
    if (d.stInspire) { const v = VEILLE().list.find(x => x.id === d.stInspire) || {}; X.tab = "scripts"; X.edit = newScript({ hook: v.hook || BASE_HOOKS[0], note: `Inspiré de ${v.advertiser || "une pub repérée"}` }); X.edit.text = draft(X.edit); render(); window.scrollTo(0, 0); return true; }
    if (d.stScript) { X.tab = "scripts"; X.edit = d.stScript === "new" ? newScript() : Object.assign({}, SCRIPTS().list.find(x => x.id === d.stScript)); if (!X.edit.text) X.edit.text = draft(X.edit); render(); window.scrollTo(0, 0); return true; }
    if ("stBack" in d) { X.edit = null; render(); return true; }
    if ("stRedraft" in d) { const s = readEditor(); s.text = draft(s); render(); return true; }
    if ("stCopy" in d) { const s = readEditor(); (navigator.clipboard ? navigator.clipboard.writeText(s.text || "") : Promise.reject()).then(() => EM().toast("Script copié."), () => EM().toast("La copie n'a pas marché.")); return true; }
    if ("stAsk" in d) {
      const s = readEditor(); if (checks(s.text || "").length) { EM().toast("Corrigez d'abord les mots interdits signalés en haut du script."); return true; }
      if (!s.client) { EM().toast("Choisissez le client."); return true; }
      const saved = saveScript(S), old = valOf(saved.id);
      VALID().put({ id: old ? old.id : "val-" + saved.id, client_id: saved.client, script: saved.id, title: saved.title, text: saved.text, format: saved.format, status: "attente", sentAt: nowIso(), sentBy: S.who, comment: "", answeredAt: "", answeredName: "" });
      TM().haptic("done"); render(); EM().toast(`Envoyé à ${cname(saved.client)} : il le voit dans « Votre tournage » et peut le valider.`); return true;
    }
    if ("stSave" in d) { const s = saveScript(S); TM().haptic("done"); render(); EM().toast(checks(s.text).length ? "Enregistré. Attention : il reste des mots à corriger avant de tourner." : "Script enregistré pour toute l'équipe."); return true; }
    if ("stMontage" in d) {
      const s = readEditor(); if (checks(s.text || "").length) { EM().toast("Corrigez d'abord les mots interdits signalés en haut du script."); return true; }
      const saved = saveScript(S, "montage");
      if (window.ENTREMIS_VIDEOS && window.ENTREMIS_VIDEOS.add) window.ENTREMIS_VIDEOS.add({ client: saved.client, angle: cut(fillPlaces(saved.hook, clients().find(x => x.id === saved.client)), 40), status: "monter", note: "Script : " + saved.title, script: saved.id, format: saved.format === "long" ? "Long 1-2 min" : "Vertical 9:16" }, S);
      TM().haptic("done"); X.edit = null; render(); EM().toast("Envoyé au montage : la fiche est dans Vidéos, colonne « À monter ».");
      return true;
    }
    if ("stMxmake" in d) {
      const m = X.mx, cid = m.client || (clients()[0] || {}).id || "", n = m.h.length * m.b.length * m.c.length; if (!n || !(window.ENTREMIS_VIDEOS && window.ENTREMIS_VIDEOS.add)) return true;
      EM().confirm({ title: `Créer ${n} fiches à monter ?`, text: `Pour ${cname(cid)}, dans Vidéos, colonne « À monter ». Chacune avec son nom standard.`, ok: "Créer" }).then(y => { if (!y) return;
        const tag = String(cname(cid) || "CLIENT").split(/\s+/)[0].toUpperCase(), H = hooks(); let k = 0;
        m.h.forEach(h => m.b.forEach(b => m.c.forEach(c => { window.ENTREMIS_VIDEOS.add({ client: cid, name: `${tag}_A${String(h + 1).padStart(2, "0")}_C${String(b + 1).padStart(2, "0")}_CTA${c + 1}_V1`, angle: cut(fillPlaces((H[h] || {}).text || "", clients().find(x => x.id === cid)), 40), status: "monter", note: `${BODIES[b][1]} · ${CTAS[c]}`, suffix: k++ }, S); })));
        TM().haptic("done"); render(); EM().toast(`${n} fiches créées dans Vidéos, à monter.`); });
      return true;
    }
    return false;
  }
  function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "st-veille-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), g = k => String(fd.get(k) || "").trim();
    if (!g("advertiser")) { EM().toast("Écrivez le nom de l'annonceur."); return true; }
    if (g("url") && !/^https:\/\//i.test(g("url"))) { EM().toast("Le lien doit commencer par https://"); return true; }
    const cur = X.id === "new" ? { id: "vt" + Date.now().toString(36), by: S.who, createdAt: nowIso() } : VEILLE().list.find(x => x.id === X.id) || { id: X.id };
    VEILLE().put(Object.assign({}, cur, { url: g("url"), advertiser: g("advertiser"), since: g("since"), family: g("family"), reach: Number(g("reach")) || 0, format: g("format"), hook: g("hook"), why: g("why"), updatedAt: nowIso() }));
    X.sheet = null; TM().haptic("done"); render(); EM().toast("Pub ajoutée à la veille de l'équipe."); return true;
  }
  document.addEventListener("input", e => {
    if (!e.target.matches) return;
    if (e.target.matches("[data-st-q]")) { X.q = e.target.value; const a = document.querySelector("[data-st-go]"); if (a) a.href = libUrl(X.q || "pompe à chaleur", X.pays); return; }
    if (e.target.matches("[data-st-text]")) { if (X.edit) X.edit.text = e.target.value; const w = checks(e.target.value), box = e.target.closest(".lx-scroll").querySelector(".st-warn, .st-ok");
      if (box) { box.className = w.length ? "st-warn" : "st-ok"; box.innerHTML = w.length ? `${EM().icon("alert")}<span><b>À corriger avant de tourner :</b> ${EM().esc(w.join(" · "))}.</span>` : `${EM().icon("check")}Aucun mot interdit. Mention France Rénov' prévue sur l'écran de fin.`; } }
  });
  document.addEventListener("change", e => {
    if (e.target.matches && e.target.matches("[data-st-mx]")) { const [k, i] = e.target.dataset.stMx.split(":"), arr = X.mx[k], n = Number(i); if (e.target.checked) { if (!arr.includes(n)) arr.push(n); } else X.mx[k] = arr.filter(x => x !== n); EM().render(); return; }
    if (e.target.closest && e.target.closest("#st-script-form") && e.target.name === "hookPick") { readEditor(); EM().render(); }
  });
  // Pour l'espace client (tournage.js) et les notifications
  function validations(cid) { return VALID().list.filter(v => v.client_id === cid).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))); }
  function answer(id, status, comment, name) { const v = VALID().list.find(x => x.id === id); if (!v) return null; const n = Object.assign({}, v, { status, comment: String(comment || "").slice(0, 600), answeredAt: nowIso(), answeredName: String(name || "").slice(0, 60) }); VALID().put(n); return n; }
  function notifs(space, cid) {
    if (space === "client") return validations(cid).filter(v => v.status === "attente").map(v => ({ id: "val-" + v.id + "-" + v.sentAt, text: `Un script de tournage attend votre validation : ${v.title}`, href: "#tournage" }));
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    return VALID().list.filter(v => v.status !== "attente" && String(v.answeredAt).slice(0, 10) >= since).map(v => ({ id: "vala-" + v.id + "-" + v.answeredAt, ok: v.status === "valide", text: `${cname(v.client_id)} ${v.status === "valide" ? "a validé" : "demande une correction sur"} le script « ${v.title} »${v.comment ? " : " + v.comment : ""}`, href: "#studio" }));
  }
  window.ENTREMIS_STUDIO = { view, sheet, onClick, onSubmit, validations, answer, notifs, perfRows, init: render => [VEILLE, SCRIPTS, HOOKS, VALID].forEach(s => s().init(render)), reset: () => { X.sheet = null; } };
})();
