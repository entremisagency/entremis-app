/* Entremis — #acces : les accès des clients à leur espace (Marc, 20 nov. 2026).
   L'équipe crée l'accès d'un client (existant ou nouveau) : un identifiant et un mot de passe provisoire.
   Le client se connecte avec son identifiant ; à la première connexion, l'app lui fait choisir son mot de passe.
   Sur le site en ligne, la création passe par des fonctions de la base (schema.sql, « 6 bis ») réservées à l'équipe :
   la clé secrète ne quitte jamais Supabase. Le mot de passe provisoire n'est gardé nulle part dans l'app.
   Les nouveaux clients vont dans la collection partagée « clients » (nom, métier) ; chaque client lit la sienne. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  const CL = () => window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? window.ENTREMIS_CLOUD : null;
  const X = { pick: "", login: "", name: "", trade: "", contact: "", err: "", busy: false, done: null, reset: null, members: null, loading: false };
  let ST = null;
  const CLIENTS = () => ST || (ST = OPS().makeStore("clients", () => []));

  // Un identifiant propre : minuscules, sans accent ni espace (« Thermo Rhône » devient « thermo-rhone »)
  const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const LOGIN_OK = /^[a-z0-9][a-z0-9._-]{1,39}$/;
  const appUrl = () => location.origin + location.pathname;
  const initials = n => String(n || "?").split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase();

  // Les clients ajoutés depuis l'app (en plus de ceux de la maquette)
  const extra = () => CLIENTS().list.filter(c => c && c.id && c.name);
  const clientName = id => { const c = EM().allClients().find(x => x.id === id); return c ? c.name : id; };

  async function loadMembers(render) {
    const c = CL(); if (!c || X.loading) return;
    X.loading = true;
    const rows = await c.listMembers();
    X.members = rows.filter(r => r.role === "client").sort((a, b) => String(b.created_at || "") < String(a.created_at || "") ? -1 : 1);
    X.loading = false; render();
  }

  const pwInput = (name, label) => `<label class="field"><span>${label}</span><span class="cg-pw"><input name="${name}" type="password" required minlength="6" autocomplete="new-password"><button class="cg-eye" type="button" data-cloud-eye aria-label="Afficher le mot de passe" aria-pressed="false">${EM().icon("eye")}</button></span></label>`;

  function shareBox(d) {
    const esc = EM().esc, icon = EM().icon;
    const text = `Bonjour, voici votre espace Entremis : ${appUrl()}\nIdentifiant : ${d.login}\nJe vous donne le mot de passe provisoire par téléphone. Vous choisirez le vôtre à la première connexion.`;
    const enc = encodeURIComponent(text);
    return `<section class="card ac-done" role="status">
      <div class="card-head"><h2 class="h2">${icon("check")}Accès créé pour ${esc(d.name)}</h2><button class="link" type="button" data-ac-done-close>Fermer</button></div>
      <p class="body">Identifiant : <b>${esc(d.login)}</b>. Donnez-lui le mot de passe provisoire de vive voix ou par SMS, à part. Il en choisira un à la première connexion.</p>
      <div class="ac-share">
        <a class="btn btn-ghost" href="sms:?&body=${enc}">${icon("chat")}SMS</a>
        <a class="btn btn-ghost" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">${icon("wa")}WhatsApp</a>
        <a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent("Votre espace Entremis")}&body=${enc}">${icon("mail")}E-mail</a>
        <button class="btn btn-ghost" type="button" data-copy="${esc(text)}">${icon("copy")}Copier le message</button>
      </div>
    </section>`;
  }

  function resetSheet() {
    if (!X.reset) return "";
    const esc = EM().esc;
    return `<div class="scrim" data-ac-reset-close></div>
    <form class="sheet" id="ac-reset" aria-label="Nouveau mot de passe provisoire" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-ac-reset-close>Annuler</button><b>Nouveau mot de passe</b><button class="link strong" type="submit">Enregistrer</button></div>
      <p class="body">Pour <b>${esc(X.reset)}</b>. Il s'en servira une fois, puis choisira le sien.</p>
      ${pwInput("password", "Mot de passe provisoire")}
      <p class="cg-msg ac-reset-msg" role="alert" hidden></p>
      <p class="field-help">6 caractères au moins. Donnez-le-lui de vive voix ou par SMS.</p>
    </form>`;
  }

  function view(S, render) {
    const esc = EM().esc, icon = EM().icon, cloud = !!CL();
    if (cloud && X.members === null && !X.loading) setTimeout(() => loadMembers(EM().render), 0);
    const clients = EM().allClients();
    const isNew = X.pick === "__new";
    const picked = clients.find(c => c.id === X.pick);
    const opts = [["", "Choisir un client"]].concat(clients.map(c => [c.id, c.name]), [["__new", "Un nouveau client"]]);
    const trades = (window.ENTREMIS_SECTORS && window.ENTREMIS_SECTORS.list ? window.ENTREMIS_SECTORS.list() : []).map(s => s.name || s.label).filter(Boolean);
    const login = X.login || (picked ? picked.id : isNew ? slug(X.name) : "");
    const list = X.members || [];
    const rows = list.map(m => `<li class="ac-row">
        <span class="av av-md">${esc(initials(clientName(m.client_id)))}</span>
        <span><b>${esc(clientName(m.client_id))}</b><small>Identifiant : ${esc(m.who || "")}${m.created_at ? " – depuis le " + new Date(m.created_at).toLocaleDateString("fr-FR") : ""}</small></span>
        <span class="ac-acts">
          <button class="btn btn-ghost" type="button" data-ac-view="${esc(m.client_id || "")}">${icon("eye")}Son espace</button>
          <button class="btn btn-ghost" type="button" data-ac-reset="${esc(m.who || "")}">${icon("lock")}Mot de passe</button>
          <button class="link ac-del" type="button" data-ac-del="${esc(m.who || "")}" data-ac-name="${esc(clientName(m.client_id))}">Retirer</button>
        </span>
      </li>`).join("");
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Accès clients</h1>
      <p class="sub">Ouvrez à un client son espace : ses rendez-vous, ses demandes et ses résultats. Il se connecte avec un identifiant, et choisit son mot de passe à la première connexion.</p></div></div>
    ${X.done ? shareBox(X.done) : ""}
    <div class="ac-grid">
      <form class="card" id="ac-form" autocomplete="off" novalidate>
        <div class="card-head"><h2 class="h2">Nouvel accès</h2></div>
        <div class="field"><label for="ac-pick">Client</label><select id="ac-pick" data-fsel="ac-pick">${opts.map(([v, l]) => `<option value="${esc(v)}"${X.pick === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        ${isNew ? `<div class="field-row">
            <label class="field"><span>Nom de l'entreprise</span><input name="name" required maxlength="80" value="${esc(X.name)}" placeholder="Ex. : Durand Énergie"></label>
            <div class="field"><label for="ac-trade">Métier</label><select id="ac-trade" name="trade">${trades.map(t => `<option${X.trade === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
          </div>
          <label class="field"><span>Personne à contacter (facultatif)</span><input name="contact" maxlength="80" value="${esc(X.contact)}" placeholder="Prénom et nom"></label>` : ""}
        <label class="field"><span>Identifiant</span><input name="login" maxlength="40" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(login)}" placeholder="${isNew ? "Tiré du nom si vous le laissez vide" : ""}"><small class="field-help">Ce que le client tapera pour se connecter : minuscules, sans espace ni accent.</small></label>
        ${pwInput("password", "Mot de passe provisoire")}
        ${X.err ? `<p class="cg-msg" role="alert">${esc(X.err)}</p>` : ""}
        <div class="form-actions"><button class="btn btn-primary" type="submit"${X.busy ? " disabled" : ""}>${icon("lock")}${X.busy ? "Création…" : "Créer l'accès"}</button></div>
        <p class="field-help">${cloud ? "Le mot de passe provisoire n'est gardé nulle part dans l'app : donnez-le au client de vive voix ou par SMS." : "Maquette : la création d'un accès se fait sur le site en ligne, dans la vraie base."}</p>
      </form>
      <section class="card">
        <div class="card-head"><h2 class="h2">Accès ouverts <span class="muted tabnum">${list.length}</span></h2>${cloud ? `<button class="link" type="button" data-ac-refresh>Actualiser</button>` : ""}</div>
        ${!cloud ? `<p class="body">Sur le site en ligne, les accès de vos clients s'affichent ici.</p>`
          : X.members === null ? `<p class="body">Chargement…</p>`
          : list.length ? `<ul class="ac-list">${rows}</ul>` : `<p class="body">Aucun accès pour l'instant.</p>`}
      </section>
    </div>
    ${resetSheet()}`;
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-ac-pick],[data-ac-view],[data-ac-reset],[data-ac-reset-close],[data-ac-del],[data-ac-refresh],[data-ac-done-close]");
    if (!t) return false;
    const d = t.dataset;
    if (d.acPick !== undefined) { X.pick = d.acPick; X.login = ""; X.err = ""; render(); return true; }
    if (d.acView !== undefined) { EM().pickClient(d.acView); return true; }
    if (d.acReset !== undefined && !("acResetClose" in d)) { X.reset = d.acReset; render(); setTimeout(() => { const i = document.querySelector('#ac-reset input[name="password"]'); if (i) i.focus(); }, 60); return true; }
    if ("acResetClose" in d) { X.reset = null; render(); return true; }
    if ("acRefresh" in d) { X.members = null; render(); return true; }
    if ("acDoneClose" in d) { X.done = null; render(); return true; }
    if (d.acDel !== undefined) {
      const login = d.acDel, name = d.acName || login;
      EM().confirm({ title: `Retirer l'accès de ${name} ?`, text: "Il ne pourra plus se connecter. Ses rendez-vous, résultats et demandes restent dans l'app.", ok: "Retirer" }).then(async ok => {
        if (!ok) return;
        const { error } = await CL().rpc("retirer_acces_client", { p_login: login });
        if (error) { EM().toast(error.message || "L'accès n'a pas pu être retiré."); return; }
        TM().haptic("warn"); EM().toast(`Accès de ${name} retiré.`); X.members = null; render();
      });
      return true;
    }
    return false;
  }

  function onSubmit(e, S, render) {
    if (e.target.id === "ac-reset") {
      e.preventDefault();
      const f = e.target, pw = String(new FormData(f).get("password") || ""), say = m => { const p = f.querySelector(".ac-reset-msg"); p.textContent = m; p.hidden = false; };
      if (pw.length < 6) { say("6 caractères au moins."); return true; }
      const go = f.querySelector('button[type="submit"]'); go.disabled = true; go.textContent = "Envoi…";
      CL().rpc("nouveau_mot_de_passe_client", { p_login: X.reset, p_password: pw }).then(({ error }) => {
        if (error) { go.disabled = false; go.textContent = "Enregistrer"; say(error.message || "Pas enregistré. Réessayez."); return; }
        const who = X.reset; X.reset = null; TM().haptic("done"); render(); EM().toast(`Nouveau mot de passe provisoire pour ${who}. Il en choisira un à la connexion.`);
      });
      return true;
    }
    if (e.target.id !== "ac-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), isNew = X.pick === "__new", clients = EM().allClients();
    const name = isNew ? String(fd.get("name") || "").trim() : (clients.find(c => c.id === X.pick) || {}).name || "";
    const trade = isNew ? String(fd.get("trade") || "") : "", contact = isNew ? String(fd.get("contact") || "").trim() : "";
    const login = slug(String(fd.get("login") || "").trim() || (isNew ? name : X.pick)).replace(/-+/g, "-");
    const pw = String(fd.get("password") || "");
    X.name = isNew ? name : ""; X.trade = trade; X.contact = contact; X.login = String(fd.get("login") || "");
    const fail = m => { X.err = m; render(); return true; };
    if (!X.pick) return fail("Choisissez d'abord le client.");
    if (isNew && !name) return fail("Écrivez le nom de l'entreprise.");
    if (!LOGIN_OK.test(login)) return fail("Identifiant : 2 caractères au moins, lettres et chiffres, sans espace ni accent.");
    if (pw.length < 6) return fail("Mot de passe provisoire : 6 caractères au moins.");
    const cid = isNew ? (slug(name) || login) : X.pick;
    if (isNew && clients.some(c => c.id === cid)) return fail("Ce client existe déjà : choisissez-le dans la liste.");
    if (!CL()) { X.err = ""; render(); EM().toast("Maquette : sur le site en ligne, l'accès serait créé dans la base."); return true; }
    X.busy = true; X.err = ""; render();
    CL().rpc("creer_acces_client", { p_login: login, p_password: pw, p_client: cid }).then(async ({ error }) => {
      X.busy = false;
      if (error) { X.err = error.message || "L'accès n'a pas pu être créé. Réessayez."; render(); return; }
      if (isNew) await CLIENTS().put(Object.assign({ id: cid, client_id: cid, name, trade, createdAt: new Date().toISOString().slice(0, 16) }, contact ? { contact, contactRole: "Gérant" } : {}));
      X.done = { login, name }; X.pick = ""; X.login = ""; X.name = ""; X.trade = ""; X.contact = ""; X.members = null;
      TM().haptic("done"); render();
    });
    return true;
  }

  window.ENTREMIS_ACCESS = {
    view: S => view(S, EM().render), onClick, onSubmit, extra,
    init: render => CLIENTS().init(render),
    reset: () => { X.reset = null; X.err = ""; }
  };
})();
