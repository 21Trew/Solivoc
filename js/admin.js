(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fmt = (value) => new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
  const fmtDate = (value) => {
    const number = Number(value) || 0;
    if (!number) return "—";
    try { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(number)); }
    catch { return new Date(number).toLocaleString("ru-RU"); }
  };
  const json = (value) => JSON.stringify(value ?? {}, null, 2);
  const commandId = (prefix = "adm") => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const SECTION_META = {
    overview: ["УПРАВЛЕНИЕ", "Обзор", "Состояние игры, риски и быстрые действия."],
    players: ["АККАУНТЫ", "Игроки", "Поиск, диагностика и управление любым аспектом аккаунта."],
    messages: ["КОММУНИКАЦИЯ", "Сообщения", "Письма в игровой почтовый ящик — одному игроку или всем."],
    leaderboards: ["СОРЕВНОВАНИЯ", "Лидерборды", "Все игровые рейтинги, кроме пользовательских правил."],
    audit: ["НАБЛЮДАЕМОСТЬ", "Журнал", "Кто, когда и что изменял через админку."],
    system: ["ИНФРАСТРУКТУРА", "Система", "Резервные копии, массовый ремонт и обслуживание данных."],
  };
  const PLAYER_TABS = [
    ["summary", "Сводка"], ["progress", "Прогресс"], ["daily", "Ежедневное"], ["rewards", "Награды"],
    ["characters", "Персонажи"], ["modes", "Режимы"], ["recovery", "Восстановление"], ["history", "История"], ["danger", "Опасные действия"],
  ];
  const BOARD_META = {
    stars: ["Звёзды", "★"], levels: ["Уровни", "ур."], daily: ["Ежедневные", "дн."], marathon: ["Марафон", ""],
    zen: ["Дзен", ""], combo: ["Комбо", ""], duel: ["Дуэли", ""], pictures: ["Картинки", ""], time: ["На время", "мс"],
    moves: ["На ходы", "ход."], noMistakes: ["Без ошибок", ""], onePass: ["Один проход", ""], hardcore: ["Хардкор", ""],
  };

  const state = {
    authenticated: false,
    section: "overview",
    summary: null,
    selectedUserId: "",
    playerTab: "summary",
    player: null,
    playerLoading: false,
    recovery: null,
    recoveryLoading: false,
    audit: [],
    auditLoaded: false,
    auditQuery: "",
    auditAction: "",
    auditUser: "",
    expandedAudit: new Set(),
    leaderboards: null,
    leaderboardBoard: "stars",
    playerSearch: "",
    playerSort: "attention",
  };

  function errorMessage(error) {
    const code = error?.code || "";
    if (code === "invalid_credentials") return "Неверный логин или пароль.";
    if (code === "rate_limited") return "Слишком много запросов. Попробуй чуть позже.";
    if (code === "reason_required") return "Укажи причину изменения.";
    if (code === "admin_not_configured") return "Админ-доступ не настроен на сервере.";
    if (error?.status === 401) return "Сессия истекла. Войди снова.";
    return error?.message || "Не удалось выполнить запрос.";
  }

  function setStatus(message = "", danger = false) {
    const node = byId("adminStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("danger", !!danger);
  }
  function setLoginStatus(message = "", danger = false) {
    const node = byId("adminLoginStatus");
    node.textContent = message;
    node.classList.toggle("danger", !!danger);
  }

  async function adminRequest(path = "", options = {}) {
    const response = await apiFetch(`/api/admin${path}`, {
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.error || "request_failed";
      throw error;
    }
    return data;
  }

  async function recoveryRequest(query = "", options = {}) {
    const suffix = query ? `&${String(query).replace(/^\?/, "")}` : "";
    const response = await apiFetch(`/api/admin?recovery=1${suffix}`, {
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.error || "request_failed";
      throw error;
    }
    return data;
  }

  async function leaderboardRequest() {
    const response = await apiFetch("/api/leaderboard?board=all", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function showLogin(message = "") {
    state.authenticated = false;
    byId("adminAuth").hidden = false;
    byId("adminApp").hidden = true;
    if (message) setLoginStatus(message, true);
  }
  function showApp() {
    state.authenticated = true;
    byId("adminAuth").hidden = true;
    byId("adminApp").hidden = false;
    setLoginStatus("");
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const section = SECTION_META[parts[0]] ? parts[0] : "overview";
    const route = { section, userId: "", playerTab: "summary" };
    if (section === "players") {
      route.userId = /^u_/.test(parts[1] || "") ? parts[1] : "";
      route.playerTab = PLAYER_TABS.some(([id]) => id === parts[2]) ? parts[2] : "summary";
    }
    return route;
  }
  function routeTo(section, userId = "", playerTab = "summary") {
    if (section === "players" && userId) location.hash = `#/players/${encodeURIComponent(userId)}/${playerTab}`;
    else location.hash = `#/${section}`;
  }

  function updateTopbar() {
    const meta = SECTION_META[state.section] || SECTION_META.overview;
    byId("pageEyebrow").textContent = meta[0];
    byId("pageTitle").textContent = meta[1];
    byId("pageSubtitle").textContent = meta[2];
    document.querySelectorAll("[data-section]").forEach((button) => button.classList.toggle("active", button.dataset.section === state.section));
    byId("navPlayerCount").textContent = state.summary?.accounts != null ? fmt(state.summary.accounts) : "";
  }

  async function ensureSummary(force = false) {
    if (state.summary && !force) return state.summary;
    state.summary = await adminRequest();
    return state.summary;
  }
  async function ensureAudit(force = false) {
    if (state.auditLoaded && !force) return state.audit;
    const data = await adminRequest("?audit=1&limit=200");
    state.audit = Array.isArray(data.audit) ? data.audit : [];
    state.auditLoaded = true;
    return state.audit;
  }
  async function ensureLeaderboards(force = false) {
    if (state.leaderboards && !force) return state.leaderboards;
    state.leaderboards = await leaderboardRequest();
    return state.leaderboards;
  }
  async function ensurePlayer(userId, force = false) {
    if (!userId) return null;
    if (state.player?.id === userId && !force) return state.player;
    state.playerLoading = true;
    try {
      const data = await adminRequest(`?player=${encodeURIComponent(userId)}`);
      state.player = data.detail;
      state.selectedUserId = userId;
      state.recovery = null;
      return state.player;
    } finally { state.playerLoading = false; }
  }
  async function ensureRecovery(force = false) {
    const userId = state.selectedUserId;
    if (!userId) return null;
    if (state.recovery?.userId === userId && !force) return state.recovery;
    state.recoveryLoading = true;
    try {
      const data = await recoveryRequest(`userId=${encodeURIComponent(userId)}`);
      state.recovery = data.detail;
      return state.recovery;
    } finally { state.recoveryLoading = false; }
  }

  async function applyRoute() {
    if (!state.authenticated) return;
    const route = parseRoute();
    state.section = route.section;
    state.playerTab = route.playerTab;
    try {
      setStatus("Загружаю…");
      await ensureSummary();
      if (route.section === "overview") await ensureAudit();
      if (route.section === "audit") await ensureAudit();
      if (route.section === "leaderboards") await ensureLeaderboards();
      if (route.section === "players") {
        const accounts = (state.summary?.players || []).filter((p) => p.account);
        const userId = route.userId || state.selectedUserId || accounts[0]?.id || "";
        if (userId) {
          await ensurePlayer(userId);
          if (["daily", "modes", "recovery"].includes(route.playerTab)) await ensureRecovery();
        }
      }
      render();
      setStatus("");
    } catch (error) {
      if (error.status === 401) return showLogin("Сессия истекла. Войди снова.");
      setStatus(errorMessage(error), true);
      render();
    }
  }

  function render() {
    updateTopbar();
    const view = byId("adminView");
    if (state.section === "overview") view.innerHTML = overviewMarkup();
    else if (state.section === "players") view.innerHTML = playersMarkup();
    else if (state.section === "messages") view.innerHTML = messagesMarkup();
    else if (state.section === "leaderboards") view.innerHTML = leaderboardsMarkup();
    else if (state.section === "audit") view.innerHTML = auditMarkup();
    else view.innerHTML = systemMarkup();
    if (state.section === "messages") renderMailPreview();
  }

  function overviewMarkup() {
    const s = state.summary || {};
    const players = (s.players || []).filter((p) => p.account);
    const attention = players.filter((p) => Number(p.healthIssues) > 0).slice(0, 8);
    const recentAudit = state.audit.slice(0, 6);
    const active = [...players].sort((a, b) => (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0)).slice(0, 6);
    return `<div class="page-grid">
      <div class="kpi-grid">
        ${kpi("Аккаунты", s.accounts, "зарегистрированных игроков")}
        ${kpi("Облачные профили", s.profiles, "серверных профилей")}
        ${kpi("Лидерборд", s.leaderboardRecords, "серверных записей")}
        ${kpi("Нужна проверка", players.filter((p) => Number(p.healthIssues) > 0).length, "аккаунтов с диагностическими флагами", attention.length ? "attention" : "")}
      </div>
      <div class="two-col">
        <section class="panel">
          ${panelHead("ТРЕБУЕТ ВНИМАНИЯ", "Проблемы целостности", "Игроки, у которых серверная диагностика видит противоречия.", `<button class="secondary-button" data-section-go="players">Все игроки</button>`)}
          ${attention.length ? `<div class="attention-list">${attention.map((p) => `<div class="attention-row"><div><h4>${esc(p.name)} · ${esc(p.email || p.id)}</h4><p>${fmt(p.levels)} уровней · ★ ${fmt(p.stars)} · проблем: ${fmt(p.healthIssues)}</p></div><button class="secondary-button" data-player-open="${esc(p.id)}">Открыть</button></div>`).join("")}</div>` : `<div class="empty-state"><strong>Явных проблем нет</strong>Диагностические проверки для аккаунтов сейчас чистые.</div>`}
        </section>
        <section class="panel">
          ${panelHead("БЫСТРЫЕ ДЕЙСТВИЯ", "Операции", "Самые частые административные задачи.")}
          <div class="quick-actions">
            <button class="primary-button" data-section-go="players">Найти игрока</button>
            <button class="secondary-button" data-section-go="messages">Отправить сообщение</button>
            <button class="secondary-button" data-system-action="backup">Резервная копия</button>
            <button class="ghost-button" data-section-go="system">Обслуживание</button>
          </div>
        </section>
      </div>
      <div class="two-col">
        <section class="panel">
          ${panelHead("АКТИВНОСТЬ", "Игроки", "Быстрый переход к последним активным аккаунтам.")}
          <div class="attention-list">${active.length ? active.map((p) => `<div class="attention-row"><div><h4>${esc(p.name)}</h4><p>${esc(p.email || p.id)} · ${fmt(p.levels)} ур. · ★ ${fmt(p.stars)}</p></div><button class="ghost-button" data-player-open="${esc(p.id)}">Открыть</button></div>`).join("") : `<div class="empty-state">Аккаунтов пока нет.</div>`}</div>
        </section>
        <section class="panel">
          ${panelHead("АУДИТ", "Последние изменения", "Последние действия, выполненные через админку.", `<button class="secondary-button" data-section-go="audit">Весь журнал</button>`)}
          <div class="audit-list">${recentAudit.length ? recentAudit.map(compactAuditRow).join("") : `<div class="empty-state">В журнале пока нет записей.</div>`}</div>
        </section>
      </div>
    </div>`;
  }

  function kpi(label, value, hint, className = "") {
    return `<div class="kpi-card ${className}"><small>${esc(label)}</small><strong>${fmt(value)}</strong><p>${esc(hint)}</p></div>`;
  }
  function panelHead(label, title, text, actions = "") {
    return `<div class="panel-header"><div><small class="section-label">${esc(label)}</small><h3>${esc(title)}</h3><p>${esc(text)}</p></div>${actions ? `<div class="panel-actions">${actions}</div>` : ""}</div>`;
  }
  function compactAuditRow(item) {
    return `<div class="audit-row"><div><h4><code>${esc(item.action || "action")}</code></h4><p>${fmtDate(item.at)} · ${esc(item.actor || "—")}</p></div><span class="status-pill">${esc(item.userId || "система")}</span></div>`;
  }

  function accounts() { return (state.summary?.players || []).filter((p) => p.account); }
  function sortedFilteredPlayers() {
    const q = state.playerSearch.trim().toLowerCase();
    let rows = accounts().filter((p) => !q || `${p.name} ${p.email} ${p.id}`.toLowerCase().includes(q));
    rows = [...rows].sort((a, b) => {
      if (state.playerSort === "name") return String(a.name).localeCompare(String(b.name), "ru");
      if (state.playerSort === "levels") return (Number(b.levels) || 0) - (Number(a.levels) || 0);
      if (state.playerSort === "stars") return (Number(b.stars) || 0) - (Number(a.stars) || 0);
      if (state.playerSort === "attention") return (Number(b.healthIssues) || 0) - (Number(a.healthIssues) || 0) || (Number(b.levels) || 0) - (Number(a.levels) || 0);
      return (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0);
    });
    return rows;
  }
  function playerListMarkup() {
    const rows = sortedFilteredPlayers();
    return rows.length ? rows.map((p) => `<button type="button" data-player-open="${esc(p.id)}" class="${p.id === state.selectedUserId ? "active" : ""}"><span class="mini-avatar">${Number(p.healthIssues) ? "!" : "♟"}</span><span><b>${esc(p.name || "Игрок")}</b><small>${esc(p.email || p.id)}</small></span><em>${fmt(p.levels)} ур.</em></button>`).join("") : `<div class="empty-state">Ничего не найдено.</div>`;
  }
  function playersMarkup() {
    return `<div class="players-layout">
      <section class="panel players-sidebar">
        <div class="players-filter">
          <input id="playerSearch" type="search" placeholder="Имя, email или user ID" value="${esc(state.playerSearch)}" autocomplete="off">
          <select id="playerSort"><option value="attention" ${state.playerSort === "attention" ? "selected" : ""}>Сначала проблемы</option><option value="recent" ${state.playerSort === "recent" ? "selected" : ""}>По активности</option><option value="levels" ${state.playerSort === "levels" ? "selected" : ""}>По уровням</option><option value="stars" ${state.playerSort === "stars" ? "selected" : ""}>По звёздам</option><option value="name" ${state.playerSort === "name" ? "selected" : ""}>По имени</option></select>
        </div>
        <div id="playerList" class="player-list">${playerListMarkup()}</div>
      </section>
      <section class="player-detail">${playerDetailMarkup()}</section>
    </div>`;
  }

  function playerDetailMarkup() {
    if (state.playerLoading) return `<div class="panel empty-state"><strong>Загружаю игрока…</strong></div>`;
    const d = state.player;
    if (!d) return `<div class="panel empty-state"><strong>Выбери игрока</strong>Карточка аккаунта откроется здесь.</div>`;
    const c = d.campaign || {};
    const lb = d.leaderboard?.values || {};
    const mismatch = Number(lb.levels || 0) > Number(c.levelsCompleted || 0) || Number(lb.stars || 0) > Number(c.totalStars || 0);
    return `<div class="stack">
      <div class="player-hero">
        <div class="player-avatar">${esc(d.identity?.avatar || "🙂")}</div>
        <div class="player-title"><small>${esc(d.id)}</small><h3>${esc(d.identity?.name || "Игрок")}</h3><p>${esc(d.identity?.email || "Без email")}</p></div>
        <div class="player-kpis"><span><small>Кампания</small><b>${fmt(c.levelsCompleted)} ур.</b></span><span><small>Звёзды</small><b>★ ${fmt(c.totalStars)}</b></span><span><small>XP</small><b>${fmt(d.xp)}</b></span><span><small>Диагностика</small><b class="${d.health?.ok ? "" : "danger-text"}">${d.health?.ok ? "OK" : `${fmt(d.health?.issues?.length)} проблем`}</b></span></div>
      </div>
      ${mismatch ? `<div class="panel danger-zone"><div class="system-action"><div><h4>Облачный профиль отстаёт от серверного лидерборда</h4><p>Профиль: ${fmt(c.levelsCompleted)} ур. / ★ ${fmt(c.totalStars)}. Лидерборд: ${fmt(lb.levels)} ур. / ★ ${fmt(lb.stars)}. Это состояние нельзя оставлять без проверки.</p></div><button class="warning-button" data-player-command="repair_player">Синхронизировать</button></div></div>` : ""}
      <div class="player-tabs">${PLAYER_TABS.map(([id, label]) => `<button type="button" data-player-tab="${id}" class="${state.playerTab === id ? "active" : ""}">${label}</button>`).join("")}</div>
      ${state.playerTab !== 'history' ? playerContextMarkup() : ""}
      <div class="player-body">${playerTabMarkup(d)}</div>
    </div>`;
  }
  function playerContextMarkup() {
    return `<div class="context-bar"><label>Причина изменения *<input id="playerReason" maxlength="240" placeholder="Например: восстановление после сбоя синхронизации"></label><label>Тикет / инцидент<input id="playerTicket" maxlength="80" placeholder="INC-2026-…"></label></div>`;
  }
  function playerTabMarkup(d) {
    if (state.playerTab === "progress") return progressMarkup(d);
    if (state.playerTab === "daily") return dailyMarkup();
    if (state.playerTab === "rewards") return rewardsMarkup(d);
    if (state.playerTab === "characters") return charactersMarkup(d);
    if (state.playerTab === "modes") return modesMarkup();
    if (state.playerTab === "recovery") return recoveryMarkup();
    if (state.playerTab === "history") return playerHistoryMarkup(d);
    if (state.playerTab === "danger") return dangerMarkup(d);
    return playerSummaryMarkup(d);
  }

  function playerSummaryMarkup(d) {
    const c = d.campaign || {};
    const lb = d.leaderboard?.values || {};
    const issues = d.health?.issues || [];
    const stars = Object.entries(c.starsByLevel || {}).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 12);
    return `<div class="two-col">
      <div class="stack">
        <section class="tool-card">
          ${panelHead("ИСТОЧНИКИ ДАННЫХ", "Профиль и лидерборд", "Сразу показывает расхождения между двумя серверными представлениями прогресса.")}
          <div class="source-compare"><div class="source-box"><small>ОБЛАЧНЫЙ ПРОФИЛЬ</small><strong>${fmt(c.levelsCompleted)} ур. · ★ ${fmt(c.totalStars)}</strong></div><div class="source-box"><small>ЛИДЕРБОРД</small><strong>${fmt(lb.levels)} ур. · ★ ${fmt(lb.stars)}</strong></div></div>
        </section>
        <section class="tool-card">
          ${panelHead("ДИАГНОСТИКА", "Целостность аккаунта", "Проверки ключевых инвариантов прогресса.", `<button class="secondary-button" data-player-command="repair_player">Починить автоматически</button>`)}
          ${issues.length ? `<div class="health-list">${issues.map((issue) => `<div class="health-item ${issue.severity === "danger" ? "danger" : ""}"><code>${esc(issue.code)}</code><span>${esc(issue.text)}</span></div>`).join("")}</div>` : `<span class="status-pill good">✓ Явных противоречий не найдено</span>`}
        </section>
        <section class="tool-card">
          ${panelHead("ПОСЛЕДНИЕ РЕЗУЛЬТАТЫ", "Уровни", "Последние записи звёзд по кампании.")}
          <div class="chip-list">${stars.length ? stars.map(([level, star]) => `<span class="chip"><code>${esc(level)}</code> ${"★".repeat(Number(star) || 0)}</span>`).join("") : `<span class="help">Записей нет.</span>`}</div>
        </section>
      </div>
      <div class="stack">
        <section class="tool-card">${panelHead("АККАУНТ", "Сведения", "Идентичность и текущая конфигурация.")}${metric("ID", `<code>${esc(d.id)}</code>`)}${metric("Email", esc(d.identity?.email || "—"))}${metric("Создан", fmtDate(d.identity?.createdAt))}${metric("Спутник", esc(d.selectedCompanion || "—"))}${metric("Открыто спутников", fmt(d.companionsUnlocked?.length))}</section>
        <section class="tool-card">${panelHead("БЫСТРЫЕ ДЕЙСТВИЯ", "Исправление", "Частые операции без поиска по всей админке.")}<div class="quick-actions"><button class="primary-button" data-player-tab-go="recovery">Восстановить прогресс</button><button class="secondary-button" data-player-tab-go="daily">Серия и задания</button><button class="secondary-button" data-player-tab-go="progress">XP и уровни</button><button class="ghost-button" data-player-tab-go="history">История действий</button></div></section>
      </div>
    </div>`;
  }
  function metric(label, value) { return `<div class="metric-line"><span>${esc(label)}</span><b>${value}</b></div>`; }

  function progressMarkup(d) {
    const c = d.campaign || {};
    return `<div class="tool-grid">
      <section class="tool-card"><div class="tool-head"><div><small class="section-label">ОПЫТ</small><h4>XP игрока</h4><p>Ранг пересчитывается из XP.</p></div><strong>${fmt(d.xp)} XP</strong></div><form class="inline-form" data-form="xp-adjust"><input name="delta" type="number" step="1" placeholder="+500 или -100" required><button class="primary-button">Изменить</button></form><form class="inline-form" data-form="xp-set" style="margin-top:8px"><input name="value" type="number" min="0" step="1" placeholder="Точное значение" required><button class="warning-button">Установить точно</button></form></section>
      <section class="tool-card"><div class="tool-head"><div><small class="section-label">ЗВЁЗДЫ</small><h4>Конкретный уровень</h4><p>Меняет мастерство уже пройденного уровня.</p></div><strong>★ ${fmt(c.totalStars)}</strong></div><form class="form-grid three" data-form="level-stars"><label>Уровень<input name="level" type="number" min="1" max="10000" value="${Math.max(1, Number(c.levelsCompleted) || 1)}" required></label><label>Звёзды<select name="stars"><option value="1">★</option><option value="2">★★</option><option value="3" selected>★★★</option></select></label><label>Режим<select name="mode"><option value="at_least">Не ниже</option><option value="exact">Точно</option></select></label><button class="primary-button" style="grid-column:1/-1">Применить</button></form></section>
      <section class="tool-card"><div class="tool-head"><div><small class="section-label">КАМПАНИЯ</small><h4>Пройти до уровня</h4><p>Явно открывает кампанию до указанной точки.</p></div><strong>${fmt(c.levelsCompleted)} →</strong></div><form class="form-grid three" data-form="campaign-through"><label>До уровня<input name="targetLevel" type="number" min="1" max="10000" value="${Math.max(1, Number(c.levelsCompleted) || 1)}" required></label><label>Звёзды<select name="stars"><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option></select></label><label>Существующие<select name="mode"><option value="new_only">Не менять</option><option value="at_least">Поднять не ниже</option><option value="exact">Перезаписать</option></select></label><button class="warning-button" style="grid-column:1/-1">Отметить пройденными</button></form></section>
      <section class="tool-card"><div class="tool-head"><div><small class="section-label">АДАПТАЦИЯ</small><h4>Сложность и персонализация</h4><p>Не затрагивает основной прогресс.</p></div><strong>bias ${esc(d.adaptive?.bias ?? 0)}</strong></div><p class="help">История: ${esc((d.adaptive?.history || []).join(", ") || "—")}</p><button class="secondary-button" data-player-command="adaptive_reset">Сбросить адаптивный профиль</button></section>
    </div>`;
  }

  function recoveryProgress() { return state.recovery?.progress || {}; }
  function dailyMarkup() {
    if (state.recoveryLoading) return loadingCard("Загружаю ежедневный прогресс…");
    if (!state.recovery) return loadRecoveryCard();
    const p = recoveryProgress(), d = p.daily || {}, q = p.dailyQuests || {};
    return `<div class="stack">
      <div class="kpi-grid">${kpi("Дней подряд", d.currentStreak, "текущая серия")}${kpi("Лучшая серия", d.bestStreak, "рекорд аккаунта")}${kpi("Ежедневных", p.stats?.dailyCompleted, "завершено")}${kpi("Последний день", d.lastDate || "—", "серверная дата")}</div>
      <section class="tool-card"><div class="tool-head"><div><small class="section-label">БЫСТРОЕ ВОССТАНОВЛЕНИЕ</small><h4>Серия и счётчики</h4><p>Перед сохранением сервер автоматически создаст контрольную точку.</p></div></div>${recoveryReasonField()}<form class="form-grid three" data-form="daily-quick"><label>Дней подряд<input name="currentStreak" type="number" min="0" max="100000" value="${Number(d.currentStreak) || 0}"></label><label>Лучшая серия<input name="bestStreak" type="number" min="0" max="100000" value="${Number(d.bestStreak) || 0}"></label><label>Последний день<input name="lastDate" type="date" value="${esc(d.lastDate || "")}"></label><label>Ежедневных пройдено<input name="dailyCompleted" type="number" min="0" max="100000" value="${Number(p.stats?.dailyCompleted) || 0}"></label><label>Недельных завершено<input name="weeklyCompleted" type="number" min="0" max="100000" value="${Number(p.stats?.weeklyCompleted) || 0}"></label><label>Месячных завершено<input name="monthlyCompleted" type="number" min="0" max="100000" value="${Number(p.stats?.monthlyCompleted) || 0}"></label><button class="primary-button" style="grid-column:1/-1">Сохранить ежедневный прогресс</button></form></section>
      <div class="two-col"><section class="tool-card">${panelHead("ЗАДАНИЯ", "Ежедневные задания", `Дата: ${q.date || "—"}`)}${q.modes?.length ? q.modes.map((mode) => `${metric(mode, `${fmt(q.progress?.[mode])}/5 ${q.rewarded?.[mode] ? "· награда получена" : ""}`)}`).join("") : `<span class="help">Активных заданий нет.</span>`}</section><section class="tool-card">${panelHead("ПЕРИОД", "Недельное и месячное", "Текущее серверное состояние периодических задач.")}<details class="details-box"><summary>Недельное</summary><div><pre class="json-box">${esc(json(p.weekly || {}))}</pre></div></details><details class="details-box" style="margin-top:8px"><summary>Месячное</summary><div><pre class="json-box">${esc(json(p.monthly || {}))}</pre></div></details></section></div>
      <section class="tool-card">${panelHead("РАСШИРЕННОЕ", "Точные данные ежедневного прогресса", "Для сложных случаев: даты, звёзды, задания и данные маскота.")}<details class="details-box"><summary>Открыть точное редактирование JSON</summary><div>${recoveryReasonField("advancedRecoveryReason")}<form class="form-grid two" data-form="daily-advanced"><label>Завершённые даты<textarea name="completedDates">${esc(json(d.completedDates || []))}</textarea></label><label>Звёзды по дням<textarea name="dailyStars">${esc(json(p.dailyStars || {}))}</textarea></label><label>Ежедневные задания<textarea name="dailyQuests">${esc(json(p.dailyQuests || {}))}</textarea></label><label>Задания маскота<textarea name="mascotDaily">${esc(json(p.mascotDaily || {}))}</textarea></label><label>Недельное<textarea name="weekly">${esc(json(p.weekly || {}))}</textarea></label><label>Месячное<textarea name="monthly">${esc(json(p.monthly || {}))}</textarea></label><button class="warning-button" style="grid-column:1/-1">Применить точные данные</button></form></div></details></section>
    </div>`;
  }
  function recoveryReasonField(id = "recoveryReason") { return `<label class="field" style="margin-bottom:10px">Причина восстановления *<input id="${id}" maxlength="240" placeholder="Например: потеря серии после сбоя синхронизации"></label>`; }
  function loadingCard(text) { return `<div class="panel empty-state"><strong>${esc(text)}</strong></div>`; }
  function loadRecoveryCard() { return `<div class="panel empty-state"><strong>Нужны расширенные данные профиля</strong><button class="primary-button" data-load-recovery style="margin-top:10px">Загрузить</button></div>`; }

  function rewardsMarkup(d) {
    return `<div class="tool-grid"><section class="tool-card"><div class="tool-head"><div><small class="section-label">НАГРАДЫ</small><h4>Достижения</h4><p>${fmt(d.achievements?.length)} выдано</p></div></div><form class="inline-form" data-form="achievement"><input name="id" placeholder="technical_id" required><div class="table-actions"><button class="primary-button" name="operation" value="grant">Выдать</button><button class="secondary-button" name="operation" value="revoke">Забрать</button></div></form><div class="chip-list" style="margin-top:10px">${(d.achievements || []).map((x) => `<span class="chip"><code>${esc(x)}</code></span>`).join("") || `<span class="help">Нет достижений.</span>`}</div></section><section class="tool-card"><div class="tool-head"><div><small class="section-label">КОЛЛЕКЦИЯ</small><h4>Предметы</h4><p>${fmt(d.collectibles?.unlocked?.length)} открыто</p></div></div><form class="inline-form" data-form="collectible"><input name="id" placeholder="technical_id" required><div class="table-actions"><button class="primary-button" name="operation" value="grant">Выдать</button><button class="secondary-button" name="operation" value="revoke">Забрать</button></div></form><div class="chip-list" style="margin-top:10px">${(d.collectibles?.unlocked || []).map((x) => `<span class="chip"><code>${esc(x)}</code></span>`).join("") || `<span class="help">Коллекция пуста.</span>`}</div></section></div>`;
  }

  function charactersMarkup(d) {
    return `<div class="stack"><section class="tool-card"><div class="tool-head"><div><small class="section-label">СПУТНИКИ</small><h4>Открытые персонажи</h4><p>Принудительная выдача предназначена для исправления данных.</p></div><strong>${fmt(d.companionsUnlocked?.length)}</strong></div><form class="inline-form" data-form="companion"><input name="id" placeholder="mascot id" required><div class="table-actions"><button class="warning-button" name="operation" value="grant">Выдать</button><button class="danger-button" name="operation" value="revoke">Забрать</button></div></form><div class="chip-list" style="margin-top:10px">${(d.companionsUnlocked || []).map((x) => `<span class="chip"><code>${esc(x)}</code></span>`).join("") || `<span class="help">Нет открытых спутников.</span>`}</div></section><div class="two-col"><section class="tool-card">${panelHead("МАСКОТЫ", "Прогресс персонажей", "Точное серверное состояние.")}<pre class="json-box">${esc(json(d.mascotProgress || {}))}</pre></section><section class="tool-card">${panelHead("БОГИ", "Прогресс божеств", "Точное серверное состояние.")}<pre class="json-box">${esc(json(d.godProgress || {}))}</pre></section></div><p class="help">Для точного восстановления сложных состояний персонажей используй вкладку «Восстановление» — там доступен полный безопасный снимок игрового прогресса с контрольной точкой.</p></div>`;
  }

  function modesMarkup() {
    if (state.recoveryLoading) return loadingCard("Загружаю статистику режимов…");
    if (!state.recovery) return loadRecoveryCard();
    const p = recoveryProgress();
    const modes = p.modeStats && typeof p.modeStats === "object" ? p.modeStats : {};
    const stats = p.stats && typeof p.stats === "object" ? p.stats : {};
    return `<div class="stack"><section class="tool-card">${panelHead("РЕЖИМЫ", "Статистика по режимам", "Все сохранённые сервером показатели режимов игры.")}<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Режим</th><th>Данные</th></tr></thead><tbody>${Object.keys(modes).length ? Object.entries(modes).map(([name, value]) => `<tr><td><b>${esc(name)}</b></td><td><code>${esc(JSON.stringify(value))}</code></td></tr>`).join("") : `<tr><td colspan="2">Нет modeStats.</td></tr>`}</tbody></table></div></section><div class="two-col"><section class="tool-card">${panelHead("ОБЩАЯ СТАТИСТИКА", "stats", "Сводные игровые счётчики профиля.")}<pre class="json-box">${esc(json(stats))}</pre></section><section class="tool-card">${panelHead("ИСПЫТАНИЯ", "Метрики", "Challenge / duel / weekly данные, если они присутствуют в профиле.")}<pre class="json-box">${esc(json({ challengeMetrics: p.challengeMetrics || {}, challengeRecords: p.challengeRecords || {}, duelHistoryRecords: p.duelHistoryRecords || {}, weekly: p.weekly || {}, monthly: p.monthly || {} }))}</pre></section></div></div>`;
  }

  function recoveryMarkup() {
    if (state.recoveryLoading) return loadingCard("Загружаю снимок профиля…");
    if (!state.recovery) return loadRecoveryCard();
    const r = state.recovery, s = r.summary || {}, checkpoints = r.checkpoints || [];
    return `<div class="stack"><div class="kpi-grid">${kpi("Версия профиля", r.version, "серверная версия")}${kpi("Уровни", s.levels, "в снимке")}${kpi("Звёзды", s.stars, "в снимке")}${kpi("Серия", s.streak, `лучшая ${fmt(s.bestStreak)}`)}</div><section class="tool-card">${panelHead("ПОЛНОЕ ВОССТАНОВЛЕНИЕ", "Снимок игрового прогресса", "Охватывает уровни, XP, ежедневные задачи, серии, достижения, коллекции, персонажей, режимы и другие игровые области. Авторизация и данные устройства не входят.")}${recoveryReasonField("snapshotReason")}<form data-form="snapshot-restore"><label class="field">JSON снимка<textarea name="progress" style="min-height:360px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${esc(json(r.progress || {}))}</textarea></label><button class="warning-button" style="margin-top:10px">Применить снимок</button></form></section><section class="tool-card">${panelHead("КОНТРОЛЬНЫЕ ТОЧКИ", "Откат", "Перед каждым восстановлением сервер сохраняет предыдущее состояние на 90 дней.")}<div class="checkpoint-list">${checkpoints.length ? checkpoints.map((cp) => `<div class="checkpoint-row"><div><b>${esc(fmtDate(cp.at))}</b><p>${esc(cp.reason || "Без описания")} · ${fmt(cp.summary?.levels)} ур. · ★ ${fmt(cp.summary?.stars)} · серия ${fmt(cp.summary?.streak)}</p></div><button class="secondary-button" data-checkpoint="${esc(cp.id)}">Откатить сюда</button></div>`).join("") : `<div class="empty-state">Контрольных точек пока нет.</div>`}</div></section></div>`;
  }

  function playerHistoryMarkup(d) {
    const rows = d.audit || [];
    return `<section class="panel">${panelHead("ИСТОРИЯ ИГРОКА", "Действия админов", "Все последние административные изменения этого аккаунта.")}<div class="audit-list">${rows.length ? rows.map(fullAuditRow).join("") : `<div class="empty-state">Для игрока нет записей.</div>`}</div></section>`;
  }
  function dangerMarkup(d) {
    return `<div class="stack"><section class="panel">${panelHead("РЕМОНТ", "Безопасная сверка", "Сверяет прогресс с серверными данными и пересчитывает производные поля.")}<div class="system-action"><div><h4>Починить аккаунт автоматически</h4><p>Используй, если карточка показывает расхождение профиля и лидерборда или диагностика нашла противоречия.</p></div><button class="warning-button" data-player-command="repair_player">Починить</button></div></section><section class="panel danger-zone">${panelHead("DANGER ZONE", "Удаление аккаунта", "Удаляет auth/profile, связанные серверные данные и активные сессии. Действие необратимо.")}<label class="field">Причина удаления *<input id="deleteReason" maxlength="240" placeholder="Обязательное основание"></label><label class="field" style="margin-top:8px">Тикет / инцидент<input id="deleteTicket" maxlength="80"></label><button class="danger-button" data-delete-account="${esc(d.id)}" style="margin-top:12px">Удалить аккаунт</button></section></div>`;
  }

  function fullAuditRow(item) {
    const expanded = state.expandedAudit.has(item.id);
    return `<div class="audit-row"><div><h4><code>${esc(item.action || "action")}</code></h4><p>${fmtDate(item.at)}</p></div><div><h4>${esc(item.actor || "—")}</h4><p>${esc(item.userId || "система")}</p></div><div><h4>${esc(item.reason || "Без описания")}</h4><p>${esc(item.ticket || "")}</p></div><button class="ghost-button" data-audit-toggle="${esc(item.id)}">${expanded ? "Скрыть" : "Подробнее"}</button>${expanded ? `<div class="audit-detail"><pre class="json-box">${esc(json(item.before))}</pre><pre class="json-box">${esc(json(item.after))}</pre><pre class="json-box">${esc(json(item.meta))}</pre></div>` : ""}</div>`;
  }

  function messagesMarkup() {
    const players = accounts();
    return `<div class="message-layout"><section class="panel"><form id="messageForm" class="message-form">${panelHead("НОВОЕ СООБЩЕНИЕ", "Игровая почта", "Сообщение появляется внутри Словасьянса, а не в email.")}<div class="form-grid two"><label>Получатель<select name="target"><option value="all">Все игроки</option>${players.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.email || p.id)}</option>`).join("")}</select></label><label>Отправитель<input name="sender" maxlength="60" value="Команда Словасьянса"></label></div><label class="field">Заголовок<input name="title" maxlength="80" required placeholder="Короткий заголовок"></label><label class="field">Текст<textarea name="intro" maxlength="480" required placeholder="Основной текст сообщения"></textarea></label><label class="field">Пункты сообщения<textarea name="items" placeholder="Один пункт на строку"></textarea></label><div class="form-grid three"><label>Показывать<select name="presentation"><option value="inbox">В почте</option><option value="inbox_modal">В почте + модалка</option></select></label><label>Приоритет<select name="priority"><option value="normal">Обычный</option><option value="important">Важный</option></select></label><label>Срок, часов<input name="expiresHours" type="number" min="0" max="8760" value="0"></label></div><div class="form-grid two"><label>Кнопка<input name="ctaLabel" maxlength="48" placeholder="Например: Открыть событие"></label><label>Внутренняя ссылка<input name="ctaHref" maxlength="240" placeholder="/ или #..."></label></div><div class="form-grid two"><label>Причина отправки *<input name="reason" maxlength="240" required placeholder="Зачем отправляется сообщение"></label><label>Тикет / инцидент<input name="ticket" maxlength="80"></label></div><button class="primary-button">Отправить сообщение</button></form></section><aside class="message-preview"><section class="panel">${panelHead("ПРЕДПРОСМОТР", "Как увидит игрок", "Предварительный вид содержимого.")}<div id="mailPreview"></div></section></aside></div>`;
  }
  function renderMailPreview() {
    const form = byId("messageForm"), host = byId("mailPreview");
    if (!form || !host) return;
    const data = new FormData(form), items = String(data.get("items") || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
    host.innerHTML = `<div class="mail-preview-card"><small>${esc(data.get("sender") || "Команда Словасьянса")}</small><h4>${esc(data.get("title") || "Заголовок сообщения")}</h4><p>${esc(data.get("intro") || "Здесь будет текст сообщения.")}</p>${items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${data.get("ctaLabel") ? `<button class="primary-button" type="button">${esc(data.get("ctaLabel"))}</button>` : ""}</div>`;
  }

  function leaderboardsMarkup() {
    const boards = state.leaderboards?.boards || {};
    const available = Object.keys(BOARD_META).filter((key) => Array.isArray(boards[key]));
    const board = available.includes(state.leaderboardBoard) ? state.leaderboardBoard : (available[0] || "stars");
    state.leaderboardBoard = board;
    const rows = boards[board] || [];
    return `<section class="panel">${panelHead("РЕЙТИНГИ", "Лидерборды", "Серверные рейтинги всех игровых режимов. Пользовательские правила намеренно не входят.", `<button class="secondary-button" data-refresh-leaderboards>Обновить</button>`)}<div class="board-toolbar"><label class="field">Режим<select id="leaderboardBoard">${available.map((key) => `<option value="${key}" ${key === board ? "selected" : ""}>${esc(BOARD_META[key]?.[0] || key)}</option>`).join("")}</select></label><span class="status-pill">${fmt(rows.length)} записей</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Место</th><th>Игрок</th><th>ID</th><th>Результат</th><th></th></tr></thead><tbody>${rows.length ? rows.map((row, index) => `<tr><td class="rank ${index < 3 ? "top" : ""}">${index + 1}</td><td><b>${esc(row.name || "Игрок")}</b></td><td><code>${esc(row.playerId || "")}</code></td><td class="value-cell">${formatBoardValue(board, row.value)}</td><td><button class="ghost-button" data-player-open="${esc(row.playerId || "")}">Игрок</button></td></tr>`).join("") : `<tr><td colspan="5">Нет данных.</td></tr>`}</tbody></table></div></section>`;
  }
  function formatBoardValue(board, value) {
    const n = Number(value) || 0;
    if (board === "time") return n ? `${(n / 1000).toFixed(2)} сек.` : "—";
    if (board === "moves") return `${fmt(n)} ход.`;
    if (board === "stars") return `★ ${fmt(n)}`;
    return fmt(n);
  }

  function auditMarkup() {
    const actions = [...new Set(state.audit.map((x) => x.action).filter(Boolean))].sort();
    const filtered = state.audit.filter((x) => {
      const q = state.auditQuery.toLowerCase();
      const matchesQ = !q || `${x.action} ${x.actor} ${x.userId} ${x.reason} ${x.ticket}`.toLowerCase().includes(q);
      return matchesQ && (!state.auditAction || x.action === state.auditAction) && (!state.auditUser || String(x.userId || "").includes(state.auditUser));
    });
    return `<section class="panel">${panelHead("AUDIT LOG", "Административные действия", "Изменения хранят актёра, причину, цель и снимки до/после.", `<button class="secondary-button" data-refresh-audit>Обновить</button>`)}<div class="audit-toolbar"><label class="field">Поиск<input id="auditQuery" value="${esc(state.auditQuery)}" placeholder="Действие, игрок, причина…"></label><label class="field">Действие<select id="auditAction"><option value="">Все</option>${actions.map((a) => `<option value="${esc(a)}" ${state.auditAction === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label><label class="field">User ID<input id="auditUser" value="${esc(state.auditUser)}" placeholder="u_..."></label><span class="status-pill">${fmt(filtered.length)} записей</span></div><div class="audit-list">${filtered.length ? filtered.map(fullAuditRow).join("") : `<div class="empty-state">По фильтру ничего не найдено.</div>`}</div></section>`;
  }

  function systemMarkup() {
    const s = state.summary || {}, issueCount = accounts().filter((p) => Number(p.healthIssues) > 0).length;
    return `<div class="stack"><div class="kpi-grid">${kpi("Аккаунты", s.accounts, "зарегистрировано")}${kpi("Профили", s.profiles, "в облаке")}${kpi("Лидерборд", s.leaderboardRecords, "записей")}${kpi("Диагностика", issueCount, "аккаунтов требуют внимания", issueCount ? "attention" : "")}</div><section class="panel">${panelHead("ДАННЫЕ", "Обслуживание", "Редкие глобальные операции. Для массовых изменений всегда требуется явное подтверждение.")}<div class="system-action"><div><h4>Скачать резервную копию Redis</h4><p>Постранично выгружает серверные ключи, собирает JSON и вычисляет SHA-256.</p></div><button class="primary-button" data-system-action="backup">Скачать</button></div><div class="system-action"><div><h4>Пересчитать прогресс всех игроков</h4><p>Проверяет кампанию, звёзды и синхронизирует лидерборд. Используй после массового сбоя или миграции.</p></div><button class="warning-button" data-system-action="repair-all">Пересчитать</button></div><div class="system-action"><div><h4>Убрать безопасные дубли лидерборда</h4><p>Удаляет только записи, которые можно однозначно признать дублями аккаунтов.</p></div><button class="secondary-button" data-system-action="dedupe">Очистить дубли</button></div></section><section class="panel danger-zone">${panelHead("ПРАВИЛО БЕЗОПАСНОСТИ", "Источник истины", "Массовые операции не заменяют контрольные точки и аудит.")}<p class="help">Восстановление конкретного игрока выполняется во вкладке «Игроки → Восстановление»: перед записью автоматически создаётся контрольная точка. Удаление аккаунта находится только внутри карточки игрока и требует отдельного подтверждения.</p></section></div>`;
  }

  function context() {
    return { reason: String(byId("playerReason")?.value || "").trim(), ticket: String(byId("playerTicket")?.value || "").trim() };
  }
  function requireReason(value) {
    const text = String(value || "").trim();
    if (text.length < 3) throw new Error("Укажи причину изменения — минимум 3 символа.");
    return text;
  }
  function parseJson(text, label) {
    try { return JSON.parse(String(text || "").trim() || "{}"); }
    catch { throw new Error(`Некорректный JSON: ${label}.`); }
  }

  async function runPlayerCommand(command, args = {}, confirmOptions = null) {
    if (!state.selectedUserId) return;
    const ctx = context();
    try { ctx.reason = requireReason(ctx.reason); } catch (error) { return setStatus(error.message, true); }
    if (confirmOptions && !(await askConfirm(confirmOptions))) return;
    setStatus("Применяю изменение…");
    try {
      const data = await adminRequest("", { method: "POST", body: JSON.stringify({ action: "command", command, commandId: commandId(), userId: state.selectedUserId, reason: ctx.reason, ticket: ctx.ticket, args }) });
      state.player = data.detail;
      state.recovery = null;
      await ensureSummary(true);
      render();
      setStatus("Изменение сохранено. Действие записано в журнал.");
    } catch (error) {
      if (error.status === 401) return showLogin("Сессия истекла. Войди снова.");
      setStatus(errorMessage(error), true);
    }
  }

  async function runRecovery(payload, reason, confirmation) {
    try { reason = requireReason(reason); } catch (error) { return setStatus(error.message, true); }
    if (!(await askConfirm({ title: "Восстановить прогресс?", text: confirmation, confirmText: "Восстановить" }))) return;
    setStatus("Создаю контрольную точку и сохраняю…");
    try {
      const data = await recoveryRequest("", { method: "POST", body: JSON.stringify({ ...payload, userId: state.selectedUserId, reason, commandId: commandId("recovery") }) });
      state.recovery = data.detail;
      await ensurePlayer(state.selectedUserId, true);
      await ensureSummary(true);
      render();
      setStatus(`Готово. Предыдущее состояние сохранено: ${data.checkpoint?.id || "контрольная точка"}.`);
    } catch (error) { setStatus(errorMessage(error), true); }
  }

  async function deleteAccount() {
    const userId = state.selectedUserId, reason = String(byId("deleteReason")?.value || "").trim(), ticket = String(byId("deleteTicket")?.value || "").trim();
    try { requireReason(reason); } catch (error) { return setStatus(error.message, true); }
    const phrase = `DELETE ${userId}`;
    if (!(await askConfirm({ title: "Удалить аккаунт безвозвратно?", text: "Будут удалены облачный профиль, серверные данные, лидерборд и активные сессии. Восстановление через эту кнопку невозможно.", confirmText: "Удалить аккаунт", danger: true, phrase }))) return;
    setStatus("Удаляю аккаунт…");
    try {
      const data = await adminRequest("", { method: "POST", body: JSON.stringify({ action: "delete_account", userId, reason, ticket }) });
      state.summary = data;
      state.player = null; state.recovery = null; state.selectedUserId = "";
      routeTo("players");
      setStatus("Аккаунт удалён.");
    } catch (error) { setStatus(errorMessage(error), true); }
  }

  async function sendMessage(form) {
    const fd = new FormData(form), reason = String(fd.get("reason") || "").trim();
    try { requireReason(reason); } catch (error) { return setStatus(error.message, true); }
    const target = String(fd.get("target") || "all");
    const targetLabel = target === "all" ? "всем игрокам" : accounts().find((p) => p.id === target)?.name || target;
    if (!(await askConfirm({ title: "Отправить игровое сообщение?", text: `Получатель: ${targetLabel}. Сообщение появится в игровой почте.`, confirmText: "Отправить" }))) return;
    const payload = {
      action: "send_mail", target,
      sender: String(fd.get("sender") || ""), title: String(fd.get("title") || ""), intro: String(fd.get("intro") || ""),
      items: String(fd.get("items") || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8),
      presentation: String(fd.get("presentation") || "inbox"), priority: String(fd.get("priority") || "normal"), expiresHours: Number(fd.get("expiresHours")) || 0,
      ctaLabel: String(fd.get("ctaLabel") || ""), ctaHref: String(fd.get("ctaHref") || ""), reason, ticket: String(fd.get("ticket") || ""),
    };
    setStatus("Отправляю сообщение…");
    try { await adminRequest("", { method: "POST", body: JSON.stringify(payload) }); form.reset(); renderMailPreview(); setStatus("Сообщение отправлено и записано в журнал."); }
    catch (error) { setStatus(errorMessage(error), true); }
  }

  async function systemAction(action) {
    if (action === "backup") return downloadBackup();
    if (action === "repair-all") {
      if (!(await askConfirm({ title: "Пересчитать всех игроков?", text: "Будут пересчитаны уровни, звёзды и связанные записи лидерборда для всех облачных профилей.", confirmText: "Пересчитать" }))) return;
      setStatus("Пересчитываю прогресс всех игроков…");
      try { const data = await adminRequest("", { method: "POST", body: JSON.stringify({ action: "repair_all", reason: "Массовая проверка через системную панель" }) }); state.summary = data; render(); setStatus(`Готово: профилей ${fmt(data.repaired)}, уровней исправлено ${fmt(data.levelsChanged)}, звёзд ${fmt(data.starsChanged)}, дублей ${fmt(data.deduped)}.`); } catch (error) { setStatus(errorMessage(error), true); }
    }
    if (action === "dedupe") {
      if (!(await askConfirm({ title: "Очистить дубли?", text: "Будут удалены только безопасно определённые дубликаты записей лидерборда.", confirmText: "Удалить дубли" }))) return;
      setStatus("Ищу дубли…");
      try { const data = await adminRequest("", { method: "POST", body: JSON.stringify({ action: "dedupe", reason: "Очистка дублей через системную панель" }) }); await ensureSummary(true); render(); setStatus(`Удалено дублей: ${fmt(data.deduped)}.`); } catch (error) { setStatus(errorMessage(error), true); }
    }
  }

  async function downloadBackup() {
    const entriesByKey = new Map(); let cursor = "0", pages = 0;
    setStatus("Создаю резервную копию…");
    try {
      do {
        const page = await adminRequest(`?backup=1&cursor=${encodeURIComponent(cursor)}`);
        if (page.format !== "solivoc-redis-dump-v1") throw new Error("Неизвестный формат резервной копии.");
        for (const entry of page.entries || []) if (entry?.key) entriesByKey.set(entry.key, entry);
        cursor = String(page.cursor || "0"); pages++;
        setStatus(`Создаю резервную копию… ${fmt(entriesByKey.size)} ключей`);
        if (pages > 5000) throw new Error("Слишком много страниц Redis — операция остановлена.");
      } while (cursor !== "0");
      const backup = { format: "solivoc-redis-dump-v1", createdAt: new Date().toISOString(), source: "production", keyCount: entriesByKey.size, entries: [...entriesByKey.values()].sort((a, b) => a.key.localeCompare(b.key)) };
      const text = JSON.stringify(backup), digest = await sha256Hex(text), blob = new Blob([text], { type: "application/json;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `solivoc-redis-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(`Резервная копия готова: ${fmt(backup.keyCount)} ключей · SHA-256 ${digest}.`);
    } catch (error) { setStatus(errorMessage(error), true); }
  }
  async function sha256Hex(text) { const bytes = new TextEncoder().encode(text), hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

  function askConfirm({ title, text, confirmText = "Продолжить", danger = false, phrase = "" }) {
    const dialog = byId("adminConfirmDialog");
    if (!dialog?.showModal) return Promise.resolve(window.confirm(`${title}\n\n${text}`));
    dialog.classList.toggle("danger", danger); byId("confirmTitle").textContent = title; byId("confirmText").textContent = text; byId("confirmAccept").textContent = confirmText; byId("confirmAccept").value = "confirm";
    const wrap = byId("confirmPhraseWrap"), input = byId("confirmPhraseInput"), label = byId("confirmPhraseLabel"), accept = byId("confirmAccept");
    wrap.hidden = !phrase; label.textContent = phrase; input.value = ""; accept.disabled = !!phrase;
    const onInput = () => { accept.disabled = !!phrase && input.value !== phrase; };
    input.addEventListener("input", onInput);
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => { input.removeEventListener("input", onInput); resolve(dialog.returnValue === "confirm"); }, { once: true });
      dialog.showModal(); if (phrase) setTimeout(() => input.focus(), 0);
    });
  }

  async function refreshCurrent() {
    setStatus("Обновляю данные…");
    try {
      await ensureSummary(true);
      if (state.section === "overview" || state.section === "audit") await ensureAudit(true);
      if (state.section === "leaderboards") await ensureLeaderboards(true);
      if (state.section === "players" && state.selectedUserId) {
        await ensurePlayer(state.selectedUserId, true);
        if (["daily", "modes", "recovery"].includes(state.playerTab)) await ensureRecovery(true);
      }
      render(); setStatus("Данные обновлены.");
    } catch (error) { if (error.status === 401) return showLogin("Сессия истекла. Войди снова."); setStatus(errorMessage(error), true); }
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form"); if (!form || form.id === "adminLoginForm" || form.id === "adminConfirmForm") return;
    event.preventDefault();
    if (form.id === "messageForm") return sendMessage(form);
    const kind = form.dataset.form, fd = new FormData(form);
    if (kind === "xp-adjust") return runPlayerCommand("xp_adjust", { delta: Number(fd.get("delta")) });
    if (kind === "xp-set") return runPlayerCommand("xp_set", { value: Number(fd.get("value")) }, { title: "Установить точный XP?", text: "Это заменит текущее значение XP игрока.", confirmText: "Установить" });
    if (kind === "level-stars") return runPlayerCommand("level_stars_set", { level: Number(fd.get("level")), stars: Number(fd.get("stars")), mode: String(fd.get("mode")) });
    if (kind === "campaign-through") return runPlayerCommand("campaign_complete_through", { targetLevel: Number(fd.get("targetLevel")), stars: Number(fd.get("stars")), mode: String(fd.get("mode")) }, { title: "Продвинуть кампанию?", text: "Указанные уровни будут считаться пройденными. XP автоматически не начисляется.", confirmText: "Продвинуть" });
    if (kind === "achievement" || kind === "collectible" || kind === "companion") {
      const submitter = event.submitter, operation = submitter?.value || "grant", id = String(fd.get("id") || "").trim(); if (!id) return;
      const command = kind === "companion" ? `companion_force_${operation}` : `${kind}_${operation}`;
      return runPlayerCommand(command, { id }, operation === "revoke" ? { title: "Забрать объект?", text: `Будет отозван ${kind}: ${id}.`, confirmText: "Забрать" } : null);
    }
    if (kind === "daily-quick") {
      if (!state.recovery) return;
      const p = recoveryProgress(), d = p.daily || {};
      const daily = { currentStreak: Number(fd.get("currentStreak")) || 0, bestStreak: Number(fd.get("bestStreak")) || 0, lastDate: String(fd.get("lastDate") || ""), dailyCompleted: Number(fd.get("dailyCompleted")) || 0, completedDates: d.completedDates || [], dailyStars: p.dailyStars || {}, dailyQuests: p.dailyQuests || {}, mascotDaily: p.mascotDaily || {} };
      const periodic = { weekly: p.weekly || {}, monthly: p.monthly || {}, weeklyCompleted: Number(fd.get("weeklyCompleted")) || 0, monthlyCompleted: Number(fd.get("monthlyCompleted")) || 0 };
      return runRecovery({ action: "progress_restore_daily", daily, periodic }, byId("recoveryReason")?.value, "Изменить серию и ежедневные счётчики? Перед записью будет сохранено текущее состояние.");
    }
    if (kind === "daily-advanced") {
      if (!state.recovery) return;
      try {
        const p = recoveryProgress(), d = p.daily || {};
        const daily = { currentStreak: Number(d.currentStreak) || 0, bestStreak: Number(d.bestStreak) || 0, lastDate: d.lastDate || "", dailyCompleted: Number(p.stats?.dailyCompleted) || 0, completedDates: parseJson(fd.get("completedDates"), "завершённые даты"), dailyStars: parseJson(fd.get("dailyStars"), "звёзды по дням"), dailyQuests: parseJson(fd.get("dailyQuests"), "ежедневные задания"), mascotDaily: parseJson(fd.get("mascotDaily"), "задания маскота") };
        const periodic = { weekly: parseJson(fd.get("weekly"), "недельное"), monthly: parseJson(fd.get("monthly"), "месячное"), weeklyCompleted: Number(p.stats?.weeklyCompleted) || 0, monthlyCompleted: Number(p.stats?.monthlyCompleted) || 0 };
        return runRecovery({ action: "progress_restore_daily", daily, periodic }, byId("advancedRecoveryReason")?.value, "Применить точные данные ежедневного и периодического прогресса?");
      } catch (error) { return setStatus(error.message, true); }
    }
    if (kind === "snapshot-restore") {
      try { return runRecovery({ action: "progress_restore_snapshot", progress: parseJson(fd.get("progress"), "снимок прогресса") }, byId("snapshotReason")?.value, "Заменить все восстанавливаемые области профиля значениями из снимка?"); }
      catch (error) { return setStatus(error.message, true); }
    }
  }

  async function handleClick(event) {
    const section = event.target.closest("[data-section]")?.dataset.section || event.target.closest("[data-section-go]")?.dataset.sectionGo;
    if (section) { document.documentElement.classList.remove("sidebar-open"); return routeTo(section); }
    const playerId = event.target.closest("[data-player-open]")?.dataset.playerOpen;
    if (playerId && /^u_/.test(playerId)) { document.documentElement.classList.remove("sidebar-open"); return routeTo("players", playerId, "summary"); }
    const tab = event.target.closest("[data-player-tab]")?.dataset.playerTab || event.target.closest("[data-player-tab-go]")?.dataset.playerTabGo;
    if (tab && state.selectedUserId) return routeTo("players", state.selectedUserId, tab);
    const cmd = event.target.closest("[data-player-command]")?.dataset.playerCommand;
    if (cmd) {
      if (cmd === "repair_player") return runPlayerCommand(cmd, {}, { title: "Починить профиль?", text: "Сервер пересчитает кампанию и сверит её с уже подтверждённым лидербордом.", confirmText: "Починить" });
      if (cmd === "adaptive_reset") return runPlayerCommand(cmd, {}, { title: "Сбросить адаптацию?", text: "Будут очищены bias и история адаптивной сложности. Основной прогресс не изменится.", confirmText: "Сбросить" });
    }
    const checkpoint = event.target.closest("[data-checkpoint]")?.dataset.checkpoint;
    if (checkpoint) return runRecovery({ action: "progress_restore_checkpoint", checkpointId: checkpoint }, byId("snapshotReason")?.value || "Откат к контрольной точке", "Откатить игровой прогресс к выбранной контрольной точке? Текущее состояние тоже будет сохранено.");
    if (event.target.closest("[data-delete-account]")) return deleteAccount();
    const system = event.target.closest("[data-system-action]")?.dataset.systemAction; if (system) return systemAction(system);
    if (event.target.closest("[data-load-recovery]")) { setStatus("Загружаю расширенный профиль…"); try { await ensureRecovery(true); render(); setStatus(""); } catch (error) { setStatus(errorMessage(error), true); } return; }
    if (event.target.closest("[data-refresh-audit]")) { await ensureAudit(true); render(); return; }
    if (event.target.closest("[data-refresh-leaderboards]")) { await ensureLeaderboards(true); render(); return; }
    const auditId = event.target.closest("[data-audit-toggle]")?.dataset.auditToggle;
    if (auditId) { state.expandedAudit.has(auditId) ? state.expandedAudit.delete(auditId) : state.expandedAudit.add(auditId); render(); }
  }

  function handleInput(event) {
    if (event.target.id === "playerSearch") { state.playerSearch = event.target.value; const host = byId("playerList"); if (host) host.innerHTML = playerListMarkup(); }
    if (event.target.id === "auditQuery") { state.auditQuery = event.target.value; render(); const input = byId("auditQuery"); input?.focus(); input?.setSelectionRange(state.auditQuery.length, state.auditQuery.length); }
    if (event.target.closest("#messageForm")) renderMailPreview();
  }
  function handleChange(event) {
    if (event.target.id === "playerSort") { state.playerSort = event.target.value; const host = byId("playerList"); if (host) host.innerHTML = playerListMarkup(); }
    if (event.target.id === "leaderboardBoard") { state.leaderboardBoard = event.target.value; render(); }
    if (event.target.id === "auditAction") { state.auditAction = event.target.value; render(); }
    if (event.target.id === "auditUser") { state.auditUser = event.target.value; render(); }
  }

  byId("adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const login = byId("adminLogin").value.trim(), password = byId("adminPassword").value; if (!login || !password) return;
    byId("adminConnect").disabled = true; setLoginStatus("Проверяю доступ…");
    try { await adminRequest("", { method: "POST", body: JSON.stringify({ action: "login", login, password }) }); byId("adminPassword").value = ""; showApp(); await ensureSummary(true); if (!location.hash) location.hash = "#/overview"; await applyRoute(); }
    catch (error) { byId("adminPassword").value = ""; setLoginStatus(errorMessage(error), true); }
    finally { byId("adminConnect").disabled = false; }
  });
  byId("adminPasswordToggle").addEventListener("click", () => { const input = byId("adminPassword"), reveal = input.type === "password"; input.type = reveal ? "text" : "password"; byId("adminPasswordToggle").textContent = reveal ? "Скрыть" : "Показать"; });
  byId("adminLogout").addEventListener("click", async () => { try { await adminRequest("", { method: "POST", body: JSON.stringify({ action: "logout" }) }); } catch {} Object.assign(state, { authenticated: false, summary: null, player: null, recovery: null, audit: [], auditLoaded: false, leaderboards: null }); showLogin(); });
  byId("globalRefresh").addEventListener("click", refreshCurrent);
  byId("sidebarOpen").addEventListener("click", () => document.documentElement.classList.add("sidebar-open"));
  byId("sidebarClose").addEventListener("click", () => document.documentElement.classList.remove("sidebar-open"));
  byId("sidebarBackdrop").addEventListener("click", () => document.documentElement.classList.remove("sidebar-open"));
  byId("adminView").addEventListener("click", handleClick);
  byId("adminView").addEventListener("submit", handleSubmit);
  byId("adminView").addEventListener("input", handleInput);
  byId("adminView").addEventListener("change", handleChange);
  document.querySelector(".main-nav").addEventListener("click", handleClick);
  window.addEventListener("hashchange", applyRoute);

  async function restoreSession() {
    try { await adminRequest("?session=1"); showApp(); await ensureSummary(true); if (!location.hash) location.hash = "#/overview"; await applyRoute(); }
    catch (error) { if (error.status === 401) return showLogin(); showLogin(errorMessage(error)); }
  }
  restoreSession();
})();
