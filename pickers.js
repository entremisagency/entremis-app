/* Entremis — sélecteurs de date et d'heure façon Apple (Marc, 20 nov. 2026).
   Chaque <input type="date"> ou <input type="time"> affiché devient une pastille grise (« 19 nov. 2026 », « 15:00 »).
   Au toucher : un calendrier du mois (le jour choisi dans un rond bleu, aujourd'hui en bleu), ou deux roues qui défilent
   pour l'heure (heures, minutes de 5 en 5), avec une bande grise au centre comme sur l'iPhone.
   Le vrai champ reste dans le formulaire (caché) : l'enregistrement et les aperçus marchent comme avant
   (on lui envoie les mêmes événements « input » et « change » que le champ du navigateur). */
(function () {
  "use strict";
  const EM = () => window.EM;
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MSHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const WD = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const p2 = n => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`;
  const today = () => window.ENTREMIS_DATA.today.iso;   // le jour de la maquette
  const dateLabel = v => { if (!v) return ""; const [y, m, d] = v.split("-").map(Number); return `${d} ${MSHORT[m - 1]} ${y}`; };
  const near5 = mm => p2(Math.min(55, Math.round((Number(mm) || 0) / 5) * 5));
  let OPEN = null;      // { inp, pill, kind, y, m }
  let seq = 0;
  const ROW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tw-row")) || 36;

  // Remplace les champs du navigateur par les pastilles (appelé après chaque affichage)
  function enhance(root) {
    (root || document).querySelectorAll('input[type="date"]:not([data-dp]),input[type="time"]:not([data-dp])').forEach(inp => {
      const kind = inp.type, v = inp.getAttribute("value") || inp.value || "";
      inp.dataset.dp = kind; if (!inp.id) inp.id = "dp-" + (++seq);
      inp.type = "hidden"; inp.value = v;
      const pill = document.createElement("button");
      pill.type = "button"; pill.className = "dp-pill" + (kind === "time" ? " is-time" : ""); pill.dataset.dpFor = inp.id; pill.setAttribute("aria-haspopup", "dialog");
      inp.after(pill); paint(inp);
    });
  }
  function paint(inp) {
    const pill = document.querySelector(`[data-dp-for="${inp.id}"]`); if (!pill) return;
    const v = inp.value, time = inp.dataset.dp === "time";
    pill.textContent = v ? (time ? v : dateLabel(v)) : (time ? "Heure" : "Choisir");
    pill.classList.toggle("is-empty", !v);
    const host = inp.closest("label,.field"), lab = host && host.querySelector("span,label");
    pill.setAttribute("aria-label", `${lab && lab !== pill ? lab.textContent + " : " : ""}${v ? pill.textContent : "vide"}. Modifier`);
  }
  function setValue(v) {
    if (!OPEN) return;
    const { inp } = OPEN;
    inp.value = v; paint(inp);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ---------- La fenêtre : calendrier ou roues ---------- */
  const host = () => document.getElementById("root") || document.body;   // dans le cadre du téléphone en aperçu
  function close() { const p = document.querySelector(".dp-pop"); if (p) p.remove(); const s = document.querySelector(".dp-scrim"); if (s) s.remove(); if (OPEN && OPEN.pill && document.contains(OPEN.pill)) OPEN.pill.setAttribute("aria-expanded", "false"); OPEN = null; }
  function open(pill) {
    const inp = document.getElementById(pill.dataset.dpFor); if (!inp) return;
    close();
    const kind = inp.dataset.dp, v = inp.value || today(), [y, m] = kind === "date" ? v.split("-").map(Number) : [0, 1];
    OPEN = { inp, pill, kind, y, m: m - 1 };
    pill.setAttribute("aria-expanded", "true");
    draw();
  }
  function calHtml() {
    const { y, m, inp } = OPEN, sel = inp.value, t = today(), icon = EM().icon;
    const startDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let cells = ""; for (let i = 0; i < startDow; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const v = iso(y, m, d), on = v === sel, isT = v === t;
      cells += `<button type="button" class="dp-day${on ? " is-on" : ""}${isT ? " is-today" : ""}" data-dp-day="${v}" aria-pressed="${on}" aria-label="${d} ${MONTHS[m]} ${y}${isT ? ", aujourd'hui" : ""}">${d}</button>`;
    }
    return `<div class="dp-head"><b>${MONTHS[m]} ${y}</b><span><button type="button" class="dp-nav is-prev" data-dp-nav="-1" aria-label="Mois précédent">${icon("chev")}</button><button type="button" class="dp-nav" data-dp-nav="1" aria-label="Mois suivant">${icon("chev")}</button></span></div>
      <div class="dp-wd" aria-hidden="true">${WD.map(w => `<span>${w}</span>`).join("")}</div>
      <div class="dp-grid">${cells}</div>
      <div class="dp-foot"><button type="button" class="link" data-dp-day="${t}">Aujourd'hui</button>${inp.required ? "" : `<button type="button" class="link" data-dp-day="">Effacer</button>`}</div>`;
  }
  function timeHtml() {
    const [h, mi] = (OPEN.inp.value || "09:00").split(":");
    const col = (name, items, cur, lab) => `<div class="tw-col" data-tw="${name}" aria-label="${lab}">${"<i></i>".repeat(2)}${items.map(x => `<button type="button" class="tw-item${x === cur ? " is-on" : ""}" data-tw-val="${x}">${x}</button>`).join("")}${"<i></i>".repeat(2)}</div>`;
    return `<div class="tw"><span class="tw-band" aria-hidden="true"></span>${col("h", HOURS, h, "Heures")}<b class="tw-sep" aria-hidden="true">:</b>${col("m", MINS, near5(mi), "Minutes")}</div>
      <div class="dp-foot">${OPEN.inp.required ? "<span></span>" : `<button type="button" class="link" data-dp-clear>Effacer</button>`}<button type="button" class="link strong" data-dp-done>OK</button></div>`;
  }
  function draw() {
    const old = document.querySelector(".dp-pop"); if (old) old.remove();
    const narrow = EM().isNarrow();
    if (narrow && !document.querySelector(".dp-scrim")) { const s = document.createElement("div"); s.className = "dp-scrim"; s.dataset.dpClose = ""; host().appendChild(s); }
    const pop = document.createElement("div");
    pop.className = "dp-pop" + (OPEN.kind === "time" ? " is-time" : "") + (narrow ? " is-sheet" : "");
    pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", OPEN.kind === "time" ? "Choisir l'heure" : "Choisir la date");
    pop.innerHTML = OPEN.kind === "time" ? timeHtml() : calHtml();
    host().appendChild(pop);
    if (!narrow) place(pop);
    if (OPEN.kind === "time") initWheels(pop);
    else { const f = pop.querySelector(".dp-day.is-on") || pop.querySelector(".dp-day.is-today") || pop.querySelector(".dp-day"); if (f) f.focus({ preventScroll: true }); }
  }
  // Sur ordinateur : sous la pastille, sans sortir de l'écran
  function place(pop) {
    const r = OPEN.pill.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, gap = 8;
    const top = r.bottom + gap + h > vh - gap ? Math.max(gap, r.top - gap - h) : r.bottom + gap;
    pop.style.top = top + "px"; pop.style.left = Math.min(Math.max(gap, r.left), vw - w - gap) + "px";
  }
  // Les roues : on fait défiler, la valeur au centre est choisie
  function initWheels(pop) {
    const row = ROW();
    pop.querySelectorAll(".tw-col").forEach(col => {
      const on = col.querySelector(".tw-item.is-on") || col.querySelector(".tw-item");
      const items = [...col.querySelectorAll(".tw-item")];
      col.scrollTop = items.indexOf(on) * row;
      // Le placement de départ ne choisit rien : seule la main de l'utilisateur change l'heure
      let tm = null, ready = false; setTimeout(() => { ready = true; }, 200);
      col.addEventListener("scroll", () => { if (!ready) return; clearTimeout(tm); tm = setTimeout(() => pick(col), 90); }, { passive: true });
    });
  }
  function pick(col) {
    if (!OPEN || OPEN.kind !== "time") return;
    const items = [...col.querySelectorAll(".tw-item")], i = Math.max(0, Math.min(items.length - 1, Math.round(col.scrollTop / ROW())));
    items.forEach((x, j) => x.classList.toggle("is-on", j === i));
    const pop = col.closest(".dp-pop"), h = pop.querySelector('[data-tw="h"] .tw-item.is-on'), m = pop.querySelector('[data-tw="m"] .tw-item.is-on');
    if (h && m) setValue(`${h.dataset.twVal}:${m.dataset.twVal}`);
  }

  document.addEventListener("click", e => {
    const pill = e.target.closest("[data-dp-for]");
    if (pill) { e.preventDefault(); if (OPEN && OPEN.pill === pill) close(); else open(pill); return; }
    if (!OPEN) return;
    const pop = e.target.closest(".dp-pop");
    if (!pop) { close(); return; }                     // un clic ailleurs ferme, et le clic continue son chemin
    const day = e.target.closest("[data-dp-day]");
    if (day) { setValue(day.dataset.dpDay); const p = OPEN.pill; close(); if (p && document.contains(p)) p.focus({ preventScroll: true }); return; }
    const nav = e.target.closest("[data-dp-nav]");
    if (nav) { const n = OPEN.m + Number(nav.dataset.dpNav); OPEN.y += Math.floor(n / 12); OPEN.m = ((n % 12) + 12) % 12; draw(); return; }
    const tw = e.target.closest("[data-tw-val]");
    if (tw) { const col = tw.closest(".tw-col"), items = [...col.querySelectorAll(".tw-item")]; col.scrollTo({ top: items.indexOf(tw) * ROW(), behavior: "smooth" }); setTimeout(() => pick(col), 260); return; }
    if (e.target.closest("[data-dp-clear]")) { setValue(""); close(); return; }
    if (e.target.closest("[data-dp-done]")) { const p = OPEN.pill; close(); if (p && document.contains(p)) p.focus({ preventScroll: true }); }
  });
  document.addEventListener("click", e => { if (OPEN && e.target.closest("[data-dp-close]")) close(); });
  // Échap ferme d'abord le sélecteur (et pas la fenêtre en dessous) ; flèches pour passer d'un jour à l'autre
  document.addEventListener("keydown", e => {
    if (!OPEN) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); const p = OPEN.pill; close(); if (p && document.contains(p)) p.focus({ preventScroll: true }); return; }
    const d = e.target.closest && e.target.closest(".dp-day"); if (!d) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
    e.preventDefault();
    const days = [...document.querySelectorAll(".dp-day")], i = days.indexOf(d), next = days[i + step];
    if (next) next.focus(); else { const n = OPEN.m + (step > 0 ? 1 : -1); OPEN.y += Math.floor(n / 12); OPEN.m = ((n % 12) + 12) % 12; draw(); }
  }, true);
  window.addEventListener("resize", () => { if (OPEN && !EM().isNarrow()) { const p = document.querySelector(".dp-pop"); if (p) place(p); } });

  window.ENTREMIS_PICK = { enhance, close };
})();
