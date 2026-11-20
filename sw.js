/* Entremis — le service de l'app sur le téléphone : afficher les alertes, et rouvrir l'app quand on les touche.
   Volontairement rien en cache : l'app se met toujours à jour normalement. */
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
