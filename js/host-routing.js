/* Host compatibility, legacy-origin migration and browser-level hardening. */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const APP_ORIGIN = "https://solivoc.ru";
  const API_ORIGIN = "https://api.solivoc.ru";
  const LEGACY_ORIGIN = "https://solivoc.vercel.app";
  const MIGRATION_KEYS = [
    "worditaire-profile-v7",
    "worditaire-profile-v6",
    "worditaire-profile-v5",
    "worditaire-profile-v4",
    "worditaire-profile-v3",
    "worditaire-profile-v2",
    "worditaire-state-v10",
    "worditaire-state-v10-backup",
    "assoc-klondike-v7",
    "assoc-klondike-v6",
    "assoc-klondike-v5",
    "assoc-klondike-v4",
    "assoc-recent-categories-v2",
  ];

  const { location } = window;
  const isWeb = /^https?:$/.test(location.protocol);
  const host = String(location.hostname || "").toLowerCase();
  const isLegacyHost = host === "solivoc.vercel.app" || host.endsWith(".vercel.app");

  function bytesToBase64Url(bytes) {
    let binary = "";
    const size = 0x4000;
    for (let i = 0; i < bytes.length; i += size) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + size)));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToText(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function migrationPayload() {
    const storage = {};
    for (const key of MIGRATION_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (typeof value === "string" && value.length) storage[key] = value;
      } catch {}
    }
    return { version: 1, source: "vercel", storage };
  }

  function restoreMigration(payload) {
    if (!payload || payload.version !== 1 || payload.source !== "vercel" || !payload.storage) return false;
    let restored = 0;
    for (const key of MIGRATION_KEYS) {
      const value = payload.storage[key];
      if (typeof value !== "string" || value.length > 1_500_000) continue;
      try {
        localStorage.setItem(key, value);
        restored++;
      } catch {}
    }
    if (!restored) return false;
    try {
      localStorage.setItem("solivoc-origin-migrated", "1");
      localStorage.removeItem("solivoc-deployment-id");
    } catch {}
    return true;
  }

  // Synchronous fragment migration runs before profile.js, so the restored
  // profile is available on the very first canonical render.
  if (isWeb && !isLegacyHost && location.hash.startsWith("#legacy=")) {
    try {
      const payload = JSON.parse(base64UrlToText(location.hash.slice("#legacy=".length)));
      if (restoreMigration(payload)) {
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      }
    } catch (error) {
      console.warn("Legacy profile migration failed", error);
    }
  }

  function showCanonicalMigrationNotice() {
    let migrated = false;
    try {
      migrated = localStorage.getItem("solivoc-origin-migrated") === "1";
      if (migrated) localStorage.setItem("solivoc-origin-migrated", "shown");
    } catch {}
    if (!migrated) return;

    const render = () => {
      const overlay = document.createElement("div");
      overlay.id = "solivocOriginMigrationDone";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:22px;" +
        "background:rgba(8,8,27,.82);backdrop-filter:blur(12px);font-family:system-ui,-apple-system,sans-serif;color:#fff";
      overlay.innerHTML = `
        <div style="width:min(390px,100%);padding:24px;border-radius:24px;background:linear-gradient(160deg,#29205d,#151d4a);border:1px solid #ffffff26;box-shadow:0 24px 80px #0009">
          <div style="font-size:28px;margin-bottom:8px">✓</div>
          <h2 style="margin:0 0 10px;font-size:22px">Прогресс перенесён</h2>
          <p style="margin:0;color:#cbc7ed;line-height:1.45;font-size:14px">
            Теперь Словасьянс живёт на <b style="color:#fff">solivoc.ru</b>.
            Старый ярлык был установлен с Vercel и не может автоматически сменить адрес.
          </p>
          <p style="margin:14px 0 0;color:#cbc7ed;line-height:1.45;font-size:14px">
            На iPhone нажми <b style="color:#fff">Поделиться → На экран «Домой»</b>.
            После проверки нового ярлыка старый можно удалить.
          </p>
          <button type="button" style="width:100%;margin-top:18px;padding:14px;border:0;border-radius:15px;background:linear-gradient(135deg,#745dff,#4f8cff);color:#fff;font-weight:900;font-size:16px">Понятно</button>
        </div>`;
      overlay.querySelector("button")?.addEventListener("click", () => overlay.remove());
      document.body.appendChild(overlay);
    };
    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  function showLegacyMigrationScreen() {
    const render = () => {
      if (document.getElementById("solivocLegacyMigration")) return;
      const overlay = document.createElement("div");
      overlay.id = "solivocLegacyMigration";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:22px;" +
        "background:linear-gradient(160deg,#100d2a,#151d4a);font-family:system-ui,-apple-system,sans-serif;color:#fff";
      overlay.innerHTML = `
        <div style="width:min(400px,100%);padding:24px;border-radius:24px;background:linear-gradient(160deg,#29205d,#151d4a);border:1px solid #ffffff26;box-shadow:0 24px 80px #0009">
          <small style="color:#8fe9ff;font-weight:900;letter-spacing:.12em">СЛОВАСЬЯНС ПЕРЕЕХАЛ</small>
          <h1 style="margin:8px 0 10px;font-size:25px">Перенесём прогресс на solivoc.ru</h1>
          <p style="margin:0;color:#cbc7ed;line-height:1.5;font-size:14px">
            Этот ярлык относится к старому адресу Vercel. Данные на нём ещё можно перенести на новый официальный адрес.
          </p>
          <div id="solivocMigrationStatus" style="min-height:20px;margin-top:12px;color:#ffd98a;font-size:13px"></div>
          <button id="solivocMigrationStart" type="button" style="width:100%;margin-top:8px;padding:15px;border:0;border-radius:15px;background:linear-gradient(135deg,#745dff,#4f8cff);color:#fff;font-weight:900;font-size:16px">Перенести прогресс →</button>
          <button id="solivocMigrationSkip" type="button" style="width:100%;margin-top:9px;padding:12px;border:1px solid #ffffff26;border-radius:15px;background:#ffffff0b;color:#ddd8ff;font-weight:800;font-size:14px">Открыть без переноса</button>
          <p style="margin:14px 0 0;color:#8e89b8;line-height:1.4;font-size:11px">
            Не удаляй старый ярлык до успешного переноса.
          </p>
        </div>`;
      document.body.appendChild(overlay);

      const status = overlay.querySelector("#solivocMigrationStatus");
      const start = overlay.querySelector("#solivocMigrationStart");
      const skip = overlay.querySelector("#solivocMigrationSkip");

      start?.addEventListener("click", () => {
        const payload = migrationPayload();
        const json = JSON.stringify(payload);
        const count = Object.keys(payload.storage).length;
        if (!count) {
          status.textContent = "Локальный прогресс на старом адресе не найден. Можно открыть новый сайт и войти в аккаунт.";
          return;
        }

        // The common path is fragment transfer: it is local-only (not sent to
        // servers) and restores storage before profile.js executes.
        try {
          const token = bytesToBase64Url(new TextEncoder().encode(json));
          if (token.length <= 120000) {
            status.textContent = `Найден прогресс (${count} хранилищ). Открываем новый адрес…`;
            window.open(`${APP_ORIGIN}/#legacy=${token}`, "_blank");
            return;
          }
        } catch {}

        // Fallback for unusually large profiles: transfer through postMessage.
        status.textContent = "Профиль большой — переносим через защищённое окно…";
        const child = window.open(`${APP_ORIGIN}/?legacy-transfer=1`, "_blank");
        if (!child) {
          status.textContent = "Safari заблокировал новое окно. Разреши всплывающие окна и повтори.";
          return;
        }
        const send = () => {
          try { child.postMessage({ type: "SOLIVOC_LEGACY_DATA", payload }, APP_ORIGIN); } catch {}
        };
        const timer = setInterval(send, 350);
        send();
        const stop = setTimeout(() => {
          clearInterval(timer);
          status.textContent = "Если новый сайт не подтвердил перенос, вернись сюда и попробуй ещё раз.";
        }, 12000);
        const onMessage = (event) => {
          if (event.origin !== APP_ORIGIN || event.data?.type !== "SOLIVOC_LEGACY_IMPORTED") return;
          clearInterval(timer);
          clearTimeout(stop);
          window.removeEventListener("message", onMessage);
          status.textContent = "Готово. Прогресс перенесён.";
        };
        window.addEventListener("message", onMessage);
      });

      skip?.addEventListener("click", () => {
        window.open(APP_ORIGIN, "_blank");
      });
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  if (isWeb && isLegacyHost) {
    // Keep the legacy origin alive only as a migration bridge. Do not redirect
    // immediately: an origin redirect cannot carry Safari/PWA localStorage.
    window.SOLIVOC_API_BASE = API_ORIGIN;
    showLegacyMigrationScreen();
    return;
  }

  // Large-profile postMessage receiver.
  if (isWeb && location.origin === APP_ORIGIN) {
    window.addEventListener("message", (event) => {
      if (!event.origin.endsWith(".vercel.app") && event.origin !== LEGACY_ORIGIN) return;
      if (event.data?.type !== "SOLIVOC_LEGACY_DATA") return;
      if (!restoreMigration(event.data.payload)) return;
      try { event.source?.postMessage({ type: "SOLIVOC_LEGACY_IMPORTED" }, event.origin); } catch {}
      location.replace(`${APP_ORIGIN}/`);
    });
  }

  if (isWeb) {
    if (!["localhost", "127.0.0.1"].includes(host)) {
      window.SOLIVOC_API_BASE = API_ORIGIN;
    }

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
      try { window.top.location = window.self.location.href; } catch {}
      return;
    }
  }

  if (host === "admin.solivoc.ru" && (location.pathname === "/" || location.pathname === "")) {
    window.location.replace("/admin.html");
    return;
  }

  showCanonicalMigrationNotice();

  // Runtime safety net for iOS: if an interrupted auto-move leaves a tutorial
  // interaction lock behind, release it instead of trapping a new player.
  window.addEventListener("load", () => {
    let busySince = 0;
    let categorySince = 0;

    const repairTutorial = () => {
      try {
        if (typeof state === "undefined" || state?.mode !== "tutorial") {
          busySince = 0;
          categorySince = 0;
          return;
        }

        state.tutorialActions ||= {};

        // Self-heal step 1 if the category is visibly already in a slot but an
        // interrupted/mixed-cache event missed noteTutorialAction("category").
        if (
          state.tutorialStep === 1 &&
          !state.tutorialActions.category &&
          Array.isArray(state.slots) &&
          state.slots.some((group) => group && typeof categoryCard === "function" && categoryCard(group))
        ) {
          state.tutorialActions.category = true;
          if (typeof updateCoach === "function") updateCoach();
          if (typeof markStateChanged === "function") markStateChanged();
        }

        if (typeof autoMoveBusy !== "undefined" && autoMoveBusy) {
          busySince ||= Date.now();
          if (Date.now() - busySince > 2200) {
            autoMoveBusy = false;
            busySince = 0;
            try { cleanupAutoMoveVisuals?.(); } catch {}
            try { render?.(); } catch {}
          }
        } else busySince = 0;

        if (typeof categoryAnimating !== "undefined" && categoryAnimating) {
          categorySince ||= Date.now();
          if (Date.now() - categorySince > 2800) {
            categoryAnimating = false;
            categorySince = 0;
            try { render?.(); } catch {}
          }
        } else categorySince = 0;
      } catch {}
    };

    setInterval(repairTutorial, 450);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setTimeout(repairTutorial, 80);
    });
  }, { once: true });
})();
