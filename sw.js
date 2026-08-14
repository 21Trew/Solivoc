const CACHE = "worditaire-v19";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./styles/base.css",
  "./styles/meta.css",
  "./styles/responsive.css",
  "./data/categories.js",
  "./data/categories.json",
  "./js/config.js",
  "./js/profile.js",
  "./js/data.js",
  "./js/runtime.js",
  "./js/generator.js",
  "./js/meta/systems.js",
  "./js/retention.js",
  "./js/engagement.js",
  "./js/animations.js",
  "./js/game/feedback.js",
  "./js/game/state.js",
  "./js/components/cards.js",
  "./js/components/board.js",
  "./js/game/rules.js",
  "./js/game/drag.js",
  "./js/progression.js",
  "./js/components/hub.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shouldCache(request, url, response) {
  if (!response?.ok || request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (shouldCache(event.request, url, response)) {
          // Some browsers can return a Response whose stream has already been
          // locked/consumed. Caching must never break the actual page request.
          let copy = null;
          try {
            if (!response.bodyUsed) copy = response.clone();
          } catch {}
          if (copy) {
            await caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => undefined);
          }
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() || "" };
  }
  const title = data.title || "Словасьянс";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "В игре появилось новое событие.",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: data.tag || "worditaire",
      renotify: false,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client && client.url !== target) await client.navigate(target);
          return;
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
