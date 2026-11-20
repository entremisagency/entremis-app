/* Entremis — #processus (espace fondateurs) : vos marches à suivre, en blocs reliés, modifiables à trois.
   Un processus = un nom + des étapes dans l'ordre. Une étape = un titre, ce qu'on fait, qui s'en occupe.
   On ajoute, renomme, déplace (avant / après), attribue et supprime une étape. Suppression : toujours confirmée.
   Partagé : collection « process ». Sans base : exemples, gardés dans ce navigateur. */
(function () {
  "use strict";
  const EM = () => window.EM, OPS = () => window.ENTREMIS_OPS, TM = () => window.ENTREMIS_TEAM;
  const WHO = [["marc", "Marc"], ["richard", "Richard"], ["gianni", "Gianni"], ["client", "Le client"], ["equipe", "Toute l'équipe"]];
  const whoName = id => (WHO.find(w => w[0] === id) || [, "Personne"])[1];
  const sid = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const SAMPLE = () => [
    { id: "onboarding", name: "Lancer un nouveau client", steps: [
      { id: "o1", title: "Devis signé", text: "Le passer en « Signé » dans Prospection.", who: "richard" },
      { id: "o2", title: "Appel de lancement", text: "Métier, zone, créneaux, objectif du mois.", who: "richard" },
      { id: "o3", title: "Publicités en ligne", text: "Campagne sur son métier et sa zone.", who: "marc" },
      { id: "o4", title: "Espace client ouvert", text: "Lui envoyer son accès et le guide.", who: "gianni" },
      { id: "o5", title: "Premier rendez-vous", text: "Sous 7 jours. Sinon, on l'appelle.", who: "equipe" }
    ] },
    { id: "lead", name: "Traiter un lead", steps: [
      { id: "l1", title: "Rappeler", text: "Moins d'une minute après la demande.", who: "equipe" },
      { id: "l2", title: "Vérifier 4 critères", text: "Projet, budget, propriétaire, délai.", who: "richard" },
      { id: "l3", title: "Donner au client", text: "Même métier, même zone. Un seul client.", who: "gianni" },
      { id: "l4", title: "Placer le rendez-vous", text: "Dans l'agenda du client, avec la fiche.", who: "richard" }
    ] },
    { id: "impaye", name: "Relancer un impayé", steps: [
      { id: "i1", title: "J+1 : e-mail", text: "Rappel poli avec la facture.", who: "gianni" },
      { id: "i2", title: "J+7 : appel", text: "Trouver une date de paiement.", who: "richard" },
      { id: "i3", title: "J+15 : pause", text: "On suspend les nouveaux rendez-vous.", who: "equipe" }
    ] }
  ];
  let ST = null;
  const store = () => ST || (ST = OPS().makeStore("process", SAMPLE));
  const P = { sel: null, sheet: null };   // sheet : { kind: "step"|"process", pid, id? }
  const cur = () => { const l = store().list; return l.find(p => p.id === P.sel) || l[0] || null; };
  const save = p => store().put(Object.assign({}, p, { steps: p.steps.map(s => Object.assign({}, s)) }));

  function wire(i) {
    return `<svg class="nf-wire${i % 2 ? " up" : ""}" viewBox="0 0 56 120" preserveAspectRatio="none" aria-hidden="true"><path d="${i % 2 ? "M2,98 C28,98 28,58 54,58" : "M2,58 C28,58 28,98 54,98"}"/><circle cx="2" cy="${i % 2 ? 98 : 58}" r="3.5"/><circle cx="54" cy="${i % 2 ? 58 : 98}" r="3.5"/></svg>`;
  }
  function node(p, s, i) {
    const esc = EM().esc, icon = EM().icon, last = i === p.steps.length - 1;
    const who = ["marc", "richard", "gianni"].includes(s.who) ? TM().avatar(s.who, "av") : `<span class="av pr-av">${icon(s.who === "client" ? "building" : "users")}</span>`;
    return `<article class="nf-node pr-node${i % 2 ? " low" : ""}" role="listitem">
      ${i === 0 ? `<span class="nf-start">Début</span>` : ""}
      <header><span class="pr-n tabnum">${i + 1}</span><b>${esc(s.title)}</b></header>
      ${s.text ? `<p class="nf-text">${esc(s.text)}</p>` : ""}
      <footer class="pr-foot"><span class="pr-who">${who}${esc(whoName(s.who))}</span>
        <span class="pr-acts">
          <button class="icon-btn" type="button" data-pr-move="${s.id}:-1" aria-label="Avancer « ${esc(s.title)} »" ${i === 0 ? "disabled" : ""}>${icon("back")}</button>
          <button class="icon-btn" type="button" data-pr-move="${s.id}:1" aria-label="Reculer « ${esc(s.title)} »" ${last ? "disabled" : ""}>${icon("chev")}</button>
          <button class="icon-btn" type="button" data-pr-edit="${s.id}" aria-label="Modifier « ${esc(s.title)} »">${icon("sliders")}</button>
        </span></footer>
    </article>`;
  }

  function sheet(p) {
    if (!P.sheet) return "";
    const esc = EM().esc;
    if (P.sheet.kind === "process") {
      const ex = P.sheet.id ? p : null;
      return `<div class="scrim" data-pr-close></div>
      <form class="sheet" id="pr-form" aria-label="${ex ? "Renommer le processus" : "Nouveau processus"}">
        <div class="sheet-grab" aria-hidden="true"></div>
        <div class="sheet-head"><button class="link" type="button" data-pr-close>Annuler</button><b>${ex ? "Renommer" : "Nouveau processus"}</b><button class="link strong" type="submit">${ex ? "Enregistrer" : "Créer"}</button></div>
        <label class="field"><span>Nom</span><input name="name" required maxlength="60" value="${ex ? esc(ex.name) : ""}" placeholder="Ex. : relancer un client silencieux"></label>
        ${ex ? `<button class="btn btn-ghost pr-danger" type="button" data-pr-delproc="${ex.id}">${EM().icon("trash")}Supprimer ce processus</button>` : ""}
      </form>`;
    }
    const s = P.sheet.id ? p.steps.find(x => x.id === P.sheet.id) : null;
    const after = s ? p.steps.indexOf(s) - 1 : p.steps.length - 1;
    return `<div class="scrim" data-pr-close></div>
    <form class="sheet" id="pr-form" aria-label="${s ? "Modifier l'étape" : "Nouvelle étape"}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><button class="link" type="button" data-pr-close>Annuler</button><b>${s ? "Modifier l'étape" : "Nouvelle étape"}</b><button class="link strong" type="submit">${s ? "Enregistrer" : "Ajouter"}</button></div>
      <label class="field"><span>Étape</span><input name="title" required maxlength="50" value="${s ? esc(s.title) : ""}" placeholder="Ex. : appel de lancement"></label>
      <label class="field"><span>Ce qu'on fait</span><input name="text" maxlength="90" value="${s ? esc(s.text || "") : ""}" placeholder="Une phrase courte"></label>
      <div class="field-row field-row-1">
        <label class="field"><span>Place</span><select name="pos"><option value="-1" ${after === -1 ? "selected" : ""}>En premier</option>${p.steps.filter(x => x !== s).map((x, i) => `<option value="${i}" ${i === after ? "selected" : ""}>Après « ${esc(x.title)} »</option>`).join("")}</select></label>
      </div>
      <fieldset class="field"><legend>Qui s'en occupe</legend><div class="who-pick">${WHO.map(([k, l]) => `<label><input type="radio" name="who" value="${k}" ${(s ? s.who : "equipe") === k ? "checked" : ""}>${["marc", "richard", "gianni"].includes(k) ? TM().avatar(k, "av") : `<span class="av pr-av">${EM().icon(k === "client" ? "building" : "users")}</span>`}<span>${l}</span></label>`).join("")}</div></fieldset>
      ${s ? `<button class="btn btn-ghost pr-danger" type="button" data-pr-del="${s.id}">${EM().icon("trash")}Supprimer l'étape</button>` : ""}
    </form>`;
  }

  function view() {
    const esc = EM().esc, icon = EM().icon, list = store().list, p = cur();
    if (p) P.sel = p.id;
    return `
    <div class="head"><div class="head-text"><h1 class="h1">Processus</h1><p class="sub">Vos marches à suivre, partagées entre vous trois.</p></div>
      <div class="head-actions">${store().source === "db" ? `<span class="sample sync">${icon("users")}Partagé</span>` : EM().sampleTag}<button class="btn btn-primary" type="button" data-pr-newproc>${icon("plus")}Nouveau processus</button></div></div>
    ${!store().ready ? EM().loader("Chargement des processus") : !list.length ? `<section class="card"><p class="body">Aucun processus. Créez le premier.</p></section>` : `
    <div class="filters">${EM().fsel("pr-sel", "Processus", list.map(x => [x.id, `${x.name} (${x.steps.length} étapes)`]), p.id)}</div>
    <section class="card guide-flow">
      <div class="card-head"><h2 class="h2">${esc(p.name)}</h2><span class="pr-head-acts"><button class="link" type="button" data-pr-rename>Renommer</button><button class="btn btn-ghost btn-xs" type="button" data-pr-add>${icon("plus")}Ajouter une étape</button></span></div>
      ${p.steps.length ? `<div class="nf pr-flow" role="list" aria-label="${esc(p.name)}">${p.steps.map((s, i) => `${i ? wire(i - 1) : ""}${node(p, s, i)}`).join("")}</div>`
        : `<div class="empty"><p>Aucune étape pour l'instant.</p><button class="btn btn-ghost" type="button" data-pr-add>${icon("plus")}Ajouter une étape</button></div>`}
    </section>`}
    ${p ? sheet(p) : P.sheet && P.sheet.kind === "process" ? sheet({ steps: [] }) : ""}`;
  }

  function onClick(e, S, render) {
    const t = e.target.closest("[data-pr-sel],[data-pr-move],[data-pr-edit],[data-pr-add],[data-pr-close],[data-pr-del],[data-pr-newproc],[data-pr-rename],[data-pr-delproc]");
    if (!t) return false;
    const p = cur();
    const open = sh => { P.sheet = sh; render(); const i = document.querySelector("#pr-form input"); if (i) i.focus(); };
    if (t.dataset.prSel) { P.sel = t.dataset.prSel; TM().haptic("tap"); render(); return true; }
    if ("prClose" in t.dataset) { P.sheet = null; render(); return true; }
    if ("prNewproc" in t.dataset) { open({ kind: "process" }); return true; }
    if ("prRename" in t.dataset && p) { open({ kind: "process", id: p.id }); return true; }
    if ("prAdd" in t.dataset && p) { open({ kind: "step" }); return true; }
    if (t.dataset.prEdit) { open({ kind: "step", id: t.dataset.prEdit }); return true; }
    if (t.dataset.prMove && p) {
      const [id, d] = t.dataset.prMove.split(":"), i = p.steps.findIndex(s => s.id === id), j = i + Number(d);
      if (i < 0 || j < 0 || j >= p.steps.length) return true;
      const steps = p.steps.slice(); [steps[i], steps[j]] = [steps[j], steps[i]];
      save(Object.assign({}, p, { steps })); TM().haptic("tap"); render();
      return true;
    }
    if (t.dataset.prDel && p) {
      const s = p.steps.find(x => x.id === t.dataset.prDel); if (!s) return true;
      P.sheet = null; render();
      EM().confirm({ title: `Supprimer l'étape « ${s.title} » ?`, text: "Elle disparaît du processus pour toute l'équipe.", ok: "Supprimer" }).then(ok => {
        if (!ok) return;
        const before = Object.assign({}, p, { steps: p.steps.slice() });
        save(Object.assign({}, p, { steps: p.steps.filter(x => x.id !== s.id) })); P.sheet = null; TM().haptic("done"); render();
        EM().toast("Étape supprimée.", () => { save(before); render(); });
      });
      return true;
    }
    if (t.dataset.prDelproc) {
      const x = store().list.find(y => y.id === t.dataset.prDelproc); if (!x) return true;
      P.sheet = null; render();
      EM().confirm({ title: `Supprimer « ${x.name} » ?`, text: `Ses ${x.steps.length} étapes disparaissent pour toute l'équipe.`, ok: "Supprimer" }).then(ok => {
        if (!ok) return;
        store().remove(x.id); P.sheet = null; P.sel = null; TM().haptic("done"); render();
        EM().toast("Processus supprimé.", () => { store().put(x); render(); });
      });
      return true;
    }
    return false;
  }

  function onSubmit(e, S, render) {
    if (e.target.id !== "pr-form") return false;
    e.preventDefault();
    const fd = new FormData(e.target), p = cur();
    if (P.sheet.kind === "process") {
      const name = String(fd.get("name") || "").trim(); if (!name) return true;
      if (P.sheet.id && p) save(Object.assign({}, p, { name }));
      else { const id = "p" + Date.now().toString(36); store().put({ id, name, steps: [] }); P.sel = id; }
      P.sheet = null; TM().haptic("done"); render();
      return true;
    }
    const title = String(fd.get("title") || "").trim(); if (!title || !p) return true;
    const step = { id: P.sheet.id || sid(), title, text: String(fd.get("text") || "").trim(), who: fd.get("who") || "equipe" };
    const rest = p.steps.filter(x => x.id !== step.id), pos = Number(fd.get("pos"));
    rest.splice(Math.max(0, Math.min(rest.length, pos + 1)), 0, step);
    save(Object.assign({}, p, { steps: rest }));
    EM().toast(P.sheet.id ? "Étape modifiée." : "Étape ajoutée.");
    P.sheet = null; TM().haptic("done"); render();
    return true;
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape" && P.sheet && !document.querySelector(".confirm")) { P.sheet = null; EM().render(); } });
  window.ENTREMIS_PROCESS = { view, onClick, onSubmit, init: render => store().init(render), list: () => store().list };
})();
