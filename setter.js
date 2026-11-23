/* Entremis — la conversation WhatsApp de l'assistant (setter) avec un lead, sur la fiche du lead (Marc, 23 nov. 2026).
   Les messages arrivent de deux façons : collés depuis WhatsApp (« Exporter la discussion » ou copier-coller), ou envoyés par l'automatisation
   ou par Claude (outil « noter_conversation_setter »). Une fiche par lead dans la collection « setter » (équipe seulement) :
   { id: lead, messages: [{ at, from: "setter" | "lead", text }], outcome: "qualifie" | "pas-qualifie" | "sans-reponse" | "", outcomeAt }.
   « Qualifié » fait aussi passer le lead à l'étape « Qualifié ». */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  let ST = null; const SET = () => ST || (ST = OPS().makeStore("setter", () => []));
  const X = { paste: null };
  const OUT = { qualifie: ["Qualifié", "ok"], "pas-qualifie": ["Pas qualifié", "danger"], "sans-reponse": ["Sans réponse", "warn"] };
  const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
  const whenShort = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${iso.length > 10 ? " " + iso.slice(11, 16) : ""}` : "";
  // Lit un export WhatsApp ou un copier-coller : « [23/11/2026 14:02:11] Nom : texte », « 23/11/2026 14:02 - Nom: texte » ou « Nom : texte »
  function parse(raw, leadName) {
    const out = [], first = String(leadName || "").split(/\s+/)[0].toLowerCase();
    String(raw || "").split(/\r?\n/).forEach(line => {
      const m = line.match(/^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ ,à]+(\d{1,2}):(\d{2})(?::\d{2})?\]?\s*-?\s*([^:]{1,40}?)\s?:\s(.*)$/) || line.match(/^()()()()()([^:]{1,30}?)\s?:\s(.+)$/);
      if (!m) { if (out.length && line.trim()) out[out.length - 1].text += "\n" + line.trim(); return; }
      const [, d, mo, y, h, mi, who, text] = m, yr = y ? (y.length === 2 ? "20" + y : y) : "";
      const at = d ? `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}` : "";
      out.push({ at, who: who.trim().toLowerCase(), text: String(text).trim().slice(0, 2000) });
    });
    // Qui parle : le setter (assistant, Entremis…), le lead (son prénom, « client »…) ; un inconnu est le lead s'il n'y en a pas d'autre
    const kind = w => /setter|assistant|entremis|bot|\bia\b|conseill/.test(w) ? "setter" : /^(lead|client|prospect)$/.test(w) || (first && w.includes(first)) ? "lead" : "";
    const names = [...new Set(out.map(m => m.who))], hasLead = names.some(w => kind(w) === "lead"), firstUnknown = names.find(w => !kind(w));
    return out.filter(x => x.text).slice(0, 400).map(m => ({ at: m.at, from: kind(m.who) || (!hasLead && m.who === firstUnknown ? "lead" : "setter"), text: m.text }));
  }
  function box(l) {
    const esc = EM().esc, icon = EM().icon, s = SET().list.find(x => x.id === l.id), msgs = (s && s.messages) || [], o = s && OUT[s.outcome];
    return `<section class="lp-box"><div class="sw-head"><p class="lp-label">Conversation WhatsApp</p>${o ? `<span class="state state-${o[1]}">${o[0]}</span>` : ""}</div>
      ${msgs.length ? `<ol class="sw-chat">${msgs.slice(-40).map(m => `<li class="sw-${m.from === "lead" ? "lead" : "setter"}"><p>${esc(m.text)}</p>${m.at ? `<span>${whenShort(m.at)}</span>` : ""}</li>`).join("")}</ol>${msgs.length > 40 ? `<p class="kpi-note">Les 40 derniers messages sur ${msgs.length}.</p>` : ""}`
        : `<p class="body">Pas encore de conversation. Collez-la depuis WhatsApp, ou laissez l'assistant l'envoyer.</p>`}
      ${X.paste === l.id ? `<form id="sw-form" data-sw-lead="${esc(l.id)}"><label class="field"><span>Collez la conversation (une ligne par message : « Nom : texte »)</span><textarea name="raw" rows="6"></textarea></label>
          <div class="form-actions"><button class="btn btn-ghost" type="button" data-sw-paste="">Annuler</button><button class="btn btn-primary" type="submit">${icon("check")}Ajouter</button></div></form>`
        : `<div class="sw-acts"><button class="btn btn-ghost btn-xs" type="button" data-sw-paste="${esc(l.id)}">${icon("copy")}Coller la conversation</button>${Object.entries(OUT).map(([k, [t]]) => `<button class="pill${s && s.outcome === k ? " is-on" : ""}" type="button" data-sw-out="${esc(l.id)}:${k}" aria-pressed="${!!(s && s.outcome === k)}">${t}</button>`).join("")}</div>`}</section>`;
  }
  function save(id, patch) { const cur = SET().list.find(x => x.id === id) || { id, messages: [] }; const n = Object.assign({}, cur, patch, { updatedAt: nowIso() }); SET().put(n); return n; }
  function onClick(e, S, render) {
    const t = e.target.closest("[data-sw-paste],[data-sw-out]"); if (!t) return false;
    if (t.dataset.swPaste !== undefined) { X.paste = t.dataset.swPaste || null; render(); if (X.paste) setTimeout(() => { const a = document.querySelector("#sw-form textarea"); if (a) a.focus(); }, 60); return true; }
    const [id, k] = t.dataset.swOut.split(":"), cur = SET().list.find(x => x.id === id), next = cur && cur.outcome === k ? "" : k;
    save(id, { outcome: next, outcomeAt: next ? nowIso() : "", outcomeBy: S.who });
    if (next === "qualifie") { const l = window.ENTREMIS_LEADS.list().find(x => x.id === id); if (l && ["nouveau", "rappele"].includes(l.status || "nouveau")) window.ENTREMIS_LEADS.put(Object.assign({}, l, { status: "qualifie" })); }
    TM().haptic("tap"); render(); return true;
  }
  function onSubmit(e, S, render) {
    if (!e.target.getAttribute || e.target.getAttribute("id") !== "sw-form") return false;
    e.preventDefault();
    const id = e.target.dataset.swLead, l = window.ENTREMIS_LEADS.list().find(x => x.id === id) || {}, msgs = parse(new FormData(e.target).get("raw"), l.name);
    if (!msgs.length) { EM().toast("Rien de lisible. Une ligne par message, sous la forme « Nom : texte »."); return true; }
    const cur = SET().list.find(x => x.id === id), seen = new Set(((cur && cur.messages) || []).map(m => m.at + "|" + m.text));
    save(id, { messages: ((cur && cur.messages) || []).concat(msgs.filter(m => !seen.has(m.at + "|" + m.text))), pastedBy: S.who });
    X.paste = null; TM().haptic("done"); render(); EM().toast(`${msgs.length} message${msgs.length > 1 ? "s" : ""} ajouté${msgs.length > 1 ? "s" : ""} à la fiche du lead.`); return true;
  }
  window.ENTREMIS_SETTER = { box, parse, onClick, onSubmit, init: render => SET().init(render), reset: () => { X.paste = null; } };
})();
