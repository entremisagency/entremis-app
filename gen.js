/* Entremis — #generer : le générateur de devis et de factures (espace fondateurs).
   À gauche le formulaire (client, lignes, TVA, dates), à droite l'aperçu du document, mis à jour à chaque frappe.
   « Enregistrer » le range dans Finances (collection « documents », avec ses lignes). « Télécharger le PDF » le fabrique
   dans le navigateur (jsPDF, chargé à la demande depuis cdnjs) : rien n'est envoyé ailleurs.
   Les coordonnées d'Entremis (SIRET, adresse, TVA, IBAN) sont à compléter dans ME ci-dessous : rien n'est inventé. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TD = () => window.ENTREMIS_DATA.team, FI = () => window.ENTREMIS_FICHE;
  const ME = { name: "Entremis", email: "contact@entremis.fr", address: "Adresse à compléter", siret: "SIRET à compléter", tva: "N° de TVA à compléter", iban: "IBAN à compléter" };
  const TVA = [["20", "20 %"], ["10", "10 %"], ["5.5", "5,5 %"], ["0", "Pas de TVA"]];
  const today = () => window.ENTREMIS_DATA.today.iso;
  const plus = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fresh = (to, kind) => {
    const c = to && FI().info(to);
    return { kind: kind || "devis", to: to || "solaria", date: today(), due: plus(today(), 30), tva: "20", note: "",
      lines: [{ d: "Rendez-vous qualifiés chez des particuliers, exclusifs", q: 10, pu: c && c.kind === "prospect" ? Math.round((c.value || 2400) / 10) : 240 }, { d: "Mise en place de la campagne (publicités, qualification)", q: 1, pu: 0 }] };
  };
  let G = null;
  const g = () => G || (G = fresh());
  const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
  const money = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ") + " €";
  const frDate = iso => iso ? `${+iso.slice(8, 10)} ${["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : "—";
  const totals = s => { const ht = s.lines.reduce((a, l) => a + num(l.q) * num(l.pu), 0), tva = ht * num(s.tva) / 100; return { ht, tva, ttc: ht + tva }; };
  const parties = () => TD().clients.map(c => [c.id, c.name, "Clients"]).concat(TD().pipeline.filter(p => p.stage !== "won").map(p => [p.id, p.name, "Prospects"]));
  const number = s => s.number || OPS().nextNumber(s.kind);

  function paper(s) {
    const esc = EM().esc, c = (s.to && FI().info(s.to)) || { name: s.client || "Client", contact: "", address: "", siret: "" }, t = totals(s);
    return `<article class="paper" aria-label="Aperçu du document">
      <header class="paper-top"><div><p class="paper-brand legal-brand"><svg aria-hidden="true"><use href="#logo-e"/></svg><b>ENTREMIS</b></p><p>${esc(ME.email)}</p><p>${esc(ME.address)}</p><p>${esc(ME.siret)}</p></div>
        <div class="paper-id"><p class="paper-kind">${s.kind === "devis" ? "Devis" : "Facture"}</p><p class="tabnum">${esc(number(s))}</p><p>Le ${frDate(s.date)}</p></div></header>
      <div class="paper-to"><p class="paper-label">${s.kind === "devis" ? "Pour" : "Facturé à"}</p><p><b>${esc(c.name)}</b></p>${c.contact ? `<p>À l'attention de ${esc(c.contact)}</p>` : ""}<p>${esc(c.address || "")}</p>${c.siret ? `<p>SIRET ${esc(c.siret)}</p>` : ""}</div>
      <table class="paper-lines"><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
        <tbody>${s.lines.filter(l => l.d || num(l.pu)).map(l => `<tr><td>${esc(l.d || "")}</td><td class="tabnum">${num(l.q)}</td><td class="tabnum">${money(num(l.pu))}</td><td class="tabnum">${money(num(l.q) * num(l.pu))}</td></tr>`).join("")}</tbody></table>
      <dl class="paper-sum"><div><dt>Total HT</dt><dd class="tabnum">${money(t.ht)}</dd></div><div><dt>TVA ${num(s.tva) ? String(s.tva).replace(".", ",") + " %" : ""}</dt><dd class="tabnum">${num(s.tva) ? money(t.tva) : "non applicable"}</dd></div><div class="paper-ttc"><dt>Total TTC</dt><dd class="tabnum">${money(t.ttc)}</dd></div></dl>
      ${s.note ? `<p class="paper-note">${esc(s.note)}</p>` : ""}
      <footer class="paper-foot">${s.kind === "devis"
        ? `<p>Devis valable jusqu'au ${frDate(s.due)}. Bon pour accord : date et signature du client.</p>`
        : `<p>À payer avant le ${frDate(s.due)} par virement : ${esc(ME.iban)}.</p><p>En cas de retard : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement. Pas d'escompte pour paiement anticipé.</p>`}
        <p>${esc(ME.name)} – ${esc(ME.siret)} – ${esc(ME.tva)}</p></footer>
    </article>`;
  }

  let TAB = "form";   // téléphone : « Remplir » ou « Aperçu »
  const lineTotal = l => money(num(l.q) * num(l.pu));
  function view(S) {
    const esc = EM().esc, icon = EM().icon, s = g(), t = totals(s), ps = parties(), narrow = EM().isNarrow();
    const opt = (grp) => ps.filter(p => p[2] === grp).map(([id, n]) => `<option value="${id}" ${s.to === id ? "selected" : ""}>${esc(n)}</option>`).join("");
    return `
    <div class="head"><div class="head-text"><h1 class="h1">${s.kind === "devis" ? "Nouveau devis" : "Nouvelle facture"}</h1><p class="sub">${narrow ? "Remplissez, puis touchez Aperçu." : "L'aperçu se met à jour pendant que vous tapez."}</p></div>
      <div class="head-actions"><div class="seg" role="group" aria-label="Type de document">${[["devis", "Devis"], ["facture", "Facture"]].map(([k, l]) => `<button type="button" data-gen-kind="${k}" aria-pressed="${s.kind === k}">${l}</button>`).join("")}</div></div></div>
    ${narrow ? `<div class="gen-tabs" role="group" aria-label="Affichage">${[["form", "Remplir"], ["preview", "Aperçu"]].map(([k, l]) => `<button type="button" data-gen-tab="${k}" aria-pressed="${TAB === k}">${l}</button>`).join("")}</div>` : ""}
    <div class="gen${narrow && TAB === "preview" ? " is-preview" : ""}">
      <form class="card gen-form" id="gen-form" autocomplete="off">
        <div class="field"><label for="gen-to">${s.kind === "devis" ? "Pour" : "Facturé à"}</label><select id="gen-to" name="to"><optgroup label="Clients">${opt("Clients")}</optgroup><optgroup label="Prospects">${opt("Prospects")}</optgroup></select></div>
        <div class="field-row">
          <div class="field"><label for="gen-date">Date</label><input id="gen-date" name="date" type="date" value="${s.date}"></div>
          <div class="field"><label for="gen-due">${s.kind === "devis" ? "Valable jusqu'au" : "À payer avant le"}</label><input id="gen-due" name="due" type="date" value="${s.due}"></div>
        </div>
        <fieldset class="gen-lines"><legend>Lignes</legend>
          <div class="gl-head" aria-hidden="true"><span>Désignation</span><span>Qté</span><span>Prix HT</span><span></span></div>
          ${s.lines.map((l, i) => `<div class="gl">
            <input class="gl-d" name="d-${i}" value="${esc(l.d)}" placeholder="Ce que vous vendez" aria-label="Désignation, ligne ${i + 1}">
            <label class="gl-n"><span>Qté</span><input name="q-${i}" value="${l.q}" inputmode="decimal" aria-label="Quantité, ligne ${i + 1}" placeholder="Qté"></label>
            <label class="gl-n"><span>Prix HT</span><input name="pu-${i}" value="${l.pu}" inputmode="decimal" aria-label="Prix unitaire hors taxes, ligne ${i + 1}" placeholder="Prix HT"></label>
            <span class="gl-t tabnum" data-gen-lt="${i}">${lineTotal(l)} HT</span>
            <button class="icon-btn row-del" type="button" data-gen-del="${i}" aria-label="Retirer la ligne ${i + 1}" ${s.lines.length < 2 ? "disabled" : ""}>${icon("trash")}</button>
          </div>`).join("")}
          <button class="btn btn-ghost btn-xs" type="button" data-gen-add>${icon("plus")}Ajouter une ligne</button>
        </fieldset>
        <div class="field-row">
          <div class="field"><label for="gen-tva">TVA</label><select id="gen-tva" name="tva">${TVA.map(([v, l]) => `<option value="${v}" ${s.tva === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="field gen-total-field"><label>Total TTC</label><p class="gen-total tabnum" data-gen-total>${money(t.ttc)}</p></div>
        </div>
        <div class="field"><label for="gen-note">Note pour le client</label><textarea id="gen-note" name="note" rows="2" placeholder="Facultatif">${esc(s.note)}</textarea></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon("check")}Enregistrer dans Finances</button><button class="btn btn-ghost" type="button" data-gen-pdf>${icon("download")}Télécharger le PDF</button></div>
        <p class="kpi-note">SIRET, adresse, TVA et IBAN d'Entremis : à compléter avant un vrai envoi.</p>
      </form>
      <div class="gen-preview" data-gen-preview>${paper(s)}</div>
      ${narrow ? `<div class="gen-bar"><div><small>Total TTC</small><b class="tabnum" data-gen-total-bar>${money(t.ttc)}</b></div>
        <button class="btn btn-ghost" type="button" data-gen-pdf>${icon("download")}PDF</button>
        <button class="btn btn-primary" type="submit" form="gen-form">${icon("check")}Enregistrer</button></div>` : ""}
    </div>`;
  }

  // Frappe dans le formulaire : on met à jour l'état et l'aperçu, sans redessiner le formulaire (le curseur reste en place)
  function onInput(e) {
    const f = e.target.closest("#gen-form"); if (!f) return false;
    const s = g(), n = e.target.name || "";
    const m = n.match(/^(d|q|pu)-(\d+)$/);
    if (m) s.lines[+m[2]][m[1]] = e.target.value;
    else if (["to", "date", "due", "tva", "note"].includes(n)) s[n] = e.target.value;
    if (n === "to" && window.ENTREMIS_MACHINE) { const v = window.ENTREMIS_MACHINE.vatFor(s.to); if (v.note) { s.tva = "0"; if (!String(s.note).includes(v.note)) s.note = (s.note ? s.note + " " : "") + v.note; setTimeout(() => EM().render(), 0); } }
    const pv = document.querySelector("[data-gen-preview]"); if (pv) pv.innerHTML = paper(s);
    const tt = document.querySelector("[data-gen-total]"); if (tt) tt.textContent = money(totals(s).ttc);
    const tb = document.querySelector("[data-gen-total-bar]"); if (tb) tb.textContent = money(totals(s).ttc);
    if (m) { const lt = document.querySelector(`[data-gen-lt="${m[2]}"]`); if (lt) lt.textContent = lineTotal(s.lines[+m[2]]) + " HT"; }
    return true;
  }
  function onClick(e, S, render) {
    const open = e.target.closest("[data-doc-open]"), inner = e.target.closest("button,a,input,select,label,textarea");
    if (open && (!inner || inner === open)) { VIEW = open.dataset.docOpen; render(); return true; }
    if (e.target.closest("[data-doc-close]")) { VIEW = null; render(); return true; }
    const sh = e.target.closest("[data-doc-share]"); if (sh) { share(sh.dataset.docShare, S); return true; }
    const gm = e.target.closest("[data-doc-gmail]"); if (gm) { MAIL = gm.dataset.docGmail; window.ENTREMIS_GCAL.preload(); render(); setTimeout(() => { const i = document.querySelector('#doc-mail input[name="to"]'); if (i) i.focus(); }, 60); return true; }
    if (e.target.closest("[data-doc-gmail-close]")) { MAIL = null; render(); return true; }
    const t = e.target.closest("[data-gen-kind],[data-gen-add],[data-gen-del],[data-gen-pdf],[data-gen-for],[data-gen-new],[data-doc-pdf],[data-gen-tab]");
    if (!t) return false;
    if (t.dataset.genTab) { TAB = t.dataset.genTab; render(); return true; }
    if (t.dataset.genFor) { G = fresh(t.dataset.genFor); TAB = "form"; return false; }            // le lien suit son chemin vers #generer
    if (t.dataset.genNew) { G = fresh(null, t.dataset.genNew); TAB = "form"; return false; }
    if (t.dataset.genKind) { const s = g(); s.kind = t.dataset.genKind; s.number = null; s.due = plus(s.date, 30); render(); return true; }
    if ("genAdd" in t.dataset) { g().lines.push({ d: "", q: 1, pu: 0 }); render(); const i = document.querySelector(`[name="d-${g().lines.length - 1}"]`); if (i) i.focus(); return true; }
    if (t.dataset.genDel) { const s = g(); if (s.lines.length > 1) { s.lines.splice(+t.dataset.genDel, 1); render(); } return true; }
    if ("genPdf" in t.dataset) { pdf(g()); return true; }
    if (t.dataset.docPdf) {
      const id = t.dataset.docPdf, d = OPS().stores.DOCS.list.find(x => x.id === id); if (!d) return true;
      const c = CACHE[id];
      if (c && c.file && c.key === docKey(d)) { save(c.file, c.file.name); return true; }
      fileOf(d).then(m => save(m.blob, m.filename)).catch(() => EM().toast("Le PDF n'a pas pu être préparé : pas de connexion. Réessayez."));
      return true;
    }
    return false;
  }
  function onSubmit(e, S) {
    if (e.target.id !== "gen-form") return false;
    e.preventDefault();
    const s = g(), t = totals(s), c = FI().info(s.to);
    if (!s.lines.some(l => l.d && num(l.q) * num(l.pu) > 0)) { EM().toast("Ajoutez au moins une ligne avec un prix."); return true; }
    const d = { id: "d" + Date.now().toString(36), kind: s.kind, number: number(s), client: c ? c.name : s.to, to: s.to, amount: Math.round(t.ht * 100) / 100, tva: num(s.tva),
      lines: s.lines.filter(l => l.d).map(l => ({ d: l.d, q: num(l.q), pu: num(l.pu) })), note: s.note, date: s.date, due: s.due, status: "brouillon", by: S.who, createdAt: new Date().toISOString().slice(0, 16), made: true };
    OPS().stores.DOCS.put(d);
    window.ENTREMIS_TEAM.haptic("done");
    G = null; location.hash = "#finances";
    EM().toast(`${d.kind === "devis" ? "Devis" : "Facture"} ${d.number} enregistré${d.kind === "devis" ? "" : "e"} en brouillon dans Finances.`);
    return true;
  }

  /* ---------- PDF ---------- */
  let JSPDF = null;
  function loadPdf() {
    if (JSPDF) return JSPDF;
    JSPDF = new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; sc.onload = () => ok(window.jspdf.jsPDF); sc.onerror = () => { JSPDF = null; ko(new Error("load")); }; document.head.appendChild(sc); });
    return JSPDF;
  }
  // Fabrique le vrai PDF (A4) et le rend sous forme de fichier : { blob, filename }
  async function makePdf(s) {
    const jsPDF = await loadPdf();
    const c = (s.to && FI().info(s.to)) || { name: s.client || "Client" }, t = totals(s), no = s.number || number(s), doc = new jsPDF({ unit: "mm", format: "a4" });
    const ink = [6, 18, 28], mute = [100, 122, 141], L = 20, R = 190;
    let y = 24;
    const logo = window.ENTREMIS_LEGAL ? await window.ENTREMIS_LEGAL.logoPng() : null;
    if (logo) doc.addImage(logo, "PNG", L, y - 7, 9, 9);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...ink); doc.text("ENTREMIS", logo ? L + 11.5 : L, y);
    doc.setFillColor(47, 91, 234); doc.roundedRect(R - 18, y + 14, 18, 1.4, 0.7, 0.7, "F");
    doc.setFontSize(20); doc.text(s.kind === "devis" ? "Devis" : "Facture", R, y, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mute);
    [ME.email, ME.address, ME.siret].forEach((l, i) => doc.text(l, L, y + 6 + i * 4.5));
    [no, "Le " + frDate(s.date)].forEach((l, i) => doc.text(l, R, y + 6 + i * 4.5, { align: "right" }));
    y = 62;
    doc.setFontSize(8); doc.text((s.kind === "devis" ? "Pour" : "Facturé à"), L, y);
    doc.setFontSize(11); doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.text(c.name, L, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mute);
    [c.contact ? "À l'attention de " + c.contact : "", c.address || "", c.siret ? "SIRET " + c.siret : ""].filter(Boolean).forEach((l, i) => doc.text(l, L, y + 11 + i * 4.5));
    y = 94;
    const col = [L, 120, 145, R];
    doc.setDrawColor(220, 228, 236); doc.line(L, y, R, y);
    doc.setFontSize(8); doc.text("Désignation", col[0], y + 5); doc.text("Qté", col[1], y + 5, { align: "right" }); doc.text("Prix unitaire HT", col[2] + 10, y + 5, { align: "right" }); doc.text("Total HT", col[3], y + 5, { align: "right" });
    doc.line(L, y + 8, R, y + 8); y += 14;
    doc.setFontSize(10); doc.setTextColor(...ink);
    s.lines.filter(l => l.d || num(l.pu)).forEach(l => {
      const wrap = doc.splitTextToSize(String(l.d || ""), 92);
      doc.text(wrap, col[0], y); doc.text(String(num(l.q)), col[1], y, { align: "right" }); doc.text(money(num(l.pu)), col[2] + 10, y, { align: "right" }); doc.text(money(num(l.q) * num(l.pu)), col[3], y, { align: "right" });
      y += 5 * wrap.length + 3; doc.setDrawColor(236, 241, 245); doc.line(L, y - 3, R, y - 3);
    });
    y += 4;
    const row = (k, v, b) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(b ? 12 : 10); doc.text(k, 140, y); doc.text(v, R, y, { align: "right" }); y += b ? 8 : 6; };
    row("Total HT", money(t.ht)); row("TVA " + (num(s.tva) ? String(s.tva).replace(".", ",") + " %" : ""), num(s.tva) ? money(t.tva) : "non applicable"); row("Total TTC", money(t.ttc), true);
    if (s.note) { y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(doc.splitTextToSize(s.note, 170), L, y); }
    doc.setFontSize(8); doc.setTextColor(...mute); doc.setFont("helvetica", "normal");
    const foot = s.kind === "devis" ? [`Devis valable jusqu'au ${frDate(s.due)}.`, "Bon pour accord : date et signature du client."] : [`À payer avant le ${frDate(s.due)} par virement : ${ME.iban}.`, "En cas de retard : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement. Pas d'escompte pour paiement anticipé."];
    foot.concat([`${ME.name} – ${ME.siret} – ${ME.tva}`]).forEach((l, i) => doc.text(doc.splitTextToSize(l, 170), L, 268 + i * 5));
    return { blob: doc.output("blob"), filename: `${no} ${c.name}.pdf`.replace(/[\/:]/g, "-") };
  }
  async function pdf(s) {
    let made;
    try { made = await makePdf(s); } catch (_) { EM().toast("Le PDF n'a pas pu être préparé : pas de connexion. Réessayez."); return; }
    await save(made.blob, made.filename);
  }
  async function save(blob, filename) {
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (dl) { await dl.save({ filename, data: blob }); EM().toast("PDF prêt."); return; }
    } catch (err) { if (err && (err.code === "declined" || err.code === "cancelled")) return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    EM().toast(`PDF téléchargé : ${filename}`);
  }


  /* ---------- Ouvrir un devis ou une facture : le vrai PDF, et de quoi l'envoyer ---------- */
  // Le PDF affiché est le fichier lui-même (fabriqué par jsPDF, ou celui qui a été déposé), dessiné page par page par PDF.js.
  // Partager (téléphone) envoie ce fichier en pièce jointe ; E-mail, SMS et WhatsApp ouvrent la messagerie avec le texte prêt.
  let VIEW = null;           // id du document ouvert
  const CACHE = {};          // id → { key, pages: [images], file } ou { key, busy } ou { key, failed }
  const TM = () => window.ENTREMIS_TEAM;
  const idByName = name => { const n = String(name || "").toLowerCase(), x = TD().clients.concat(TD().pipeline).find(c => c.name.toLowerCase() === n); return x ? x.id : ""; };
  // Un document de Finances, sous la forme de l'aperçu et du PDF. Les anciens n'ont qu'un montant : une seule ligne.
  function fromDoc(d) {
    const lines = d.lines && d.lines.length ? d.lines.map(l => ({ d: l.d, q: l.q, pu: l.pu }))
      : [{ d: d.kind === "devis" ? "Rendez-vous qualifiés chez des particuliers, exclusifs" : "Campagne Entremis : rendez-vous qualifiés livrés", q: 1, pu: Number(d.amount) || 0 }];
    return { kind: d.kind, number: d.number, to: d.to || idByName(d.client), client: d.client, date: d.date || today(), due: d.due || "", tva: d.tva != null && d.tva !== "" ? String(d.tva) : "20", note: d.note || "", lines };
  }
  const docKey = d => [d.id, d.updatedAt || d.createdAt || "", d.amount || 0, d.lines ? d.lines.length : 0, d.asset || d.localUrl || ""].join("|");
  async function fileOf(d) {
    const url = d.asset ? "/_blob/" + d.asset : d.localUrl;
    if (url) { const r = await fetch(url); if (!r.ok) throw new Error("file"); return { blob: await r.blob(), filename: `${d.number || "Document"} ${d.client || ""}.pdf`.trim().replace(/[\\/:]/g, "-") }; }
    return makePdf(fromDoc(d));
  }
  let PDFJS = null;
  function loadPdfJs() {
    if (PDFJS) return PDFJS;
    const base = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
    PDFJS = new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = base + "pdf.min.js";
      sc.onload = () => { const lib = window.pdfjsLib; if (!lib) { PDFJS = null; ko(new Error("lib")); return; } lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js"; ok(lib); };
      sc.onerror = () => { PDFJS = null; ko(new Error("load")); }; document.head.appendChild(sc); });
    return PDFJS;
  }
  const pagesHtml = (c, title) => c.pages.map((u, i) => `<img src="${u}" alt="${EM().esc(title)}, page ${i + 1}">`).join("");
  async function mount(id) {
    const d = OPS().stores.DOCS.list.find(x => x.id === id); if (!d) return;
    const key = docKey(d), cur = CACHE[id];
    if (cur && cur.key === key && (cur.pages || cur.failed || Date.now() - cur.t < 20000)) return;   // déjà prêt, raté, ou en cours
    CACHE[id] = { key, busy: true, t: Date.now() };
    // Au-delà de 15 s, on abandonne : l'aperçu de secours s'affiche, le bouton PDF marche toujours
    const late = new Promise((_, ko) => setTimeout(() => ko(new Error("lent")), 15000));
    try {
      await Promise.race([late, (async () => {
      const made = await fileOf(d);
      if (/^image\//.test(made.blob.type)) {   // une photo déposée : on la montre telle quelle
        const url = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(made.blob); });
        CACHE[id] = { key, pages: [url], file: new File([made.blob], d.fileName || made.filename, { type: made.blob.type }) };
        return;
      }
      const lib = await loadPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await made.blob.arrayBuffer()) }).promise;
      const box = document.querySelector(`[data-doc-pages="${id}"]`), w = (box && box.clientWidth) || 520, pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i), base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(3, w * Math.max(2, window.devicePixelRatio || 1) / base.width) });
        const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        // intent « print » : dessin sans attendre l'affichage de l'écran (sinon tout s'arrête quand la page est cachée)
        await page.render({ canvasContext: cv.getContext("2d"), viewport: vp, intent: "print" }).promise;
        pages.push(cv.toDataURL("image/png"));
      }
      CACHE[id] = { key, pages, file: new File([made.blob], made.filename, { type: "application/pdf" }) };
      })()]);
    } catch (_) { if (!(CACHE[id] && CACHE[id].pages)) CACHE[id] = { key, failed: true }; }
    const box = document.querySelector(`[data-doc-pages="${id}"]`); if (!box) return;
    const c = CACHE[id], title = `${d.kind === "devis" ? "Devis" : "Facture"} ${d.number || ""}`;
    box.innerHTML = c.pages ? pagesHtml(c, title) : `<p class="doc-fail">Le PDF n'a pas pu s'afficher ici (pas de connexion ?). Le bouton PDF le télécharge.</p>${paper(fromDoc(d))}`;
  }
  const shareOk = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] })); } catch (_) { return false; } };
  // Les textes prêts à envoyer, dans la voix de celui qui envoie
  function texts(d, S) {
    const s = fromDoc(d), t = totals(s), c = (s.to && FI().info(s.to)) || {}, me = TM().member(S.who).name, devis = d.kind === "devis";
    const hi = `Bonjour${c.contact ? " " + String(c.contact).split(" ")[0] : ""}`, due = d.due ? frDate(d.due) : "", no = d.number || "";
    const mail = devis
      ? `${hi},\n\nVoici notre devis ${no} : ${money(t.ht)} HT, soit ${money(t.ttc)} TTC.${due ? ` Il est valable jusqu'au ${due}.` : ""}\nLe PDF est en pièce jointe. Pour l'accepter, renvoyez-le-nous signé.\n\nBonne journée,\n${me} – Entremis`
      : `${hi},\n\nVoici notre facture ${no} : ${money(t.ttc)} TTC${due ? `, à régler avant le ${due}` : ""}.\nLe PDF est en pièce jointe.\n\nMerci et bonne journée,\n${me} – Entremis`;
    const short = `${hi}, voici notre ${devis ? "devis" : "facture"} ${no} : ${money(t.ttc)} TTC${due ? (devis ? `, valable jusqu'au ${due}` : `, à régler avant le ${due}`) : ""}. ${me}, Entremis`;
    return { mail, short, subject: `${devis ? "Devis" : "Facture"} ${no} – Entremis`, email: c.email || "", phone: String(c.phone || "").replace(/[^\d+]/g, ""), t, c };
  }
  function docPanel(S) {
    const d = VIEW && OPS().stores.DOCS.list.find(x => x.id === VIEW); if (!d) return "";
    const esc = EM().esc, icon = EM().icon, x = texts(d, S), title = `${d.kind === "devis" ? "Devis" : "Facture"} ${d.number || ""}`.trim();
    const intl = x.phone.replace(/^\+/, "").replace(/^0/, "33");
    const mailto = `mailto:${x.email.replace(/[^\w.@+-]/g, "")}?subject=${encodeURIComponent(x.subject)}&body=${encodeURIComponent(x.mail)}`;
    const sms = `sms:${x.phone}?&body=${encodeURIComponent(x.short)}`;
    const wa = `https://wa.me/${intl}?text=${encodeURIComponent(x.short)}`;
    const c = CACHE[d.id], ready = c && c.key === docKey(d) && c.pages, share = shareOk(), gmail = window.ENTREMIS_GCAL && window.ENTREMIS_GCAL.gmailReady();
    setTimeout(() => mount(d.id), 0);
    return `<div class="lp-scrim" data-doc-close></div><aside class="lead-panel doc-panel" aria-label="${esc(title)}">
      <header class="lp-head"><div class="doc-head-id">${EM().fileIcon(d.fileName || "pdf", "fic-lg")}<div><h2 class="h2">${esc(title)}</h2><div class="lp-tags">${OPS().docTag(d)}<span class="src">${esc(d.client || "")}</span></div></div></div>
        <button class="icon-btn" type="button" data-doc-close aria-label="Fermer">${icon("plus")}</button></header>
      <div class="lp-acts doc-acts">
        ${share ? `<button class="lp-act lp-main" type="button" data-doc-share="${d.id}">${icon("share")}<span>Partager</span></button>` : ""}
        ${gmail ? `<button class="lp-act${share ? "" : " lp-main"}" type="button" data-doc-gmail="${d.id}">${icon("mail")}<span>E-mail</span></button>` : `<a class="lp-act${share ? "" : " lp-main"}" href="${esc(mailto)}" target="_blank" rel="noopener">${icon("mail")}<span>E-mail</span></a>`}
        <a class="lp-act" href="${esc(sms)}" target="_blank" rel="noopener">${icon("chat")}<span>SMS</span></a>
        <a class="lp-act" href="${esc(wa)}" target="_blank" rel="noopener">${icon("wa")}<span>WhatsApp</span></a>
        <button class="lp-act" type="button" data-doc-pdf="${d.id}">${icon("download")}<span>${d.fileName && !/\.pdf$/i.test(d.fileName) ? "Fichier" : "PDF"}</span></button>
        <button class="lp-act" type="button" data-copy="${esc(x.mail)}">${icon("copy")}<span>Copier</span></button>
      </div>
      <p class="doc-hint">${share ? "Partager joint le vrai PDF (Mail, Messages, WhatsApp…)." : "Le texte est prêt. Pour l'e-mail, joignez le PDF téléchargé."}</p>
      <dl class="lp-dl"><div><dt>Montant</dt><dd>${money(x.t.ht)} HT – ${money(x.t.ttc)} TTC</dd></div>${x.email ? `<div><dt>E-mail</dt><dd>${esc(x.email)}</dd></div>` : ""}${x.phone ? `<div><dt>Téléphone</dt><dd>${esc(x.c.phone)}</dd></div>` : ""}</dl>
      ${OPS().docNext(d)}
      ${MAIL === d.id ? mailBox(d, x) : ""}
      <div class="doc-pdf" data-doc-pages="${d.id}">${ready ? pagesHtml(c, title) : EM().loader("Préparation du PDF", "Le même fichier que celui que vous envoyez")}</div>
    </aside>`;
  }
  // Écrire l'e-mail avant de l'envoyer depuis son Gmail : le texte est prêt, le PDF part en pièce jointe
  let MAIL = null;
  function mailBox(d, x) {
    const esc = EM().esc;
    return `<form class="doc-mail" id="doc-mail" data-doc="${d.id}" novalidate>
      <label class="field"><span>À</span><input name="to" type="email" required value="${esc(x.email)}" placeholder="adresse du client"></label>
      <label class="field"><span>Objet</span><input name="subject" required value="${esc(x.subject)}"></label>
      <label class="field"><span>Message</span><textarea name="text" rows="7">${esc(x.mail)}</textarea></label>
      <p class="cg-msg doc-mail-msg" role="alert" hidden></p>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${EM().icon("mail")}Envoyer depuis mon Gmail</button><button class="btn btn-ghost" type="button" data-doc-gmail-close>Annuler</button></div>
      <p class="field-help">Le PDF part en pièce jointe. L'e-mail apparaîtra dans vos messages envoyés.</p>
    </form>`;
  }
  async function sendMail(f, S, render) {
    const id = f.dataset.doc, d = OPS().stores.DOCS.list.find(x => x.id === id); if (!d) return;
    const fd = new FormData(f), to = String(fd.get("to") || "").trim(), say = m => { const p = f.querySelector(".doc-mail-msg"); p.textContent = m; p.hidden = false; };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { say("Écrivez l'adresse e-mail du client."); return; }
    const go = f.querySelector('button[type="submit"]'); go.disabled = true; go.textContent = "Envoi…";
    try {
      const c = CACHE[id], file = c && c.file ? c.file : await fileOf(d).then(m => new File([m.blob], m.filename, { type: m.blob.type || "application/pdf" }));
      await window.ENTREMIS_GCAL.gmailSend({ to, subject: String(fd.get("subject") || ""), text: String(fd.get("text") || ""), file });
      if (d.status === "brouillon" || !d.status) OPS().stores.DOCS.put(Object.assign({}, d, { status: "envoye", sentAt: new Date().toISOString().slice(0, 16) }));
      MAIL = null; TM().haptic("done"); render(); EM().toast(`Envoyé depuis votre Gmail à ${to}.`);
    } catch (err) {
      go.disabled = false; go.innerHTML = EM().icon("mail") + "Envoyer depuis mon Gmail";
      say(err && err.type === "popup_closed" ? "La fenêtre Google a été fermée : rien n'est parti." : err && err.status === 403 ? "Google refuse l'envoi : l'autorisation Gmail n'est pas encore donnée dans la console Google." : "L'e-mail n'est pas parti. Réessayez.");
    }
  }
  function share(id, S) {
    const c = CACHE[id], d = OPS().stores.DOCS.list.find(x => x.id === id);
    if (!c || !c.file || !d) { EM().toast("Le PDF se prépare. Réessayez dans un instant."); return; }
    const x = texts(d, S);
    navigator.share({ files: [c.file], title: x.subject, text: x.short }).catch(err => {
      if (err && err.name === "AbortError") return;
      EM().toast("Le partage n'est pas possible ici. Le bouton PDF télécharge le fichier.");
    });
  }
  // Ouvrir au clavier (Entrée) une ligne ou un élément qui ouvre un document ; Échap ferme
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && VIEW && !document.querySelector("#spot,.confirm")) { VIEW = null; EM().render(); return; }
    const o = e.key === "Enter" && e.target.closest && e.target.closest("[data-doc-open]");
    if (o && e.target === o) { e.preventDefault(); VIEW = o.dataset.docOpen; EM().render(); }
  });

  document.addEventListener("input", e => onInput(e));
  document.addEventListener("change", e => { if (e.target.closest("#gen-form")) onInput(e); });
  document.addEventListener("submit", e => { if (e.target.id === "doc-mail") { e.preventDefault(); sendMail(e.target, EM().S, EM().render); } });
  window.ENTREMIS_GEN = { view, onClick, onSubmit, docPanel, loadPdf, save, money, frDate, closeDoc: () => { VIEW = null; }, openDoc: id => { VIEW = id; } };
})();
