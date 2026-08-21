/* Host compatibility, canonical routing and browser-level hardening. */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const APP_ORIGIN = "https://solivoc.ru";
  const API_ORIGIN = "https://api.solivoc.ru";
  const { location } = window;
  const isWeb = /^https?:$/.test(location.protocol);
  const host = String(location.hostname || "").toLowerCase();

  // Transitional safety: old links may still point to the former Vercel host.
  // Never let them open the obsolete frontend deployment.
  if (isWeb && (host === "solivoc.vercel.app" || host.endsWith(".vercel.app"))) {
    const duelMatch = location.pathname.match(/^\/d\/([A-HJ-NP-Z2-9]{6})\/?$/i);
    if (duelMatch) {
      window.location.replace(`${API_ORIGIN}/d/${duelMatch[1].toUpperCase()}`);
      return;
    }

    const target = new URL(location.href);
    target.protocol = "https:";
    target.host = "solivoc.ru";
    window.location.replace(target.href);
    return;
  }

  if (isWeb) {
    // Production web builds always use the split Yandex API.
    if (!["localhost", "127.0.0.1"].includes(host)) {
      window.SOLIVOC_API_BASE = API_ORIGIN;
    }

    // Static Object Storage cannot emit arbitrary security response headers.
    // Apply the policies that browsers support at document level instead.
    if (!document.querySelector('meta[name="referrer"]')) {
      const referrer = document.createElement("meta");
      referrer.name = "referrer";
      referrer.content = "same-origin";
      document.head.appendChild(referrer);
    }

    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const csp = document.createElement("meta");
      csp.httpEquiv = "Content-Security-Policy";
      csp.content = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src 'self' ${API_ORIGIN}`,
        "manifest-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");
      document.head.appendChild(csp);
    }

    if (window.top !== window.self) {
      document.documentElement.style.display = "none";
      try {
        window.top.location = window.self.location.href;
      } catch {}
      return;
    }
  }

  if (
    host === "admin.solivoc.ru" &&
    (location.pathname === "/" || location.pathname === "")
  ) {
    window.location.replace("/admin.html");
    return;
  }

  // systems.js is a classic script and exposes these functions globally.
  // Pin all future share URLs to the canonical production hosts even if an
  // older cached implementation survives during the migration.
  window.addEventListener("load", () => {
    if (typeof window.challengeShortLink === "function") {
      window.challengeShortLink = (entryOrCode) => {
        const raw = entryOrCode?.code ?? entryOrCode ?? "";
        const code = String(raw)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6);
        return `${API_ORIGIN}/d/${code}`;
      };
    }

    if (typeof window.appShareLink === "function") {
      window.appShareLink = () => `${APP_ORIGIN}/`;
    }
  }, { once: true });
})();
