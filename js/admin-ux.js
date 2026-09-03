(() => {
  "use strict";

  const originalApiFetch = globalThis.apiFetch;
  if (typeof originalApiFetch === "function") {
    const cache = new Map();
    const ttl = 20000;
    globalThis.apiFetch = async (input, init = {}) => {
      const method = String(init?.method || "GET").toUpperCase();
      const url = String(input || "");
      const cacheable = method === "GET" && /\/api\/admin\?player=u_|\/api\/admin\?recovery=1&userId=u_/.test(url);
      if (method !== "GET") cache.clear();
      if (cacheable) {
        const hit = cache.get(url);
        if (hit && Date.now() - hit.at < ttl) return hit.response.clone();
      }
      const response = await originalApiFetch(input, init);
      if (cacheable && response.ok) cache.set(url, { at: Date.now(), response: response.clone() });
      return response;
    };
  }

  const LABELS = {
    wins: "Победы", losses: "Поражения", played: "Сыграно", completed: "Завершено", attempts: "Попытки",
    best: "Лучший результат", bestScore: "Лучший счёт", score: "Счёт", total: "Всего", current: "Текущее",
    streak: "Серия", currentStreak: "Текущая серия", bestStreak: "Лучшая серия", level: "Уровень", levels: "Уровни",
    stars: "Звёзды", xp: "Опыт", moves: "Ходы", time: "Время", mistakes: "Ошибки", hints: "Подсказки",
    date: "Дата", updatedAt: "Обновлено", createdAt: "Создано", lastDate: "Последняя дата", progress: "Прогресс",
    rewarded: "Награда получена", unlocked: "Открыто", discovered: "Обнаружено", seen: "Просмотрено", mode: "Режим",
    daily: "Ежедневное", weekly: "Недельное", monthly: "Месячное", marathon: "Марафон", combo: "Комбо",
    duel: "Дуэли", pictures: "Картинки", onePass: "Один проход", noMistakes: "Без ошибок", hardcore: "Хардкор",
    chapterFinalsCompleted: "Финалов глав", levelsCompleted: "Пройдено уровней", tripleStarWins: "Уровней на 3 звезды",
    dailyCompleted: "Ежедневных завершено", challengeCompleted: "Испытаний завершено", duelsPlayed: "Дуэлей сыграно",
  };

  const humanKey = (key) => LABELS[key] || String(key)
    .replace(/([a-zа-я])([A-ZА-Я])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

  const humanScalar = (value) => {
    if (value === true) return "Да";
    if (value === false) return "Нет";
    if (value == null || value === "") return "—";
    if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    return String(value);
  };

  function renderValue(value, depth = 0) {
    if (Array.isArray(value)) {
      if (!value.length) return `<span class="admin-data-empty">Нет данных</span>`;
      if (value.every((x) => x == null || ["string", "number", "boolean"].includes(typeof x))) {
        return `<div class="admin-data-list">${value.map((x) => `<span class="chip">${escapeHtml(humanScalar(x))}</span>`).join("")}</div>`;
      }
      return `<div class="admin-friendly-data">${value.map((x, i) => `<div class="admin-data-group"><h5>Запись ${i + 1}</h5>${renderObject(x, depth + 1)}</div>`).join("")}</div>`;
    }
    if (value && typeof value === "object") return renderObject(value, depth + 1);
    return `<span class="admin-data-value">${escapeHtml(humanScalar(value))}</span>`;
  }

  function renderObject(object, depth = 0) {
    const entries = Object.entries(object || {});
    if (!entries.length) return `<span class="admin-data-empty">Нет данных</span>`;
    const simple = entries.filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v));
    const nested = entries.filter(([, v]) => v && typeof v === "object");
    return `<div class="admin-data-grid">${simple.map(([k, v]) => `<div class="admin-data-row"><span class="admin-data-key">${escapeHtml(humanKey(k))}</span>${renderValue(v, depth)}</div>`).join("")}</div>${nested.map(([k, v]) => `<div class="admin-data-nested"><div class="admin-data-key">${escapeHtml(humanKey(k))}</div>${renderValue(v, depth + 1)}</div>`).join("")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function upgradeJsonBlocks(root = document) {
    root.querySelectorAll("pre.json-box:not([data-ux-upgraded])").forEach((pre) => {
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

    root.querySelectorAll(".data-table td code:not([data-ux-upgraded])").forEach((code) => {
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
    root.querySelectorAll('form[data-form="snapshot-restore"]:not([data-ux-upgraded])').forEach((form) => {
      form.dataset.uxUpgraded = "1";
      const details = document.createElement("details");
      details.className = "admin-technical-recovery";
      details.innerHTML = `<summary>Техническое восстановление полного снимка</summary>`;
      form.parentNode.insertBefore(details, form);
      details.appendChild(form);
    });
  }

  function addQuickPlayerSwitch(root = document) {
    const hero = root.querySelector(".player-hero");
    const playerList = [...document.querySelectorAll('.player-list [data-player-open]')];
    if (!hero || !playerList.length || hero.parentElement?.querySelector(":scope > .admin-player-quick-switch")) return;
    const current = playerList.findIndex((button) => button.classList.contains("active"));
    const wrap = document.createElement("div");
    wrap.className = "admin-player-quick-switch";
    wrap.innerHTML = `<button type="button" class="secondary-button" data-quick-prev aria-label="Предыдущий игрок">←</button><label>Быстро перейти к игроку</label><select aria-label="Выбрать игрока">${playerList.map((button, index) => `<option value="${escapeHtml(button.dataset.playerOpen)}" ${index === current ? "selected" : ""}>${escapeHtml(button.querySelector("b")?.textContent || button.dataset.playerOpen)} · ${escapeHtml(button.querySelector("small")?.textContent || "")}</option>`).join("")}</select><button type="button" class="secondary-button" data-quick-next aria-label="Следующий игрок">→</button>`;
    hero.insertAdjacentElement("afterend", wrap);
    const select = wrap.querySelector("select");
    select.addEventListener("change", () => {
      const target = document.querySelector(`.player-list [data-player-open="${CSS.escape(select.value)}"]`);
      target?.click();
    });
    wrap.querySelector("[data-quick-prev]").addEventListener("click", () => {
      const index = current <= 0 ? playerList.length - 1 : current - 1;
      playerList[index]?.click();
    });
    wrap.querySelector("[data-quick-next]").addEventListener("click", () => {
      const index = current < 0 || current >= playerList.length - 1 ? 0 : current + 1;
      playerList[index]?.click();
    });
  }

  function prefetchPlayer(button) {
    const userId = button?.dataset?.playerOpen;
    if (!/^u_/.test(userId || "") || typeof globalThis.apiFetch !== "function") return;
    globalThis.apiFetch(`/api/admin?player=${encodeURIComponent(userId)}`, { cache: "no-store" }).catch(() => {});
  }

  let toastTimer = 0;
  function watchStatus() {
    const status = document.getElementById("adminStatus");
    if (!status || status.dataset.uxWatch) return;
    status.dataset.uxWatch = "1";
    const observer = new MutationObserver(() => {
      clearTimeout(toastTimer);
      if (!status.textContent.trim()) return;
      if (!status.classList.contains("danger") && !/Загружаю|Создаю|сохраня/i.test(status.textContent)) {
        toastTimer = setTimeout(() => { status.textContent = ""; }, 3200);
      }
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }

  function enhance(root = document) {
    upgradeJsonBlocks(root);
    upgradeRecovery(root);
    addQuickPlayerSwitch(root);
    watchStatus();
  }

  document.addEventListener("pointerenter", (event) => {
    const button = event.target.closest?.(".player-list [data-player-open]");
    if (button) prefetchPlayer(button);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const list = [...document.querySelectorAll('.player-list [data-player-open]')];
    if (!list.length) return;
    const current = list.findIndex((button) => button.classList.contains("active"));
    const next = event.key === "ArrowDown"
      ? (current < 0 || current === list.length - 1 ? 0 : current + 1)
      : (current <= 0 ? list.length - 1 : current - 1);
    event.preventDefault();
    list[next]?.click();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) for (const node of mutation.addedNodes) if (node.nodeType === 1) enhance(node);
    enhance(document);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });
  else {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
