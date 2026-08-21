/* Deployment-specific runtime values. */
(() => {
  const existing = String(window.SOLIVOC_API_BASE || "").trim().replace(/\/+$/, "");
  if (existing) {
    window.SOLIVOC_API_BASE = existing;
    return;
  }

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
})();
