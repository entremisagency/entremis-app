/* Entremis — le compte rendu du mois d'un client, en PDF (Marc, 23 nov. 2026).
   Ce qui compte au moment de renouveler le contrat : les leads reçus et facturables, leurs niveaux (vérifié, qualifié, RDV pris),
   les chantiers signés, les contestations, la facture du mois, le budget pub dépensé chez Meta, les vidéos qui ont amené le plus de leads,
   et où en est l'engagement. L'équipe le télécharge ou l'envoie (Gmail avec le PDF) depuis la fiche du client ;
   le client le télécharge lui-même dans « Leads et facture ». Les envois sont notés (collection « comptes-rendus », équipe seulement). */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM, M = () => window.ENTREMIS_MACHINE;
  let ST = null; const SENT = () => ST || (ST = OPS().makeStore("comptes-rendus", () => []));
  const X = { month: {} };
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const today = () => window.ENTREMIS_DATA.today.iso;
  const label = m => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const shift = (m, n) => { const d = new Date(m + "-15T12:00:00"); d.setMonth(d.getMonth() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  // Par défaut : le mois dernier jusqu'au 5, ensuite le mois en cours
  const defMonth = () => Number(today().slice(8, 10)) <= 5 ? shift(today().slice(0, 7), -1) : today().slice(0, 7);
  const monthOf = cid => X.month[cid] || defMonth();
  // Espaces ordinaires : le PDF (police Helvetica) n'affiche pas l'espace fine des milliers (« 13 500 € » devenait « 13 /500 € »)
  const eur = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: n % 1 ? 2 : 0 }).replace(/[\u202f\u00a0]/g, " ") + " €";
  const name = cid => (EM().allClients().find(c => c.id === cid) || {}).name || cid;

  function stats(cid, m) {
    const b = M().billing(cid, m), prev = M().billing(cid, shift(m, -1)), lv = l => M().levelOf(l), inM = v => String(v || "").slice(0, 7) === m;
    const results = (window.ENTREMIS_CPLUS ? window.ENTREMIS_CPLUS.results() : []).filter(r => inM(r.at) && (r.client_id ? r.client_id === cid : cid === "solaria"));
    const signed = results.filter(r => r.outcome === "signe");
    const contests = (M().contests ? M().contests() : []).filter(c => c.client_id === cid && inM(c.at));
    const meta = window.ENTREMIS_LIVE && window.ENTREMIS_LIVE.META ? (window.ENTREMIS_LIVE.META().list.find(x => x.id === cid) || {}) : {};
    const spend = Number((meta.spend || {})[m]) || 0;
    // Les vidéos qui ont amené le plus de leads ce mois-ci (nom de la pub porté par le lead), sinon les accroches les moins chères
    const byAd = {}; b.all.forEach(l => { if (l.ad) byAd[l.ad] = (byAd[l.ad] || 0) + 1; });
    let videos = Object.entries(byAd).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n, k]) => ({ name: n, text: `${k} lead${k > 1 ? "s" : ""}` }));
    if (!videos.length && window.ENTREMIS_STUDIO && window.ENTREMIS_STUDIO.perfRows) videos = window.ENTREMIS_STUDIO.perfRows(cid).h.filter(r => r.cpl != null).slice(0, 3).map(r => ({ name: r.label, text: `${eur(r.cpl)} par lead` }));
    const eg = window.ENTREMIS_PILOT ? window.ENTREMIS_PILOT.engagement(cid) : {};
    const monthsLeft = eg.end ? Math.max(0, Math.round((new Date(eg.end + "T12:00:00") - new Date(today() + "T12:00:00")) / (30.44 * 864e5))) : null;
    return { m, leads: b.all.length, ok: b.ok.length, out: b.out.length, prevOk: prev.ok.length, amount: b.amount, price: b.price, capped: b.capped, levels: b.levels,
      verified: b.all.filter(l => l.verified === true).length, rdv: b.all.filter(l => lv(l) === "rdv").length,
      signed: signed.length, signedAmount: signed.reduce((a, r) => a + (Number(r.amount) || 0), 0), contests: contests.length, contestsOk: contests.filter(c => c.state === "accepte").length,
      spend, cplClient: spend && b.ok.length ? spend / b.ok.length : 0, videos, end: eg.end || "", monthsLeft };
  }

  async function pdf(cid, m) {
    const s = stats(cid, m), jsPDF = await window.ENTREMIS_GEN.loadPdf(), logo = window.ENTREMIS_LEGAL ? await window.ENTREMIS_LEGAL.logoPng() : null;
    const doc = new jsPDF({ unit: "mm", format: "a4" }), L = 22, W = 166, INK = [6, 18, 28], MUTE = [96, 112, 128], BLUE = [47, 91, 234], SOFT = [244, 247, 250];
    if (logo) doc.addImage(logo, "PNG", L, 14, 9, 9);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text("Entremis", L + 11.5, 20);
    doc.setFontSize(20); doc.text(`Compte rendu de ${label(m)}`, L, 42);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...MUTE); doc.text(name(cid), L, 49);
    doc.setFillColor(...BLUE); doc.roundedRect(L, 53, 16, 1.4, 0.7, 0.7, "F");
    const diff = s.ok - s.prevOk, tiles = [["Leads facturables", String(s.ok), diff ? `${diff > 0 ? "+" : ""}${diff} par rapport au mois d'avant` : "comme le mois d'avant"],
      ["Rendez-vous pris", String(s.rdv), "par l'assistant WhatsApp"], ["Chantiers signés", String(s.signed), s.signedAmount ? eur(s.signedAmount) + " HT" : "notés dans votre espace"],
      ["Facture du mois", eur(s.amount) + " HT", `${eur(s.price)} par lead vérifié${s.capped ? ", plafond atteint" : ""}`]];
    tiles.forEach(([l, v, n], i) => { const x = L + (i % 2) * 85, y = 62 + Math.floor(i / 2) * 34; doc.setFillColor(...SOFT); doc.roundedRect(x, y, 81, 29, 3, 3, "F");
      doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(l, x + 5, y + 8); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...INK); doc.text(v, x + 5, y + 19);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE); doc.text(n, x + 5, y + 25); });
    let y = 140;
    const h = t => { doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(t, L, y); y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); };
    const p = t => { const lines = doc.splitTextToSize(t, W); doc.setTextColor(...INK); doc.text(lines, L, y); y += lines.length * 5.4 + 2; };
    h("Vos leads");
    p(`${s.leads} lead${s.leads > 1 ? "s" : ""} reçu${s.leads > 1 ? "s" : ""}, dont ${s.verified} numéro${s.verified > 1 ? "s" : ""} vérifié${s.verified > 1 ? "s" : ""} par SMS. ${s.ok} facturable${s.ok > 1 ? "s" : ""} : ${s.levels.rdv} avec rendez-vous pris, ${s.levels.qualifie} qualifié${s.levels.qualifie > 1 ? "s" : ""}, ${s.levels.verifie} vérifié${s.levels.verifie > 1 ? "s" : ""}.`);
    p(`${s.out} non facturé${s.out > 1 ? "s" : ""} (locataires, hors zone, doublons, numéros faux).${s.contests ? ` ${s.contests} contestation${s.contests > 1 ? "s" : ""}, dont ${s.contestsOk} acceptée${s.contestsOk > 1 ? "s" : ""}.` : ""}`);
    if (s.spend) { y += 2; h("Votre publicité Meta"); p(`${eur(s.spend)} dépensés ce mois sur votre compte publicitaire${s.ok ? `, soit ${eur(s.cplClient)} de publicité par lead facturable` : ""}.`); }
    if (s.videos.length) { y += 2; h("Les vidéos qui marchent le mieux"); s.videos.forEach(v => p(`•  ${v.name} : ${v.text}`)); }
    if (s.end) { y += 2; h("Votre engagement"); p(s.monthsLeft ? `Votre engagement court jusqu'au ${s.end.slice(8, 10)}/${s.end.slice(5, 7)}/${s.end.slice(0, 4)}, encore ${s.monthsLeft} mois environ.` : `Votre engagement est arrivé à son terme le ${s.end.slice(8, 10)}/${s.end.slice(5, 7)}/${s.end.slice(0, 4)}. Parlons de la suite.`); }
    doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text("Le détail, lead par lead, est dans votre espace client Entremis, page « Leads et facture ».", L, 282);
    return new File([doc.output("blob")], `Compte rendu Entremis – ${name(cid)} – ${label(m)}.pdf`.replace(/[\\/:*?"<>|]/g, "-"), { type: "application/pdf" });
  }
  const save = f => { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  function mailText(cid, m, who) {
    const s = stats(cid, m), c = EM().allClients().find(x => x.id === cid) || {}, first = String(c.contact || "").split(/\s+/)[0];
    return [`Bonjour${first ? " " + first : ""},`, "", `Voici votre compte rendu de ${label(m)} avec Entremis, en pièce jointe.`, "",
      `En résumé : ${s.ok} lead${s.ok > 1 ? "s" : ""} facturable${s.ok > 1 ? "s" : ""}, ${s.rdv} rendez-vous pris, ${s.signed} chantier${s.signed > 1 ? "s" : ""} signé${s.signed > 1 ? "s" : ""}. Facture du mois : ${eur(s.amount)} HT.`,
      "", "Le détail, lead par lead, est dans votre espace : " + location.origin + location.pathname, "", TM().member(who).name + ", Entremis"].join("\n");
  }

  /* Fiche client (équipe) */
  function card(cid) {
    const esc = EM().esc, icon = EM().icon, m = monthOf(cid), s = stats(cid, m), sent = SENT().list.find(x => x.id === cid + "-" + m);
    const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`, c = EM().allClients().find(x => x.id === cid) || {};
    return `<section class="card"><div class="card-head"><h2 class="h2">Compte rendu du mois</h2><span class="mc-month"><button class="icon-btn" type="button" data-cr-month="${esc(cid)}:-1" aria-label="Mois précédent">${icon("back")}</button><b>${label(m)}</b><button class="icon-btn" type="button" data-cr-month="${esc(cid)}:1" aria-label="Mois suivant"${m >= today().slice(0, 7) ? " disabled" : ""}>${icon("chev")}</button></span></div>
      <dl class="lp-dl">${row("Leads facturables", `${s.ok}${s.prevOk !== s.ok ? ` <small class="muted">${s.ok - s.prevOk > 0 ? "+" : ""}${s.ok - s.prevOk} vs mois d'avant</small>` : ""}`)}${row("Rendez-vous pris", s.rdv)}${row("Chantiers signés", s.signed + (s.signedAmount ? ` <small class="muted">${eur(s.signedAmount)} HT</small>` : ""))}${row("Facture", eur(s.amount) + " HT")}${s.spend ? row("Pub Meta dépensée", eur(s.spend)) : ""}${s.end ? row("Engagement", s.monthsLeft ? `encore ${s.monthsLeft} mois` : "terminé") : ""}</dl>
      ${sent ? `<p class="kpi-note">Envoyé le ${String(sent.at).slice(8, 10)}/${String(sent.at).slice(5, 7)} par ${esc(TM().member(sent.by).name)}.</p>` : ""}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-cr-pdf="${esc(cid)}">${icon("download")}Télécharger le PDF</button><button class="btn btn-ghost" type="button" data-cr-send="${esc(cid)}">${window.ENTREMIS_GCAL && window.ENTREMIS_GCAL.gmailReady() ? EM().brand("gmail", "Gmail") : icon("mail")}${c.email ? "Envoyer à " + esc(c.email) : "Envoyer par e-mail"}</button></div></section>`;
  }
  /* « Leads et facture » (client) : le bouton du PDF */
  function clientButton(cid, m) { return `<button class="btn btn-ghost" type="button" data-cr-pdf="${EM().esc(cid)}" data-cr-m="${EM().esc(m)}">${EM().icon("download")}Compte rendu de ${label(m)} (PDF)</button>`; }

  async function send(cid, S) {
    const m = monthOf(cid), c = EM().allClients().find(x => x.id === cid) || {}, subject = `Votre compte rendu de ${label(m)} – Entremis`, body = mailText(cid, m, S.who), G = window.ENTREMIS_GCAL;
    const file = await pdf(cid, m);
    if (c.email && G && G.gmailReady()) {
      try { await G.gmailSend({ to: c.email, subject, text: body, file }); SENT().put({ id: cid + "-" + m, cid, m, at: new Date().toISOString().slice(0, 16), by: S.who, via: "gmail" }); TM().haptic("done"); EM().render(); EM().toast(`Compte rendu envoyé à ${c.email}, avec le PDF.`); return; }
      catch (_) { EM().toast("Gmail n'a pas pu l'envoyer : l'e-mail s'ouvre, joignez le PDF téléchargé."); }
    }
    save(file); window.open(`mailto:${encodeURIComponent(c.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener");
    SENT().put({ id: cid + "-" + m, cid, m, at: new Date().toISOString().slice(0, 16), by: S.who, via: "mail" }); EM().render();
  }
  function onClick(e, S, render) {
    const t = e.target.closest("[data-cr-month],[data-cr-pdf],[data-cr-send]"); if (!t) return false;
    const d = t.dataset;
    if (d.crMonth) { const [cid, n] = d.crMonth.split(":"), next = shift(monthOf(cid), Number(n)); if (next <= today().slice(0, 7)) X.month[cid] = next; render(); return true; }
    if (d.crPdf) { pdf(d.crPdf, d.crM || monthOf(d.crPdf)).then(save).catch(() => EM().toast("Le PDF n'a pas pu être créé.")); return true; }
    if (d.crSend) { send(d.crSend, S).catch(() => EM().toast("Le compte rendu n'a pas pu être préparé.")); return true; }
    return false;
  }
  window.ENTREMIS_MONTH = { card, clientButton, stats, pdf, onClick, init: render => SENT().init(render) };
})();
