/* Entremis — #reglages : le centre de réglages (Marc, 20 nov. 2026).
   Une colonne de rubriques à gauche, la rubrique ouverte à droite (sur téléphone : la liste, puis la rubrique).
   Rubriques : profil, espace, notifications, apparence, connexions (agence), données et sécurité, aide.
   Connexions : chacun (Marc, Richard, Gianni) branche SON IA, ses serveurs MCP, ses bots et ses automatisations.
   C'est propre à chaque compte : rangé par personne, jamais montré aux deux autres. Dans la maquette, rien n'est branché
   et aucune clé n'est demandée ni gardée ; le vrai branchement arrive avec Supabase (un compte par personne) et GitHub. */
(function () {
  "use strict";
  const EM = () => window.EM, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team;
  const X = { sec: null, cx: null, pw: false };   // rubrique ouverte, connexion ouverte dans la fenêtre, fenêtre du mot de passe

  // La police : Inter Tight (style AgentOps) ou Outfit (la charte). Gardée dans ce navigateur.
  const FONT_KEY = "entremis-app-font";
  const font = () => { try { return localStorage.getItem(FONT_KEY) || "inter"; } catch (_) { return "inter"; } };
  const applyFont = f => { if (f === "outfit") document.documentElement.style.setProperty("--font", "var(--font-charte)"); else document.documentElement.style.removeProperty("--font"); };
  applyFont(font());

  /* ---------- Connexions : le catalogue ---------- */
  const GROUPS = [
    ["ia", "Ton IA et tes outils (MCP)"], ["bot", "Bots et messages"], ["auto", "Automatisations"], ["outils", "Agenda et mail"], ["socle", "Le socle, à l'étape Supabase et GitHub"]
  ];
  const CONNECT = [
    { id: "claude", brand: "claude", group: "ia", name: "Claude", mark: "C", live: true, what: "Branché par la clé MCP ci-dessus : il lit l'app et crée des tâches.", can: ["Lire les leads et les fiches que tu lui ouvres", "Préparer un message, tu valides avant l'envoi"] },
    { id: "chatgpt", brand: "openai", group: "ia", name: "ChatGPT", mark: "G", what: "Un autre assistant, si tu préfères.", can: ["Lire les leads et les fiches que tu lui ouvres", "Préparer un message, tu valides avant l'envoi"] },
    { id: "mcp", group: "ia", name: "Serveur MCP", mark: "M", what: "Donne à ton IA un accès à un outil : base, agenda, fichiers.", field: "Adresse du serveur", ph: "https://…", can: ["Ce que le serveur autorise, rien de plus", "Seulement sur ton compte"] },
    { id: "telegram", brand: "telegram", group: "bot", name: "Bot Telegram", mark: "T", what: "Tes alertes et tes tâches du jour sur Telegram.", field: "Nom du bot", ph: "@…", can: ["T'envoyer tes alertes", "Noter une tâche quand tu lui écris"] },
    { id: "whatsapp", brand: "whatsapp", group: "bot", name: "WhatsApp Business", mark: "W", what: "Écrire aux particuliers depuis le numéro d'Entremis.", can: ["Envoyer les messages que tu valides", "Recevoir leurs réponses dans Discussions"] },
    { id: "slack", brand: "slack", group: "bot", name: "Slack", mark: "S", what: "Recevoir les alertes dans un canal Slack.", field: "Nom du canal", ph: "#…", can: ["Poster tes alertes dans ce canal"] },
    { id: "make", brand: "make", group: "auto", name: "Make ou Zapier", mark: "Z", what: "Relier Entremis à d'autres outils, sans code.", field: "Nom du scénario", ph: "Ex. : nouveau lead vers Google Sheets", can: ["Recevoir un signal à chaque événement choisi"] },
    { id: "n8n", brand: "n8n", group: "auto", name: "n8n", mark: "N", what: "Des automatisations hébergées chez toi.", field: "Adresse de ton n8n", ph: "https://…", can: ["Recevoir un signal à chaque événement choisi"] },
    { id: "gcal", group: "outils", name: "Google Agenda", brand: "gcal", what: "Tes tâches et les rendez-vous dans ton agenda.", live: true, can: ["Lire ton agenda de la semaine", "Ajouter un événement quand tu le demandes"] },
    { id: "gmail", group: "outils", name: "Gmail", brand: "gmail", what: "Envoyer devis, factures et relances depuis ta boîte.", can: ["Préparer un brouillon avec le PDF joint", "Tu cliques sur Envoyer, jamais l'app seule"] },
    { id: "supabase", brand: "supabase", group: "socle", name: "Supabase", mark: "S", what: "La vraie base : un compte par personne, données séparées.", later: true, can: ["Un compte et un mot de passe chacun", "Tes connexions rangées sur ton compte, clés chiffrées côté serveur"] },
    { id: "github", brand: "github", group: "socle", name: "GitHub", mark: "G", what: "Le code de l'app, ses versions et sa mise en ligne.", later: true, can: ["Garder chaque version de l'app", "Mettre en ligne sans perdre les données"] }
  ];
  const AUTO = [
    { id: "lead-ia", text: "Quand un lead arrive, mon IA prépare le premier message", needs: ["claude", "chatgpt", "mcp"] },
    { id: "morning", text: "Chaque matin à 8 h, mon bot m'envoie mes tâches du jour", needs: ["telegram", "slack", "whatsapp"] },
    { id: "late-invoice", text: "Facture en retard : mon IA rédige la relance, je valide", needs: ["claude", "chatgpt"] },
    { id: "rdv-cal", text: "RDV placé : il arrive dans mon Google Agenda", needs: ["gcal"] },
    { id: "weekly", text: "Le vendredi, mon IA fait le bilan de mes clients", needs: ["claude", "chatgpt", "mcp"] }
  ];
  // Rangé par personne : Marc ne voit que les siennes, Richard et Gianni pareil
  const key = who => "entremis-app-connect-" + who;
  // Site en ligne : rangé sur le compte de la personne connectée (table private_docs), sinon dans ce navigateur
  const CL = () => window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? window.ENTREMIS_CLOUD : null;
  const mine = who => { const c = CL(); if (c) return Object.assign({ cx: {}, auto: {} }, c.privGet("connect", "me") || {}); try { return Object.assign({ cx: {}, auto: {} }, JSON.parse(localStorage.getItem(key(who)) || "{}")); } catch (_) { return { cx: {}, auto: {} }; } };
  const saveMine = (who, v) => { const c = CL(); if (c) { c.privSet("connect", "me", v); return; } try { localStorage.setItem(key(who), JSON.stringify(v)); } catch (_) {} };
  const state = (c, m) => c.live ? ["Dans la version en ligne", "ok"] : c.later ? ["Étape suivante", "neutral"] : m.cx[c.id] && m.cx[c.id].on ? ["Prévu", "info"] : ["Pas branché", "neutral"];
  const ready = (a, m) => a.needs.some(id => { const c = CONNECT.find(x => x.id === id); return c && (c.live || (m.cx[id] && m.cx[id].on)); });

  /* ---------- Les rubriques ---------- */
  const SECS = S => (S.space === "team"
    ? [["profil", "user", "Profil"], ["espace", "swap", "Espace"], ["notifs", "bell", "Notifications"], ["apparence", "sliders", "Apparence"], ["connexions", "tool", "Connexions"], ["donnees", "shield", "Données et sécurité"], ["aide", "info", "Aide"]]
    : [["profil", "user", "Profil"], ["espace", "swap", "Espace"], ["notifs", "bell", "Notifications"], ["apparence", "sliders", "Apparence"], ["donnees", "shield", "Données et sécurité"], ["aide", "info", "Aide"]].filter(x => !(S.lock && x[0] === "espace")));

  const row = (title, sub, control) => `<div class="set-row"><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${control || ""}</div>`;
  const linkRow = (href, title, sub) => `<a class="set-row set-link" href="${href}"><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${EM().icon("chev")}</a>`;
  const seg = (attr, opts, cur) => `<div class="seg seg-lg">${opts.map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;

  function secProfil(S) {
    const esc = EM().esc, team = S.space === "team";
    if (!team) {
      const u = EM().viewUser(), owner = TM().member(EM().viewClient().owner || "richard");
      return `<section class="set-group"><div class="set-me"><span class="av av-xl">${esc(u.initials)}</span><div><b>${esc(u.name)}</b><span>${esc(u.role)} – ${esc(u.company)}</span></div></div>
        ${row("Votre contact chez Entremis", `${esc(owner.name)} place vos rendez-vous et répond à vos questions.`, `<a class="btn btn-ghost" href="#messages">${EM().icon("chat")}Écrire</a>`)}</section>
      ${S.lock && CL() ? `<section class="set-group">${row("Connecté", esc((CL().me() || {}).email || ""), `<button class="btn btn-ghost" type="button" data-cloud-out>Se déconnecter</button>`)}${pwRow()}</section>` : ""}`;
    }
    const me = TM().member(S.who), url = TM().photoUrl(S.who), busy = TM().photoBusy();
    return `<section class="set-group">
      <div class="set-me">${TM().avatar(S.who, "av av-xl")}<div><b>${esc(me.name)}</b><span>${esc(me.role || "")}</span></div>
        <div class="set-me-acts"><label class="btn btn-ghost${busy ? " is-busy" : ""}"><input class="sr" type="file" accept="image/png,image/jpeg,image/webp,image/heic" data-photo>${EM().icon("user")}${busy ? "Envoi…" : url ? "Changer la photo" : "Choisir une photo"}</label>${url ? `<button class="link" type="button" data-act="photo-remove">Retirer</button>` : ""}</div></div>
      ${CL() ? row("Connecté", esc((CL().me() || {}).email || ""), `<button class="btn btn-ghost" type="button" data-cloud-out>Se déconnecter</button>`) + pwRow()
          + (S.shared ? row("C'est moi", "Compte de l'agence, partagé : choisis ton portail (tes tâches, tes clients, tes alertes).", seg("data-who", TD().members.map(m => [m.id, m.name]), S.who)) : "")
        : row("C'est moi", "Ton portail : tes tâches, tes clients, tes alertes, tes connexions.", seg("data-who", TD().members.map(m => [m.id, m.name]), S.who))}
    </section>
    ${CL() ? "" : `<p class="set-note">${EM().icon("info")}Dans la maquette, n'importe qui peut choisir son nom ici. Sur le site en ligne, chacun se connecte avec son compte.</p>`}`;
  }
  function secEspace(S) {
    const cur = EM().viewId();
    return `<section class="set-group">${row("Espace affiché", "Celui de l'agence, ou l'espace d'un client tel qu'il le voit.", seg("data-space", [["client", "Client"], ["team", "Agence"]], S.space))}
      ${row("Client affiché", "Le client dont vous ouvrez l'espace.", EM().fsel("as-pick", "Client", EM().allClients().map(c => [c.id, c.name]), cur))}</section>
      <p class="set-note">${EM().icon("info")}Un client connecté ne voit que son espace : ni ce réglage, ni l'agence.</p>`;
  }
  // Le mot de passe : seulement sur le site en ligne, pour la personne connectée
  const pwRow = () => row("Mot de passe", "Remplacez le mot de passe provisoire par le vôtre.", `<button class="btn btn-ghost" type="button" data-pw-open>${EM().icon("lock")}Changer</button>`);
  const pwField = (name, label, auto) => `<label class="field"><span>${label}</span><span class="cg-pw"><input name="${name}" type="password" required${name === "current" ? "" : ' minlength="8"'} autocomplete="${auto}"><button class="cg-eye" type="button" data-cloud-eye aria-label="Afficher le mot de passe" aria-pressed="false">${EM().icon("eye")}</button></span></label>`;
  function pwSheet() {
    if (!X.pw || !CL()) return "";
    return `<div class="scrim" data-pw-close></div>
    <form class="sheet" id="pw-form" aria-label="Changer mon mot de passe" novalidate>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-pw-close>Annuler</button><b>Mot de passe</b><button class="link strong" type="submit">Enregistrer</button></div>
      ${pwField("current", "Mot de passe actuel", "current-password")}
      ${pwField("next", "Nouveau mot de passe", "new-password")}
      ${pwField("again", "Encore une fois", "new-password")}
      <p class="cg-msg pw-msg" role="alert" hidden></p>
      <p class="field-help">8 caractères au moins. Personne d'autre ne le voit, pas même l'équipe Entremis.</p>
    </form>`;
  }
  function secNotifs(S) {
    const n = TM().unreadCount(S);
    const perm = "Notification" in window ? Notification.permission : "absent";
    const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    const dev = perm === "granted" ? `<span class="state state-ok">Activées</span>` : perm === "denied" ? `<span class="state state-neutral">Refusées</span>`
      : perm === "absent" || (ios && !standalone) ? `<span class="state state-neutral">Pas ici</span>` : `<button class="btn btn-ghost" type="button" data-alerts-on>${EM().icon("bell")}Activer</button>`;
    const devSub = perm === "denied" ? "Refusées dans ce navigateur : à rétablir dans ses réglages (site entremisagency.github.io)."
      : ios && !standalone ? "Sur iPhone : ajoutez d'abord l'app à l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis ouvrez-la depuis l'icône."
      : "Un nouveau lead, une demande du site, un rendez-vous, une contestation, une tâche : une alerte sur cet appareil, même quand l'app est fermée.";
    return `<section class="set-group">${CL() ? row("Alertes sur cet appareil", devSub, dev) : ""}${linkRow("#notifications", "Ce qui vous prévient", "Choisir les événements, et comment : dans l'app, par e-mail, par SMS.")}
      ${row("Non lues", n ? `${n} notification${n > 1 ? "s" : ""} à lire` : "Tout est lu", `<a class="btn btn-ghost" href="#notifications">${EM().icon("bell")}Voir</a>`)}</section>`;
  }
  const HAPTIC_KEY = "entremis-app-haptics";
  const haptics = () => { try { return localStorage.getItem(HAPTIC_KEY) === "off" ? "off" : "on"; } catch (_) { return "on"; } };
  function secApparence() {
    const f = font();
    return `<section class="set-group">${row("Police", f === "outfit" ? "Outfit, la police de la charte Entremis." : "Inter Tight, nette et serrée, comme la référence AgentOps.", seg("data-set-font", [["inter", "Inter Tight"], ["outfit", "Outfit"]], f))}
      <div class="set-sample" aria-hidden="true"><b class="tabnum">14 700 €</b><span>Potentiel par mois</span></div>
      ${row("Vibrations", "Sur téléphone, quand on choisit, enregistre, supprime ou change de page.", seg("data-set-haptics", [["on", "Oui"], ["off", "Non"]], haptics()))}
      ${(() => { const ua = navigator.userAgent, m = ua.match(/OS (\d+)_(\d+)/), ios = /iP(hone|ad|od)/.test(ua), v = m ? Number(m[1]) + Number(m[2]) / 100 : 0;
        const how = navigator.vibrate ? "Ce téléphone accepte les vibrations." : ios ? (v >= 17.04 ? `iPhone, iOS ${m[1]}.${m[2]} : retour haptique possible si « Retour haptique du système » est activé (Réglages › Sons et vibrations).` : `iPhone, iOS ${m ? m[1] + "." + m[2] : "?"} : trop ancien, il faut iOS 17.4 ou plus.`) : "Cet appareil ne vibre pas (ordinateur).";
        return row("Tester la vibration", how + " Essayez A, puis B, puis C : celui que vous sentez reste choisi.", `<span class="hx-tries">${["a", "b", "c"].map(k => `<button class="btn btn-ghost${TM().hapticMode() === k ? " is-on" : ""}" type="button" data-haptic-try="${k}" aria-pressed="${TM().hapticMode() === k}">${k.toUpperCase()}</button>`).join("")}</span>`); })()}</section>
      <p class="set-note">${EM().icon("info")}Gardé dans ce navigateur. Le logo reste en Outfit.</p>`;
  }
  /* ---------- Ton Claude (MCP) : une clé personnelle, l'adresse à coller dans Claude ---------- */
  const MC = { list: undefined, loading: false, fresh: null, busy: false };
  function loadKeys() { const c = CL(); if (!c || MC.loading) return; MC.loading = true; c.mcpKeys().then(l => { MC.list = l; MC.loading = false; EM().render(); }); }
  const when = iso => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "jamais";
  function mcpSection(S) {
    const esc = EM().esc, icon = EM().icon, c = CL();
    if (S.space !== "team") return "";
    if (!c) return `<section class="set-group"><p class="set-title set-title-brand">${EM().brand("claude", "Claude")}Ton Claude (MCP)</p>${row("Brancher ton Claude sur l'app", "Sur le site en ligne : une clé personnelle, puis Claude lit les leads, les clients, les factures et crée des tâches.", `<span class="state state-neutral">Site en ligne</span>`)}</section>`;
    if (MC.list === undefined) loadKeys();
    const fresh = MC.fresh ? `<div class="mcp-fresh"><p><b>Ta clé est prête.</b> Elle ne s'affichera qu'une fois : copie l'adresse maintenant.</p>
        <div class="mcp-url"><code>${esc(MC.fresh.url)}</code><button class="btn btn-ghost" type="button" data-copy="${esc(MC.fresh.url)}">${icon("copy")}Copier</button></div>
        <ol class="mcp-steps"><li><b>claude.ai ou l'app Claude</b> : Paramètres › Connecteurs › Ajouter un connecteur personnalisé. Nom : Entremis. Colle l'adresse.</li>
        <li><b>Claude Code</b> : <code>claude mcp add --transport http entremis "${esc(MC.fresh.url)}"</code> <button class="link" type="button" data-copy='claude mcp add --transport http entremis "${esc(MC.fresh.url)}"'>Copier</button></li>
        <li>Demande-lui par exemple : « Qu'est-ce qui m'attend aujourd'hui chez Entremis ? »</li></ol>
        <p class="field-help">Cette adresse vaut un mot de passe : ne la partage pas. Si elle fuite, retire la clé ci-dessous.</p>
        <button class="btn btn-ghost" type="button" data-mcp-done>J'ai copié l'adresse</button></div>` : "";
    const list = MC.list === null ? `<p class="field-help">La liste des clés n'a pas pu être lue : le SQL des connexions Claude n'est peut-être pas encore lancé.</p>`
      : (MC.list || []).map(k => row(esc(k.label), `Créée le ${when(k.created_at)} · dernière utilisation : ${when(k.last_used)}`, `<button class="btn btn-ghost" type="button" data-mcp-del="${esc(k.hash)}">${icon("trash")}Retirer</button>`)).join("");
    return `<section class="set-group"><p class="set-title set-title-brand">${EM().brand("claude", "Claude")}Ton Claude (MCP)</p>
      ${row("Brancher ton propre Claude", "Claude lit les leads, les clients, les rendez-vous, les factures et les documents de travail, et peut créer des tâches. Il ne supprime et n'envoie rien.", `<button class="btn btn-primary" type="button" data-mcp-new ${MC.busy ? "disabled" : ""}>${icon("plus")}Créer une clé</button>`)}
      ${fresh}${list}</section>`;
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-mcp-new],[data-mcp-del],[data-mcp-done]"); if (!t) return;
    const c = CL(); if (!c) return;
    if ("mcpNew" in t.dataset) { const label = window.prompt("Nom de cette connexion (pour la reconnaître)", "Claude de " + TM().member(EM().S.who).name); if (label == null) return;
      MC.busy = true; EM().render(); c.mcpCreate(label).then(r => { MC.fresh = r; MC.busy = false; MC.list = undefined; TM().haptic("done"); EM().render(); }).catch(() => { MC.busy = false; EM().render(); EM().toast("La clé n'a pas pu être créée. Le SQL des connexions Claude est-il lancé ?"); }); }
    if (t.dataset.mcpDel) EM().confirm({ title: "Retirer cette clé ?", text: "Le Claude branché avec elle n'aura plus accès à l'app, tout de suite.", ok: "Retirer" }).then(y => { if (!y) return; c.mcpDelete(t.dataset.mcpDel).then(() => { MC.list = undefined; EM().render(); EM().toast("Clé retirée."); }).catch(() => EM().toast("La clé n'a pas pu être retirée. Réessayez.")); });
    if ("mcpDone" in t.dataset) { MC.fresh = null; EM().render(); }
  });
  function secConnexions(S) {
    const esc = EM().esc, me = TM().member(S.who), m = mine(S.who);
    const card = c => { const [l, k] = state(c, m), note = m.cx[c.id] && m.cx[c.id].note;
      return `<li><button type="button" class="cx" data-cx-open="${c.id}">
        <span class="cx-mark">${c.brand ? EM().brand(c.brand, c.name) : esc(c.mark)}</span>
        <span class="cx-main"><b>${esc(c.name)}</b><small>${esc(note || c.what)}</small></span>
        <span class="state state-${k}">${l}</span></button></li>`; };
    return `${mcpSection(S)}<p class="set-private">${EM().icon("shield")}<span><b>Visible seulement par ${esc(me.name)}.</b> ${TD().members.filter(x => x.id !== S.who).map(x => x.name).join(" et ")} ont les leurs et ne voient pas les tiennes.</span></p>
      ${GROUPS.map(([g, title]) => `<section class="set-group"><p class="set-title">${title}</p><ul class="cx-list">${CONNECT.filter(c => c.group === g).map(card).join("")}</ul></section>`).join("")}
      <section class="set-group"><p class="set-title">Mes automatisations</p>
        ${AUTO.map(a => { const ok = ready(a, m), on = !!m.auto[a.id] && ok;
          return `<label class="set-row set-toggle${ok ? "" : " is-off"}"><div><b>${esc(a.text)}</b>${ok ? "" : `<span>Branche d'abord : ${a.needs.map(id => CONNECT.find(c => c.id === id).name).join(", ")}</span>`}</div>
            <span class="switch"><input type="checkbox" data-auto="${a.id}" ${on ? "checked" : ""} ${ok ? "" : "disabled"}><span class="track" aria-hidden="true"></span></span></label>`; }).join("")}
      </section>
      <p class="set-note">${EM().icon("info")}${CL() ? "Rangé sur ton compte : personne d'autre ne le voit. Aucune clé n'est demandée ici : le branchement de chaque outil se fera côté serveur." : "Maquette : rien n'est encore branché, aucune clé n'est demandée ni gardée. Sur le site en ligne, tout est rangé sur ton compte."}</p>`;
  }
  function secDonnees(S) {
    return `<section class="set-group">
      ${row("Données de l'équipe", "Leads, tâches, devis, discussions : partagés entre Marc, Richard et Gianni.", `<span class="state state-ok">Partagées</span>`)}
      ${row("Ce qui reste dans ce navigateur", CL() ? "La police et ce que tu as déjà lu. Tes connexions sont rangées sur ton compte." : "Tes connexions, la police, ce que tu as déjà lu.", `<span class="state state-neutral">Ici seulement</span>`)}
      ${row("Fichiers déposés", "Rangés avec l'app, visibles par l'équipe.", "")}
      ${row("Comptes séparés", "Un compte et un mot de passe chacun. Un client ne reçoit que ses propres données.", CL() ? `<span class="state state-ok">En place</span>` : `<span class="state state-neutral">Site en ligne</span>`)}
    </section>
    ${window.ENTREMIS_PILOT.backupRows(S, row)}
    <p class="set-note">${EM().icon("info")}${S.space === "team" ? "Un compte client n'ouvre que son espace. La base ne lui envoie que ce qui le concerne : ses résultats de visite, son avis, ses disponibilités, ses parrainages." : "Vos demandes et vos rendez-vous ne sont jamais revendus ni partagés."}</p>`;
  }
  function secAide(S) {
    const team = S.space === "team";
    return `<section class="set-group">${linkRow(team ? "#guide" : "#aide", team ? "Guide de l'app" : "Comment ça marche", "Ce que fait chaque page, en cinq minutes de lecture.")}
      ${team ? linkRow("#secteurs", "Secteurs et parcours", "Ajouter un métier, choisir comment on livre.") : linkRow("#messages", "Poser une question à Entremis", "Richard vous répond dans la journée.")}
      ${(() => { const U = window.ENTREMIS_UPDATE, v = U ? U.version() : ""; const lab = v ? `Version du ${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)} à ${v.slice(9, 11)} h ${v.slice(11, 13)}` : "Version de l'app";
        return row("Version de l'app", `${lab}. L'app se met à jour toute seule, même installée sur l'écran d'accueil.`, `<button class="btn btn-ghost" type="button" data-upd-check>${EM().icon("swap")}Vérifier</button>`); })()}</section>`;
  }
  const SECTION = { profil: secProfil, espace: secEspace, notifs: secNotifs, apparence: secApparence, connexions: secConnexions, donnees: secDonnees, aide: secAide };

  function cxSheet(S) {
    const c = X.cx && CONNECT.find(x => x.id === X.cx); if (!c) return "";
    const esc = EM().esc, m = mine(S.who), cur = m.cx[c.id] || {}, me = TM().member(S.who).name;
    return `<div class="scrim" data-cx-close></div>
    <form class="sheet" id="cx-form" aria-label="${esc(c.name)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-cx-close>Annuler</button><b>${esc(c.name)}</b><button class="link strong" type="submit">${c.live || c.later ? "OK" : "Enregistrer"}</button></div>
      <div class="cx-top"><span class="cx-mark">${c.brand ? EM().brand(c.brand, c.name) : esc(c.mark)}</span><p class="body">${esc(c.what)}</p></div>
      <ul class="cx-can">${c.can.map(x => `<li>${EM().icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>
      ${c.live ? `<p class="set-note">${EM().icon("info")}Branché dans la version en ligne de l'app, sur ton propre compte Google. Rien à faire ici.</p>`
        : c.later ? `<p class="set-note">${EM().icon("info")}Prévu pour l'étape où l'app aura sa vraie base. Coche pour qu'on le prépare.</p><label class="check-line"><input type="checkbox" name="on" ${cur.on ? "checked" : ""}><span>Je le veux pour mon compte</span></label>`
        : `<label class="check-line"><input type="checkbox" name="on" ${cur.on ? "checked" : ""}><span>Je veux le brancher sur mon compte (${esc(me)})</span></label>
          ${c.field ? `<label class="field"><span>${esc(c.field)}</span><input name="note" maxlength="120" autocomplete="off" value="${esc(cur.note || "")}" placeholder="${esc(c.ph || "")}"></label>` : ""}
          <p class="field-help">Ne colle jamais de clé ni de mot de passe ici. Le vrai branchement se fera de façon sécurisée, à l'étape Supabase.</p>`}
    </form>`;
  }

  function view(S) {
    const esc = EM().esc, icon = EM().icon, secs = SECS(S), narrow = EM().isNarrow();
    if (!secs.some(s => s[0] === X.sec)) X.sec = narrow ? null : "profil";
    const nav = `<nav class="set-nav" aria-label="Rubriques des réglages"><ul>${secs.map(([k, i, l]) => `<li><button type="button" data-set-sec="${k}" ${X.sec === k ? 'aria-current="page"' : ""}><span class="set-ico">${icon(i)}</span><span>${l}</span>${icon("chev")}</button></li>`).join("")}</ul></nav>`;
    const cur = secs.find(s => s[0] === X.sec);
    const main = cur ? `<div class="set-main">${narrow ? `<button class="m-back set-back" type="button" data-set-back>${icon("back")}Réglages</button>` : ""}<h2 class="h2 set-h">${cur[2]}</h2>${SECTION[cur[0]](S)}</div>` : "";
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Réglages</h1><p class="sub">${S.space === "team" ? "Ton profil, ton espace et tes connexions." : "Votre profil et votre espace."}</p></div></div>
    <div class="set${cur ? " has-main" : ""}">${narrow ? (cur ? main : nav) : nav + main}</div>
    ${cxSheet(S)}${pwSheet()}`;
  }

  function onClick(e, S, render) {
    const ht = e.target.closest("[data-haptic-try]");
    if (ht) { e.stopPropagation(); TM().hapticTry(ht.dataset.hapticTry); document.querySelectorAll("[data-haptic-try]").forEach(b => { const on = b === ht; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); }); EM().toast(`Essai ${ht.dataset.hapticTry.toUpperCase()} envoyé. Senti ? Gardez-le. Sinon, essayez le suivant.`); return true; }
    if (e.target.closest("[data-haptic-test]")) { TM().haptic("done"); EM().toast(haptics() === "off" ? "Les vibrations sont sur « Non » : passez-les sur « Oui »." : "Vibration envoyée. Rien senti ? Voir la ligne au-dessus."); return true; }
    if (e.target.closest("[data-upd-check]")) { const U = window.ENTREMIS_UPDATE; if (U) U.check().then(v => { if (!v) EM().toast("L'app est à jour."); }); return true; }
    if (e.target.closest("[data-alerts-on]")) { window.ENTREMIS_LIVE.askAlerts().then(r => { render(); EM().toast(r === "granted" ? "Alertes activées sur cet appareil." : "Alertes non activées."); }); return true; }
    if (e.target.closest("[data-pw-open]")) { X.pw = true; render(); setTimeout(() => { const i = document.querySelector('#pw-form input[name="current"]'); if (i) i.focus(); }, 60); return true; }
    if (e.target.closest("[data-pw-close]")) { X.pw = false; render(); return true; }
    const t = e.target.closest("[data-set-sec],[data-set-back],[data-set-font],[data-set-haptics],[data-cx-open],[data-cx-close]"); if (!t) return false;
    const d = t.dataset;
    if (d.setSec) { X.sec = d.setSec; TM().haptic("tap"); render(); window.scrollTo(0, 0); const ap = document.querySelector(".app"); if (ap) ap.scrollTop = 0; return true; }
    if ("setBack" in d) { X.sec = null; render(); return true; }
    if (d.setHaptics) { try { localStorage.setItem(HAPTIC_KEY, d.setHaptics); } catch (_) {} if (d.setHaptics === "on") TM().haptic("done"); render(); return true; }
    if (d.setFont) { try { localStorage.setItem(FONT_KEY, d.setFont); } catch (_) {} applyFont(d.setFont); render(); return true; }
    if (d.cxOpen) { X.cx = d.cxOpen; render(); return true; }
    if ("cxClose" in d) { X.cx = null; render(); return true; }
    return false;
  }
  function onChange(e, S, render) {
    const a = e.target.closest && e.target.closest("[data-auto]"); if (!a) return false;
    const m = mine(S.who); m.auto[a.dataset.auto] = a.checked; saveMine(S.who, m); TM().haptic("tap");
    EM().toast(a.checked ? "Automatisation notée pour ton compte. Elle tournera à l'étape Supabase." : "Automatisation retirée.");
    return true;
  }
  function onSubmit(e, S, render) {
    if (e.target.id === "pw-form") {
      e.preventDefault();
      const f = e.target, fd = new FormData(f), cur = String(fd.get("current") || ""), nx = String(fd.get("next") || ""), again = String(fd.get("again") || "");
      const say = m => { const p = f.querySelector(".pw-msg"); p.textContent = m; p.hidden = false; };
      if (!cur) { say("Écrivez d'abord votre mot de passe actuel."); return true; }
      if (nx.length < 8) { say("Le nouveau mot de passe doit faire 8 caractères au moins."); return true; }
      if (nx !== again) { say("Les deux nouveaux mots de passe ne sont pas les mêmes."); return true; }
      const go = f.querySelector('button[type="submit"]'); go.disabled = true; go.textContent = "Envoi…";
      window.ENTREMIS_CLOUD.changePassword(cur, nx).then(code => {
        if (!code) { X.pw = false; render(); TM().haptic("done"); EM().toast("Mot de passe changé."); return; }
        go.disabled = false; go.textContent = "Enregistrer";
        say({ current: "Le mot de passe actuel n'est pas le bon.", same: "Choisissez un mot de passe différent de l'ancien.", weak: "Ce mot de passe est trop simple. Mélangez lettres et chiffres.", off: "Connectez-vous d'abord." }[code] || "Le mot de passe n'a pas été changé. Réessayez.");
      });
      return true;
    }
    if (e.target.id !== "cx-form") return false;
    e.preventDefault();
    const c = CONNECT.find(x => x.id === X.cx); if (!c) return true;
    if (!c.live) {
      const fd = new FormData(e.target), m = mine(S.who);
      m.cx[c.id] = { on: !!fd.get("on"), note: String(fd.get("note") || "").trim().slice(0, 120) };
      saveMine(S.who, m);
      EM().toast(m.cx[c.id].on ? `${c.name} : prévu sur ton compte.` : `${c.name} : retiré de ton compte.`);
    }
    X.cx = null; TM().haptic("done"); render();
    return true;
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && (X.cx || X.pw) && !document.querySelector(".confirm,.dp-pop")) { X.cx = null; X.pw = false; EM().render(); } });

  window.ENTREMIS_SETTINGS = { view, onClick, onChange, onSubmit, reset: () => { X.cx = null; X.sec = null; X.pw = false; } };   // en arrivant sur la page : la liste des rubriques (téléphone), Profil (ordinateur)
})();
