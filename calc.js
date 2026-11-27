/* Entremis — Marketing › Calculateur : combien coûte un rendez-vous, et ce qu'il rapporte.
   Deux sens : « J'ai un budget » (budget → rendez-vous) ou « J'ai un objectif » (rendez-vous voulus → budget).
   Les valeurs de départ viennent des exemples de l'app (coût par demande des pubs, taux de Chiffres). Tout se recalcule à la frappe. */
(function () {
  "use strict";
  const EM = () => window.EM, TD = () => window.ENTREMIS_DATA.team;
  let C = null;
  const start = () => {
    const ads = TD().ads || [], spent = ads.reduce((s, a) => s + a.spent, 0), leads = ads.reduce((s, a) => s + a.leads, 0);
    return { mode: "budget", budget: 2000, goal: 10, cpl: Math.round((spent / Math.max(leads, 1)) * 10) / 10 || 10, qual: 21, rdv: 40, show: 91, price: 240 };
  };
  const c = () => C || (C = start());
  const n = v => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : 0; };
  const eur = (v, d) => (Math.round(v * (d ? 100 : 1)) / (d ? 100 : 1)).toLocaleString("fr-FR", { maximumFractionDigits: d ? 2 : 0 }) + " €";
  const int = v => Math.round(v).toLocaleString("fr-FR");

  function compute(s) {
    const per = (n(s.qual) / 100) * (n(s.rdv) / 100);                 // part des demandes qui deviennent un rendez-vous
    const budget = s.mode === "budget" ? n(s.budget) : (per > 0 && n(s.cpl) > 0 ? n(s.goal) / per * n(s.cpl) : 0);
    const demandes = n(s.cpl) > 0 ? budget / n(s.cpl) : 0, qual = demandes * n(s.qual) / 100, rdv = qual * n(s.rdv) / 100, present = rdv * n(s.show) / 100;
    const ca = rdv * n(s.price), marge = ca - budget;
    return { budget, demandes, qual, rdv, present, ca, marge, cpr: rdv ? budget / rdv : 0, roi: budget ? ca / budget : 0 };
  }

  const field = (name, label, val, unit, min, max, step, help) => `<div class="calc-f">
    <div class="calc-l"><label for="calc-${name}">${label}</label><span class="calc-in"><input id="calc-${name}" name="${name}" value="${val}" inputmode="decimal"><em>${unit}</em></span></div>
    <input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${label}">
    ${help ? `<p class="kpi-note">${help}</p>` : ""}</div>`;

  function results(s) {
    const r = compute(s), max = Math.max(r.demandes, 1), bad = r.marge < 0;
    const step = (l, v, sub) => `<li><div class="cf-top"><span>${l}</span><b class="tabnum">${int(v)}</b></div><div class="cf-bar"><i style="--p:${Math.max(2, Math.round(v / max * 100))}%"></i></div>${sub ? `<span class="kpi-note">${sub}</span>` : ""}</li>`;
    return `
      <div class="calc-big">
        <div><p class="kpi-label">${s.mode === "budget" ? "Rendez-vous obtenus" : "Budget pub à prévoir"}</p><p class="calc-hero tabnum">${s.mode === "budget" ? int(r.rdv) : eur(r.budget)}</p><p class="kpi-note">par mois</p></div>
        <div><p class="kpi-label">Coût d'un rendez-vous</p><p class="calc-num tabnum">${r.rdv ? eur(r.cpr) : "—"}</p><p class="kpi-note">vendu ${eur(n(s.price))}</p></div>
        <div><p class="kpi-label">Marge du mois</p><p class="calc-num tabnum ${bad ? "t-danger" : "t-ok"}">${eur(r.marge)}</p><p class="kpi-note">${eur(r.ca)} encaissés − ${eur(r.budget)} de pub</p></div>
      </div>
      <p class="calc-verdict ${bad ? "is-bad" : "is-ok"}">${EM().icon(bad ? "alert" : "check")}<span>${!r.rdv ? "Pas assez de demandes pour obtenir un rendez-vous : augmentez le budget ou baissez le coût par demande."
        : bad ? `Pas rentable : un rendez-vous coûte ${eur(r.cpr)} et se vend ${eur(n(s.price))}. Il faut baisser le coût par demande sous ${eur(n(s.price) * (n(s.qual) / 100) * (n(s.rdv) / 100), true)}, ou mieux qualifier.`
        : `Rentable : chaque euro de pub rapporte ${r.roi.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €. Au-delà de ${eur(n(s.price) * (n(s.qual) / 100) * (n(s.rdv) / 100), true)} par demande, vous perdez de l'argent.`}</span></p>
      <ol class="calc-funnel" aria-label="Du budget au rendez-vous">
        ${step("Demandes reçues", r.demandes, `${eur(r.budget)} de pub ÷ ${eur(n(s.cpl), true)} par demande`)}
        ${step("Demandes qualifiées", r.qual, `${n(s.qual)} % passent les 4 critères`)}
        ${step("Rendez-vous placés", r.rdv, `${n(s.rdv)} % des qualifiées`)}
        ${step("Client présent", r.present, `${n(s.show)} % de présence, les absents sont remplacés`)}
      </ol>`;
  }

  function view() {
    const s = c();
    return `
    <div class="calc">
      <form class="card calc-form" id="calc-form" autocomplete="off">
        <div class="card-head"><h2 class="h2">Vos chiffres</h2><button class="link" type="button" data-calc-reset>Réinitialiser</button></div>
        <div class="seg seg-full" role="group" aria-label="Sens du calcul">${[["budget", "J'ai un budget"], ["goal", "J'ai un objectif"]].map(([k, l]) => `<button type="button" data-calc-mode="${k}" aria-pressed="${s.mode === k}">${l}</button>`).join("")}</div>
        ${s.mode === "budget" ? field("budget", "Budget pub par mois", s.budget, "€", 0, 10000, 50) : field("goal", "Rendez-vous voulus par mois", s.goal, "rdv", 1, 100, 1)}
        ${field("cpl", "Coût d'une demande", s.cpl, "€", 1, 60, 0.5, "")}
        ${field("qual", "Demandes qualifiées", s.qual, "%", 1, 100, 1, "")}
        ${field("rdv", "Qualifiées qui prennent rendez-vous", s.rdv, "%", 1, 100, 1)}
        ${field("show", "Présence au rendez-vous", s.show, "%", 1, 100, 1)}
        ${field("price", "Prix d'un rendez-vous pour le client", s.price, "€", 20, 800, 10)}
      </form>
      <section class="card calc-out" data-calc-out aria-live="polite">${results(s)}</section>
    </div>`;
  }

  // Frappe ou curseur : on met à jour les chiffres sans redessiner le formulaire
  function onInput(e) {
    const f = e.target.closest("#calc-form"); if (!f) return;
    const name = e.target.name; if (!name) return;
    c()[name] = e.target.value;
    f.querySelectorAll(`[name="${name}"]`).forEach(x => { if (x !== e.target) x.value = e.target.value; });
    const out = document.querySelector("[data-calc-out]"); if (out) out.innerHTML = results(c());
  }
  function onClick(e, S, render) {
    const t = e.target.closest("[data-calc-mode],[data-calc-reset]"); if (!t) return false;
    if (t.dataset.calcMode) { c().mode = t.dataset.calcMode; render(); return true; }
    C = start(); render(); return true;
  }
  document.addEventListener("input", onInput);
  window.ENTREMIS_CALC = { view, onClick };
})();
