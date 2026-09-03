(() => {
  "use strict";

  const originalApiFetch = globalThis.apiFetch;
  const readCache = new Map();
  const inflight = new Map();
  const CACHE_LIMIT = 140;

  const endpointPolicy = (url) => {
    if (/\/api\/admin\?player=u_/.test(url)) return { ttl: 120000, stale: 600000 };
    if (/\/api\/admin\?recovery=1&userId=u_/.test(url)) return { ttl: 120000, stale: 600000 };
    if (/\/api\/admin\?audit=1/.test(url)) return { ttl: 90000, stale: 300000 };
    if (/\/api\/leaderboard\?board=all/.test(url)) return { ttl: 90000, stale: 300000 };
    if (/\/api\/admin(?:$|\?$)/.test(url)) return { ttl: 60000, stale: 180000 };
    return null;
  };

  function trimCache() {
    if (readCache.size <= CACHE_LIMIT) return;
    const oldest = [...readCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, readCache.size - CACHE_LIMIT);
    oldest.forEach(([key]) => readCache.delete(key));
  }

  function clearReadCache(match = null) {
    if (!match) {
      readCache.clear();
      inflight.clear();
      return;
    }
    for (const key of readCache.keys()) if (match(key)) readCache.delete(key);
    for (const key of inflight.keys()) if (match(key)) inflight.delete(key);
  }

  async function fetchAndRemember(url, input, init, policy) {
    if (inflight.has(url)) return (await inflight.get(url)).clone();
    const task = originalApiFetch(input, init).then((response) => {
      if (response.ok) {
        readCache.set(url, { at: Date.now(), response: response.clone(), policy });
        trimCache();
      }
      return response;
    }).finally(() => inflight.delete(url));
    inflight.set(url, task);
    return (await task).clone();
  }

  if (typeof originalApiFetch === "function") {
    globalThis.apiFetch = async (input, init = {}) => {
      const method = String(init?.method || "GET").toUpperCase();
      const url = String(input || "");
      if (method !== "GET") {
        clearReadCache();
        return originalApiFetch(input, init);
      }
      const policy = endpointPolicy(url);
      if (!policy) return originalApiFetch(input, init);
      const hit = readCache.get(url);
      const age = hit ? Date.now() - hit.at : Infinity;
      if (hit && age < policy.ttl) return hit.response.clone();
      if (hit && age < policy.stale) {
        fetchAndRemember(url, input, init, policy).catch(() => {});
        return hit.response.clone();
      }
      return fetchAndRemember(url, input, init, policy);
    };
  }

  const LABELS = {
    wins: "Победы", losses: "Поражения", played: "Сыграно", completed: "Завершено", attempts: "Попытки",
    best: "Лучший результат", bestScore: "Лучший счёт", score: "Счёт", total: "Всего", current: "Текущее значение",
    streak: "Серия", currentStreak: "Текущая серия", bestStreak: "Лучшая серия", level: "Уровень", levels: "Уровни",
    stars: "Звёзды", xp: "Опыт", moves: "Ходы", time: "Время", duration: "Длительность", durationMs: "Длительность",
    mistakes: "Ошибки", hints: "Подсказки", hintsUsed: "Использовано подсказок", noHints: "Без подсказок",
    perfect: "Идеальные прохождения", categories: "Категории", cards: "Карты", combo: "Комбо", bestCombo: "Лучшее комбо",
    date: "Дата", at: "Время записи", updatedAt: "Обновлено", createdAt: "Создано", lastDate: "Последняя дата", progress: "Прогресс",
    rewarded: "Награда получена", unlocked: "Открыто", discovered: "Обнаружено", seen: "Просмотрено", mode: "Режим",
    daily: "Ежедневное", weekly: "Недельное", monthly: "Месячное", marathon: "Марафон", zen: "Дзен",
    duel: "Дуэли", pictures: "Картинки", onePass: "Один проход", noMistakes: "Без ошибок", hardcore: "Хардкор",
    chapterFinalsCompleted: "Финалов глав", levelsCompleted: "Пройдено уровней", tripleStarWins: "Уровней на 3 звезды",
    dailyCompleted: "Ежедневных завершено", challengeCompleted: "Испытаний завершено", duelsPlayed: "Дуэлей сыграно",
    challengeMetrics: "Метрики испытаний", challengeRecords: "Результаты испытаний", duelHistoryRecords: "История дуэлей",
    weeklyDigest: "Недельная сводка", weeklyCompleted: "Недель завершено", monthlyCompleted: "Месяцев завершено",
    levelRecords: "История уровней", dailyRecords: "История ежедневных игр", modeStats: "Статистика режимов",
    adaptive: "Адаптивная сложность", stats: "Общая статистика", result: "Результат", won: "Победа", lost: "Поражение",
    rewardedAt: "Награда получена", completedAt: "Завершено", startedAt: "Начато", lastPlayedAt: "Последняя игра",
    id: "Идентификатор", name: "Название", value: "Значение", count: "Количество", rank: "Место", points: "Очки",
    bestTime: "Лучшее время", bestMoves: "Лучший результат по ходам", maxCombo: "Максимальное комбо",
    easy: "Лёгкий", normal: "Обычный", hard: "Сложный", success: "Успешно", failed: "Неудачно",
  };

  const VALUE_LABELS = {
    classic: "Классический", daily: "Ежедневный", marathon: "Марафон", zen: "Дзен", combo: "Комбо", duel: "Дуэли",
    pictures: "Картинки", time: "На время", moves: "На ходы", noMistakes: "Без ошибок", onePass: "Один проход", hardcore: "Хардкор",
    owl: "Сова", cat: "Кот", fox: "Лис", bear: "Медведь", raven: "Ворон", wolf: "Волк", tiger: "Тигр", panda: "Панда",
    frog: "Лягушка", octopus: "Осьминог", normal: "Обычный", important: "Важный", inbox: "В почте", inbox_modal: "В почте и отдельным окном",
  };

  const ACTION_LABELS = {
    xp_adjust: "Изменение опыта", xp_set: "Установка опыта", level_stars_set: "Изменение звёзд уровня",
    campaign_complete_through: "Продвижение кампании", achievement_grant: "Выдача достижения", achievement_revoke: "Отзыв достижения",
    collectible_grant: "Выдача предмета", collectible_revoke: "Отзыв предмета", companion_force_grant: "Выдача персонажа",
    companion_force_revoke: "Отзыв персонажа", adaptive_reset: "Сброс адаптивной сложности", repair_player: "Автоматическое исправление профиля",
    progress_restore_daily: "Восстановление ежедневного прогресса", progress_restore_snapshot: "Восстановление снимка прогресса",
    progress_restore_checkpoint: "Откат к контрольной точке", send_mail: "Отправка игрового сообщения", delete_account: "Удаление аккаунта",
    repair_all: "Массовая проверка профилей", dedupe: "Очистка дублей лидерборда",
  };

  const STATIC_REPLACEMENTS = new Map([
    ["AUDIT LOG", "ЖУРНАЛ"],
    ["DANGER ZONE", "ОПАСНЫЕ ДЕЙСТВИЯ"],
    ["stats", "Общая статистика"],
    ["Challenge / duel / weekly данные, если они присутствуют в профиле.", "Данные испытаний, дуэлей, недельной и месячной активности."],
    ["User ID", "ID игрока"],
    ["JSON снимка", "Технический снимок данных"],
  ]);

  const TOKEN_LABELS = {
    challenge: "испытаний", metrics: "метрики", records: "результаты", duel: "дуэлей", history: "история", weekly: "недельное",
    monthly: "месячное", daily: "ежедневное", best: "лучший", current: "текущий", total: "всего", completed: "завершено",
    no: "без", hints: "подсказок", perfect: "идеально", categories: "категории", levels: "уровни", stars: "звёзды",
    moves: "ходы", combo: "комбо", score: "счёт", wins: "победы", losses: "поражения", played: "сыграно",
  };

  function splitIdentifier(key) {
    return String(key || "").replace(/([a-zа-я])([A-ZА-Я])/g, "$1 $2").replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  }

  function humanKey(key) {
    if (LABELS[key]) return LABELS[key];
    const tokens = splitIdentifier(key);
    if (tokens.length && tokens.every((token) => TOKEN_LABELS[token.toLowerCase()])) {
      const text = tokens.map((token) => TOKEN_LABELS[token.toLowerCase()]).join(" ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    return "Дополнительный параметр";
  }

  function formatDateNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n > 1e12 ? n : n > 1e9 && n < 2e10 ? n * 1000 : 0;
    if (!ms) return null;
    try { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(ms)); }
    catch { return null; }
  }

  function humanScalar(value, key = "") {
    if (value === true) return "Да";
    if (value === false) return "Нет";
    if (value == null || value === "") return "—";
    if (typeof value === "string") {
      if (VALUE_LABELS[value]) return VALUE_LABELS[value];
      if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
      }
      return value;
    }
    if (typeof value === "number") {
      if (["at", "updatedAt", "createdAt", "completedAt", "startedAt", "lastPlayedAt", "rewardedAt"].includes(key)) {
        const date = formatDateNumber(value);
        if (date) return date;
      }
      if (["time", "duration", "durationMs", "bestTime"].includes(key) && value > 1000) return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value / 1000)} сек.`;
      return new Intl.NumberFormat("ru-RU").format(value);
    }
    return String(value);
  }

  const RECORD_COLLECTIONS = new Set(["challengeRecords", "duelHistoryRecords", "dailyRecords", "levelRecords"]);

  function recordTitle(collection, rawKey, index) {
    if (collection === "levelRecords" && /^\d+$/.test(rawKey)) return `Уровень ${rawKey}`;
    if (collection === "dailyRecords") return `Ежедневная игра ${index + 1}`;
    if (collection === "duelHistoryRecords") return `Дуэль ${index + 1}`;
    return `Испытание ${index + 1}`;
  }

  function renderRecordCollection(value, key, depth) {
    const entries = Object.entries(value || {});
    if (!entries.length) return `<span class="admin-data-empty">Нет данных</span>`;
    return `<div class="admin-friendly-data admin-record-list">${entries.map(([recordId, record], index) => `<div class="admin-data-group"><h5>${escapeHtml(recordTitle(key, recordId, index))}</h5>${renderValue(record, depth + 1, key)}</div>`).join("")}</div>`;
  }

  function renderValue(value, depth = 0, key = "") {
    if (Array.isArray(value)) {
      if (!value.length) return `<span class="admin-data-empty">Нет данных</span>`;
      if (value.every((x) => x == null || ["string", "number", "boolean"].includes(typeof x))) {
        return `<div class="admin-data-list">${value.map((x) => `<span class="chip">${escapeHtml(humanScalar(x, key))}</span>`).join("")}</div>`;
      }
      return `<div class="admin-friendly-data">${value.map((x, i) => `<div class="admin-data-group"><h5>Запись ${i + 1}</h5>${renderValue(x, depth + 1, key)}</div>`).join("")}</div>`;
    }
    if (value && typeof value === "object") {
      if (RECORD_COLLECTIONS.has(key)) return renderRecordCollection(value, key, depth);
      return renderObject(value, depth + 1, key);
    }
    return `<span class="admin-data-value">${escapeHtml(humanScalar(value, key))}</span>`;
  }

  function renderObject(object, depth = 0, contextKey = "") {
    const entries = Object.entries(object || {});
    if (!entries.length) return `<span class="admin-data-empty">Нет данных</span>`;
    const simple = entries.filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v));
    const nested = entries.filter(([, v]) => v && typeof v === "object");
    return `<div class="admin-data-grid">${simple.map(([k, v]) => `<div class="admin-data-row"><span class="admin-data-key">${escapeHtml(humanKey(k))}</span>${renderValue(v, depth, k)}</div>`).join("")}</div>${nested.map(([k, v]) => `<div class="admin-data-nested"><div class="admin-data-key">${escapeHtml(humanKey(k))}</div>${renderValue(v, depth + 1, k)}</div>`).join("")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function upgradeJsonBlocks(root = document) {
    root.querySelectorAll?.("pre.json-box:not([data-ux-upgraded])").forEach((pre) => {
      pre.dataset.uxUpgraded = "1";
      let parsed;
      try { parsed = JSON.parse(pre.textContent || "{}"); } catch { return; }
      const friendly = document.createElement("div");
      friendly.className = "admin-friendly-data";
      friendly.innerHTML = renderValue(parsed);
      const details = document.createElement("details");
      details.className = "technical-json";
      details.innerHTML = `<summary>Технические данные</summary>`;
      pre.parentNode.insertBefore(friendly, pre);
      pre.parentNode.insertBefore(details, pre);
      details.appendChild(pre);
    });

    root.querySelectorAll?.(".data-table td code:not([data-ux-upgraded])").forEach((code) => {
      const text = code.textContent || "";
      if (!/^[\[{]/.test(text.trim())) return;
      let parsed;
      try { parsed = JSON.parse(text); } catch { return; }
      code.dataset.uxUpgraded = "1";
      const box = document.createElement("div");
      box.className = "admin-mode-data";
      box.innerHTML = renderValue(parsed);
      code.replaceWith(box);
    });
  }

  function upgradeRecovery(root = document) {
    root.querySelectorAll?.('form[data-form="snapshot-restore"]:not([data-ux-upgraded])').forEach((form) => {
      form.dataset.uxUpgraded = "1";
      const details = document.createElement("details");
      details.className = "admin-technical-recovery";
      details.innerHTML = `<summary>Техническое восстановление полного снимка</summary>`;
      form.parentNode.insertBefore(details, form);
      details.appendChild(form);
    });
  }

  function translateInterface(root = document) {
    root.querySelectorAll?.(".section-label,h3,h4,.tool-head p,.panel-header p,label,option").forEach((node) => {
      const text = node.textContent.trim();
      if (STATIC_REPLACEMENTS.has(text) && node.children.length === 0) node.textContent = STATIC_REPLACEMENTS.get(text);
    });
    root.querySelectorAll?.('input[placeholder="technical_id"]').forEach((input) => { input.placeholder = "Служебный код"; });
    root.querySelectorAll?.('input[placeholder="mascot id"]').forEach((input) => { input.placeholder = "Код персонажа"; });
    root.querySelectorAll?.(".audit-row h4 code").forEach((code) => {
      const raw = code.textContent.trim();
      code.title = raw;
      code.textContent = ACTION_LABELS[raw] || humanKey(raw);
    });
    root.querySelectorAll?.(".health-item code").forEach((code) => {
      const raw = code.textContent.trim();
      code.title = raw;
      code.textContent = "Проверка данных";
    });
    root.querySelectorAll?.(".data-table tbody tr td:first-child b").forEach((cell) => {
      const raw = cell.textContent.trim();
      if (VALUE_LABELS[raw]) cell.textContent = VALUE_LABELS[raw];
    });
  }

  function addQuickPlayerSwitch(root = document) {
    const hero = root.querySelector?.(".player-hero") || document.querySelector(".player-hero");
    const playerList = [...document.querySelectorAll('.player-list [data-player-open]')];
    if (!hero || !playerList.length || hero.parentElement?.querySelector(":scope > .admin-player-quick-switch")) return;
    const current = playerList.findIndex((button) => button.classList.contains("active"));
    const wrap = document.createElement("div");
    wrap.className = "admin-player-quick-switch";
    wrap.innerHTML = `<button type="button" class="secondary-button" data-quick-prev aria-label="Предыдущий игрок">←</button><label>Игрок</label><select aria-label="Выбрать игрока">${playerList.map((button, index) => `<option value="${escapeHtml(button.dataset.playerOpen)}" ${index === current ? "selected" : ""}>${escapeHtml(button.querySelector("b")?.textContent || button.dataset.playerOpen)} · ${escapeHtml(button.querySelector("small")?.textContent || "")}</option>`).join("")}</select><button type="button" class="secondary-button" data-quick-next aria-label="Следующий игрок">→</button>`;
    hero.insertAdjacentElement("afterend", wrap);
    const select = wrap.querySelector("select");
    select.addEventListener("change", () => document.querySelector(`.player-list [data-player-open="${CSS.escape(select.value)}"]`)?.click());
    wrap.querySelector("[data-quick-prev]").addEventListener("click", () => playerList[current <= 0 ? playerList.length - 1 : current - 1]?.click());
    wrap.querySelector("[data-quick-next]").addEventListener("click", () => playerList[current < 0 || current >= playerList.length - 1 ? 0 : current + 1]?.click());
  }

  function upgradeLeaderboards(root = document) {
    const select = root.querySelector?.("#leaderboardBoard") || document.querySelector("#leaderboardBoard");
    if (!select || select.dataset.uxTabs) return;
    select.dataset.uxTabs = "1";
    const toolbar = select.closest(".board-toolbar");
    if (!toolbar) return;
    select.closest("label")?.classList.add("ux-native-board-select");
    const tabs = document.createElement("div");
    tabs.className = "leaderboard-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.innerHTML = [...select.options].map((option) => `<button type="button" role="tab" data-board-value="${escapeHtml(option.value)}" class="${option.selected ? "active" : ""}" aria-selected="${option.selected ? "true" : "false"}">${escapeHtml(option.textContent)}</button>`).join("");
    toolbar.insertBefore(tabs, toolbar.firstChild);
    tabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-board-value]");
      if (!button) return;
      select.value = button.dataset.boardValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function setupSidebarCollapse() {
    const sidebar = document.getElementById("adminSidebar");
    const brand = sidebar?.querySelector(".sidebar-brand");
    if (!sidebar || !brand || brand.querySelector(".sidebar-collapse-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button sidebar-collapse-toggle";
    brand.insertBefore(button, brand.querySelector(".sidebar-close"));
    const apply = (collapsed) => {
      document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
      button.textContent = collapsed ? "›" : "‹";
      button.setAttribute("aria-label", collapsed ? "Развернуть навигацию" : "Свернуть навигацию");
      button.title = collapsed ? "Развернуть навигацию" : "Свернуть навигацию";
      try { localStorage.setItem("solivoc-admin-sidebar-collapsed-v1", collapsed ? "1" : "0"); } catch {}
    };
    let initial = false;
    try { initial = localStorage.getItem("solivoc-admin-sidebar-collapsed-v1") === "1"; } catch {}
    apply(initial);
    button.addEventListener("click", () => apply(!document.documentElement.classList.contains("sidebar-collapsed")));
    document.querySelectorAll(".main-nav button").forEach((nav) => { nav.title = nav.querySelector("b")?.textContent || ""; });
  }

  function prefetchUrl(url) {
    if (typeof globalThis.apiFetch !== "function") return;
    globalThis.apiFetch(url, { cache: "no-store" }).catch(() => {});
  }

  function prefetchPlayer(button, includeRecovery = true) {
    const userId = button?.dataset?.playerOpen;
    if (!/^u_/.test(userId || "")) return;
    prefetchUrl(`/api/admin?player=${encodeURIComponent(userId)}`);
    if (includeRecovery) prefetchUrl(`/api/admin?recovery=1&userId=${encodeURIComponent(userId)}`);
  }

  let warmupTimer = 0;
  function warmupCommonData() {
    clearTimeout(warmupTimer);
    warmupTimer = setTimeout(() => {
      const app = document.getElementById("adminApp");
      if (!app || app.hidden) return;
      prefetchUrl("/api/admin?audit=1&limit=200");
      prefetchUrl("/api/leaderboard?board=all");
      const players = [...document.querySelectorAll('.player-list [data-player-open]')];
      if (!players.length) return;
      const current = Math.max(0, players.findIndex((button) => button.classList.contains("active")));
      const indices = [...new Set([current, current - 1, current + 1, 0, 1, 2, 3].filter((i) => i >= 0 && i < players.length))];
      indices.forEach((index, order) => setTimeout(() => prefetchPlayer(players[index], Math.abs(index - current) <= 1), order * 90));
    }, 140);
  }

  let toastTimer = 0;
  let toastDelay = 0;
  function watchStatus() {
    const status = document.getElementById("adminStatus");
    if (!status || status.dataset.uxWatch) return;
    status.dataset.uxWatch = "1";
    const update = () => {
      clearTimeout(toastTimer);
      clearTimeout(toastDelay);
      status.classList.remove("ux-status-visible");
      const message = status.textContent.trim();
      if (!message) return;
      const slow = /Загружаю|Создаю|сохраня|Обновляю|Отправляю|Применяю|Удаляю|Пересчитываю|Ищу/i.test(message);
      if (slow) {
        toastDelay = setTimeout(() => {
          if (status.textContent.trim() === message) status.classList.add("ux-status-visible");
        }, 260);
        return;
      }
      status.classList.add("ux-status-visible");
      if (!status.classList.contains("danger")) toastTimer = setTimeout(() => { status.textContent = ""; }, 3400);
    };
    new MutationObserver(update).observe(status, { childList: true, characterData: true, subtree: true });
    update();
  }

  function enhance(root = document) {
    upgradeJsonBlocks(root);
    upgradeRecovery(root);
    translateInterface(root);
    addQuickPlayerSwitch(root);
    upgradeLeaderboards(root);
    setupSidebarCollapse();
    watchStatus();
    warmupCommonData();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#globalRefresh")) clearReadCache();
    if (event.target.closest?.("[data-refresh-audit]")) clearReadCache((url) => /audit=1/.test(url));
    if (event.target.closest?.("[data-refresh-leaderboards]")) clearReadCache((url) => /\/api\/leaderboard/.test(url));
    if (event.target.closest?.("[data-load-recovery]")) clearReadCache((url) => /recovery=1/.test(url));
  }, true);

  document.addEventListener("pointerenter", (event) => {
    const button = event.target.closest?.(".player-list [data-player-open]");
    if (button) prefetchPlayer(button, true);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const list = [...document.querySelectorAll('.player-list [data-player-open]')];
    if (!list.length) return;
    const current = list.findIndex((button) => button.classList.contains("active"));
    const next = event.key === "ArrowDown" ? (current < 0 || current === list.length - 1 ? 0 : current + 1) : (current <= 0 ? list.length - 1 : current - 1);
    event.preventDefault();
    list[next]?.click();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) for (const node of mutation.addedNodes) if (node.nodeType === 1) enhance(node);
    enhance(document);
  });

  const start = () => {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
