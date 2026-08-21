/* Deployment-specific runtime values and PWA update handoff. */
(() => {
  const existing = String(window.SOLIVOC_API_BASE || "").trim().replace(/\/+$/, "");
  if (existing) {
    window.SOLIVOC_API_BASE = existing;
  } else {
    const protocol = String(window.location.protocol || "");
    const host = String(window.location.hostname || "").toLowerCase();
    const local =
      protocol === "file:" ||
      host === "localhost" ||
      host === "127.0.0.1";

    window.SOLIVOC_API_BASE =
      !local && /^https?:$/.test(protocol)
        ? "https://api.solivoc.ru"
        : "";
  }
})();

(() => {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  // app.js owns the normal update flow. This tiny handoff guard only covers
  // iOS/WebKit cases where controllerchange is missed and the page reloads
  // while the same waiting worker is still visible to the next navigation.
  const REQUEST_KEY = "solivoc-pwa-update-requested-v2";
  const RECENT_MS = 45_000;
  const MIN_SUPPRESS_MS = 5_000;
  const MAX_SUPPRESS_MS = 15_000;

  const banner = document.getElementById("updateBanner");
  const updateButton = document.getElementById("updateNow");

  const hideBanner = () => {
    banner?.classList.remove("show");
    banner?.setAttribute("aria-hidden", "true");
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = "Обновить";
    }
  };

  const requestedAt = () => {
    try { return Number(sessionStorage.getItem(REQUEST_KEY) || 0) || 0; }
    catch { return 0; }
  };

  const recentlyRequested = () => {
    const at = requestedAt();
    return at > 0 && Date.now() - at < RECENT_MS;
  };

  const markRequested = () => {
    try { sessionStorage.setItem(REQUEST_KEY, String(Date.now())); } catch {}
  };

  updateButton?.addEventListener("click", markRequested, { capture: true });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!recentlyRequested()) return;
    // Keep the marker across app.js's explicit reload. The next document uses
    // it to suppress a stale copy of the same update banner.
    markRequested();
    hideBanner();
  });

  if (!recentlyRequested()) return;

  const startedAt = Date.now();
  let timer = null;
  let observer = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    observer?.disconnect();
    hideBanner();
    try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
  };

  hideBanner();

  if (banner && "MutationObserver" in window) {
    observer = new MutationObserver(() => {
      if (recentlyRequested()) hideBanner();
    });
    observer.observe(banner, {
      attributes: true,
      attributeFilter: ["class", "aria-hidden"],
    });
  }

  const settle = async () => {
    if (!recentlyRequested()) {
      cleanup();
      return;
    }

    hideBanner();

    let registration = null;
    try { registration = await navigator.serviceWorker.getRegistration(); } catch {}

    // If WebKit reloaded before SKIP_WAITING completed, repeat the request.
    if (registration?.waiting) {
      try { registration.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
    }

    const elapsed = Date.now() - startedAt;
    if (!registration?.waiting && elapsed >= MIN_SUPPRESS_MS) {
      cleanup();
      return;
    }

    if (elapsed >= MAX_SUPPRESS_MS) {
      // Never trap the UI permanently. If a genuinely newer update arrives,
      // app.js can show it normally after this short handoff window.
      cleanup();
      return;
    }

    timer = setTimeout(settle, 500);
  };

  settle();
})();
