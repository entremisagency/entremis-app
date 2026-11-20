/* Entremis — la webapp branchée sur Supabase (le site en ligne).
   Actif sur le site publié (GitHub Pages, ou une adresse à nous), ou avec ?cloud=1 pour essayer ailleurs ; ?cloud=0 l'éteint.
   Ailleurs (claude.ai, aperçu sur ce Mac), rien ne change : les données restent celles de la maquette.
   Ce qu'il fait :
   - un écran de connexion (adresse e-mail et mot de passe, un compte par personne) ;
   - la personne connectée est reconnue (table members : Marc, Richard ou Gianni) ;
   - les données partagées (table docs) se lisent et s'écrivent en temps réel, rangées par collection comme dans la maquette ;
   - les données de chacun (table private_docs : ses connexions IA, MCP, bots) ne sont lues que par lui.
   Seule la clé « publishable » est ici : elle est faite pour être publique. La sécurité vient des règles de la base (schema.sql). */
(function () {
  "use strict";
  const URL_ = "https://cnhxrhyugghigkozfpde.supabase.co";
  const KEY = "sb_publishable_85-eC1adPGzOvLtAhLPonw_2HJwrdYX";
  const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const EM = () => window.EM;

  // Allumé ou pas : ?cloud=1 / ?cloud=0 (gardé pour la visite), sinon allumé seulement sur le site publié
  const on = (() => {
    try {
      const q = new URLSearchParams(location.search).get("cloud");
      if (q === "1" || q === "0") sessionStorage.setItem("entremis-cloud", q);
      const s = sessionStorage.getItem("entremis-cloud");
      if (s) return s === "1";
    } catch (_) {}
    const inClaude = typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";
    return !inClaude && (/\.github\.io$/.test(location.hostname) || /(^|\.)entremis\./.test(location.hostname));
  })();

  // Site en ligne : la vraie date et la vraie heure (la maquette, elle, reste figée au jeudi 19 novembre, 10 h 40)
  if (on) {
    const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const p2 = n => String(n).padStart(2, "0"), isoOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const clock = () => {
      const n = new Date(), D_ = window.ENTREMIS_DATA;
      D_.today = { iso: isoOf(n), label: `${JOURS[n.getDay()]} ${n.getDate()} ${MOIS[n.getMonth()]}`, now: `${p2(n.getHours())}:${p2(n.getMinutes())}`, nowMinutes: n.getHours() * 60 + n.getMinutes() };
      const mon = new Date(n); mon.setDate(n.getDate() - ((n.getDay() + 6) % 7));
      D_.weeks = [-7, 0, 7].map(k => { const a = new Date(mon); a.setDate(mon.getDate() + k); const b = new Date(a); b.setDate(a.getDate() + 4);
        return { start: isoOf(a), label: a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${MOIS[a.getMonth()]} – ${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}` }; });
    };
    clock(); setInterval(clock, 60000);
  }

  // Arrivée par le lien d'une invitation ou d'un « mot de passe oublié » : on le note avant que la bibliothèque nettoie l'adresse
  const LINK = (() => { const m = String(location.hash).match(/(?:^|[#&])type=(invite|recovery)/); return m ? m[1] : ""; })();
  let client = null, me = null, priv = {};
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });
  const loadLib = () => new Promise((ok, ko) => {
    if (window.supabase && window.supabase.createClient) return ok();
    const s = document.createElement("script"); s.src = LIB; s.onload = ok; s.onerror = () => ko(new Error("lib")); document.head.appendChild(s);
  });

  /* ---------- L'écran de connexion ----------
     Deux colonnes (Marc, 20 nov. 2026) : à gauche la photo d'un installateur, dans le bleu d'Entremis, avec ce que contient l'espace ;
     à droite le formulaire. Sur téléphone, la photo devient un bandeau au-dessus du formulaire.
     Pas de « créer un compte » : c'est Entremis qui crée les comptes. Pas de connexion Google pour l'instant. */
  let lastEmail = "";
  /* Connexion par identifiant (Marc, 20 nov. 2026) : « richard » suffit, en majuscules ou non.
     Supabase demande une adresse e-mail : on la fabrique sur l'adresse de l'app (prenom@entremisagency.github.io).
     Cette adresse ne reçoit aucun e-mail, personne ne peut s'en servir. Une vraie adresse e-mail marche aussi. */
  const LOGIN_DOMAIN = "entremisagency.github.io";
  const loginEmail = id => { const v = String(id || "").trim().toLowerCase().replace(/\s+/g, ""); return !v || v.includes("@") ? v : v + "@" + LOGIN_DOMAIN; };
  let pwMode = LINK;    // pourquoi on choisit un mot de passe : invitation, mot de passe oublié, ou premier passage
  let pwOk = false;     // mot de passe déjà choisi pendant cette visite
  const esc_ = v => EM() ? EM().esc(v) : String(v).replace(/[&<>"']/g, "");
  const ART = `<figure class="cg-art" aria-hidden="true">
      <img src="img/connexion.jpg" alt="" decoding="async">
      <div class="cg-art-logo"><svg aria-hidden="true"><use href="#logo-e"/></svg><span>ENTREMIS</span></div>
      <figcaption><span>Votre espace Entremis</span><b>Vos rendez-vous, vos demandes et vos résultats, au même endroit.</b></figcaption>
    </figure>`;
  function shell(form) {
    let g = document.getElementById("cloud-gate");
    if (!g) { g = document.createElement("div"); g.id = "cloud-gate"; document.body.appendChild(g); }
    g.innerHTML = `<div class="cg-shell">${ART}${form}</div>`;
    return g;
  }
  // Un champ mot de passe avec l'œil pour l'afficher
  const pwField = (name, label, auto, extra) => `<label class="field"><span>${label}</span><span class="cg-pw">
      <input name="${name}" type="password" required autocomplete="${auto}"${extra || ""}>
      <button class="cg-eye" type="button" data-cloud-eye aria-label="Afficher le mot de passe" aria-pressed="false"><svg class="icon" aria-hidden="true"><use href="#i-eye"/></svg></button></span></label>`;
  const msgLine = (msg, kind) => msg ? `<p class="cg-msg${kind === "ok" ? " is-ok" : ""}" role="alert">${esc_(msg)}</p>` : "";
  function gate(msg, kind) {
    const g = shell(`<form class="cg-card" id="cloud-login" autocomplete="on">
      <svg class="cg-mark" aria-hidden="true"><use href="#logo-e"/></svg>
      <div class="cg-head"><h1 class="cg-title">Connexion</h1><p class="cg-sub">Votre identifiant et votre mot de passe.</p></div>
      <label class="field"><span>Identifiant</span><input name="email" type="text" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc_(lastEmail)}"></label>
      ${pwField("password", "Mot de passe", "current-password")}
      ${msgLine(msg, kind)}
      <button class="btn btn-primary cg-go" type="submit">Se connecter</button>
      <button class="link cg-forgot" type="button" data-cloud-forgot>Mot de passe oublié</button>
      <p class="cg-foot">Pas de compte ? Votre contact Entremis vous le crée.</p>
    </form>`);
    const i = g.querySelector(lastEmail ? 'input[name="password"]' : 'input[name="email"]'); if (i) i.focus();
  }
  const closeGate = () => { const g = document.getElementById("cloud-gate"); if (g) g.remove(); };
  // Choisir son mot de passe : au premier passage (le mot de passe provisoire ne sert qu'une fois), après une invitation ou un oubli
  function passwordGate(msg) {
    const first = pwMode === "first";
    const g = shell(`<form class="cg-card" id="cloud-password">
      <svg class="cg-mark" aria-hidden="true"><use href="#logo-e"/></svg>
      <div class="cg-head"><h1 class="cg-title">${first ? "Votre mot de passe" : pwMode === "invite" ? "Bienvenue" : "Nouveau mot de passe"}</h1><p class="cg-sub">${first ? "Le mot de passe provisoire ne sert qu'une fois. Choisissez le vôtre : 8 caractères au moins." : "Choisissez votre mot de passe : 8 caractères au moins."}</p></div>
      ${pwField("password", "Mot de passe", "new-password", ' minlength="8"')}
      ${pwField("again", "Encore une fois", "new-password", ' minlength="8"')}
      ${msgLine(msg)}
      <button class="btn btn-primary cg-go" type="submit">Enregistrer et entrer</button>
    </form>`);
    const i = g.querySelector('input[name="password"]'); if (i) i.focus();
  }
  // L'œil : afficher ou masquer le mot de passe (écran de connexion et réglages)
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-cloud-eye]"); if (!b) return;
    e.preventDefault();
    const i = b.parentElement.querySelector("input"); if (!i) return;
    const show = i.type === "password";
    i.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", String(show));
    b.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    const u = b.querySelector("use"); if (u) u.setAttribute("href", show ? "#i-eye-off" : "#i-eye");
    i.focus();
  });

  async function afterLogin(session) {
    const { data, error } = await client.from("members").select("who, role, client_id").eq("user_id", session.user.id).maybeSingle();
    if (error || !data) { gate("Ce compte n'est pas encore activé. Demandez à Marc de l'ajouter à l'équipe (dernière étape du fichier schema.sql)."); return; }
    me = { id: session.user.id, email: session.user.email, who: data.who, role: data.role, client: data.client_id };
    // Premier passage : le mot de passe provisoire donné par Marc ne sert qu'une fois, on en choisit un à soi
    const provisional = String(session.user.email || "").endsWith("@" + LOGIN_DOMAIN);   // compte à identifiant : mot de passe donné par Marc
    if (provisional && !pwOk && !((session.user && session.user.user_metadata) || {}).pw_set) { pwMode = "first"; passwordGate(""); return; }
    const p = await client.from("private_docs").select("collection, id, data");
    priv = {}; (p.data || []).forEach(r => { priv[r.collection + "/" + r.id] = r.data; });
    closeGate(); readyResolve(me);
  }

  async function start() {
    if (!on) return;
    document.documentElement.classList.add("is-cloud");
    gate("Connexion à la base…", "ok");
    try { await loadLib(); } catch (_) { gate("La base ne répond pas. Vérifiez la connexion, puis rechargez la page."); return; }
    client = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await client.auth.getSession();
    if (data && data.session && LINK) { passwordGate(""); return; }
    if (data && data.session) await afterLogin(data.session);
    else gate(LINK ? "Ce lien n'est plus valable. Demandez une nouvelle invitation, ou « Mot de passe oublié »." : "");
  }

  document.addEventListener("submit", async e => {
    if (e.target.id !== "cloud-login") return;
    e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(e.target), btn = e.target.querySelector(".cg-go");
    lastEmail = String(fd.get("email") || "").trim();
    if (btn) { btn.disabled = true; btn.textContent = "Connexion…"; }
    const { data, error } = await client.auth.signInWithPassword({ email: loginEmail(fd.get("email")), password: String(fd.get("password") || "") });
    if (error || !data.session) { gate(/invalid/i.test(error ? error.message : "") ? "Identifiant ou mot de passe incorrect." : "La connexion n'a pas marché. Réessayez."); return; }
    await afterLogin(data.session);
  }, true);
  document.addEventListener("submit", async e => {
    if (e.target.id !== "cloud-password") return;
    e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(e.target), pw = String(fd.get("password") || ""), again = String(fd.get("again") || "");
    if (pw.length < 8) { passwordGate("8 caractères au moins."); return; }
    if (pw !== again) { passwordGate("Les deux mots de passe ne sont pas les mêmes."); return; }
    const { error } = await client.auth.updateUser({ password: pw, data: { pw_set: true } });
    if (error) { passwordGate(/same_password|different from the old/i.test(String(error.code || "") + " " + String(error.message || "")) ? "Choisissez un mot de passe différent du provisoire." : "Le mot de passe n'a pas été enregistré. Réessayez."); return; }
    pwOk = true;
    if (LINK) history.replaceState(null, "", location.pathname + location.search);   // on retire le lien de l'adresse
    const { data } = await client.auth.getSession();
    if (data && data.session) await afterLogin(data.session); else gate("Mot de passe enregistré. Connectez-vous.", "ok");
  }, true);
  document.addEventListener("click", async e => {
    if (!e.target.closest("[data-cloud-forgot]")) return;
    const f = document.getElementById("cloud-login"), email = f ? String(new FormData(f).get("email") || "").trim() : "";
    lastEmail = email;
    if (!email) { gate("Écrivez d'abord votre identifiant, puis « Mot de passe oublié »."); return; }
    if (!email.includes("@")) { gate("Demandez à votre contact Entremis un nouveau mot de passe provisoire.", "ok"); return; }
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) { gate("L'e-mail n'a pas pu partir. Demandez un nouveau mot de passe à votre contact Entremis."); return; }
    gate("Si cette adresse a un compte, un e-mail vient de partir pour choisir un nouveau mot de passe.", "ok");
  });

  /* ---------- Les collections partagées (même usage que la base de la maquette) ---------- */
  function collection(name) {
    return {
      // Lit tout, puis suit les changements en temps réel
      async subscribe(onRows, onError) {
        await ready;
        let rows = [];
        const { data, error } = await client.from("docs").select("id, data").eq("collection", name);
        if (error) { onError && onError(error); return; }
        rows = (data || []).map(r => Object.assign({ id: r.id }, r.data)); onRows(rows);
        client.channel("docs-" + name)
          .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "collection=eq." + name }, p => {
            if (p.eventType === "DELETE") rows = rows.filter(r => r.id !== (p.old && p.old.id));
            else { const r = Object.assign({ id: p.new.id }, p.new.data), i = rows.findIndex(x => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); }
            onRows(rows.slice());
          }).subscribe();
      },
      async set(id, data) {
        const owner = data && data.client_id ? data.client_id : name === "leads" && data && data.to ? data.to : null;
        const { error } = await client.from("docs").upsert({ collection: name, id, data, client_id: owner });
        if (error) throw error;
      },
      async remove(id) {
        const { error } = await client.from("docs").delete().eq("collection", name).eq("id", id);
        if (error) throw error;
      }
    };
  }

  /* ---------- Les données de chacun ---------- */
  const privGet = (col, id) => priv[col + "/" + id];
  async function privSet(col, id, data) {
    priv[col + "/" + id] = data;
    const { error } = await client.from("private_docs").upsert({ collection: col, id, data });
    if (error && EM()) EM().toast("Pas enregistré : la base n'a pas répondu. Réessayez.");
  }

  async function changePassword(current, next) {
    if (!client || !me) return "off";
    const a = await client.auth.signInWithPassword({ email: me.email, password: current });
    if (a.error) return "current";
    const { error } = await client.auth.updateUser({ password: next, data: { pw_set: true } });
    if (!error) return "";
    const m = String(error.code || "") + " " + String(error.message || "");
    return /same_password|different from the old/i.test(m) ? "same" : /weak|short|at least/i.test(m) ? "weak" : "other";
  }

  // Pour la page Accès clients (équipe) : les comptes, et les fonctions de la base (créer, réinitialiser, retirer un accès)
  async function listMembers() { await ready; if (!client) return []; const { data, error } = await client.from("members").select("user_id, who, role, client_id, created_at"); return error ? [] : (data || []); }
  async function rpc(fn, args) { if (!client) return { error: { message: "Pas connecté." } }; return client.rpc(fn, args); }

  async function signOut() { if (client) await client.auth.signOut(); try { sessionStorage.removeItem("entremis-cloud"); } catch (_) {} location.reload(); }

  window.ENTREMIS_CLOUD = { on: () => on, ready: () => ready, me: () => me, collection, privGet, privSet, changePassword, listMembers, rpc, signOut, start };
  if (on) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
})();
