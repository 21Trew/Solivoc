/* Shared API URL/credentials adapter for same-origin and split frontend/API deployments. */
function solivocApiBase() {
  return String(window.SOLIVOC_API_BASE || "").trim().replace(/\/+$/, "");
}
function apiUrl(path = "") {
  const value = String(path || "");
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${solivocApiBase()}${normalized}`;
}
function apiUsesCrossOrigin() {
  const base = solivocApiBase();
  if (!base || typeof location === "undefined") return false;
  try { return new URL(base, location.href).origin !== location.origin; }
  catch { return false; }
}
function apiFetch(path, options = {}) {
  const next = { ...options };
  if (!next.credentials) next.credentials = apiUsesCrossOrigin() ? "include" : "same-origin";
  return fetch(apiUrl(path), next);
}
