/* Entremis — la signature en ligne des documents (Marc, 23 nov. 2026).
   L'équipe envoie un document juridique « à signer » à un client (Documents juridiques › Envoyer à signer).
   Le client le lit dans son espace (Documents à signer), tape son nom, coche « Lu et approuvé », signe du doigt ou à la souris.
   La signature est enregistrée par la base elle-même (fonction signer_document : bon client, document pas encore signé, heure du serveur).
   L'équipe télécharge le PDF signé, avec la date, l'heure et l'empreinte du texte. Signature électronique simple (règlement eIDAS).
   Collection « signatures » : une ligne par document, portant le client (client_id) : lui seul la voit. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  let ST = null; const SIG = () => ST || (ST = OPS().makeStore("signatures", () => []));
  const X = { open: null, drawn: false };
  const CL = () => window.ENTREMIS_CLOUD && window.ENTREMIS_CLOUD.on() ? window.ENTREMIS_CLOUD : null;
  const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 19).replace(" ", "T");
  const frDT = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} à ${iso.slice(11, 16)}` : "";
  const sha = async t => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, "0")).join("");
  const forClient = cid => SIG().list.filter(s => s.client_id === cid).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  const pending = cid => forClient(cid).filter(s => s.status === "a-signer");

  // Équipe : créer la demande de signature depuis le générateur juridique
  async function create(snap, S) {
    if (!snap || !snap.cid) { EM().toast("Choisissez d'abord le client du document."); return; }
    const row = { id: "sig" + Date.now().toString(36), client_id: snap.cid, tpl: snap.tpl, title: snap.title, ref: snap.ref, party: snap.party, html: snap.html, text: snap.text,
      hash: await sha(snap.text), status: "a-signer", sentAt: nowIso(), sentBy: S.who };
    await SIG().put(row); TM().haptic("done"); EM().render();
    EM().toast(`Envoyé à signer : le client le trouve dans son espace, page « Documents à signer ».`);
  }

  /* Fiche client (équipe) : les documents envoyés et leur état */
  function teamCard(cid) {
    const list = forClient(cid), esc = EM().esc, icon = EM().icon;
    if (!list.length) return "";
    return `<section class="card"><div class="card-head"><h2 class="h2">Documents à signer</h2><span class="muted">${list.filter(s => s.status === "signe").length} signé${list.filter(s => s.status === "signe").length > 1 ? "s" : ""} sur ${list.length}</span></div>
      <ul class="ac-list">${list.map(s => `<li class="ac-row"><span class="av av-md">${icon("book")}</span><span><b>${esc(s.title)}</b><small>Réf. ${esc(s.ref || "")} · envoyé le ${frDT(s.sentAt)}${s.status === "signe" ? ` · signé le ${frDT(s.signedAt)} par ${esc(s.signerName || "")}` : ""}</small></span>
        <span class="ac-acts">${s.status === "signe" ? `<span class="state state-ok">Signé</span><button class="link" type="button" data-sign-pdf="${esc(s.id)}">PDF signé</button>` : `<span class="state state-warn">À signer</span><button class="link" type="button" data-sign-cancel="${esc(s.id)}">Retirer</button>`}</span></li>`).join("")}</ul></section>`;
  }

  /* Espace client : la liste, puis le document et la signature */
  function view(S) {
    const cid = EM().viewId(), list = forClient(cid), esc = EM().esc, icon = EM().icon, cur = X.open && list.find(s => s.id === X.open);
    if (cur) {
      const signed = cur.status === "signe";
      return `<div class="head"><div class="head-text"><button class="link" type="button" data-sign-back>${icon("back")} Tous vos documents</button><h1 class="h1">${esc(cur.title)}</h1><p class="sub">Réf. ${esc(cur.ref || "")} · envoyé le ${frDT(cur.sentAt)}</p></div></div>
        <div class="sg">
          <div class="sg-doc">${cur.html}</div>
          <section class="card sg-pad">${signed
            ? `<div class="card-head"><h2 class="h2">Signé</h2><span class="state state-ok">${icon("check")}Signé</span></div><p class="body">Signé le ${frDT(cur.signedAt)} par ${esc(cur.signerName || "")}.</p>${cur.signature ? `<img class="sg-img" src="${esc(cur.signature)}" alt="Votre signature">` : ""}`
            : `<form id="sign-form" novalidate><div class="card-head"><h2 class="h2">Signer ce document</h2></div>
              <label class="field"><span>Votre prénom et nom</span><input name="nom" maxlength="80" autocomplete="name" required></label>
              <div class="field"><span class="lx-lab">Votre signature</span><canvas class="sg-canvas" width="600" height="200" aria-label="Zone de signature : signez avec le doigt ou la souris"></canvas><button class="link" type="button" data-sign-clear>Effacer</button></div>
              <label class="check-line"><input type="checkbox" name="ok"><span>J'ai lu ce document et je l'accepte (« Lu et approuvé »).</span></label>
              <p class="field-help">Votre signature, votre nom, la date et l'heure sont enregistrés avec le document. Entremis vous en garde une copie.</p>
              <div class="form-actions"><button class="btn btn-primary" type="submit">${icon("check")}Signer</button></div></form>`}</section>
        </div>`;
    }
    return `<div class="head"><div class="head-text"><h1 class="h1">Documents à signer</h1><p class="sub">Vos contrats et documents envoyés par Entremis. Lisez, puis signez en ligne.</p></div></div>
      <section class="card">${list.length ? `<ul class="ac-list">${list.map(s => `<li class="ac-row is-link" data-sign-open="${esc(s.id)}" tabindex="0" role="button"><span class="av av-md">${icon("book")}</span><span><b>${esc(s.title)}</b><small>Réf. ${esc(s.ref || "")} · ${s.status === "signe" ? "signé le " + frDT(s.signedAt) : "envoyé le " + frDT(s.sentAt)}</small></span>
        <span class="ac-acts">${s.status === "signe" ? `<span class="state state-ok">Signé</span>` : `<span class="state state-warn">À signer</span>`}</span></li>`).join("")}</ul>` : `<p class="body">Aucun document pour l'instant. Quand Entremis vous envoie un contrat, il arrive ici.</p>`}</section>`;
  }

  // La zone de signature : doigt ou souris
  function bindPad() {
    const c = document.querySelector(".sg-canvas"); if (!c || c.dataset.ready) return; c.dataset.ready = "1"; X.drawn = false;
    const g = c.getContext("2d"); g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#06121C";
    let on = false;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.addEventListener("pointerdown", e => { on = true; c.setPointerCapture(e.pointerId); const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); e.preventDefault(); });
    c.addEventListener("pointermove", e => { if (!on) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); X.drawn = true; e.preventDefault(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => c.addEventListener(ev, () => { on = false; }));
  }
  const observer = new MutationObserver(() => bindPad());
  const watchView = () => { const v = document.getElementById("view"); if (v) observer.observe(v, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchView); else watchView();

  async function signedPdf(s) {
    const jsPDF = await window.ENTREMIS_GEN.loadPdf(), logo = window.ENTREMIS_LEGAL ? await window.ENTREMIS_LEGAL.logoPng() : null, doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = 22, W = 166, INK = [6, 18, 28], MUTE = [96, 112, 128]; let y = 24;
    if (logo) doc.addImage(logo, "PNG", L, 12, 8, 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK); doc.text("Entremis", L + 10.5, 17.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTE); doc.text(`Réf. ${s.ref || ""} · document signé électroniquement`, 188, 17.6, { align: "right" });
    y = 30; doc.setFontSize(9.2); doc.setTextColor(...INK);
    String(s.text || "").split("\n").forEach(line => { const ls = line ? doc.splitTextToSize(line, W) : [""]; if (y + ls.length * 4.4 > 250) { doc.addPage(); y = 24; } doc.setFont("helvetica", /^(Article \d+\.|Conditions particulières)/.test(line) ? "bold" : "normal"); doc.text(ls, L, y); y += ls.length * 4.4 + (line ? 0.6 : 1.6); });
    if (y > 215) { doc.addPage(); y = 24; }
    y += 6; doc.setDrawColor(222, 229, 236); doc.roundedRect(L, y, W, 52, 3, 3, "S");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Signature électronique", L + 5, y + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6); doc.setTextColor(...MUTE);
    doc.text([`Signé par : ${s.signerName || ""}`, `Le : ${frDT(s.signedAt)} (heure de Paris), via l'espace client Entremis`, `Document envoyé le ${frDT(s.sentAt)} · « Lu et approuvé » coché`, `Empreinte du texte (SHA-256) : ${String(s.hash || "").slice(0, 32)}…`], L + 5, y + 15);
    if (s.signature) doc.addImage(s.signature, "PNG", L + W - 70, y + 10, 64, 21);
    return new File([doc.output("blob")], `${s.title} – signé – ${s.ref || ""}.pdf`.replace(/[\\/:*?"<>|]/g, "-"), { type: "application/pdf" });
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-sign-open],[data-sign-back],[data-sign-clear],[data-sign-pdf],[data-sign-cancel]"); if (!t) return false;
    const d = t.dataset;
    if (d.signOpen) { X.open = d.signOpen; render(); window.scrollTo(0, 0); return true; }
    if ("signBack" in d) { X.open = null; render(); return true; }
    if ("signClear" in d) { const c = document.querySelector(".sg-canvas"); if (c) { c.getContext("2d").clearRect(0, 0, c.width, c.height); X.drawn = false; } return true; }
    if (d.signPdf) { const s = SIG().list.find(x => x.id === d.signPdf); if (s) signedPdf(s).then(f => { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }); return true; }
    if (d.signCancel) { EM().confirm({ title: "Retirer ce document ?", text: "Le client ne le verra plus dans son espace.", ok: "Retirer" }).then(y => { if (!y) return; SIG().remove(d.signCancel); render(); }); return true; }
    return false;
  }
  async function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "sign-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), nom = String(fd.get("nom") || "").trim(), c = document.querySelector(".sg-canvas"), s = SIG().list.find(x => x.id === X.open);
    if (nom.length < 2) { EM().toast("Écrivez votre prénom et votre nom."); return true; }
    if (!X.drawn) { EM().toast("Signez dans le cadre, avec le doigt ou la souris."); return true; }
    if (!fd.get("ok")) { EM().toast("Cochez « Lu et approuvé » pour signer."); return true; }
    const png = c.toDataURL("image/png");
    try {
      if (CL()) { const r = await CL().rpc("signer_document", { p_id: s.id, p_nom: nom, p_signature: png }); if (r && r.error) throw r.error; if (CL().resync) CL().resync(); }
      else SIG().put(Object.assign({}, s, { status: "signe", signerName: nom, signature: png, signedAt: nowIso() }));
      TM().haptic("done"); EM().toast("Document signé. Merci, Entremis en reçoit une copie."); render();
    } catch (err) { EM().toast((err && err.message) || "La signature n'a pas pu être enregistrée. Réessayez."); }
    return true;
  }
  // Notifications : côté client, ce qui attend sa signature ; côté équipe, ce qui vient d'être signé
  function notifs(space) {
    if (space === "client") return pending(EM().viewId()).map(s => ({ id: "sg-" + s.id, text: `Un document attend votre signature : ${s.title}`, href: "#signer" }));
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    return SIG().list.filter(s => s.status === "signe" && String(s.signedAt).slice(0, 10) >= since).map(s => ({ id: "sgd-" + s.id, text: `${s.signerName || "Le client"} a signé « ${s.title} »`, href: "#fiche-" + s.client_id }));
  }
  window.ENTREMIS_SIGN = { create, teamCard, view, onClick, onSubmit, notifs, pendingCount: cid => pending(cid).length, init: render => SIG().init(render), reset: () => { X.open = null; } };
})();
