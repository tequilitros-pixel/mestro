// Service Worker de Maestro — Destiladora del Norte
// Estrategia Offline-First para App Store y PWA Standalone

const CACHE_NAME = "maestro-shell-v14";

// Las páginas de autenticación nunca deben guardarse ni mostrarse desde caché.
const AUTH_NAVIGATION_PATH = /^\/(?:login|forgot-password|reset-password|api\/session)(?:\/|$)/;

const STATIC_PRECACHE = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/offline.html",
  "/pospress",
  "/pospress/tables",
  "/pospress/pending-tabs",
  "/timeclock",
  "/timeclock/calendar",
  "/cooking",
  "/boiler",
  "/liquors/batches",
  "/liquors/bottling",
  "/tequilitros/productos/vampiro.png",
  "/tequilitros/productos/paloma.png",
  "/tequilitros/productos/cantarito.png",
  "/tequilitros/productos/tequimiche.png",
  "/tequilitros/productos/tequimojito.png",
  "/tequilitros/productos/tequimora.png",
  "/tequilitros/tequimango.jpg",
  "/tequilitros/blanco.jpg",
  "/tequilitros/reposado.jpg",
  "/tequilitros/zarzamora.jpg",
];

// Rutas de API seguras de sólo lectura que soportan Stale-While-Revalidate offline
const CACHEABLE_API_PREFIXES = [
  "/api/pos/products",
  "/api/pos/employees",
  "/api/pos/discount-rules",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Precachear recursos estáticos y páginas principales de forma resiliente
      for (const url of STATIC_PRECACHE) {
        try {
          const res = await fetch(url, { credentials: "same-origin" });
          if (res.ok) await cache.put(url, res);
        } catch {
          // Si alguna ruta falla al instalar, no interrumpir la instalación del SW
        }
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar POST (incluidas las Server Actions del login) ni otros métodos.
  if (request.method !== "GET") return;

  // Solo interceptar peticiones de nuestro propio origen.
  if (url.origin !== self.location.origin) return;

  // Nunca servir un estado previo del login (?error=1) desde almacenamiento local.
  if (AUTH_NAVIGATION_PATH.test(url.pathname)) return;

  // 1. Navegación (Páginas HTML): Network-First con Fallback a Caché de App Shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Un redirect a /login puede terminar con HTTP 200. No cachear
          // la respuesta de autenticación bajo la URL privada original.
          const resolvedUrl = response.url || request.url;
          if (response.ok && !AUTH_NAVIGATION_PATH.test(new URL(resolvedUrl).pathname)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(async () => {
          // Intentar la URL exacta en caché
          const exactMatch = await caches.match(request);
          if (exactMatch) return exactMatch;

          // Si navegaba en POSpress, devolver el shell de /pospress
          if (url.pathname.startsWith("/pospress")) {
            const pospressMatch = await caches.match("/pospress");
            if (pospressMatch) return pospressMatch;
          }

          // Si navegaba en Checador, devolver el shell de /timeclock
          if (url.pathname.startsWith("/timeclock")) {
            const timeclockMatch = await caches.match("/timeclock");
            if (timeclockMatch) return timeclockMatch;
          }

          // Si navegaba en Producción / Calderas / Cocimiento
          if (url.pathname.startsWith("/cooking") || url.pathname.startsWith("/boiler")) {
            const prodMatch = (await caches.match("/cooking")) || (await caches.match("/boiler"));
            if (prodMatch) return prodMatch;
          }

          // Si navegaba en Licores
          if (url.pathname.startsWith("/liquors")) {
            const liquorMatch = (await caches.match("/liquors/batches")) || (await caches.match("/liquors/bottling"));
            if (liquorMatch) return liquorMatch;
          }

          // Fallback a pantalla offline interactiva
          return (await caches.match("/offline.html")) || Response.error();
        }),
    );
    return;
  }

  // 2. APIs de lectura de catálogo y reglas (Stale-While-Revalidate)
  if (request.method === "GET" && CACHEABLE_API_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // 3. No interceptar otras llamadas a /api/ (POST/PUT/DELETE se gestionan con la cola Outbox IndexedDB)
  if (url.pathname.startsWith("/api/")) return;

  // 4. Recursos estáticos (_next/static, iconos, fuentes, imágenes): Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(?:png|webp|svg|woff2|ico|jpg|jpeg)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Maestro", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Maestro — Destiladora del Norte";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || data.href || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && targetUrl !== "/") {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
