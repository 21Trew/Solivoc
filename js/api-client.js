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

/* Server-authored letters can request one safe, non-interrupting modal presentation.
   The inbox remains the source of truth; this layer only makes important mail visible. */
(() => {
  if (typeof window === "undefined" || window.__solivocDeveloperAlertsInstalled) return;
  window.__solivocDeveloperAlertsInstalled = true;
  const SEEN_KEY = "solivoc-developer-modal-seen-v1";
  let busy = false, lastFetchAt = 0, pending = [], shownThisSession = false;

  function gamePage() {
    return !document.getElementById("adminLoginForm") && !/\/admin\.html(?:$|[?#])/i.test(location.pathname);
  }
  function readSeen() {
    try {
      const value = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      return Array.isArray(value) ? value.map(String).slice(-120) : [];
    } catch { return []; }
  }
  function markSeen(id) {
    const seen = new Set(readSeen());
    seen.add(String(id));
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-120))); } catch {}
  }
  function deletedByPlayer(id) {
    try { return Array.isArray(profile?.developerMailDeleted) && profile.developerMailDeleted.includes(String(id)); }
    catch { return false; }
  }
  function canShowNow() {
    if (!gamePage() || document.visibilityState === "hidden") return false;
    try { if (typeof activelyPlayingRound === "function" && activelyPlayingRound()) return false; } catch {}
    const blocking = document.querySelector([
      ".modal.show", "#onboardingModal.show", "#rankUpModal.show", "#accountModal.show",
      "#duelResultModal.show", "#specialLevelModal.show", "#developerAlertModal.show",
    ].join(","));
    return !blocking;
  }
  function installAlertStyles() {
    if (document.getElementById("developerAlertStyles")) return;
    const style = document.createElement("style");
    style.id = "developerAlertStyles";
    style.textContent = `
      .developer-alert-modal{position:fixed;inset:0;z-index:10140;display:grid;place-items:center;padding:18px;background:rgba(12,9,31,.68);backdrop-filter:blur(12px)}
      .developer-alert-modal[hidden]{display:none}.developer-alert-card{width:min(440px,100%);max-height:min(82vh,680px);overflow:auto;box-sizing:border-box;padding:22px;border-radius:26px;background:var(--panel,#fbfaff);color:var(--text,#25213e);box-shadow:0 28px 90px rgba(0,0,0,.36)}
      .developer-alert-card>small{display:block;font-weight:900;letter-spacing:.13em;opacity:.58}.developer-alert-card h2{margin:7px 0 10px;font-size:clamp(23px,6vw,31px);line-height:1.08}.developer-alert-card p{margin:0;line-height:1.5;opacity:.78;white-space:pre-wrap}.developer-alert-card ul{margin:14px 0 0;padding-left:20px;display:grid;gap:7px}.developer-alert-card li{line-height:1.4;opacity:.8}.developer-alert-actions{display:flex;gap:8px;margin-top:19px}.developer-alert-actions button{flex:1;border:0;border-radius:15px;padding:13px 14px;font:inherit;font-weight:900}.developer-alert-primary{background:linear-gradient(120deg,#705ce9,#36a3d9);color:#fff}.developer-alert-secondary{background:color-mix(in srgb,currentColor 8%,transparent);color:inherit}.developer-alert-important{display:inline-flex;margin-bottom:7px;padding:5px 8px;border-radius:999px;background:rgba(209,117,43,.12);color:#a96720;font-size:10px;font-weight:900;letter-spacing:.09em}
      @media(max-width:520px){.developer-alert-modal{place-items:end stretch;padding:0}.developer-alert-card{width:100%;border-radius:26px 26px 0 0;max-height:88vh}.developer-alert-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
  function createAlertModal() {
    let modal = document.getElementById("developerAlertModal");
    if (modal) return modal;
    installAlertStyles();
    modal = document.createElement("div");
    modal.id = "developerAlertModal";
    modal.className = "developer-alert-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="developer-alert-card" role="dialog" aria-modal="true" aria-labelledby="developerAlertTitle">
      <div id="developerAlertPriority"></div><small id="developerAlertSender"></small><h2 id="developerAlertTitle"></h2><p id="developerAlertIntro"></p><ul id="developerAlertItems"></ul><div class="developer-alert-actions" id="developerAlertActions"></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }
  function closeAlert() {
    const modal = document.getElementById("developerAlertModal");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }
  function internalHref(value) {
    const href = String(value || "").trim();
    if (!href || href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return "";
    return href.startsWith("/") || href.startsWith("#") || href.startsWith("?") ? href : "";
  }
  function renderAlert(message) {
    const modal = createAlertModal();
    const sender = document.getElementById("developerAlertSender"), title = document.getElementById("developerAlertTitle"), intro = document.getElementById("developerAlertIntro"), items = document.getElementById("developerAlertItems"), actions = document.getElementById("developerAlertActions"), priority = document.getElementById("developerAlertPriority");
    sender.textContent = message.sender || "Команда Словасьянса";
    title.textContent = message.title || "Сообщение";
    intro.textContent = message.intro || "";
    priority.replaceChildren();
    if (message.priority === "important") {
      const badge = document.createElement("span");
      badge.className = "developer-alert-important";
      badge.textContent = "ВАЖНОЕ СООБЩЕНИЕ";
      priority.appendChild(badge);
    }
    items.replaceChildren();
    for (const value of (Array.isArray(message.items) ? message.items : []).slice(0, 8)) {
      const li = document.createElement("li");
      li.textContent = String(value || "");
      if (li.textContent) items.appendChild(li);
    }
    items.hidden = !items.children.length;
    actions.replaceChildren();
    const close = document.createElement("button");
    close.type = "button";
    close.className = "developer-alert-secondary";
    close.textContent = "Закрыть";
    close.onclick = closeAlert;
    actions.appendChild(close);

    const href = internalHref(message.ctaHref);
    if (message.ctaLabel && href) {
      const cta = document.createElement("button");
      cta.type = "button";
      cta.className = "developer-alert-primary";
      cta.textContent = String(message.ctaLabel).slice(0, 48);
      cta.onclick = () => { closeAlert(); location.href = href; };
      actions.appendChild(cta);
    } else if (typeof openDeveloperMailModal === "function") {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "developer-alert-primary";
      open.textContent = "Открыть письмо";
      open.onclick = () => {
        closeAlert();
        try { openDeveloperMailModal({ markRead: false }); } catch { try { openDeveloperMailModal(); } catch {} }
      };
      actions.appendChild(open);
    }
    modal.hidden = false;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function showNext() {
    if (shownThisSession || !canShowNow() || !pending.length) return false;
    const message = pending.shift();
    if (!message?.id) return showNext();
    markSeen(message.id);
    shownThisSession = true;
    renderAlert(message);
    return true;
  }
  function acceptMessages(messages) {
    const seen = new Set(readSeen()), now = Date.now();
    const fresh = (Array.isArray(messages) ? messages : [])
      .filter((message) => message?.id && message.presentation === "inbox_modal")
      .filter((message) => !seen.has(String(message.id)) && !deletedByPlayer(message.id))
      .filter((message) => !Number(message.expiresAt) || Number(message.expiresAt) > now)
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    const known = new Set(pending.map((x) => String(x.id)));
    for (const message of fresh) if (!known.has(String(message.id))) pending.push(message);
    showNext();
  }
  async function fetchAlerts({ force = false } = {}) {
    if (!gamePage() || busy || navigator.onLine === false) return false;
    if (!force && Date.now() - lastFetchAt < 45000) return false;
    try { if (typeof accountSignedIn === "function" && !accountSignedIn()) return false; } catch {}
    busy = true; lastFetchAt = Date.now();
    try {
      const response = await apiFetch("/api/developer-mail", { cache: "no-store" });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      acceptMessages(data.messages || []);
      return true;
    } catch { return false; }
    finally { busy = false; }
  }
  function start() {
    if (!gamePage()) return;
    SolivocScheduler.timeout("developer-alerts.initial", () => fetchAlerts({ force: true }), 2200);
    SolivocScheduler.interval("developer-alerts.poll", () => { fetchAlerts(); showNext(); }, 60000, { visibleOnly: true });
    SolivocLifecycle.on("online", "developer-alerts", () => fetchAlerts({ force: true }));
    SolivocLifecycle.on("visible", "developer-alerts", () => { fetchAlerts(); showNext(); });
    document.addEventListener("click", () => {
      fetchAlerts();
      SolivocScheduler.timeout("developer-alerts.show-next", showNext, 400);
    }, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
