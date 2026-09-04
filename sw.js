const CACHE = "worditaire-build-__SOLIVOC_BUILD__";
const CORE = __SOLIVOC_CORE__;

async function currentCache() {
  return caches.open(CACHE);
}

async function cacheCriticalShell() {
  const cache = await currentCache();
  for (const url of CORE) {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (!response?.ok) throw new Error(`critical_asset_failed:${url}:${response?.status || 0}`);
    await cache.put(request, response.clone());
  }
}

self.addEventListener("install", (event) => {
  // Updates stay waiting until the page reaches an explicit safe point.
  event.waitUntil(cacheCriticalShell());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    // The page-side UpdateManager sends this only after checkpointing and at an
    // explicit/safe activation point.
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === "CLEAR_APP_CACHE") {
    event.waitUntil((async () => {
      try { await caches.delete(CACHE); } catch {}
      try { event.ports?.[0]?.postMessage({ ok: true }); } catch {}
    })());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("worditaire-build-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: "SOLIVOC_SW_ACTIVATED", build: "__SOLIVOC_BUILD__" }));
  })());
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
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (["/admin", "/admin.html", "/js/admin.js", "/styles/admin.css"].includes(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await currentCache();

    if (event.request.mode === "navigate") {
      // Navigation and scripts are always served from this worker's own cache
      // generation. A waiting worker can therefore never leak new assets into
      // an older controlled page.
      const shell = (await cache.match(event.request)) || (await cache.match("./index.html")) || (await cache.match("./"));
      if (shell) return shell;
      try {
        const response = await fetch(event.request);
        if (response?.ok) {
          try { await cache.put("./index.html", response.clone()); } catch {}
        }
        return response;
      } catch {
        return Response.error();
      }
    }

    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (shouldCache(event.request, url, response)) {
        // Non-critical assets are cached lazily. Missing mascot/cosmetic assets
        // cannot fail installation of the critical shell.
        try { await cache.put(event.request, response.clone()); } catch {}
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
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
