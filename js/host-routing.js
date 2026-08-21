/* Host compatibility and browser-level hardening for static hosting. */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const isWeb = /^https?:$/.test(window.location.protocol);
  if (isWeb) {
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
        "connect-src 'self' https://api.solivoc.ru",
        "manifest-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");
      document.head.appendChild(csp);
    }

    // X-Frame-Options/frame-ancestors require HTTP response headers. As a
    // browser-level fallback, never render the game/admin UI inside a frame.
    if (window.top !== window.self) {
      document.documentElement.style.display = "none";
      try {
        window.top.location = window.self.location.href;
      } catch {
        // If top navigation is sandboxed, keeping the framed UI hidden is safer.
      }
      return;
    }
  }

  if (
    window.location.hostname === "admin.solivoc.ru" &&
    (window.location.pathname === "/" || window.location.pathname === "")
  ) {
    window.location.replace("/admin.html");
  }
})();
