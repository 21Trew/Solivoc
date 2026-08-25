/* Admin Operations Console: player controls, in-game messaging and audit. */
(() => {
  if (window.__solivocAdminConsoleInstalled) return;
  window.__solivocAdminConsoleInstalled = true;

  const state = {
    tab: "players",
    summary: null,
    detail: null,
    selectedUserId: "",
    busy: false,
    audit: [],
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
  const fmt = (value) => new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
  const fmtDate = (value) => {
    const n = Number(value) || 0;
    if (!n) return "—";
    try { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(n)); }
    catch { return new Date(n).toLocaleString(); }
  };
  const commandId = () => globalThis.crypto?.randomUUID?.() || `adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const byId = (id) => document.getElementById(id);

  async function api(path = "", options = {}) {
    const response = await apiFetch(`/api/admin${path}`, { cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.code = data.error || "request_failed";
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function post(payload) {
    return api("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function status(text = "", danger = false) {
    const node = byId("adminConsoleStatus");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("danger", !!danger);
  }

  function ensureShell() {
    const panel = byId("adminPanel");
    if (!panel || byId("adminOpsConsole")) return;
    const host = document.createElement("section");
    host.id = "adminOpsConsole";
    host.className = "admin-ops-console";
    host.innerHTML = `
      <div class="admin-ops-head">
        <div>
          <small>OPERATIONS CONSOLE</small>
          <h2>Управление игрой</h2>
          <p>Прогресс, XP, награды, сообщения и диагностика — отдельными безопасными командами.</p>
        </div>
        <span id="adminConsoleStatus" class="admin-console-status"></span>
      </div>
      <nav class="admin-console-tabs" aria-label="Разделы админки">
        <button type="button" data-admin-tab="players" class="active">Игроки</button>
        <button type="button" data-admin-tab="messages">Сообщения</button>
        <button type="button" data-admin-tab="audit">Журнал</button>
        <button type="button" data-admin-tab="system">Система</button>
      </nav>
      <div id="adminConsoleBody"></div>`;
    const table = panel.querySelector(".admin-table-wrap");
    if (table) panel.insertBefore(host, table);
    else panel.appendChild(host);
    host.addEventListener("click", handleClick);
    host.addEventListener("submit", handleSubmit);
    host.addEventListener("change", handleChange);
    renderConsole();
  }

  function renderConsole() {
    ensureShell();
    const body = byId("adminConsoleBody");
    if (!body) return;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === state.tab));
    if (state.tab === "players") body.innerHTML = playersMarkup();
    else if (state.tab === "messages") body.innerHTML = messagesMarkup();
    else if (state.tab === "audit") body.innerHTML = auditMarkup();
    else body.innerHTML = systemMarkup();
    if (state.tab === "players" && state.detail) renderPlayerDetail(state.detail);
  }

  function playersMarkup() {
    const players = Array.isArray(state.summary?.players) ? state.summary.players.filter((p) => p.account) : [];
    const selected = state.selectedUserId || players[0]?.id || "";
    if (!state.selectedUserId && selected) state.selectedUserId = selected;
    return `
      <div class="admin-console-toolbar">
        <label class="admin-console-search">Игрок
          <input id="adminPlayerSearch" type="search" placeholder="Имя, email или user ID" autocomplete="off">
        </label>
        <label>Аккаунт
          <select id="adminPlayerSelect">
            <option value="">Выбери игрока</option>
            ${players.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name)} · ${esc(p.email || p.id)}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="admin-secondary" data-admin-action="reload-player">Обновить карточку</button>
      </div>
      <div id="adminPlayerSearchResults" class="admin-player-search-results" hidden></div>
      <div id="adminPlayerDetail" class="admin-player-detail">
        <div class="admin-console-empty">${selected ? "Загружаю Player 360…" : "Выбери зарегистрированного игрока."}</div>
      </div>`;
  }

  function playerHeader(detail) {
    const c = detail.campaign || {};
    const issues = detail.health?.issues || [];
    return `
      <div class="admin-player-hero">
        <div class="admin-player-avatar">${esc(detail.identity?.avatar || "🙂")}</div>
        <div class="admin-player-title">
          <small>${esc(detail.id)}</small>
          <h3>${esc(detail.identity?.name || "Игрок")}</h3>
          <p>${esc(detail.identity?.email || "Без email")}</p>
        </div>
        <div class="admin-player-kpis">
          <span><small>Кампания</small><b>${fmt(c.levelsCompleted)} ур.</b></span>
          <span><small>Звёзды</small><b>★ ${fmt(c.totalStars)}</b></span>
          <span><small>XP</small><b>${fmt(detail.xp)}</b></span>
          <span class="${issues.length ? "warn" : "ok"}"><small>Целостность</small><b>${issues.length ? `${issues.length} проблем` : "OK"}</b></span>
        </div>
      </div>`;
  }

  function reasonFields() {
    return `
      <div class="admin-command-context">
        <label>Причина изменения *<input id="adminCommandReason" maxlength="240" placeholder="Например: восстановление после сбоя iOS"></label>
        <label>Тикет / инцидент<input id="adminCommandTicket" maxlength="80" placeholder="INC-2026-…"></label>
      </div>`;
  }

  function healthMarkup(detail) {
    const issues = detail.health?.issues || [];
    return `<section class="admin-tool-card admin-health-card">
      <div class="admin-tool-head"><div><small>ДИАГНОСТИКА</small><h4>Целостность аккаунта</h4></div><button type="button" class="admin-secondary" data-admin-command="repair_player">Починить автоматически</button></div>
      ${issues.length ? `<div class="admin-health-list">${issues.map((issue) => `<div class="${esc(issue.severity || "warning")}"><code>${esc(issue.code)}</code><span>${esc(issue.text)}</span></div>`).join("")}</div>` : `<p class="admin-ok-line">✓ Явных противоречий в прогрессе не найдено.</p>`}
    </section>`;
  }

  function renderPlayerDetail(detail) {
    const host = byId("adminPlayerDetail");
    if (!host) return;
    const c = detail.campaign || {};
    const starRows = Object.entries(c.starsByLevel || {}).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 16);
    host.innerHTML = `
      ${playerHeader(detail)}
      ${reasonFields()}
      <div class="admin-tool-grid">
        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>ОПЫТ</small><h4>XP игрока</h4></div><strong>${fmt(detail.xp)} XP</strong></div>
          <form data-admin-form="xp-adjust" class="admin-inline-form">
            <input name="delta" type="number" step="1" placeholder="+500 / -100" required>
            <button type="submit">Изменить XP</button>
          </form>
          <form data-admin-form="xp-set" class="admin-inline-form danger-zone-inline">
            <input name="value" type="number" min="0" step="1" placeholder="Точное значение" required>
            <button type="submit" class="admin-warning">Установить точно</button>
          </form>
          <small class="admin-help">Ранг вычисляется из XP. Admin-изменение не создаёт ложную модалку повышения ранга.</small>
        </section>

        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>MASTERY</small><h4>Звёзды уровня</h4></div><strong>★ ${fmt(c.totalStars)}</strong></div>
          <form data-admin-form="level-stars" class="admin-level-form">
            <label>Уровень<input name="level" type="number" min="1" max="10000" value="${Math.max(1, Number(c.levelsCompleted) || 1)}" required></label>
            <label>Звёзды<select name="stars"><option value="1">★</option><option value="2">★★</option><option value="3" selected>★★★</option></select></label>
            <label>Режим<select name="mode"><option value="at_least">Не ниже</option><option value="exact">Установить точно</option></select></label>
            <button type="submit">Применить</button>
          </form>
          <small class="admin-help">Не открывает непройденный уровень: ★ и продвижение кампании остаются разными действиями.</small>
        </section>

        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>КАМПАНИЯ</small><h4>Пройти до уровня</h4></div><strong>${fmt(c.levelsCompleted)} →</strong></div>
          <form data-admin-form="campaign-through" class="admin-level-form">
            <label>До уровня<input name="targetLevel" type="number" min="1" max="10000" value="${Math.max(1, Number(c.levelsCompleted) || 1)}" required></label>
            <label>Звёзды<select name="stars"><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option></select></label>
            <label>Существующие<select name="mode"><option value="new_only">Не менять</option><option value="at_least">Поднять не ниже</option><option value="exact">Перезаписать все</option></select></label>
            <button type="submit" class="admin-warning">Отметить пройденными</button>
          </form>
          <small class="admin-help">Это явное продвижение кампании. Оно не начисляет XP и не меняет отношения/сюжетные нити.</small>
        </section>

        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>НАГРАДЫ</small><h4>Достижения и предметы</h4></div><strong>${fmt(detail.achievements?.length)} / ${fmt(detail.collectibles?.unlocked?.length)}</strong></div>
          <form data-admin-form="generic-grant" class="admin-generic-form">
            <select name="kind"><option value="achievement">Достижение</option><option value="collectible">Предмет</option></select>
            <input name="id" placeholder="technical_id" required>
            <button type="submit" name="operation" value="grant">Выдать</button>
            <button type="submit" name="operation" value="revoke" class="admin-secondary">Забрать</button>
          </form>
          <details><summary>Что уже есть</summary><div class="admin-chip-list"><b>Достижения</b>${(detail.achievements || []).slice(0, 24).map((x) => `<code>${esc(x)}</code>`).join("") || "<span>—</span>"}<b>Предметы</b>${(detail.collectibles?.unlocked || []).slice(0, 24).map((x) => `<code>${esc(x)}</code>`).join("") || "<span>—</span>"}</div></details>
        </section>

        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>ПЕРСОНАЖИ</small><h4>Принудительный спутник</h4></div><strong>${fmt(detail.companionsUnlocked?.length)}</strong></div>
          <form data-admin-form="companion-force" class="admin-generic-form">
            <input name="id" placeholder="mascot id" required>
            <button type="submit" name="operation" value="grant" class="admin-warning">FORCE выдать</button>
            <button type="submit" name="operation" value="revoke" class="admin-danger-button">FORCE забрать</button>
          </form>
          <div class="admin-chip-list">${(detail.companionsUnlocked || []).map((x) => `<code>${esc(x)}</code>`).join("") || "<span>Нет открытых спутников</span>"}</div>
          <small class="admin-help danger">Аварийный рычаг. Не разыгрывает encounter, не создаёт понимание/взаимность и может дать сюжетно неконсистентный аккаунт.</small>
        </section>

        <section class="admin-tool-card">
          <div class="admin-tool-head"><div><small>АДАПТАЦИЯ</small><h4>Профиль персонализации</h4></div><strong>bias ${esc(detail.adaptive?.bias ?? 0)}</strong></div>
          <p>История: ${esc((detail.adaptive?.history || []).join(", ") || "—")}</p>
          <button type="button" class="admin-secondary" data-admin-command="adaptive_reset">Сбросить адаптивный профиль</button>
          <small class="admin-help">Основной прогресс, ★, XP и история аккаунта не удаляются.</small>
        </section>
      </div>
      ${healthMarkup(detail)}
      <section class="admin-tool-card">
        <div class="admin-tool-head"><div><small>ПОСЛЕДНИЕ РЕЗУЛЬТАТЫ</small><h4>Звёзды уровней</h4></div><span>${starRows.length} последних записей</span></div>
        <div class="admin-level-history">${starRows.map(([level, stars]) => `<span><b>${esc(level)}</b><i>${"★".repeat(Number(stars) || 0)}${"☆".repeat(Math.max(0, 3 - (Number(stars) || 0)))}</i></span>`).join("") || "<p>Пока нет завершённых уровней.</p>"}</div>
      </section>
      <section class="admin-tool-card">
        <div class="admin-tool-head"><div><small>AUDIT</small><h4>Последние действия по игроку</h4></div><button type="button" class="admin-secondary" data-admin-tab-jump="audit">Весь журнал</button></div>
        ${auditRows(detail.audit || [])}
      </section>
      <section class="admin-tool-card admin-account-danger">
        <div class="admin-tool-head"><div><small>DANGER ZONE</small><h4>Удаление аккаунта</h4></div><strong>необратимо</strong></div>
        <p>Удаляются auth/profile и связанные серверные данные аккаунта. Причина обязательна и попадёт в audit.</p>
        <form data-admin-form="delete-account" class="admin-delete-form">
          <input name="confirm" autocomplete="off" placeholder="Введи DELETE ${esc(detail.id)}" required>
          <button type="submit" class="admin-danger-button">Удалить аккаунт</button>
        </form>
      </section>`;
  }

  function messagesMarkup() {
    const players = Array.isArray(state.summary?.players) ? state.summary.players.filter((p) => p.account) : [];
    return `
      <section class="admin-message-console">
        <div class="admin-tool-head"><div><small>ВНУТРИИГРОВАЯ СВЯЗЬ</small><h3>Письмо игрокам</h3><p>Письмо всегда остаётся во входящих. При варианте «Письмо + модалка» оно дополнительно показывается поверх игры в безопасный момент.</p></div></div>
        <form id="adminMessageForm" class="admin-message-form">
          <div class="admin-message-grid">
            <label>Получатель<select name="target"><option value="all">Все зарегистрированные игроки</option>${players.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.email)}</option>`).join("")}</select></label>
            <label>Показ<select name="presentation"><option value="inbox">Только письмо</option><option value="inbox_modal">Письмо + модалка</option></select></label>
            <label>Отправитель<input name="sender" maxlength="60" value="Команда Словасьянса"></label>
            <label>Приоритет<select name="priority"><option value="normal">Обычный</option><option value="important">Важный</option></select></label>
            <label class="full">Заголовок<input name="title" maxlength="80" required placeholder="Например: Мы восстановили ваш прогресс"></label>
            <label class="full">Текст<textarea name="intro" maxlength="480" required placeholder="Главное сообщение игроку"></textarea></label>
            <label class="full">Пункты<textarea name="items" placeholder="Каждый пункт с новой строки"></textarea></label>
            <label>Кнопка<input name="ctaLabel" maxlength="48" placeholder="Продолжить путешествие"></label>
            <label>Deep link<input name="ctaHref" maxlength="240" placeholder="/ или #раздел"></label>
            <label>Срок, часов<input name="expiresHours" type="number" min="0" max="8760" value="0"><small>0 — без срока</small></label>
            <label>Тикет<input name="ticket" maxlength="80" placeholder="INC-2026-…"></label>
            <label class="full">Причина / контекст<input name="reason" maxlength="240" placeholder="Для audit-журнала"></label>
          </div>
          <div class="admin-message-preview" id="adminMessagePreview"><small>ПРЕДПРОСМОТР</small><h4>Заголовок письма</h4><p>Здесь будет текст сообщения.</p></div>
          <div class="admin-message-actions"><span>Массовая отправка требует дополнительного подтверждения.</span><button type="submit">Отправить</button></div>
        </form>
      </section>`;
  }

  function auditRows(rows) {
    if (!rows?.length) return `<div class="admin-console-empty">Записей пока нет.</div>`;
    return `<div class="admin-audit-list">${rows.map((item) => `<article>
      <div><b>${esc(item.action)}</b><small>${fmtDate(item.at)} · ${esc(item.actor || "admin")}</small></div>
      <p>${esc(item.reason || "Без комментария")}</p>
      <span>${item.userId ? `<code>${esc(item.userId)}</code>` : "глобальное действие"}${item.ticket ? ` · <code>${esc(item.ticket)}</code>` : ""}</span>
    </article>`).join("")}</div>`;
  }
  function auditMarkup() {
    return `<section class="admin-tool-card admin-audit-card">
      <div class="admin-tool-head"><div><small>НЕИЗМЕНЯЕМЫЙ СЛЕД</small><h3>Журнал действий</h3><p>Сохраняются admin-команда, причина, before/after и связанный игрок.</p></div><button type="button" class="admin-secondary" data-admin-action="reload-audit">Обновить</button></div>
      ${auditRows(state.audit)}
    </section>`;
  }
  function systemMarkup() {
    const s = state.summary || {};
    return `<div class="admin-system-grid">
      <section class="admin-tool-card"><small>СОСТОЯНИЕ</small><h3>Production data</h3><div class="admin-system-kpis"><span><b>${fmt(s.accounts)}</b><small>аккаунтов</small></span><span><b>${fmt(s.profiles)}</b><small>профилей</small></span><span><b>${fmt(s.leaderboardRecords)}</b><small>leaderboard records</small></span></div></section>
      <section class="admin-tool-card"><small>БЕЗОПАСНОСТЬ</small><h3>Command layer</h3><p>Изменения игрока идут через серверные команды, требуют причины, имеют idempotency key и audit before/after. Прямого редактора JSON здесь нет намеренно.</p></section>
      <section class="admin-tool-card"><small>РАЗДЕЛЕНИЕ ПРОГРЕССИИ</small><h3>Не смешиваем системы</h3><p>★ меняют mastery. «Пройти до уровня» меняет кампанию. XP меняется отдельно. FORCE-маскот не разыгрывает сюжет и выделен как аварийная операция.</p></section>
    </div>`;
  }

  async function refreshSummary() {
    if (state.busy) return;
    state.busy = true;
    status("Обновляю данные…");
    try {
      const data = await api();
      state.summary = data;
      renderConsole();
      if (state.tab === "players" && state.selectedUserId) await loadPlayer(state.selectedUserId);
      status(`Данные обновлены · ${fmt(data.accounts)} аккаунтов`);
    } catch (error) {
      if (error.status !== 401) status(error.message, true);
    } finally { state.busy = false; }
  }

  async function loadPlayer(userId) {
    userId = String(userId || "");
    if (!userId) { state.detail = null; renderConsole(); return; }
    state.selectedUserId = userId;
    const host = byId("adminPlayerDetail");
    if (host) host.innerHTML = `<div class="admin-console-empty">Загружаю Player 360…</div>`;
    try {
      const data = await api(`?player=${encodeURIComponent(userId)}`);
      state.detail = data.detail;
      renderPlayerDetail(state.detail);
      markManageButtons();
    } catch (error) {
      if (host) host.innerHTML = `<div class="admin-console-empty danger">${esc(error.message)}</div>`;
    }
  }

  async function loadAudit() {
    try {
      const data = await api("?audit=1&limit=150");
      state.audit = data.audit || [];
      if (state.tab === "audit") renderConsole();
    } catch (error) { status(error.message, true); }
  }

  function commandContext() {
    return {
      reason: byId("adminCommandReason")?.value.trim() || "",
      ticket: byId("adminCommandTicket")?.value.trim() || "",
    };
  }
  async function runCommand(command, args = {}, { confirmText = "" } = {}) {
    if (!state.selectedUserId) return status("Сначала выбери игрока.", true);
    const ctx = commandContext();
    if (ctx.reason.length < 3) return status("Укажи причину изменения.", true);
    if (confirmText && !confirm(confirmText)) return;
    status(`Выполняю ${command}…`);
    try {
      const data = await post({ action: "command", command, userId: state.selectedUserId, args, commandId: commandId(), ...ctx });
      state.detail = data.detail;
      renderPlayerDetail(state.detail);
      await loadAudit();
      await refreshBaseAdmin();
      status(`Готово: ${command}`);
    } catch (error) { status(error.message, true); }
  }

  async function refreshBaseAdmin() {
    try {
      if (typeof refresh === "function") await refresh();
    } catch {}
    try {
      state.summary = await api();
    } catch {}
    markManageButtons();
  }

  function submitterValue(event) {
    return event.submitter?.value || "grant";
  }
  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "adminMessageForm") {
      event.preventDefault();
      const fd = new FormData(form), target = String(fd.get("target") || "all");
      if (target === "all" && !confirm("Отправить это сообщение ВСЕМ зарегистрированным игрокам?")) return;
      const payload = {
        action: "send_mail",
        target,
        presentation: String(fd.get("presentation") || "inbox"),
        sender: String(fd.get("sender") || ""),
        priority: String(fd.get("priority") || "normal"),
        title: String(fd.get("title") || ""),
        intro: String(fd.get("intro") || ""),
        items: String(fd.get("items") || "").split("\n").map((x) => x.trim()).filter(Boolean),
        ctaLabel: String(fd.get("ctaLabel") || ""),
        ctaHref: String(fd.get("ctaHref") || ""),
        expiresHours: Number(fd.get("expiresHours")) || 0,
        ticket: String(fd.get("ticket") || ""),
        reason: String(fd.get("reason") || ""),
      };
      status("Отправляю сообщение…");
      try {
        const data = await post(payload);
        status(data.target === "all" ? "Сообщение отправлено всем игрокам." : "Сообщение отправлено игроку.");
        form.reset();
        form.querySelector("[name=sender]").value = "Команда Словасьянса";
        form.querySelector("[name=expiresHours]").value = "0";
        updateMessagePreview(form);
        await loadAudit();
      } catch (error) { status(error.message, true); }
      return;
    }

    const kind = form.dataset.adminForm;
    if (!kind) return;
    event.preventDefault();
    const fd = new FormData(form);
    if (kind === "xp-adjust") return runCommand("xp_adjust", { delta: Number(fd.get("delta")) });
    if (kind === "xp-set") return runCommand("xp_set", { value: Number(fd.get("value")) }, { confirmText: "Установить XP игрока в точное значение?" });
    if (kind === "level-stars") return runCommand("level_stars_set", { level: Number(fd.get("level")), stars: Number(fd.get("stars")), mode: String(fd.get("mode")) });
    if (kind === "campaign-through") {
      const targetLevel = Number(fd.get("targetLevel")), stars = Number(fd.get("stars")), mode = String(fd.get("mode"));
      return runCommand("campaign_complete_through", { targetLevel, stars, mode }, { confirmText: `Отметить кампанию пройденной до уровня ${targetLevel}? XP и сюжетные отношения начислены не будут.` });
    }
    if (kind === "generic-grant") {
      const resource = String(fd.get("kind")), op = submitterValue(event), id = String(fd.get("id") || "");
      return runCommand(`${resource}_${op === "revoke" ? "revoke" : "grant"}`, { id });
    }
    if (kind === "companion-force") {
      const op = submitterValue(event), id = String(fd.get("id") || "");
      return runCommand(`companion_force_${op === "revoke" ? "revoke" : "grant"}`, { id }, { confirmText: `FORCE-${op === "revoke" ? "забрать" : "выдать"} маскота «${id}»? Это не воспроизводит сюжетный путь отношений.` });
    }
    if (kind === "delete-account") {
      const typed = String(fd.get("confirm") || "").trim(), expected = `DELETE ${state.selectedUserId}`;
      if (typed !== expected) return status(`Для удаления введи точно: ${expected}`, true);
      const ctx = commandContext();
      if (ctx.reason.length < 3) return status("Для удаления обязательно укажи причину.", true);
      if (!confirm(`Необратимо удалить аккаунт ${state.selectedUserId}?`)) return;
      status("Удаляю аккаунт…");
      try {
        await post({ action:"delete_account", userId:state.selectedUserId, ...ctx });
        state.detail = null; state.selectedUserId = "";
        await refreshSummary(); await loadAudit();
        status("Аккаунт удалён.");
      } catch (error) { status(error.message, true); }
      return;
    }
  }

  function handleClick(event) {
    const tab = event.target.closest("[data-admin-tab]");
    if (tab) {
      state.tab = tab.dataset.adminTab;
      renderConsole();
      if (state.tab === "audit") loadAudit();
      if (state.tab === "players" && state.selectedUserId) loadPlayer(state.selectedUserId);
      return;
    }
    const jump = event.target.closest("[data-admin-tab-jump]");
    if (jump) { state.tab = jump.dataset.adminTabJump; renderConsole(); if (state.tab === "audit") loadAudit(); return; }
    const action = event.target.closest("[data-admin-action]")?.dataset.adminAction;
    if (action === "reload-player") return loadPlayer(state.selectedUserId);
    if (action === "reload-audit") return loadAudit();
    const command = event.target.closest("[data-admin-command]")?.dataset.adminCommand;
    if (command === "adaptive_reset") return runCommand(command, {}, { confirmText: "Сбросить только адаптивный профиль игрока? Основной прогресс останется." });
    if (command === "repair_player") return runCommand(command, {}, { confirmText: "Запустить автоматическую нормализацию прогресса этого игрока?" });
    const manage = event.target.closest("[data-admin-manage-user]");
    if (manage) {
      state.tab = "players";
      state.selectedUserId = manage.dataset.adminManageUser;
      renderConsole();
      loadPlayer(state.selectedUserId);
      byId("adminOpsConsole")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleChange(event) {
    if (event.target.id === "adminPlayerSelect") return loadPlayer(event.target.value);
    if (event.target.closest("#adminMessageForm")) updateMessagePreview(event.target.form || byId("adminMessageForm"));
  }
  document.addEventListener("input", (event) => {
    if (event.target.id === "adminPlayerSearch") filterPlayers(event.target.value);
    if (event.target.closest("#adminMessageForm")) updateMessagePreview(event.target.form || byId("adminMessageForm"));
  });

  function filterPlayers(query) {
    const host = byId("adminPlayerSearchResults");
    if (!host) return;
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) { host.hidden = true; host.innerHTML = ""; return; }
    const players = (state.summary?.players || []).filter((p) => p.account && [p.name, p.email, p.id].some((x) => String(x || "").toLowerCase().includes(q))).slice(0, 12);
    host.hidden = false;
    host.innerHTML = players.length ? players.map((p) => `<button type="button" data-admin-manage-user="${esc(p.id)}"><b>${esc(p.name)}</b><span>${esc(p.email || p.id)}</span><small>ур. ${fmt(p.levels)} · ★ ${fmt(p.stars)} · ${fmt(p.xp)} XP</small></button>`).join("") : `<span>Ничего не найдено.</span>`;
  }

  function updateMessagePreview(form) {
    const preview = byId("adminMessagePreview");
    if (!preview || !form) return;
    const fd = new FormData(form), title = String(fd.get("title") || "Заголовок письма"), intro = String(fd.get("intro") || "Здесь будет текст сообщения."), sender = String(fd.get("sender") || "Команда Словасьянса"), items = String(fd.get("items") || "").split("\n").filter(Boolean), cta = String(fd.get("ctaLabel") || "");
    preview.innerHTML = `<small>${esc(sender)}</small><h4>${esc(title)}</h4><p>${esc(intro)}</p>${items.length ? `<ul>${items.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${cta ? `<button type="button" disabled>${esc(cta)}</button>` : ""}`;
  }

  function markManageButtons() {
    const table = document.querySelector(".admin-table-wrap table");
    if (!table) return;
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.querySelector("[data-admin-manage-user]")) return;
      const id = row.querySelector("code")?.textContent?.trim();
      if (!/^u_/.test(id || "")) return;
      const cell = row.lastElementChild;
      if (!cell) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-manage-player";
      button.dataset.adminManageUser = id;
      button.textContent = "Управлять";
      cell.prepend(button);
    });
  }

  function watchAuthPanel() {
    const panel = byId("adminPanel");
    if (!panel) return;
    const sync = () => {
      ensureShell();
      if (!panel.hidden) {
        refreshSummary();
        loadAudit();
        setTimeout(markManageButtons, 50);
      }
    };
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    sync();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#adminRefresh,#adminRepair,#adminDedupe,#adminLogout");
    if (button) setTimeout(() => { refreshSummary(); markManageButtons(); }, 250);
    const deleteButton = event.target.closest("[data-delete-account]");
    if (deleteButton) {
      // The legacy delete flow does not send an audit reason. Disable it in favor of the
      // operations console until a reason-aware delete form is introduced.
      event.preventDefault();
      event.stopImmediatePropagation();
      status("Удаление аккаунта требует причины. Используй серверный command layer; legacy-кнопка отключена.", true);
    }
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchAuthPanel, { once: true });
  else watchAuthPanel();
})();
