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
    // Le service de l'app : il affiche les alertes (y compris sur iPhone, une fois l'app sur l'écran d'accueil)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
      navigator.serviceWorker.addEventListener("message", e => { if (e.data && typeof e.data.go === "string" && e.data.go) location.hash = e.data.go; });
    }
  }

  // Arrivée par le lien d'une invitation ou d'un « mot de passe oublié » : on le note avant que la bibliothèque nettoie l'adresse
  const LINK = (() => { const m = String(location.hash).match(/(?:^|[#&])type=(invite|recovery)/); return m ? m[1] : ""; })();
  let client = null, me = null, priv = {};
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });
  const loadLib = () => new Promise((ok, ko) => {
    if (window.supabase && window.supabase.createClient) return ok();
    const s = document.createElement("script"); s.crossOrigin = "anonymous"; s.integrity = "sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o"; s.src = LIB; s.onload = ok; s.onerror = () => ko(new Error("lib")); document.head.appendChild(s);
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
    g.classList.remove("is-splash");
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
  // L'écran d'ouverture : quand une session est gardée sur l'appareil, on ne montre jamais le formulaire pendant la vérification
  // (Marc, 23 nov. 2026 : « l'écran de connexion s'affiche 10 secondes puis disparaît »). Juste le logo et une ligne.
  function splash(msg) {
    let g = document.getElementById("cloud-gate");
    if (!g) { g = document.createElement("div"); g.id = "cloud-gate"; document.body.appendChild(g); }
    g.classList.add("is-splash");
    g.innerHTML = `<div class="cg-splash" role="status"><svg class="cg-splash-logo" aria-hidden="true"><use href="#logo-e"/></svg><span class="cg-splash-name">ENTREMIS</span><p>${esc_(msg || "Ouverture de votre espace…")}</p></div>`;
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

  /* ---------- Connexion en deux étapes (27 nov. 2026) ----------
     Pour qui l'a activée (Réglages › Connexion en deux étapes) : après le mot de passe, un code à 6 chiffres
     donné par une application du téléphone (Google Authenticator, 1Password, l'app Mots de passe de l'iPhone…).
     La base refuse aussi les données à une session qui n'a pas donné ce code (schema.sql, section 16) :
     un mot de passe volé ne suffit plus. */
  async function needsCode() {
    try { const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel(); return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2"; }
    catch (_) { return false; }
  }
  function codeGate(msg) {
    const g = shell(`<form class="cg-card" id="cloud-mfa" autocomplete="off">
      <svg class="cg-mark" aria-hidden="true"><use href="#logo-e"/></svg>
      <div class="cg-head"><h1 class="cg-title">Code de sécurité</h1><p class="cg-sub">Ouvrez votre application d'authentification et tapez le code à 6 chiffres d'Entremis.</p></div>
      <label class="field"><span>Code</span><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      ${msgLine(msg)}
      <button class="btn btn-primary cg-go" type="submit">Valider</button>
      <button class="link cg-forgot" type="button" data-cloud-other>Changer de compte</button>
    </form>`);
    const i = g.querySelector('input[name="code"]'); if (i) i.focus();
  }
  document.addEventListener("submit", async e => {
    if (e.target.id !== "cloud-mfa") return;
    e.preventDefault(); e.stopImmediatePropagation();
    const code = String(new FormData(e.target).get("code") || "").replace(/\D/g, ""), btn = e.target.querySelector(".cg-go");
    if (code.length !== 6) { codeGate("Le code fait 6 chiffres."); return; }
    if (btn) { btn.disabled = true; btn.textContent = "Vérification…"; }
    const { data: f } = await client.auth.mfa.listFactors(), factor = f && f.totp && f.totp[0];
    if (!factor) { codeGate("Aucune application reliée à ce compte. Demandez à Marc."); return; }
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) { codeGate(/rate|too many/i.test(String(error.message || "")) ? "Trop d'essais. Attendez quelques minutes." : "Ce code n'est pas le bon. Attendez le suivant et réessayez."); return; }
    const { data } = await client.auth.getSession();
    if (data && data.session) await afterLogin(data.session); else gate("Reconnectez-vous.");
  }, true);
  document.addEventListener("click", async e => {
    if (!e.target.closest("[data-cloud-other]")) return;
    try { await client.auth.signOut({ scope: "local" }); } catch (_) {}
    gate("");
  });
  // Pour les réglages : voir, activer, retirer l'application d'authentification
  async function mfaList() { if (!client) return []; const { data } = await client.auth.mfa.listFactors(); return (data && data.totp) || []; }
  async function mfaStart() {
    if (!client) return { error: "off" };
    const { data: all } = await client.auth.mfa.listFactors();   // un essai abandonné (QR jamais validé) est retiré avant d'en refaire un
    for (const f of ((all && all.all) || []).filter(x => x.factor_type === "totp" && x.status !== "verified")) await client.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Entremis " + new Date().toISOString().slice(0, 10) });
    if (error || !data) return { error: "enroll" };
    const qr = String(data.totp.qr_code || "");
    return { id: data.id, secret: data.totp.secret, uri: /^otpauth:\/\//.test(String(data.totp.uri || "")) ? data.totp.uri : "", qr: qr.startsWith("data:") ? qr : "data:image/svg+xml;utf-8," + encodeURIComponent(qr) };
  }
  async function mfaConfirm(id, code) { const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code }); return error ? "code" : ""; }
  async function mfaRemove(id) { const { error } = await client.auth.mfa.unenroll({ factorId: id }); return error ? "remove" : ""; }

  async function afterLogin(session) {
    // Connexion en deux étapes activée : le code d'abord, rien d'autre avant
    if (await needsCode()) { codeGate(""); return; }
    // Téléphone qui se réveille, réseau qui hésite : on réessaie au lieu d'afficher « compte pas activé » (Marc, 21 nov. 2026)
    let data = null, error = null;
    // Le compte et les réglages personnels sont demandés en même temps (un aller-retour de moins à l'ouverture)
    const privQ = client.from("private_docs").select("collection, id, data");
    for (let i = 0; i < 4; i++) {
      ({ data, error } = await client.from("members").select("who, role, client_id").eq("user_id", session.user.id).maybeSingle());
      if (!error || !isNetwork(error)) break;
      splash("Connexion à la base…"); await wait(1500 * (i + 1));
    }
    // Session refusée par la base (expirée, retirée) : retour au formulaire, jamais bloqué sur l'écran d'ouverture
    if (error && !isNetwork(error)) { try { await client.auth.signOut({ scope: "local" }); } catch (_) {} gate("Votre session a expiré. Reconnectez-vous."); return; }
    if (error) { splash("Pas de réseau pour l'instant. L'app réessaie dès que la connexion revient."); retryLater(); return; }
    if (!data) { gate("Ce compte n'est pas encore activé. Demandez à Marc de l'ajouter à l'équipe (dernière étape du fichier schema.sql)."); return; }
    me = { id: session.user.id, email: session.user.email, who: data.who, role: data.role, client: data.client_id };
    // Premier passage : le mot de passe provisoire donné par Marc ne sert qu'une fois, on en choisit un à soi
    const provisional = String(session.user.email || "").endsWith("@" + LOGIN_DOMAIN);   // compte à identifiant : mot de passe donné par Marc
    if (provisional && !pwOk && !((session.user && session.user.user_metadata) || {}).pw_set) { pwMode = "first"; passwordGate(""); return; }
    const p = await privQ;
    priv = {}; (p.data || []).forEach(r => { priv[r.collection + "/" + r.id] = r.data; });
    closeGate(); readyResolve(me);
    setTimeout(pushSubscribe, 3000);   // déjà autorisé sur cet appareil : on renouvelle l'abonnement
  }

  const STORE_KEY = "sb-cnhxrhyugghigkozfpde-auth-token";
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const isNetwork = e => !!e && (/fetch|network|load failed|timeout|offline/i.test(String(e.message || "")) || e.name === "AuthRetryableFetchError" || Number(e.status) === 0 || Number(e.status) >= 500);
  const hasSaved = () => { try { return !!localStorage.getItem(STORE_KEY); } catch (_) { return false; } };
  let retrying = false;
  function retryLater() {
    if (retrying) return; retrying = true;
    const again = () => { if (!retrying) return; retrying = false; window.removeEventListener("online", again); location.reload(); };
    window.addEventListener("online", again); setTimeout(again, 15000);
  }
  // Retour sur l'app (téléphone sorti de veille) : on relance tout de suite le renouvellement de la session
  document.addEventListener("visibilitychange", () => {
    if (!client) return;
    try { if (document.visibilityState === "visible") { client.auth.startAutoRefresh(); client.auth.getSession(); } else client.auth.stopAutoRefresh(); } catch (_) {}
  });

  async function start() {
    if (!on) return;
    document.documentElement.classList.add("is-cloud");
    const saved = hasSaved();
    if (saved) splash(); else gate("", "ok");
    try { await loadLib(); } catch (_) { if (saved) { splash("La base ne répond pas. L'app réessaie dès que la connexion revient."); retryLater(); } else gate("La base ne répond pas. Vérifiez la connexion, puis rechargez la page."); return; }
    client = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORE_KEY } });
    // Rester connecté : la session reste sur l'appareil. Si le réseau manque au démarrage, on réessaie ; on ne renvoie à
    // l'écran de connexion que si la base dit vraiment que la session n'est plus valable.
    let data = null, error = null;
    for (let i = 0; i < 4; i++) {
      ({ data, error } = await client.auth.getSession());
      if (!error || !isNetwork(error)) break;
      await wait(1500 * (i + 1));
    }
    if (error && isNetwork(error) && hasSaved()) { splash("Pas de réseau pour l'instant. L'app réessaie dès que la connexion revient."); retryLater(); return; }
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
  /* Rattrapage : si le direct a décroché (téléphone en veille, réseau coupé), on relit tout au réveil, au retour du réseau,
     et toutes les 60 secondes tant que l'app est ouverte. Les suppressions sont aussi rattrapées ainsi. */
  const SUBS = []; let lastSync = 0;
  function resync(force) { const now = Date.now(); if (!force && now - lastSync < 10000) return; lastSync = now; SUBS.forEach(f => f().catch(() => {})); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && SUBS.length) resync(); });
  window.addEventListener("online", () => { if (SUBS.length) resync(true); });
  setInterval(() => { if (SUBS.length && document.visibilityState === "visible") resync(); }, 60000);
  // Ce qu'un client écrit lui-même : on se fie à la colonne client_id de la ligne (posée et vérifiée par la base),
  // jamais au client_id qu'il aurait glissé dans ses données, pour qu'il ne puisse pas se faire passer pour un autre.
  const CLIENT_WRITES = ["results", "avis", "dispos", "referrals", "prep", "validations", "contests"];
  // Et on remet chaque valeur dans la forme attendue : une valeur bizarre écrite par un client
  // (une note qui n'est pas un chiffre, un résultat inconnu) ne doit jamais faire planter une page de l'équipe.
  const str = v => (typeof v === "string" ? v : v == null ? "" : String(v));
  const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const SHAPE = {
    results: o => ["signe", "devis", "perdu"].includes(o.outcome) ? Object.assign(o, { amount: num(o.amount, 0, 1e8), at: str(o.at) }) : null,
    avis: o => Object.assign(o, { note: Math.round(num(o.note, 0, 5)), text: str(o.text), at: str(o.at) }),
    dispos: o => Object.assign(o, { slots: o.slots && typeof o.slots === "object" && !Array.isArray(o.slots) ? o.slots : {}, max: num(o.max, 0, 50),
      off: (Array.isArray(o.off) ? o.off : []).filter(x => x && typeof x === "object").map(x => ({ id: str(x.id), from: str(x.from), to: str(x.to) })) }),
    contests: o => Object.assign(o, { at: str(o.at), why: str(o.why), state: str(o.state), lead: str(o.lead) }),
    validations: o => Object.assign(o, { status: str(o.status), answeredAt: str(o.answeredAt), sentAt: str(o.sentAt), comment: str(o.comment), answeredName: str(o.answeredName) }),
    referrals: o => Object.assign(o, { name: str(o.name), fromName: str(o.fromName), trade: str(o.trade), city: str(o.city), note: str(o.note), phone: str(o.phone), status: str(o.status), at: str(o.at) }),
  };
  function fromRow(name, r) {
    const out = Object.assign({}, r.data && typeof r.data === "object" ? r.data : {}, { id: r.id });
    if (!CLIENT_WRITES.includes(name)) return out;
    if (r.client_id) out.client_id = r.client_id;
    return SHAPE[name] ? SHAPE[name](out) : out;
  }
  function collection(name) {
    return {
      // Lit tout, puis suit les changements en temps réel
      async subscribe(onRows, onError) {
        await ready;
        let rows = [], sig = "";
        const load = async () => {
          const { data, error } = await client.from("docs").select("id, data, client_id").eq("collection", name);
          if (error) return error;
          const next = (data || []).map(r => fromRow(name, r)).filter(Boolean), s = JSON.stringify(next);
          if (s !== sig) { sig = s; rows = next; onRows(rows.slice()); }   // on ne réaffiche que si quelque chose a changé
          return null;
        };
        const err = await load();
        if (err) { onError && onError(err); return; }
        SUBS.push(load);
        // Le direct : chaque ajout ou changement fait par Marc, Richard ou Gianni arrive tout de suite
        let first = true;
        client.channel("docs-" + name + "-" + Math.random().toString(36).slice(2, 8))
          .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "collection=eq." + name }, p => {
            if (p.eventType === "DELETE") rows = rows.filter(r => r.id !== (p.old && p.old.id));
            else { const r = fromRow(name, p.new), i = rows.findIndex(x => x.id === p.new.id); if (!r) { if (i >= 0) rows.splice(i, 1); } else if (i >= 0) rows[i] = r; else rows.push(r); }
            sig = JSON.stringify(rows); onRows(rows.slice());
          }).subscribe(status => { if (status === "SUBSCRIBED") { if (!first) load(); first = false; } });   // reconnexion : on rattrape ce qui a été manqué
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
    if (!error) { if (await needsCode()) codeGate("Mot de passe changé. Tapez votre code pour continuer."); return ""; }
    const m = String(error.code || "") + " " + String(error.message || "");
    return /same_password|different from the old/i.test(m) ? "same" : /weak|short|at least/i.test(m) ? "weak" : "other";
  }

  // Pour la page Accès clients (équipe) : les comptes, et les fonctions de la base (créer, réinitialiser, retirer un accès)
  // Toute la table docs (équipe seulement, règles de la base) : pour la sauvegarde sur le Drive
  async function dumpAll() { await ready; const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await client.from("docs").select("collection, id, data, client_id").range(from, from + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; } return out; }
  // Les clés MCP : brancher son propre Claude. On ne garde que l'empreinte ; la clé ne se montre qu'une fois.
  const sha = async t => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, "0")).join("");
  async function mcpKeys() { await ready; if (!client) return []; const { data, error } = await client.from("mcp_keys").select("hash, label, created_at, last_used").order("created_at", { ascending: false }); return error ? null : (data || []); }
  async function mcpCreate(label) {
    await ready; const raw = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join(""), key = "ent_" + raw;
    const { error } = await client.from("mcp_keys").insert({ hash: await sha(key), label: String(label || "Claude").slice(0, 60), user_id: me.id });
    if (error) throw error; return { key, url: URL_ + "/functions/v1/mcp?key=" + key };
  }
  async function mcpDelete(hash) { await ready; const { error } = await client.from("mcp_keys").delete().eq("hash", hash); if (error) throw error; }
  async function listMembers() { await ready; if (!client) return []; const { data, error } = await client.from("members").select("user_id, who, role, client_id, created_at"); return error ? [] : (data || []); }
  // Appeler une fonction du serveur (meta-sync…) avec la session de la personne connectée
  async function invoke(fn, body) { if (!client) return { error: { message: "Pas connecté." } }; return client.functions.invoke(fn, { body: body || {} }); }
  async function rpc(fn, args) { if (!client) return { error: { message: "Pas connecté." } }; return client.rpc(fn, args); }

  // Notifications sur le téléphone, même app fermée : on abonne cet appareil (clé publique donnée par la fonction « push »)
  const b64u = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function pushSubscribe() {
    try {
      if (!on || !client || !me || !("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission !== "granted") return "absent";
      const reg = await navigator.serviceWorker.ready;
      const r = await fetch(URL_ + "/functions/v1/push", { headers: { apikey: KEY } });
      const key = r.ok ? (await r.json()).key : ""; if (!key) return "absent";
      let s = await reg.pushManager.getSubscription();
      if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
      const j = s.toJSON();
      const { error } = await client.from("push_subs").upsert({ endpoint: j.endpoint, sub: j, user_id: me.id });
      if (error) return "absent";
      try { localStorage.setItem("entremis-push", "1"); } catch (_) {}
      return "granted";
    } catch (_) { return "absent"; }
  }
  async function signOut() { if (client) await client.auth.signOut(); try { sessionStorage.removeItem("entremis-cloud"); } catch (_) {} location.reload(); }

  window.ENTREMIS_CLOUD = { on: () => on, ready: () => ready, me: () => me, key: () => KEY, collection, privGet, privSet, changePassword, listMembers, rpc, signOut, start, pushSubscribe, dumpAll, mcpKeys, mcpCreate, mcpDelete, mfaList, mfaStart, mfaConfirm, mfaRemove, invoke, resync: () => resync(true) };
  if (on) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
})();
