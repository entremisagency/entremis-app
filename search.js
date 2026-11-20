/* Entremis — la recherche (⌘K ou Ctrl K, ou un clic sur « Rechercher »).
   Cherche dans ce que voit l'espace ouvert : côté fondateurs les clients, prospects, leads, tâches, documents et pages ;
   côté client les rendez-vous, les demandes, les messages et les pages. Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer. */
(function () {
  "use strict";
  const EM = () => window.EM, D = () => window.ENTREMIS_DATA, TD = () => window.ENTREMIS_DATA.team;
  const Q = { open: false, q: "", sel: 0 };
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function index() {
    const team = EM().S.space === "team", out = [];
    const page = (h, l, i) => out.push({ kind: "Page", icon: i, title: l, sub: "Aller à la page", href: "#" + h });
    if (team) {
      [["equipe", "Mon portail", "home"], ["taches", "Tâches", "check"], ["discussions", "Discussions internes", "chat"], ["processus", "Processus", "grid"], ["notifications", "Notifications", "bell"], ["clients", "Clients", "building"], ["leads", "Leads", "inbox"], ["scripts-equipe", "Scripts", "book"], ["secteurs", "Secteurs et parcours", "tool"], ["appel", "Poste d'appel", "phone"], ["rendez-vous", "Rendez-vous de tous les clients", "cal"], ["zones", "Zones et exclusivités", "pin"], ["sante", "Santé des clients et renouvellements", "gauge"], ["propositions", "Propositions commerciales", "euro"], ["etudes", "Études de cas", "check"], ["marge", "Marge par campagne", "chart"], ["conformite", "Conformité et consentements", "shield"], ["pipeline", "Prospection", "users"], ["appels", "Appels", "phone"], ["marketing", "Marketing et calculateur", "signal"], ["chiffres", "Chiffres", "gauge"], ["avancement", "Avancement", "chart"], ["finances", "Finances", "euro"], ["generer", "Créer un devis ou une facture", "plus"], ["guide", "Guide de l'app", "info"]].forEach(p => page(...p));
      TD().clients.forEach(c => out.push({ kind: "Client", icon: "building", title: c.name, sub: c.trade, href: "#fiche-" + c.id }));
      TD().pipeline.forEach(p => out.push({ kind: "Prospect", icon: "users", title: p.name, sub: `${p.trade} – ${p.city}`, href: "#fiche-" + p.id }));
      window.ENTREMIS_LEADS.list().forEach(l => out.push({ kind: "Lead", icon: "inbox", title: l.name, sub: `${l.trade} – ${l.city}${l.to ? " – donné à " + ((TD().clients.find(c => c.id === l.to) || {}).name || "") : " – à attribuer"}`, href: "#leads", lead: l.id }));
      window.ENTREMIS_TEAM.T.list.filter(t => t.status !== "done").forEach(t => out.push({ kind: "Tâche", icon: "check", title: t.title, sub: t.client || "", href: "#taches" }));
      window.ENTREMIS_OPS.stores.DOCS.list.forEach(d => out.push({ kind: d.kind === "devis" ? "Devis" : "Facture", icon: "euro", title: `${d.number || ""} – ${d.client}`, sub: (Number(d.amount) || 0).toLocaleString("fr-FR") + " € HT", href: "#finances" }));
    } else {
      const c = EM().C();
      [["accueil", "Accueil", "home"], ["agenda", "Agenda", "cal"], ["comptes", c.words.accounts, "inbox"], ["messages", "Messages", "chat"], ["scripts", "Scripts", "book"], ["resultats", "Vos résultats", "chart"], ["dispos", "Vos disponibilités", "clock"], ["parrainage", "Parrainer un installateur", "users"], ["notifications", "Notifications", "bell"], ["aide", "Comment ça marche", "info"]].forEach(p => page(...p));
      c.appointments.forEach(a => out.push({ kind: "Rendez-vous", icon: "cal", title: a.name, sub: `${a.date.slice(8, 10)}/${a.date.slice(5, 7)} à ${a.start} – ${a.city}`, href: "#rdv-" + a.id }));
      c.accounts.forEach(a => out.push({ kind: "Demande", icon: "inbox", title: a.org, sub: `${a.sector} – ${a.city}`, href: "#comptes" }));
      (c.messages || []).forEach(m => out.push({ kind: "Message", icon: "chat", title: m.to, sub: m.subject || "", href: "#message-" + m.id }));
    }
    return out;
  }
  function results() {
    const all = index(), q = norm(Q.q).trim();
    if (!q) return all.filter(x => x.kind === "Page");
    const words = q.split(/\s+/);
    return all.map(x => { const h = norm(x.title + " " + x.sub + " " + x.kind); const ok = words.every(w => h.includes(w)); return ok ? { x, score: norm(x.title).startsWith(words[0]) ? 0 : 1 } : null; })
      .filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 12).map(r => r.x);
  }
  function list() {
    const esc = EM().esc, icon = EM().icon, rs = results();
    if (Q.sel >= rs.length) Q.sel = Math.max(0, rs.length - 1);
    return rs.length ? `<ul class="sp-list" role="listbox" aria-label="Résultats">${rs.map((r, i) => `<li role="option" aria-selected="${i === Q.sel}"><a href="${r.href}" data-sp-go="${i}"${r.lead ? ` data-sp-lead="${r.lead}"` : ""}>${icon(r.icon)}<span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><em>${esc(r.kind)}</em></a></li>`).join("")}</ul>`
      : `<p class="sp-empty">Rien ne correspond à « ${esc(Q.q)} ».</p>`;
  }
  function open() {
    if (Q.open) return;
    Q.open = true; Q.q = ""; Q.sel = 0;
    const el = document.createElement("div");
    el.className = "spot"; el.id = "spot";
    el.innerHTML = `<div class="spot-scrim" data-sp-close></div><div class="spot-box" role="dialog" aria-modal="true" aria-label="Rechercher">
      <label class="spot-in">${EM().icon("search")}<input type="search" placeholder="${EM().S.space === "team" ? "Un client, un lead, une tâche, une page…" : "Un rendez-vous, une demande, une page…"}" aria-label="Rechercher" autocomplete="off"><kbd>Échap</kbd></label>
      <div class="spot-res">${list()}</div></div>`;
    document.querySelector("#root").appendChild(el);
    const i = el.querySelector("input"); i.focus();
    i.addEventListener("input", () => { Q.q = i.value; Q.sel = 0; el.querySelector(".spot-res").innerHTML = list(); });
  }
  function close() { const el = document.querySelector("#spot"); if (el) el.remove(); Q.open = false; }
  function go(a) {
    if (!a) return;
    if (a.dataset.spLead && window.ENTREMIS_LEADS.focus) window.ENTREMIS_LEADS.focus(a.dataset.spLead);
    close(); location.hash = a.getAttribute("href");
    if (a.dataset.spLead) EM().render();
  }

  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); Q.open ? close() : open(); return; }
    if (!Q.open) return;
    const items = [...document.querySelectorAll("#spot [data-sp-go]")];
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); Q.sel = (Q.sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(items.length, 1);
      items.forEach((a, i) => a.parentElement.setAttribute("aria-selected", i === Q.sel)); if (items[Q.sel]) items[Q.sel].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); go(items[Q.sel]); }
  }, true);
  document.addEventListener("click", e => {
    if (e.target.closest("[data-sp-open]")) { e.preventDefault(); open(); return; }
    if (!Q.open) return;
    if (e.target.closest("[data-sp-close]")) { close(); return; }
    const a = e.target.closest("#spot [data-sp-go]"); if (a) { e.preventDefault(); go(a); }
  }, true);
  window.ENTREMIS_SEARCH = { open, close };
})();
