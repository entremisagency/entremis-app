/* Entremis — les tournages (Marc, 23 nov. 2026).
   Équipe, page « Tournages » : tous les tournages à venir, à planifier et passés. Pour chacun : la date, l'heure, le lieu, qui y va,
   ce que le client doit préparer, et où en sont les scripts (envoyés, validés par le client). Enregistrer crée une tâche pour l'équipe du jour
   et propose l'ajout dans Google Agenda.
   Client, page « Votre tournage » : la date, qui vient, ce qu'il faut préparer, et les scripts à valider (« Je valide » ou « Je demande une correction »).
   Les données vivent dans la fiche d'avancement du client (collection « flow », champ shoot) : le client la lit déjà, l'équipe seule l'écrit.
   Les réponses du client passent par la collection « validations » (Studio contenu). */
(function () {
  "use strict";
  const EM = () => window.EM, TM = () => window.ENTREMIS_TEAM, TD = () => window.ENTREMIS_DATA.team, PL = () => window.ENTREMIS_PILOT, STU = () => window.ENTREMIS_STUDIO;
  const X = { sheet: null, id: null, past: false, val: null };
  // Ce que le client prépare avant le tournage (brief de tournage de Gianni)
  const PREP = [["factures", "Deux factures de chauffage, avant et après, d'un vrai client"], ["temoin", "Un client témoin d'accord pour parler devant la caméra"], ["chantier", "Une installation ou un chantier à filmer"],
    ["autorisations", "Les autorisations de droit à l'image (une par personne filmée)"], ["tenue", "L'équipe en tenue, avec le logo"], ["chiffres", "Les vrais chiffres : années d'expérience, foyers aidés dans le département"]];
  const today = () => window.ENTREMIS_DATA.today.iso;
  const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const longDate = iso => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const shootOf = cid => (PL().flowOf(cid).shoot || {});
  const clients = () => EM().allClients();
  const cname = id => (clients().find(c => c.id === id) || {}).name || "";
  const crewNames = s => (s.crew || []).map(w => TM().member(w).name).filter(n => n && n !== "?");
  function gcalUrl(c, s) {
    if (!s.date) return "";
    const d = s.date.replace(/-/g, ""), t = (s.time || "09:00").replace(":", "") + "00", start = `${d}T${t}`;
    const end = (() => { const x = new Date(`${s.date}T${s.time || "09:00"}:00`); x.setHours(x.getHours() + 4); const p = n => String(n).padStart(2, "0"); return `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T${p(x.getHours())}${p(x.getMinutes())}00`; })();
    const q = new URLSearchParams({ action: "TEMPLATE", text: `Tournage – ${c.name}`, dates: `${start}/${end}`, ctz: "Europe/Paris", location: s.place || "", details: `Équipe : ${crewNames(s).join(", ") || "à définir"}` });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }

  /* ---------- Équipe : le planning ---------- */
  function row(c) {
    const esc = EM().esc, icon = EM().icon, s = shootOf(c.id), vals = STU() ? STU().validations(c.id) : [], ok = vals.filter(v => v.status === "valide").length, corr = vals.filter(v => v.status === "correction").length;
    const prep = PREP.filter(([k]) => (s.prep || {})[k]).length, url = gcalUrl(c, s);
    return `<li class="tg-row">
      <div class="tg-date">${s.date ? `<b>${esc(longDate(s.date))}</b><span>${esc(s.time || "heure à fixer")}</span>` : `<b>À planifier</b>`}</div>
      <div class="tg-main"><a class="link strong" href="#fiche-${esc(c.id)}">${esc(c.name)}</a><span class="vd-sub">${esc([s.place, crewNames(s).join(", ") || "équipe à définir"].filter(Boolean).join(" · "))}</span>
        <span class="tg-tags"><span class="state state-${prep === PREP.length ? "ok" : "neutral"}">Préparé ${prep}/${PREP.length}</span>${vals.length ? `<span class="state state-${corr ? "danger" : ok === vals.length ? "ok" : "warn"}">Scripts validés ${ok}/${vals.length}</span>` : `<span class="state state-neutral">Aucun script envoyé</span>`}</span></div>
      <div class="tg-acts">${url ? `<a class="icon-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Ajouter à Google Agenda" title="Ajouter à Google Agenda">${EM().brand("gcal", "Google Agenda")}</a>` : ""}<button class="btn btn-ghost btn-xs" type="button" data-tg-edit="${esc(c.id)}">${s.date ? "Modifier" : "Planifier"}</button></div></li>`;
  }
  function viewTeam() {
    const all = clients().filter(c => !c.archived), t = today();
    const next = all.filter(c => shootOf(c.id).date >= t).sort((a, b) => (shootOf(a.id).date + (shootOf(a.id).time || "")).localeCompare(shootOf(b.id).date + (shootOf(b.id).time || "")));
    const none = all.filter(c => !shootOf(c.id).date), past = all.filter(c => shootOf(c.id).date && shootOf(c.id).date < t).sort((a, b) => shootOf(b.id).date.localeCompare(shootOf(a.id).date));
    return `<div class="head"><div class="head-text"><h1 class="h1">Tournages</h1><p class="sub">Qui tourne, chez quel client, quel jour, et si le client est prêt.</p></div></div>
      <section class="card"><div class="card-head"><h2 class="h2">À venir <span class="muted tabnum">${next.length}</span></h2></div>${next.length ? `<ul class="tg-list">${next.map(row).join("")}</ul>` : `<p class="body">Aucun tournage prévu. Planifiez-en un ci-dessous.</p>`}</section>
      ${none.length ? `<section class="card"><div class="card-head"><h2 class="h2">À planifier <span class="muted tabnum">${none.length}</span></h2></div><ul class="tg-list">${none.map(row).join("")}</ul></section>` : ""}
      ${past.length ? `<section class="card"><div class="card-head"><h2 class="h2">Déjà tournés <span class="muted tabnum">${past.length}</span></h2><button class="link" type="button" data-tg-past>${X.past ? "Masquer" : "Voir"}</button></div>${X.past ? `<ul class="tg-list">${past.map(row).join("")}</ul>` : ""}</section>` : ""}`;
  }
  function sheet() {
    if (X.sheet !== "edit") return "";
    const esc = EM().esc, c = clients().find(x => x.id === X.id) || {}, s = shootOf(X.id);
    const f = (n, l, v, a) => `<label class="field"><span>${l}</span><input name="${n}" value="${esc(v == null ? "" : v)}" ${a || ""}></label>`;
    return `<div class="scrim" data-tg-close></div><form class="sheet pl-sheet" id="tg-form" novalidate><div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-tg-close>Annuler</button><b>Tournage – ${esc(c.name || "")}</b><button class="link strong" type="submit">Enregistrer</button></div>
      <div class="field-row">${f("date", "Date", s.date, 'type="date"')}${f("time", "Heure", s.time, 'type="time"')}</div>
      ${f("place", "Lieu (adresse)", s.place, 'maxlength="120"')}
      <fieldset class="field"><legend class="lx-lab">Qui y va</legend>${TD().members.map(m => `<label class="check-line"><input type="checkbox" name="crew_${esc(m.id)}" ${(s.crew || []).includes(m.id) ? "checked" : ""}><span>${esc(m.name)}</span></label>`).join("")}</fieldset>
      <fieldset class="field"><legend class="lx-lab">Prêt chez le client</legend>${PREP.map(([k, l]) => `<label class="check-line"><input type="checkbox" name="prep_${k}" ${(s.prep || {})[k] ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</fieldset>
      <label class="field"><span>Note pour l'équipe et le client</span><textarea name="note" rows="3" maxlength="600">${esc(s.note || "")}</textarea></label></form>`;
  }

  /* ---------- Client : « Votre tournage » ---------- */
  function viewClient() {
    const esc = EM().esc, icon = EM().icon, cid = EM().viewId(), s = shootOf(cid), vals = STU() ? STU().validations(cid) : [];
    const VST = { attente: ["À valider", "warn"], valide: ["Validé", "ok"], correction: ["Correction demandée", "neutral"] };
    return `<div class="head"><div class="head-text"><h1 class="h1">Votre tournage</h1><p class="sub">La date, qui vient, ce qu'il faut préparer, et les scripts des vidéos à valider.</p></div></div>
      <section class="card"><div class="card-head"><h2 class="h2">${s.date ? `Le ${esc(longDate(s.date))}${s.time ? " à " + esc(s.time.replace(":", " h ")) : ""}` : "Date à fixer avec nous"}</h2></div>
        ${s.place ? `<p class="body">${icon("pin")} ${esc(s.place)}</p>` : ""}${crewNames(s).length ? `<p class="body">Avec ${esc(crewNames(s).join(" et "))}, de l'équipe Entremis.</p>` : ""}${s.note ? `<p class="body">${esc(s.note)}</p>` : ""}
        <p class="lx-lab">À préparer</p><ul class="lp-checks">${PREP.map(([k, l]) => `<li class="${(s.prep || {})[k] ? "is-ok" : ""}">${(s.prep || {})[k] ? icon("check") : "<i></i>"}<span>${esc(l)}</span></li>`).join("")}</ul>
        <p class="kpi-note">Tous les chiffres dits dans les vidéos doivent être vrais : on les vérifie avec vous avant de tourner.</p></section>
      <section class="card"><div class="card-head"><h2 class="h2">Les scripts à valider <span class="muted tabnum">${vals.filter(v => v.status === "attente").length}</span></h2></div>
        ${vals.length ? vals.map(v => { const [l, k] = VST[v.status] || VST.attente; return `<article class="tg-script"><div class="vd-top"><b>${esc(v.title)}</b><span class="state state-${k}">${l}</span></div>
          <pre class="tg-text">${esc(v.text)}</pre>
          ${v.status === "attente" ? `<form class="tg-answer" data-tg-answer="${esc(v.id)}"><label class="field"><span>Un chiffre à corriger, une phrase à changer ? (facultatif)</span><textarea name="comment" rows="2" maxlength="600"></textarea></label>
            <div class="form-actions"><button class="btn btn-ghost" type="submit" name="act" value="correction">Je demande une correction</button><button class="btn btn-primary" type="submit" name="act" value="valide">${icon("check")}Je valide</button></div></form>`
            : v.comment ? `<p class="kpi-note">Votre remarque : « ${esc(v.comment)} »</p>` : ""}</article>`; }).join("")
          : `<p class="body">Les scripts arrivent ici avant le tournage. Vous vérifiez les chiffres et les phrases, puis vous validez.</p>`}</section>`;
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-tg-edit],[data-tg-close],[data-tg-past]"); if (!t) return false;
    const d = t.dataset;
    if (d.tgEdit) { X.sheet = "edit"; X.id = d.tgEdit; render(); return true; }
    if ("tgClose" in d) { X.sheet = null; render(); return true; }
    if ("tgPast" in d) { X.past = !X.past; render(); return true; }
    return false;
  }
  function onSubmit(e, S, render) {
    const form = e.target;
    if (form.matches && form.matches("[data-tg-answer]")) {
      e.preventDefault();
      const act = (e.submitter && e.submitter.value) || "valide", comment = String(new FormData(form).get("comment") || "").trim();
      if (act === "correction" && !comment) { EM().toast("Écrivez ce qu'il faut corriger."); return true; }
      STU().answer(form.dataset.tgAnswer, act, comment, (EM().viewUser() || {}).name);
      TM().haptic("done"); render(); EM().toast(act === "valide" ? "Merci, le script est validé. L'équipe est prévenue." : "Merci, l'équipe corrige le script et vous le renvoie.");
      return true;
    }
    if (!form.getAttribute || form.getAttribute("id") !== "tg-form") return false;
    e.preventDefault();
    const fd = new FormData(form), g = k => String(fd.get(k) || "").trim(), old = shootOf(X.id), c = clients().find(x => x.id === X.id) || {};
    const shoot = Object.assign({}, old, { date: g("date"), time: g("time"), place: g("place"), note: String(fd.get("note") || "").trim(),
      crew: TD().members.map(m => m.id).filter(id => fd.get("crew_" + id)), prep: Object.fromEntries(PREP.map(([k]) => [k, !!fd.get("prep_" + k)])) });
    // Une tâche pour l'équipe du jour, une seule fois par date
    if (shoot.date && shoot.crew.length && shoot.taskFor !== shoot.date && TM().addTask) {
      TM().addTask({ id: "t" + Date.now().toString(36), title: `Tournage chez ${c.name}`, desc: [shoot.place && "Lieu : " + shoot.place, shoot.note].filter(Boolean).join("\n"), who: shoot.crew[0], also: shoot.crew.slice(1),
        client: c.name, status: "todo", due: shoot.date, time: shoot.time, createdAt: nowIso(), by: S.who });
      shoot.taskFor = shoot.date;
    }
    PL().putFlow(X.id, { shoot });
    X.sheet = null; TM().haptic("done"); render();
    EM().toast(shoot.date ? `Tournage enregistré${shoot.crew.length ? ", tâche créée pour l'équipe du jour" : ""}. Le client le voit dans « Votre tournage ».` : "Enregistré.");
    return true;
  }
  // Pour le client : son tournage approche (7 jours) ; pour l'équipe : les tournages de la semaine
  function notifs(space, cid) {
    const t = today(), in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    if (space === "client") { const s = shootOf(cid); return s.date && s.date >= t && s.date <= in7 ? [{ id: "tg-" + cid + "-" + s.date, text: `Votre tournage est le ${longDate(s.date)}${s.time ? " à " + s.time.replace(":", " h ") : ""}. Pensez à préparer la liste.`, href: "#tournage" }] : []; }
    return clients().filter(c => { const s = shootOf(c.id); return s.date && s.date >= t && s.date <= in7; }).map(c => ({ id: "tgt-" + c.id + "-" + shootOf(c.id).date, text: `Tournage chez ${c.name} ${longDate(shootOf(c.id).date)}`, href: "#tournages" }));
  }
  window.ENTREMIS_SHOOT = { viewTeam, viewClient, sheet, onClick, onSubmit, notifs, count: () => clients().filter(c => { const d = shootOf(c.id).date; return d && d >= today(); }).length, reset: () => { X.sheet = null; } };
})();
