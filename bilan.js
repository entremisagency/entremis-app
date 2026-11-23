/* Entremis — le bilan de la semaine de chaque client (Marc, 23 nov. 2026).
   Calculé tout seul sur les 7 derniers jours : leads reçus, numéros vérifiés, rendez-vous pris, chantiers signés, contestations,
   et le cumul du mois. L'équipe l'envoie en un clic (Gmail avec le PDF, ou copier le texte) ; le lundi, l'app rappelle ceux à envoyer.
   Le client voit « Votre semaine » sur son accueil. Les envois sont notés (collection « bilans », équipe seulement). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  let ST = null; const SENT = () => ST || (ST = OPS().makeStore("bilans", () => []));
  const today = () => window.ENTREMIS_DATA.today.iso;
  const p2 = n => String(n).padStart(2, "0");
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const fr = iso => `${Number(iso.slice(8, 10))} ${["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][Number(iso.slice(5, 7)) - 1]}`;
  const eur = n => Math.round(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ") + " €";   // espaces ordinaires : lisibles dans le PDF
  const monday = () => { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const weekKey = cid => cid + "-" + monday();

  function stats(cid) {
    const from = addDays(today(), -6), to = today(), inW = s => { const d = String(s || "").slice(0, 10); return d >= from && d <= to; };
    const leads = (window.ENTREMIS_LEADS ? window.ENTREMIS_LEADS.list() : []).filter(l => l.to === cid && !l.erased && inW(l.givenAt || l.at));
    const M = window.ENTREMIS_MACHINE, lvl = l => M.levelOf(l);
    const results = (window.ENTREMIS_CPLUS ? window.ENTREMIS_CPLUS.results() : []).filter(r => inW(r.at) && (r.client_id ? r.client_id === cid : cid === "solaria"));
    const signed = results.filter(r => r.outcome === "signe");
    const contests = (M.contests ? M.contests() : []).filter(c => c.client_id === cid && inW(c.at));
    const month = M.billing(cid, today().slice(0, 7));
    const flow = window.ENTREMIS_PILOT ? window.ENTREMIS_PILOT.flowOf(cid) : { steps: {} };
    const STEPS = [["tournage", "le tournage"], ["montage", "le montage des vidéos"], ["campagne", "la mise en ligne des pubs"], ["formulaire", "le formulaire avec code SMS"], ["setter", "l'assistant WhatsApp"]];
    const nextStep = (STEPS.find(([k]) => ((flow.steps || {})[k] || {}).state !== "done") || [])[1] || "";
    return { from, to, leads: leads.length, verified: leads.filter(l => l.verified === true).length, rdv: leads.filter(l => lvl(l) === "rdv").length,
      signed: signed.length, signedAmount: signed.reduce((a, r) => a + (Number(r.amount) || 0), 0), contests: contests.length, month, nextStep };
  }
  function contact(cid) { const c = EM().allClients().find(x => x.id === cid) || {}, f = (window.ENTREMIS_FICHE && window.ENTREMIS_FICHE.info(cid)) || {}; return { name: c.name || cid, first: String(c.contact || f.contact || "").split(/\s+/)[0], email: c.email || f.email || "" }; }
  function text(cid, who) {
    const s = stats(cid), k = contact(cid), me = TM().member(who || EM().S.who).name, url = location.origin + location.pathname;
    const lines = [`Bonjour${k.first ? " " + k.first : ""},`, "", `Votre semaine avec Entremis (du ${fr(s.from)} au ${fr(s.to)}) :`,
      `• ${s.leads} lead${s.leads > 1 ? "s" : ""} reçu${s.leads > 1 ? "s" : ""}${s.leads ? `, dont ${s.verified} vérifié${s.verified > 1 ? "s" : ""} par SMS` : ""}`,
      `• ${s.rdv} rendez-vous pris par l'assistant`,
      `• ${s.signed} chantier${s.signed > 1 ? "s" : ""} signé${s.signed > 1 ? "s" : ""}${s.signedAmount ? ` (${eur(s.signedAmount)} HT)` : ""}`,
      s.contests ? `• ${s.contests} lead${s.contests > 1 ? "s" : ""} contesté${s.contests > 1 ? "s" : ""}` : "",
      "", `Depuis le début du mois : ${s.month.ok.length} lead${s.month.ok.length > 1 ? "s" : ""} facturable${s.month.ok.length > 1 ? "s" : ""}, soit ${eur(s.month.amount)} HT.`,
      s.nextStep ? `Prochaine étape de notre côté : ${s.nextStep}.` : "",
      "", `Le détail, lead par lead, est dans votre espace : ${url}`, "", me + ", Entremis"];
    return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  }
  async function pdf(cid) {
    const s = stats(cid), k = contact(cid), jsPDF = await window.ENTREMIS_GEN.loadPdf(), logo = window.ENTREMIS_LEGAL ? await window.ENTREMIS_LEGAL.logoPng() : null;
    const doc = new jsPDF({ unit: "mm", format: "a4" }), L = 22, INK = [6, 18, 28], MUTE = [96, 112, 128], BLUE = [47, 91, 234], SOFT = [244, 247, 250];
    if (logo) doc.addImage(logo, "PNG", L, 14, 9, 9);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text("Entremis", L + 11.5, 20);
    doc.setFontSize(20); doc.text(`Votre semaine, ${k.name}`, L, 42);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTE); doc.text(`Du ${fr(s.from)} au ${fr(s.to)}`, L, 49);
    doc.setFillColor(...BLUE); doc.roundedRect(L, 53, 16, 1.4, 0.7, 0.7, "F");
    const tiles = [["Leads reçus", String(s.leads)], ["Vérifiés par SMS", String(s.verified)], ["Rendez-vous pris", String(s.rdv)], ["Chantiers signés", String(s.signed)]];
    tiles.forEach(([l, v], i) => { const x = L + (i % 2) * 85, y = 62 + Math.floor(i / 2) * 32; doc.setFillColor(...SOFT); doc.roundedRect(x, y, 80, 26, 3, 3, "F");
      doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(l, x + 5, y + 8); doc.setFontSize(20); doc.setTextColor(...INK); doc.text(v, x + 5, y + 20); });
    doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(`Depuis le début du mois : ${s.month.ok.length} leads facturables, soit ${eur(s.month.amount)} HT (${s.month.price} € le lead vérifié).${s.signedAmount ? ` Chantiers signés cette semaine : ${eur(s.signedAmount)} HT.` : ""}`, 166), L, 136);
    if (s.nextStep) doc.text(doc.splitTextToSize(`Prochaine étape de notre côté : ${s.nextStep}.`, 166), L, 150);
    doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text("Le détail, lead par lead, et la contestation sous 7 jours sont dans votre espace client Entremis.", L, 165);
    return new File([doc.output("blob")], `Bilan Entremis – ${k.name} – ${s.to}.pdf`.replace(/[\\/:*?"<>|]/g, "-"), { type: "application/pdf" });
  }
  const sentOf = cid => SENT().list.find(x => x.id === weekKey(cid));

  /* Fiche client (équipe) : la carte du bilan */
  function card(cid) {
    const esc = EM().esc, icon = EM().icon, s = stats(cid), sent = sentOf(cid), k = contact(cid);
    const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
    return `<section class="card"><div class="card-head"><h2 class="h2">Bilan de la semaine</h2>${sent ? `<span class="state state-ok">Envoyé ${fr(String(sent.at).slice(0, 10))}</span>` : `<span class="muted">du ${fr(s.from)} au ${fr(s.to)}</span>`}</div>
      <dl class="lp-dl">${row("Leads reçus", `${s.leads}${s.leads ? ` <small class="muted">(${s.verified} vérifiés)</small>` : ""}`)}${row("Rendez-vous pris", s.rdv)}${row("Chantiers signés", `${s.signed}${s.signedAmount ? ` <small class="muted">${eur(s.signedAmount)} HT</small>` : ""}`)}${row("Contestations", s.contests)}${row("Depuis le 1er du mois", `${s.month.ok.length} facturables · ${eur(s.month.amount)} HT`)}</dl>
      <div class="form-actions"><button class="btn btn-primary" type="button" data-bilan-send="${esc(cid)}">${icon("mail")}${k.email ? "Envoyer à " + esc(k.email) : "Envoyer par e-mail"}</button><button class="btn btn-ghost" type="button" data-copy="${esc(text(cid))}">${icon("copy")}Copier le texte</button><button class="btn btn-ghost" type="button" data-bilan-pdf="${esc(cid)}">${icon("download")}PDF</button></div></section>`;
  }
  /* Accueil client : « Votre semaine » */
  function clientCard(cid) {
    const s = stats(cid), k = (l, v) => `<div><b class="tabnum">${v}</b><span>${l}</span></div>`;
    return `<section class="card bl-week"><div class="card-head"><h2 class="h2">Votre semaine</h2><span class="muted">du ${fr(s.from)} au ${fr(s.to)}</span></div>
      <div class="bl-grid">${k("leads reçus", s.leads)}${k("vérifiés par SMS", s.verified)}${k("rendez-vous pris", s.rdv)}${k("chantiers signés", s.signed)}</div></section>`;
  }
  // Le lundi (et la semaine), les bilans pas encore envoyés
  const due = () => (EM().S.space === "team" && new Date(today() + "T12:00:00").getDay() >= 1) ? window.ENTREMIS_DATA.team.clients.filter(c => !sentOf(c.id)) : [];

  async function send(cid, S) {
    const k = contact(cid), subject = `Votre semaine avec Entremis – ${k.name}`, body = text(cid, S.who);
    const G = window.ENTREMIS_GCAL;
    if (k.email && G && G.gmailReady()) {
      try { const file = await pdf(cid); await G.gmailSend({ to: k.email, subject, text: body, file });
        SENT().put({ id: weekKey(cid), cid, at: new Date().toISOString().slice(0, 16), by: S.who, via: "gmail" }); TM().haptic("done"); EM().render(); EM().toast(`Bilan envoyé à ${k.email}, avec le PDF.`); return; }
      catch (e) { EM().toast("Gmail n'a pas pu l'envoyer : l'e-mail s'ouvre, joignez le PDF téléchargé."); }
    }
    try { const file = await pdf(cid), a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); } catch (_) {}
    window.open(`mailto:${encodeURIComponent(k.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener");
    SENT().put({ id: weekKey(cid), cid, at: new Date().toISOString().slice(0, 16), by: S.who, via: "mail" }); EM().render();
  }
  function onClick(e, S) {
    const t = e.target.closest("[data-bilan-send],[data-bilan-pdf]"); if (!t) return false;
    if (t.dataset.bilanSend) { send(t.dataset.bilanSend, S); return true; }
    if (t.dataset.bilanPdf) { pdf(t.dataset.bilanPdf).then(f => { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }).catch(() => EM().toast("Le PDF n'a pas pu être créé.")); return true; }
    return false;
  }
  window.ENTREMIS_BILAN = { card, clientCard, due, text, stats, onClick, init: render => SENT().init(render) };
})();
