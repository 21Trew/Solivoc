/* Deployment-specific runtime values. */
(() => {
  const existing = String(window.SOLIVOC_API_BASE || "").trim().replace(/\/+$/, "");
  if (existing) {
    window.SOLIVOC_API_BASE = existing;
    return;
  }

  const host = String(window.location.hostname || "").toLowerCase();
  const usesSplitApi =
    host.endsWith(".twc1.net") ||
    host === "stage.solivoc.ru";

  window.SOLIVOC_API_BASE = usesSplitApi ? "https://api.solivoc.ru" : "";
})();
