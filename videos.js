/* Entremis — les vidéos des pubs, du montage à la mise en ligne (Marc, 23 nov. 2026).
   Une fiche par vidéo : le lien où elle se trouve (Drive, WeTransfer, Dropbox…), le client, le nom standard de la pub, l'accroche,
   la série, le texte à poster, quand, qui poste, et les vérifications obligatoires (France Rénov', RGE, aucun montant d'aide).
   Trois colonnes : à monter, prête à poster, en ligne. Une vidéo prête avec quelqu'un pour la poster lui crée une tâche
   (avec le lien et le texte) ; passée « en ligne », elle s'ajoute aux pubs en cours du client, surveillées par les règles d'arrêt.
   Collection « videos » (équipe seulement). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team, TM = () => window.ENTREMIS_TEAM;
  let ST = null; const VID = () => ST || (ST = OPS().makeStore("videos", () => []));
  const X = { sheet: null, id: null, client: "", col: "pret" };
  const COLS = [["monter", "À monter"], ["pret", "Prête à poster"], ["ligne", "En ligne"]];
  const today = () => window.ENTREMIS_DATA.today.iso;
  const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
  const fr = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${iso.length > 10 ? " à " + iso.slice(11, 16) : ""}` : "";
  const okUrl = u => /^https:\/\/[^\s]+$/i.test(String(u || "").trim());
  const clientName = id => (EM().allClients().find(c => c.id === id) || {}).name || "";
  const CHECKS = [["franceRenov", "Mention France Rénov' exacte en bandeau"], ["rge", "RGE et « PAC agréée » visibles"], ["noAmount", "Aucun montant d'aide, ni « 1 € », ni « MaPrimeRénov' »"]];
  const allChecked = v => CHECKS.every(([k]) => v[k]);
  // Le nom standard d'une pub (le même que dans « Pubs en cours » et le Gestionnaire de publicités)
  const stdName = (cid, angle, serie) => [String(clientName(cid) || "CLIENT").split(/\s+/)[0], "S" + (Number(serie) || 1), String(angle || "accroche").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 24)].join("_").toUpperCase();

  function card(v) {
    const esc = EM().esc, icon = EM().icon, who = v.poster ? TM().member(v.poster) : null, late = v.status === "pret" && v.when && v.when.slice(0, 10) < today();
    return `<li class="vd-card">
      <div class="vd-top"><b>${esc(v.name || "Vidéo")}</b>${v.status === "pret" && !allChecked(v) ? `<span class="state state-warn">À vérifier</span>` : ""}</div>
      <span class="vd-sub">${esc([clientName(v.client), v.angle, v.format].filter(Boolean).join(" · "))}</span>
      ${v.when ? `<span class="vd-when${late ? " is-late" : ""}">${icon("cal")}${v.status === "ligne" ? "En ligne le " + fr(v.postedAt || v.when) : "À poster le " + fr(v.when)}</span>` : ""}
      <div class="vd-foot">${who ? `<span class="who-inline">${TM().avatar(v.poster, "av")}${esc(who.name)}</span>` : `<span class="muted">À attribuer</span>`}
        <span class="vd-acts">${okUrl(v.url) ? `<a class="icon-btn" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="Ouvrir ou télécharger la vidéo ${esc(v.name || "")}" title="Ouvrir ou télécharger">${icon("download")}</a>` : ""}
          <button class="icon-btn" type="button" data-vd-edit="${esc(v.id)}" aria-label="Modifier ${esc(v.name || "")}">${icon("sliders")}</button>
          ${v.status === "monter" ? `<button class="btn btn-ghost btn-xs" type="button" data-vd-move="${esc(v.id)}:pret">Prête ${icon("arrow")}</button>` : v.status === "pret" ? `<button class="btn btn-ghost btn-xs" type="button" data-vd-move="${esc(v.id)}:ligne">En ligne ${icon("arrow")}</button>` : ""}</span></div>
    </li>`;
  }
  function view(S) {
    const esc = EM().esc, icon = EM().icon, narrow = EM().isNarrow();
    let list = VID().list.slice(); if (X.client) list = list.filter(v => v.client === X.client);
    list.sort((a, b) => String(a.when || "9").localeCompare(String(b.when || "9")));
    const n = k => list.filter(v => v.status === k).length, todayPosts = VID().list.filter(v => v.status === "pret" && String(v.when || "").slice(0, 10) === today());
    const col = ([k, l]) => { const items = list.filter(v => v.status === k); return `<section class="stage vd-col" aria-label="${l}"><header><b>${l}</b><span class="tabnum">${items.length}</span></header>
      ${items.length ? `<ul class="vd-list">${items.map(card).join("")}</ul>` : `<p class="col-empty">${k === "monter" ? "Aucune vidéo en montage." : k === "pret" ? "Rien à poster." : "Aucune vidéo en ligne."}</p>`}</section>`; };
    return `<div class="head"><div class="head-text"><h1 class="h1">Vidéos</h1><p class="sub">Du montage à la mise en ligne : le lien de chaque vidéo, son texte, qui la poste et quand.</p></div>
      <div class="head-actions"><button class="btn btn-primary" type="button" data-vd-new>${icon("plus")}Nouvelle vidéo</button></div></div>
      <div class="kpis kpis-4" role="list">
        <article class="kpi" role="listitem"><p class="kpi-label">À poster aujourd'hui</p><div><p class="kpi-value">${todayPosts.length}</p><p class="kpi-note">${todayPosts.length ? esc(todayPosts.map(v => v.name).slice(0, 2).join(", ")) : "rien de prévu"}</p></div></article>
        <article class="kpi" role="listitem"><p class="kpi-label">Prêtes à poster</p><div><p class="kpi-value">${n("pret")}</p><p class="kpi-note">${VID().list.filter(v => v.status === "pret" && !v.poster).length} sans personne pour poster</p></div></article>
        <article class="kpi" role="listitem"><p class="kpi-label">En montage</p><div><p class="kpi-value">${n("monter")}</p><p class="kpi-note">à finir</p></div></article>
        <article class="kpi" role="listitem"><p class="kpi-label">En ligne</p><div><p class="kpi-value">${n("ligne")}</p><p class="kpi-note">suivies dans « Pubs en cours »</p></div></article>
      </div>
      <div class="filters">${EM().fsel("vd-client", "Client", [["", "Tous les clients"]].concat(EM().allClients().map(c => [c.id, c.name])), X.client)}</div>
      ${narrow ? `<div class="seg seg-lg seg-full" role="group" aria-label="Étape">${COLS.map(([k, l]) => `<button type="button" data-vd-col="${k}" aria-pressed="${X.col === k}">${({ monter: "Montage", pret: "À poster", ligne: "En ligne" })[k]}${n(k) ? ` (${n(k)})` : ""}</button>`).join("")}</div>${col(COLS.find(c => c[0] === X.col))}`
        : `<div class="pipeline vd-board">${COLS.map(col).join("")}</div>`}`;
  }
  function sheet(S) {
    if (!X.sheet) return "";
    const esc = EM().esc, icon = EM().icon, v = X.id ? VID().list.find(x => x.id === X.id) || {} : { status: "pret", serie: 1, client: X.client || (EM().allClients()[0] || {}).id, format: "Vertical 9:16" };
    const f = (n, l, val, a) => `<label class="field"><span>${l}</span><input name="${n}" value="${esc(val == null ? "" : val)}" ${a || ""}></label>`;
    const sel = (n, l, opts, cur) => `<div class="field"><label>${l}</label><select name="${n}">${opts.map(([k, t]) => `<option value="${esc(k)}"${String(cur) === String(k) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
    return `<div class="scrim" data-vd-close></div><form class="sheet pl-sheet" id="vd-form" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-vd-close>Annuler</button><b>${X.id ? "La vidéo" : "Nouvelle vidéo"}</b><button class="link strong" type="submit">Enregistrer</button></div>
      ${f("url", "Lien de la vidéo (Drive, WeTransfer, Dropbox…)", v.url, 'type="url" inputmode="url" placeholder="https://…" required')}
      ${okUrl(v.url) ? `<a class="btn btn-ghost" href="${esc(v.url)}" target="_blank" rel="noopener">${icon("download")}Ouvrir ou télécharger la vidéo</a>` : ""}
      <div class="field-row">${sel("client", "Client", EM().allClients().map(c => [c.id, c.name]), v.client)}${sel("status", "Étape", COLS, v.status)}</div>
      <div class="field-row">${f("angle", "Accroche ou angle", v.angle, 'maxlength="60" placeholder="Ex. : facture divisée par 3"')}${f("serie", "Série", v.serie || 1, 'type="number" min="1" max="30"')}</div>
      ${f("name", "Nom de la pub (nommage standard)", v.name, 'maxlength="80" placeholder="Laissé vide : rempli tout seul"')}
      <div class="field-row">${sel("format", "Format", [["Vertical 9:16", "Vertical 9:16"], ["Carré 1:1", "Carré 1:1"], ["Long 1-2 min", "Long 1 à 2 min"], ["Horizontal 16:9", "Horizontal 16:9"]], v.format)}${sel("poster", "Qui la poste", [["", "Personne pour l'instant"]].concat(TD().members.map(m => [m.id, m.name])), v.poster || "")}</div>
      <div class="field-row">${f("whenDate", "À poster le", (v.when || "").slice(0, 10), 'type="date"')}${f("whenTime", "À", (v.when || "").slice(11, 16), 'type="time"')}</div>
      <label class="field"><span>Texte de la pub</span><textarea name="caption" rows="4" maxlength="2200" placeholder="Le texte au-dessus de la vidéo, et l'appel à l'action">${esc(v.caption || "")}</textarea></label>
      <p class="set-title">Vérifié avant de poster</p>
      ${CHECKS.map(([k, l]) => `<label class="check-line"><input type="checkbox" name="${k}" ${v[k] ? "checked" : ""}><span>${l}</span></label>`).join("")}
      <label class="field"><span>Note</span><input name="note" maxlength="200" value="${esc(v.note || "")}"></label>
      ${X.id ? `<div class="form-actions">${v.caption ? `<button class="btn btn-ghost" type="button" data-copy="${esc(v.caption)}">${icon("copy")}Copier le texte</button>` : ""}<button class="btn btn-ghost pr-danger" type="button" data-vd-del="${esc(v.id)}">${icon("trash")}Supprimer</button></div>` : ""}
    </form>`;
  }
  // Une vidéo prête, avec quelqu'un pour la poster : une tâche pour lui, avec le lien et le texte (une seule fois)
  function ensureTask(v, S) {
    if (v.status !== "pret" || !v.poster || v.taskId || !TM().addTask) return v;
    const t = { id: "t" + Date.now().toString(36), title: `Poster la vidéo ${v.name}`, desc: `Client : ${clientName(v.client)}\nLien : ${v.url}\n${v.caption ? "Texte : " + v.caption : ""}`.trim(), who: v.poster, client: clientName(v.client),
      status: "todo", due: (v.when || "").slice(0, 10), time: (v.when || "").slice(11, 16), createdAt: nowIso(), by: S.who, video: v.id };
    TM().addTask(t); return Object.assign({}, v, { taskId: t.id });
  }
  function goLive(v, S) {
    const done = Object.assign({}, v, { status: "ligne", postedAt: nowIso(), postedBy: S.who });
    if (window.ENTREMIS_PILOT && window.ENTREMIS_PILOT.addAd && !v.adId) { const id = "ad" + Date.now().toString(36); window.ENTREMIS_PILOT.addAd({ id, client_id: v.client, name: v.name, angle: v.angle || "", series: Number(v.serie) || 1, start: today(), spent: 0, leads: 0, state: "on", video: v.id, by: S.who }); done.adId = id; }
    if (v.taskId && TM().completeTask) TM().completeTask(v.taskId, S.who);
    return done;
  }
  function onClick(e, S, render) {
    const t = e.target.closest("[data-vd-new],[data-vd-edit],[data-vd-close],[data-vd-move],[data-vd-del],[data-vd-col],[data-vd-client]"); if (!t) return false;
    const d = t.dataset;
    if ("vdNew" in d) { X.sheet = "form"; X.id = null; render(); setTimeout(() => { const i = document.querySelector('#vd-form [name="url"]'); if (i) i.focus(); }, 60); return true; }
    if (d.vdEdit) { X.sheet = "form"; X.id = d.vdEdit; render(); return true; }
    if ("vdClose" in d) { X.sheet = null; X.id = null; render(); return true; }
    if (d.vdCol) { X.col = d.vdCol; render(); return true; }
    if (d.vdClient !== undefined) { X.client = d.vdClient; render(); return true; }
    if (d.vdMove) { const [id, st] = d.vdMove.split(":"), v = VID().list.find(x => x.id === id); if (!v) return true;
      if (st === "ligne" && !allChecked(v)) { X.sheet = "form"; X.id = id; render(); EM().toast("Avant de la mettre en ligne : cochez les trois vérifications obligatoires."); return true; }
      const next = st === "ligne" ? goLive(v, S) : ensureTask(Object.assign({}, v, { status: st }), S);
      VID().put(next); TM().haptic(st === "ligne" ? "done" : "tap"); render();
      EM().toast(st === "ligne" ? `En ligne : ajoutée aux pubs en cours de ${clientName(v.client)}.` : next.taskId && !v.taskId ? `Prête : tâche créée pour ${TM().member(next.poster).name}.` : "Prête à poster.");
      return true; }
    if (d.vdDel) { EM().confirm({ title: "Supprimer cette vidéo ?", text: "Seule la fiche disparaît : la vidéo reste là où est le lien.", ok: "Supprimer" }).then(y => { if (!y) return; VID().remove(d.vdDel); X.sheet = null; X.id = null; render(); }); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "vd-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), g = k => String(fd.get(k) || "").trim(), url = g("url");
    if (!okUrl(url)) { EM().toast("Collez le lien complet de la vidéo, qui commence par https://"); return true; }
    const cur = X.id ? VID().list.find(x => x.id === X.id) || {} : { id: "vd" + Date.now().toString(36), createdAt: nowIso(), by: S.who };
    let v = Object.assign({}, cur, { url, client: g("client"), status: g("status") || "pret", angle: g("angle"), serie: Number(g("serie")) || 1, format: g("format"), poster: g("poster"),
      when: g("whenDate") ? g("whenDate") + (g("whenTime") ? "T" + g("whenTime") : "") : "", caption: String(fd.get("caption") || "").trim(), note: g("note"), updatedAt: nowIso(), updatedBy: S.who });
    CHECKS.forEach(([k]) => { v[k] = !!fd.get(k); });
    v.name = g("name") || stdName(v.client, v.angle, v.serie);
    if (v.status === "ligne" && cur.status !== "ligne") { if (!allChecked(v)) { EM().toast("Avant de la mettre en ligne : cochez les trois vérifications obligatoires."); return true; } v = goLive(v, S); }
    const before = v.taskId; v = ensureTask(v, S);
    VID().put(v); X.sheet = null; X.id = null; TM().haptic("done"); render();
    EM().toast(v.taskId && !before ? `Enregistrée. Tâche créée pour ${TM().member(v.poster).name}, avec le lien et le texte.` : "Vidéo enregistrée pour toute l'équipe.");
    return true;
  }
  // Fiche client : le nombre de vidéos par étape
  function clientCount(cid) { const l = VID().list.filter(v => v.client === cid); return { monter: l.filter(v => v.status === "monter").length, pret: l.filter(v => v.status === "pret").length, ligne: l.filter(v => v.status === "ligne").length }; }
  window.ENTREMIS_VIDEOS = { view, sheet, onClick, onSubmit, clientCount, toPost: () => VID().list.filter(v => v.status === "pret"), init: render => VID().init(render), reset: () => { X.sheet = null; X.id = null; } };
})();
