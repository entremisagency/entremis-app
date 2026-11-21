/* Entremis — la mise à jour toute seule de l'app (Marc, 21 nov. 2026).
   L'app installée sur l'écran d'accueil n'a pas de bouton « recharger ». Ici, elle vérifie s'il existe une version plus récente
   (le numéro ?v= des fichiers, changé par outils/version.sh à chaque mise en ligne) :
   au retour sur l'app, au retour du réseau, et toutes les 5 minutes.
   Nouvelle version : rechargement tout seul si rien n'est en cours de saisie, sinon un bandeau « Mettre à jour ». */
(function () {
  "use strict";
  // Le numéro de version de ce fichier (le même pour tous les fichiers de l'app)
  const cur = (() => { const s = document.currentScript; const m = s && (s.getAttribute("src") || "").match(/\?v=([0-9a-z-]+)/i); return m ? m[1] : ""; })();
  let next = "", checking = false, last = 0;
  // Quelque chose est en cours de saisie ou une fenêtre est ouverte : on ne recharge pas sans demander
  const busy = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value) || !!document.querySelector(".sheet, .lx-full, #confirm, .lead-panel"); };
  function reload() {
    // Une adresse neuve : le navigateur ne peut pas reprendre l'ancienne page gardée en mémoire
    const q = new URLSearchParams(location.search); q.set("u", next || String(Date.now()));
    location.replace(location.pathname + "?" + q.toString() + location.hash);
  }
  function banner() {
    if (document.getElementById("upd")) return;
    const b = document.createElement("div");
    b.id = "upd"; b.className = "upd"; b.setAttribute("role", "status");
    b.innerHTML = `<span>Une nouvelle version de l'app est prête.</span><button class="btn btn-primary" type="button" data-upd-go>Mettre à jour</button><button class="link" type="button" data-upd-later>Plus tard</button>`;
    document.body.appendChild(b);
  }
  async function check(opts) {
    const o = opts || {}, now = Date.now();
    if (!cur || checking || (!o.force && now - last < 60000)) return "";
    checking = true; last = now;
    try {
      const r = await fetch("index.html?check=" + now, { cache: "no-store" });
      const t = r.ok ? await r.text() : "", m = t.match(/update\.js\?v=([0-9a-z-]+)/i);
      next = m && m[1] !== cur ? m[1] : "";
    } catch (_) { next = ""; }
    checking = false;
    if (!next) return "";
    if (o.resume && !busy()) reload();   // on revient sur l'app et rien n'est en cours : on prend la nouvelle version tout de suite
    else banner();
    return next;
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-upd-go]")) reload();
    if (e.target.closest("[data-upd-later]")) { const b = document.getElementById("upd"); if (b) b.remove(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check({ resume: true }); });
  window.addEventListener("online", () => check({ resume: true, force: true }));
  window.addEventListener("pageshow", e => { if (e.persisted) check({ resume: true, force: true }); });
  setInterval(() => { if (document.visibilityState === "visible") check(); }, 5 * 60000);
  setTimeout(() => check({ force: true }), 4000);
  // On enlève le ?u= de l'adresse après une mise à jour, pour qu'elle reste propre
  if (/[?&]u=/.test(location.search)) { const q = new URLSearchParams(location.search); q.delete("u"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }

  window.ENTREMIS_UPDATE = { version: () => cur, check: () => check({ force: true }), reload };
})();
