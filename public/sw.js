const CACHE_VERSION = "spool-vault-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Los datos del inventario nunca se almacenan en caché: Supabase sigue siendo
// la fuente de verdad y una falla de conexión no debe mostrar datos viejos.
