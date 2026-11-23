/* Entremis — le pilotage de la machine à leads (documents de Gianni, 21/11/2026).
   - Les 8 étapes par client (tournage → facturation) et le tournage (date, casting, autorisations, vidéos, mentions obligatoires),
     avec l'engagement et le rachat des vidéos en cas de départ anticipé. Le client voit où en est sa campagne.
   - Les pubs Meta : une ligne par pub, et les règles d'arrêt (60 € sans lead, plus de 40 € par lead sur 3 jours,
     plus de 50 € par lead facturé après 3 séries : changer d'angle).
   - Les risques : pas plus de 30 % du chiffre d'affaires avec un seul client.
   - Les documents de travail (argumentaire, brief, veille…) dans la base, tenus à jour par l'équipe.
   - La sauvegarde de toute l'app sur le Drive commun. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team, TM = () => window.ENTREMIS_TEAM;
  const st = {}; const store = n => st[n] || (st[n] = OPS().makeStore(n, () => []));
  const FLOW = () => store("flow"), ADS = () => store("ads"), REFS = () => store("refs"), BACK = () => store("backups");
  const X = { sheet: null, id: null, doc: null, q: "", busy: false };
  const today = () => window.ENTREMIS_DATA.today.iso;
  const p2 = n => String(n).padStart(2, "0");
  const fr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
  const eur = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";
  const days = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 864e5);
  const addMonths = (iso, n) => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const cl = id => EM().allClients().find(c => c.id === id) || { id, name: id };
  const field = (name, label, value, attrs) => `<label class="field"><span>${label}</span><input name="${name}" value="${EM().esc(value == null ? "" : value)}" ${attrs || ""}></label>`;
  const check = (name, label, on) => `<label class="check-line"><input type="checkbox" name="${name}" ${on ? "checked" : ""}><span>${label}</span></label>`;

  /* ---------- 1. Les 8 étapes et le tournage ---------- */
  const STEPS = [["tournage", "Tournage"], ["montage", "Montage (20 à 50 vidéos)"], ["campagne", "Campagne Meta"], ["formulaire", "Formulaire et code SMS"], ["setter", "Assistant WhatsApp"], ["transmission", "Transmission des leads"], ["installateur", "Rappels chez l'installateur"], ["facturation", "Facturation"]];
  const STATE = { todo: ["À faire", "neutral"], doing: ["En cours", "warn"], done: ["Fait", "ok"] };
  const flowOf = cid => FLOW().list.find(f => f.id === cid) || { id: cid, client_id: cid, steps: {}, shoot: {} };
  const putFlow = (cid, patch) => FLOW().put(Object.assign({}, flowOf(cid), patch, { client_id: cid, updatedAt: new Date().toISOString().slice(0, 16) }));
  function engagement(cid) {
    const c = cl(cid), start = c.start || (c.createdAt ? String(c.createdAt).slice(0, 10) : ""), months = Number(c.engagement) || 0;
    return { start, months, end: start && months ? addMonths(start, months) : "", rachat: Number(flowOf(cid).rachat) || 2000 };
  }
  function flowCard(cid, client) {
    const f = flowOf(cid), esc = EM().esc, icon = EM().icon, s = f.shoot || {}, eg = engagement(cid);
    const n = STEPS.filter(([k]) => (f.steps[k] || {}).state === "done").length;
    const rows = STEPS.map(([k, l], i) => { const v = f.steps[k] || {}, [t, tone] = STATE[v.state || "todo"];
      return `<li class="pl-step${v.state === "done" ? " is-done" : ""}"><span class="pl-n">${v.state === "done" ? icon("check") : i + 1}</span><span class="pl-l"><b>${l}</b>${v.at ? `<small>${fr(v.at)}</small>` : ""}</span>
        ${client ? `<span class="${v.state && v.state !== "todo" ? "state state-" + tone : "pl-todo"}">${t}</span>` : `<button class="${v.state && v.state !== "todo" ? "state state-" + tone : "pl-todo"} pl-cycle" type="button" data-pl-step="${esc(cid)}:${k}" aria-label="${l} : ${t}, changer">${t}</button>`}</li>`; }).join("");
    const shoot = [s.date ? `Tournage le ${fr(s.date)}${s.place ? " à " + esc(s.place) : ""}` : "", s.videos ? `${s.videos} vidéo${s.videos > 1 ? "s" : ""} livrée${s.videos > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
    if (client) return `<section class="card"><div class="card-head"><h2 class="h2">Où en est votre campagne</h2><span class="muted">${n} étape${n > 1 ? "s" : ""} sur 8</span></div>
      ${shoot ? `<p class="body">${shoot}</p>` : ""}<ol class="pl-steps">${rows}</ol>
      ${eg.end ? `<p class="kpi-note">Engagement de ${eg.months} mois, jusqu'au ${fr(eg.end)}. Les vidéos vous appartiennent à la fin de l'engagement.</p>` : ""}</section>`;
    const warn = [!s.franceRenov && s.date ? "mention France Rénov' à vérifier" : "", !s.consents && s.date ? "autorisations de droit à l'image à faire signer" : ""].filter(Boolean);
    return `<section class="card"><div class="card-head"><h2 class="h2">La machine pour ce client</h2><span class="muted">${n} sur 8</span></div>
      <ol class="pl-steps">${rows}</ol>
      <dl class="lp-dl">
        <div><dt>Tournage</dt><dd>${shoot || "à planifier"}</dd></div>
        ${(() => { const n = window.ENTREMIS_VIDEOS ? window.ENTREMIS_VIDEOS.clientCount(cid) : null; return n ? `<div><dt>Vidéos</dt><dd><a class="link" href="#videos">${n.pret} prête${n.pret > 1 ? "s" : ""} à poster · ${n.ligne} en ligne${n.monter ? ` · ${n.monter} en montage` : ""}</a></dd></div>` : ""; })()}
        <div><dt>Autorisations signées</dt><dd>${s.consents ? esc(String(s.consents)) : "aucune"}</dd></div>
        <div><dt>Engagement</dt><dd>${eg.end ? `${eg.months} mois, jusqu'au ${fr(eg.end)}` : "à définir (Campagne et suivi)"}</dd></div>
        <div><dt>Départ avant la fin</dt><dd>rachat du tournage ${eur(eg.rachat)} HT</dd></div>
      </dl>
      ${warn.length ? `<p class="kpi-note t-warn">${icon("alert")} À faire : ${warn.join(", ")}.</p>` : ""}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-pl-shoot="${esc(cid)}">${icon("cal")}Tournage et vidéos</button><a class="btn btn-ghost" href="#juridique" data-legal-for="${esc(cid)}">${icon("book")}Documents juridiques</a></div></section>`;
  }
  function shootSheet() {
    const f = flowOf(X.id), s = f.shoot || {};
    return `<div class="scrim" data-pl-close></div><form class="sheet pl-sheet" id="pl-shoot-form" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-pl-close>Annuler</button><b>Tournage – ${EM().esc(cl(X.id).name)}</b><button class="link strong" type="submit">Enregistrer</button></div>
      <div class="field-row">${field("date", "Date du tournage", s.date, 'type="date"')}${field("place", "Lieu", s.place, 'maxlength="80"')}</div>
      <p class="set-title">Le casting</p>
      <div class="field-row">${field("host", "Présentateur", s.host, 'maxlength="60"')}${field("tech", "Technicien ou patron", s.tech, 'maxlength="60"')}</div>
      ${field("witness", "Client témoin", s.witness, 'maxlength="60"')}
      <div class="field-row">${field("consents", "Autorisations de droit à l'image signées", s.consents || "", 'type="number" min="0" max="50"')}${field("videos", "Vidéos livrées", s.videos || "", 'type="number" min="0" max="200"')}</div>
      ${field("hooks", "Accroches tournées", s.hooks || "", 'type="number" min="0" max="50"')}
      <p class="set-title">Obligatoire dans chaque vidéo</p>
      ${check("franceRenov", "Mention France Rénov' exacte en bandeau (écran de fin)", s.franceRenov)}
      ${check("rge", "Qualification RGE et « PAC agréée » visibles", s.rge)}
      ${check("noAmount", "Aucun montant d'aide, jamais « MaPrimeRénov' », jamais « 1 € »", s.noAmount)}
      ${field("rachat", "Rachat du tournage si départ avant la fin (€ HT)", f.rachat || 2000, 'type="number" min="0" step="100"')}
    </form>`;
  }

  /* ---------- 2. Les pubs Meta et les règles d'arrêt ---------- */
  function rule(a) {
    const spent = Number(a.spent) || 0, leads = Number(a.leads) || 0, age = a.start ? days(a.start, today()) : 0;
    if (a.state === "off") return null;
    if (spent >= 60 && !leads) return "À couper : 60 € dépensés, aucun lead";
    if (age >= 3 && leads && spent / leads > 40) return `À couper : ${eur(spent / leads)} par lead sur ${age} jours`;
    return null;
  }
  function adsOf(cid) { return ADS().list.filter(a => a.client_id === cid).sort((a, b) => (b.start || "") < (a.start || "") ? -1 : 1); }
  function angleAlert(cid) {
    const m = today().slice(0, 7), meta = window.ENTREMIS_LIVE && window.ENTREMIS_LIVE.META ? window.ENTREMIS_LIVE.META().list.find(x => x.id === cid) : null;
    const spend = Number(((meta || {}).spend || {})[m]) || 0, b = window.ENTREMIS_MACHINE.billing(cid, m), series = Math.max(0, ...adsOf(cid).map(a => Number(a.series) || 1));
    return spend && b.ok.length && spend / b.ok.length > 50 && series >= 3 ? `Plus de 50 € de pub par lead facturé après ${series} séries : changer d'angle, tourner de nouvelles vidéos.` : "";
  }
  function adsCard(cid) {
    const esc = EM().esc, icon = EM().icon, list = adsOf(cid), angle = angleAlert(cid);
    return `<section class="card"><div class="card-head"><h2 class="h2">Pubs en cours</h2><span class="muted">${list.filter(a => a.state !== "off").length} active${list.filter(a => a.state !== "off").length > 1 ? "s" : ""}</span></div>
      ${list.length ? `<ul class="ac-list">${list.map(a => { const r = rule(a), cpl = Number(a.leads) ? Number(a.spent) / Number(a.leads) : 0;
        return `<li class="ac-row"><span class="av av-md">${esc(String(a.series || 1))}</span><span><b>${esc(a.name || "Pub")}</b><small>${esc(a.angle || "")}${a.start ? " · depuis le " + fr(a.start) : ""} · ${eur(a.spent)} · ${Number(a.leads) || 0} lead${Number(a.leads) > 1 ? "s" : ""}${cpl ? " · " + eur(cpl) + " par lead" : ""}</small></span>
          <span class="ac-acts">${a.state === "off" ? `<span class="state state-neutral">Coupée</span>` : r ? `<span class="state state-danger">${esc(r)}</span>` : `<span class="state state-ok">Active</span>`}<button class="link" type="button" data-pl-ad="${esc(a.id)}">Modifier</button></span></li>`; }).join("")}</ul>`
        : `<p class="body">Une ligne par pub : ce qu'elle a coûté et ses leads. L'app dit quand la couper.</p>`}
      ${angle ? `<p class="kpi-note t-warn">${icon("alert")} ${esc(angle)}</p>` : ""}
      <p class="kpi-note">Règles : couper à 60 € sans lead, ou au-delà de 40 € par lead sur 3 jours.</p>
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-pl-ad="new:${esc(cid)}">${icon("plus")}Ajouter une pub</button></div></section>`;
  }
  function adSheet() {
    const a = X.id && X.id.startsWith("new:") ? { client_id: X.id.slice(4), series: 1, start: today() } : ADS().list.find(x => x.id === X.id) || {};
    return `<div class="scrim" data-pl-close></div><form class="sheet" id="pl-ad-form" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-pl-close>Annuler</button><b>${a.id ? "Modifier la pub" : "Nouvelle pub"}</b><button class="link strong" type="submit">Enregistrer</button></div>
      ${field("name", "Nom de la pub (nommage standard)", a.name, 'required maxlength="80" placeholder="Ex. : LYON_PAC_H3_offre"')}
      <div class="field-row">${field("angle", "Angle ou accroche", a.angle, 'maxlength="80"')}${field("series", "Série de vidéos", a.series || 1, 'type="number" min="1" max="20"')}</div>
      <div class="field-row">${field("start", "Lancée le", a.start, 'type="date"')}${field("spent", "Dépensé (€)", a.spent || "", 'type="number" min="0" step="1"')}</div>
      <div class="field-row">${field("leads", "Leads obtenus", a.leads || "", 'type="number" min="0"')}<div class="field"><label>État</label><select name="state"><option value="on"${a.state !== "off" ? " selected" : ""}>Active</option><option value="off"${a.state === "off" ? " selected" : ""}>Coupée</option></select></div></div>
      ${a.id ? `<button class="btn btn-ghost" type="button" data-pl-ad-del="${EM().esc(a.id)}">${EM().icon("trash")}Supprimer cette ligne</button>` : ""}
    </form>`;
  }

  /* ---------- 3. Les risques (Chiffres) ---------- */
  function riskPanel() {
    const esc = EM().esc, since = addMonths(today(), -3), inv = OPS().stores.DOCS.list.filter(d => d.kind === "facture" && (d.date || "") >= since);
    const total = inv.reduce((a, d) => a + (Number(d.amount) || 0), 0), by = {};
    inv.forEach(d => { const k = d.to || d.client || "?"; by[k] = (by[k] || 0) + (Number(d.amount) || 0); });
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const cut = ADS().list.filter(a => rule(a)), angles = TD().clients.map(c => [c, angleAlert(c.id)]).filter(x => x[1]);
    const ends = TD().clients.map(c => [c, engagement(c.id)]).filter(([, e]) => e.end && days(today(), e.end) >= 0 && days(today(), e.end) <= 30);
    const line = (tone, text) => `<li class="pl-risk"><span class="state state-${tone}">${tone === "danger" ? "À traiter" : tone === "warn" ? "À surveiller" : "Bon"}</span><span>${text}</span></li>`;
    const items = [];
    top.forEach(([k, v]) => { const pct = total ? Math.round(v / total * 100) : 0, n = (TD().clients.find(c => c.id === k) || { name: k }).name;
      if (pct > 30) items.push(line("danger", `${esc(n)} pèse ${pct} % du chiffre d'affaires des 3 derniers mois (limite : 30 %).`)); });
    if (cut.length) items.push(line("danger", `${cut.length} pub${cut.length > 1 ? "s" : ""} à couper : ${cut.slice(0, 3).map(a => esc(a.name || "pub")).join(", ")}${cut.length > 3 ? "…" : ""}.`));
    angles.forEach(([c, t]) => items.push(line("warn", `${esc(c.name)} : ${esc(t)}`)));
    ends.forEach(([c, e]) => items.push(line("warn", `${esc(c.name)} : fin d'engagement le ${fr(e.end)}. Préparer le renouvellement.`)));
    return `<section class="card"><div class="card-head"><h2 class="h2">Risques</h2><span class="muted">chiffre d'affaires, pubs, engagements</span></div>
      ${items.length ? `<ul class="pl-risks">${items.join("")}</ul>` : `<p class="body">Rien à signaler : aucun client au-delà de 30 % du chiffre d'affaires, aucune pub à couper.</p>`}</section>`;
  }

  /* ---------- 4. Les documents de travail (tenus à jour par l'équipe) ---------- */
  function viewDocs(S) {
    const esc = EM().esc, icon = EM().icon, all = REFS().list.slice().sort((a, b) => (a.order || 99) - (b.order || 99) || String(a.title).localeCompare(String(b.title)));
    const drive = (BACK().list.find(b => b.id === "drive") || {}).url;
    if (X.doc) {
      const d = all.find(x => x.id === X.doc); if (!d) { X.doc = null; return viewDocs(S); }
      const q = X.q.trim().toLowerCase(), paras = String(d.text || "").split(/\n{2,}|\n(?=[•\-0-9])/).filter(p => !q || p.toLowerCase().includes(q));
      return `<div class="head"><div class="head-text"><button class="link" type="button" data-pl-doc-back>${icon("back")} Tous les documents</button><h1 class="h1">${esc(d.title)}</h1><p class="sub">${d.updatedAt ? `Mis à jour le ${fr(d.updatedAt)}${d.by ? " par " + esc(TM().member(d.by).name) : ""}` : ""}</p></div>
        <div class="head-actions"><button class="btn btn-ghost" type="button" data-pl-doc-edit="${esc(d.id)}">${icon("sliders")}Modifier</button></div></div>
        <section class="card"><label class="field"><span>Chercher dans ce document</span><input data-pl-doc-q value="${esc(X.q)}" placeholder="Ex. : objection, prix, tournage"></label>
        <div class="pl-doc">${paras.map(p => `<p>${esc(p)}</p>`).join("") || `<p class="body">Rien ne correspond.</p>`}</div></section>`;
    }
    return `<div class="head"><div class="head-text"><h1 class="h1">Documents de travail</h1><p class="sub">L'argumentaire, le brief de tournage, la veille : à jour, pour toute l'équipe.</p></div>
      <div class="head-actions">${drive ? `<a class="btn btn-ghost" href="${esc(drive)}" target="_blank" rel="noopener">${EM().brand("drive", "Google Drive")}Drive commun</a>` : ""}<button class="btn btn-primary" type="button" data-pl-doc-edit="new">${icon("plus")}Nouveau document</button></div></div>
      ${all.length ? `<div class="lg-grid">${all.map(d => `<button class="lg-tile" type="button" data-pl-doc="${esc(d.id)}"><span class="lg-ico">${icon("book")}</span><span class="lg-txt"><b>${esc(d.title)}</b><small>${esc(d.what || "")}</small></span><span class="lg-go">${d.updatedAt ? "Mis à jour le " + fr(d.updatedAt) : "Lire"} ${icon("arrow")}</span></button>`).join("")}</div>`
        : `<section class="card"><p class="body">${window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? "Aucun document pour l'instant. Ajoutez-en un, ou lancez le SQL des documents de Gianni." : "Maquette : les documents de Gianni sont dans la base en ligne, pas dans cette maquette."}</p></section>`}
      <p class="set-note">${icon("info")}Visibles par l'équipe seulement. Un changement ici est vu tout de suite par Marc, Richard et Gianni.</p>`;
  }
  function docSheet(S) {
    const d = X.id === "new" ? {} : REFS().list.find(x => x.id === X.id) || {};
    return `<div class="scrim" data-pl-close></div><form class="sheet pl-sheet" id="pl-doc-form" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-pl-close>Annuler</button><b>${d.id ? "Modifier le document" : "Nouveau document"}</b><button class="link strong" type="submit">Enregistrer</button></div>
      ${field("title", "Titre", d.title, 'required maxlength="120"')}
      ${field("what", "En une ligne", d.what, 'maxlength="160"')}
      <label class="field"><span>Le texte</span><textarea name="text" rows="14" maxlength="60000">${EM().esc(d.text || "")}</textarea></label>
      ${d.id ? `<button class="btn btn-ghost" type="button" data-pl-doc-del="${EM().esc(d.id)}">${EM().icon("trash")}Supprimer ce document</button>` : ""}
    </form>`;
  }

  /* ---------- 5. La sauvegarde sur le Drive commun ---------- */
  const DRIVE = "https://www.googleapis.com/auth/drive";
  const folderId = url => { const m = String(url || "").match(/folders\/([A-Za-z0-9_-]{10,})/) || String(url || "").match(/[?&]id=([A-Za-z0-9_-]{10,})/); return m ? m[1] : ""; };
  const lastBackup = () => BACK().list.filter(b => b.id !== "drive").sort((a, b) => (b.at || "") < (a.at || "") ? -1 : 1)[0];
  function backupRows(S, row) {
    if (S.space !== "team") return "";
    const esc = EM().esc, icon = EM().icon, on = window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on(), drive = (BACK().list.find(b => b.id === "drive") || {}).url, lb = lastBackup();
    return `<section class="set-group"><p class="set-title">Sauvegarde sur le Drive commun</p>
      ${row("Dossier du Drive commun", drive ? `<a class="link" href="${esc(drive)}" target="_blank" rel="noopener">Ouvrir le dossier</a>` : "Collez le lien du dossier partagé avec Richard et Gianni.", `<button class="btn btn-ghost" type="button" data-pl-drive>${icon("sliders")}${drive ? "Changer" : "Choisir"}</button>`)}
      ${row("Dernière sauvegarde", lb ? `${fr(lb.at)} à ${String(lb.at).slice(11, 16)}, par ${esc(TM().member(lb.by).name)} : ${lb.rows} lignes` : "Jamais faite", on && drive ? `<button class="btn btn-primary" type="button" data-pl-backup ${X.busy ? "disabled" : ""}>${icon("download")}${X.busy ? "Sauvegarde…" : "Sauvegarder maintenant"}</button>` : `<span class="state state-neutral">${on ? "Dossier à choisir" : "Site en ligne"}</span>`)}
      </section>
      <p class="set-note">${icon("info")}Toutes les données de l'app (leads, clients, rendez-vous, factures, documents) partent dans le dossier : un fichier complet, des tableaux Google Sheets lisibles, et la marche à suivre en cas de panne. À faire au moins une fois par semaine : l'app le rappelle.</p>`;
  }
  const csv = rows => rows.map(r => r.map(v => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  async function upload(tok, parent, name, body, mime, asMime) {
    const bd = "entremis" + Date.now().toString(36), meta = { name, parents: [parent] }; if (asMime) meta.mimeType = asMime;
    const blob = new Blob([`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\nContent-Type: ${mime}\r\n\r\n`, body, `\r\n--${bd}--`]);
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": `multipart/related; boundary=${bd}` }, body: blob });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error((j.error && j.error.message) || "Drive"), { status: r.status }); }
    return r.json();
  }
  const RESTORE = `Entremis – que faire si l'app tombe en panne

1. Le code de l'app est sur GitHub : github.com/entremisagency/entremis-app (le site se remet en ligne tout seul depuis là).
2. Les données vivent dans Supabase (projet Entremis). Ce dossier en garde une copie : le fichier « sauvegarde » (.json) contient tout.
3. Pour remettre les données : ouvrir Claude Code dans le dossier de l'app et lui donner le fichier .json de la date voulue, en lui demandant de le recharger dans la table « docs ».
4. Les tableaux Google Sheets (leads, clients, factures) se lisent sans l'app, pour continuer à travailler pendant la panne.
5. Les réglages de la base (règles d'accès, fonctions) sont dans supabase/schema.sql sur GitHub.`;
  async function backup(S) {
    const C = window.ENTREMIS_CLOUD, drive = (BACK().list.find(b => b.id === "drive") || {}).url, parent = folderId(drive);
    if (!C || !C.on() || !parent) { EM().toast("Choisissez d'abord le dossier du Drive commun."); return; }
    X.busy = true; EM().render();
    try {
      const known = (() => { try { return localStorage.getItem("entremis-app-drive-on") === "1"; } catch (_) { return false; } })();
      const tok = await window.ENTREMIS_GCAL.tokenFor(DRIVE, known);
      const rows = await C.dumpAll(), day = today(), now = new Date().toISOString().slice(0, 16);
      await upload(tok, parent, `Entremis – sauvegarde complète ${day}.json`, JSON.stringify({ app: "entremis", at: now, by: S.who, rows }, null, 1), "application/json");
      const col = n => rows.filter(r => r.collection === n).map(r => Object.assign({ id: r.id }, r.data));
      const leads = col("leads"), clients = col("clients"), inv = col("documents");
      await upload(tok, parent, `Entremis – leads ${day}`, csv([["Reçu", "Nom", "Téléphone", "Projet", "Ville", "Code postal", "Pays", "Statut", "Donné à", "Niveau", "Source"]].concat(leads.map(l => [l.at, l.name, l.phone, l.trade, l.city, l.zip, l.country || "FR", l.status, l.to, l.level, l.source]))), "text/csv", "application/vnd.google-apps.spreadsheet");
      await upload(tok, parent, `Entremis – clients ${day}`, csv([["Nom", "Métier", "Zone", "Pays", "Contact", "Téléphone", "Prix par lead", "Plafond", "Engagement (mois)", "Début"]].concat(clients.map(c => [c.name, c.trade, c.zoneCP || c.zone, c.pays || "FR", c.contact, c.phone, c.prixLead, c.plafond, c.engagement, c.start]))), "text/csv", "application/vnd.google-apps.spreadsheet");
      await upload(tok, parent, `Entremis – devis et factures ${day}`, csv([["Type", "Numéro", "Client", "Date", "Échéance", "Montant HT", "TVA %", "État"]].concat(inv.map(d => [d.kind, d.number, d.client, d.date, d.due, d.amount, d.tva, d.status]))), "text/csv", "application/vnd.google-apps.spreadsheet");
      if (!lastBackup()) await upload(tok, parent, "Entremis – que faire en cas de panne.txt", RESTORE, "text/plain");
      try { localStorage.setItem("entremis-app-drive-on", "1"); } catch (_) {}
      BACK().put({ id: "b" + Date.now().toString(36), at: now, by: S.who, rows: rows.length });
      TM().haptic("done"); EM().toast(`Sauvegarde faite : ${rows.length} lignes dans le Drive commun.`);
    } catch (e) {
      EM().toast(e && e.status === 403 ? "Google refuse l'accès au Drive : activez l'API Google Drive et ajoutez le droit « drive » (voir le guide)." : e && e.status === 404 ? "Dossier introuvable : vérifiez le lien et qu'il est partagé avec vous." : "La sauvegarde n'a pas marché. Réessayez.");
    }
    X.busy = false; EM().render();
  }
  // L'alerte « sauvegarde à faire » (Notifications de l'équipe)
  function backupDue() { if (!(window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on())) return null; const lb = lastBackup(); return !lb || days(lb.at, today()) >= 7 ? (lb ? days(lb.at, today()) : -1) : null; }

  /* ---------- Clics et envois ---------- */
  function onClick(e, S, render) {
    const t = e.target.closest("[data-pl-step],[data-pl-shoot],[data-pl-close],[data-pl-ad],[data-pl-ad-del],[data-pl-doc],[data-pl-doc-back],[data-pl-doc-edit],[data-pl-doc-del],[data-pl-drive],[data-pl-backup]"); if (!t) return false;
    const d = t.dataset;
    if (d.plStep) { const [cid, k] = d.plStep.split(":"), f = flowOf(cid), cur = (f.steps[k] || {}).state || "todo", next = { todo: "doing", doing: "done", done: "todo" }[cur];
      putFlow(cid, { steps: Object.assign({}, f.steps, { [k]: { state: next, at: next === "todo" ? "" : today() } }) }); TM().haptic(next === "done" ? "done" : "tap"); render(); return true; }
    if (d.plShoot) { X.sheet = "shoot"; X.id = d.plShoot; render(); return true; }
    if ("plClose" in d) { X.sheet = null; X.id = null; render(); return true; }
    if (d.plAd) { X.sheet = "ad"; X.id = d.plAd; render(); return true; }
    if (d.plAdDel) { EM().confirm({ title: "Supprimer cette pub ?", text: "La ligne disparaît du suivi.", ok: "Supprimer", danger: true }).then(y => { if (!y) return; ADS().remove(d.plAdDel); X.sheet = null; TM().haptic("warn"); render(); }); return true; }
    if (d.plDoc) { X.doc = d.plDoc; X.q = ""; render(); window.scrollTo(0, 0); return true; }
    if ("plDocBack" in d) { X.doc = null; render(); return true; }
    if (d.plDocEdit) { X.sheet = "doc"; X.id = d.plDocEdit; render(); return true; }
    if (d.plDocDel) { EM().confirm({ title: "Supprimer ce document ?", text: "Pour toute l'équipe. Une copie reste dans la dernière sauvegarde du Drive.", ok: "Supprimer", danger: true }).then(y => { if (!y) return; REFS().remove(d.plDocDel); X.sheet = null; X.doc = null; render(); }); return true; }
    if ("plDrive" in d) { const cur = (BACK().list.find(b => b.id === "drive") || {}).url || ""; const v = window.prompt("Lien du dossier Google Drive partagé (copié depuis la barre d'adresse du dossier)", cur); if (v == null) return true;
      if (v.trim() && !folderId(v)) { EM().toast("Ce lien n'est pas celui d'un dossier Drive."); return true; }
      BACK().put({ id: "drive", url: v.trim(), by: S.who, at: new Date().toISOString().slice(0, 16) }); render(); EM().toast(v.trim() ? "Dossier enregistré pour toute l'équipe." : "Dossier retiré."); return true; }
    if ("plBackup" in d) { backup(S); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    const id = e.target.getAttribute && e.target.getAttribute("id"); if (!["pl-shoot-form", "pl-ad-form", "pl-doc-form"].includes(id)) return false;
    e.preventDefault();
    const fd = new FormData(e.target), v = n => String(fd.get(n) || "").trim(), num = n => Number(fd.get(n)) || 0, now = new Date().toISOString().slice(0, 16);
    if (id === "pl-shoot-form") {
      putFlow(X.id, { rachat: num("rachat") || 2000, shoot: { ...(flowOf(X.id).shoot || {}), date: v("date"), place: v("place"), host: v("host"), tech: v("tech"), witness: v("witness"), consents: num("consents"), videos: num("videos"), hooks: num("hooks"), franceRenov: !!fd.get("franceRenov"), rge: !!fd.get("rge"), noAmount: !!fd.get("noAmount") } });
      EM().toast("Tournage enregistré.");
    }
    if (id === "pl-ad-form") {
      if (!v("name")) { EM().toast("Donnez un nom à la pub."); return true; }
      const cur = X.id.startsWith("new:") ? { id: "ad" + Date.now().toString(36), client_id: X.id.slice(4) } : ADS().list.find(x => x.id === X.id);
      ADS().put(Object.assign({}, cur, { name: v("name"), angle: v("angle"), series: num("series") || 1, start: v("start"), spent: num("spent"), leads: num("leads"), state: v("state") || "on", by: S.who, updatedAt: now }));
      const r = rule(ADS().list.find(x => x.id === cur.id) || {}); EM().toast(r ? r + "." : "Pub enregistrée.");
    }
    if (id === "pl-doc-form") {
      if (!v("title")) { EM().toast("Donnez un titre au document."); return true; }
      const cur = X.id === "new" ? { id: "ref" + Date.now().toString(36) } : REFS().list.find(x => x.id === X.id) || { id: X.id };
      REFS().put(Object.assign({}, cur, { title: v("title"), what: v("what"), text: String(fd.get("text") || ""), by: S.who, updatedAt: now }));
      X.doc = cur.id; EM().toast("Document enregistré pour toute l'équipe.");
    }
    X.sheet = null; X.id = null; TM().haptic("done"); render(); return true;
  }
  document.addEventListener("input", e => { if (!e.target.matches || !e.target.matches("[data-pl-doc-q]")) return; X.q = e.target.value; const pos = e.target.selectionStart; EM().render(); const i = document.querySelector("[data-pl-doc-q]"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} } });
  function sheet(S) { return X.sheet === "shoot" ? shootSheet() : X.sheet === "ad" ? adSheet() : X.sheet === "doc" ? docSheet(S) : ""; }

  window.ENTREMIS_PILOT = { addAd: a => ADS().put(a), ads: () => ADS().list, flows: () => FLOW().list, putFlow, flowCard, adsCard, riskPanel, viewDocs, backupRows, backupDue, sheet, onClick, onSubmit, rule, flowOf, engagement,
    init: render => [FLOW, ADS, REFS, BACK].forEach(s => s().init(render)), reset: () => { X.sheet = null; X.id = null; X.doc = null; X.q = ""; } };
})();
