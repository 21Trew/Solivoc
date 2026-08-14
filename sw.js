const CACHE = "worditaire-static-v4";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
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
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())),
  );
});
