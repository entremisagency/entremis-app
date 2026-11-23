/* Entremis — le service de l'app sur le téléphone : afficher les alertes, et rouvrir l'app quand on les touche.
   Les pages et les fichiers de l'app ne sont jamais gardés en mémoire : l'app se met toujours à jour normalement.
   Seule exception : la bibliothèque de connexion à la base (version figée, elle ne change jamais), gardée sur le téléphone
   pour ouvrir l'app plus vite. */
const LIB_CACHE = "entremis-lib-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const w = list[0];
    if (w) { w.postMessage({ go: href }); return w.focus(); }
    return self.clients.openWindow("./" + href);
  }));
});
// Une notification envoyée par la base (fonction « push »), même quand l'app est fermée
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Entremis", {
    body: d.body || "", icon: "img/apple-touch-icon.png", badge: "img/favicon-32.png", tag: d.tag || undefined, data: { href: d.href || "" }
  }));
});
// À chaque ouverture de l'app (écran d'accueil compris), la page vient toujours du site, jamais de la mémoire du téléphone :
// une mise à jour est donc visible dès l'ouverture suivante. Sans réseau, on retombe sur ce que le navigateur a gardé.
self.addEventListener("fetch", e => {
  if (/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@\d+\.\d+\.\d+\//.test(e.request.url)) {
    e.respondWith(caches.open(LIB_CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request, { cache: "no-store" }).catch(() => fetch(e.request)));
});
