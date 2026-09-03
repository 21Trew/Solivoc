(() => {
  const $r = (q) => document.querySelector(q);
  const panel = $r("#adminRecovery");
  if (!panel) return;
  let selectedUserId = "";
  let currentDetail = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const status = (message = "", danger = false) => {
    const node = $r("#adminRecoveryStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("danger", !!danger);
  };
  const commandId = () => `recovery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

  async function recoveryRequest(query = "", options = {}) {
    const suffix = query ? `&${String(query).replace(/^\?/, "")}` : "";
    const response = await apiFetch(`/api/admin?recovery=1${suffix}`, {
      ...options,
      cache: "no-store",
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

  function setPanelOpen(open) {
    panel.hidden = !open;
    document.documentElement.classList.toggle("admin-recovery-open", !!open);
    panel.setAttribute("aria-hidden", String(!open));
  }

  function fillDaily(detail) {
    const p = detail.progress || {};
    const daily = p.daily || {};
    $r("#recoveryCurrentStreak").value = Number(daily.currentStreak) || 0;
    $r("#recoveryBestStreak").value = Number(daily.bestStreak) || 0;
    $r("#recoveryLastDate").value = daily.lastDate || "";
    $r("#recoveryDailyCompleted").value = Number(p.stats?.dailyCompleted) || 0;
    $r("#recoveryCompletedDates").value = JSON.stringify(daily.completedDates || [], null, 2);
    $r("#recoveryDailyStars").value = JSON.stringify(p.dailyStars || {}, null, 2);
    $r("#recoveryDailyQuests").value = JSON.stringify(p.dailyQuests || {}, null, 2);
    $r("#recoveryMascotDaily").value = JSON.stringify(p.mascotDaily || {}, null, 2);
    $r("#recoveryWeekly").value = JSON.stringify(p.weekly || {}, null, 2);
    $r("#recoveryMonthly").value = JSON.stringify(p.monthly || {}, null, 2);
    $r("#recoveryFullSnapshot").value = JSON.stringify(p, null, 2);
  }

  function renderCheckpoints(detail) {
    const host = $r("#adminRecoveryCheckpoints");
    const rows = detail.checkpoints || [];
    host.innerHTML = rows.length ? rows.map((cp) => `<div class="admin-recovery-checkpoint">
      <div><b>${esc(new Date(cp.at).toLocaleString("ru-RU"))}</b><small>${esc(cp.reason || "Без описания")}</small><small>Уровни ${cp.summary?.levels || 0} · ★ ${cp.summary?.stars || 0} · серия ${cp.summary?.streak || 0}</small></div>
      <button type="button" data-restore-checkpoint="${esc(cp.id)}">Откатить сюда</button>
    </div>`).join("") : '<span class="admin-recovery-note">Контрольных точек пока нет.</span>';
  }

  function renderDetail(detail) {
    currentDetail = detail;
    selectedUserId = detail.userId;
    setPanelOpen(true);
    $r("#adminRecoveryPlayer").textContent = `${detail.email || detail.userId} · ${detail.userId}`;
    const s = detail.summary || {};
    $r("#adminRecoveryStats").innerHTML = [
      ["Уровни", s.levels || 0], ["Звёзды", s.stars || 0], ["Опыт", s.xp || 0], ["Дней подряд", s.streak || 0],
      ["Лучшая серия", s.bestStreak || 0], ["Ежедневных", s.dailyCompleted || 0], ["Неделей", s.weeklyCompleted || 0], ["Месяцев", s.monthlyCompleted || 0],
    ].map(([label,value]) => `<div class="admin-recovery-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
    fillDaily(detail);
    renderCheckpoints(detail);
    status(`Загружена серверная версия профиля №${detail.version}`);
    $r("#recoveryCurrentStreak")?.focus({ preventScroll: true });
  }

  async function openRecovery(userId) {
    userId = String(userId || "").trim();
    if (!/^u_/.test(userId)) return;
    selectedUserId = userId;
    setPanelOpen(true);
    status("Загружаю серверный профиль…");
    try {
      const data = await recoveryRequest(`userId=${encodeURIComponent(userId)}`);
      renderDetail(data.detail);
    } catch (error) {
      status(error.message || "Не удалось загрузить профиль.", true);
    }
  }

  function parseJsonField(id, fallback) {
    const text = String($r(id)?.value || "").trim();
    if (!text) return fallback;
    try { return JSON.parse(text); }
    catch { throw new Error(`Некорректный JSON в поле ${id}.`); }
  }

  async function runRecovery(body, confirmation) {
    const reason = String($r("#adminRecoveryReason")?.value || "").trim();
    if (reason.length < 3) return status("Укажи причину восстановления — минимум 3 символа.", true);
    if (!selectedUserId) return status("Сначала выбери игрока.", true);
    if (confirmation && !confirm(confirmation)) return;
    status("Сохраняю контрольную точку и применяю восстановление…");
    try {
      const data = await recoveryRequest("", {
        method: "POST",
        body: JSON.stringify({ ...body, userId: selectedUserId, reason, commandId: commandId() }),
      });
      renderDetail(data.detail);
      status(`Готово. Предыдущее состояние сохранено: ${data.checkpoint?.id || "контрольная точка"}`);
      if (typeof refresh === "function") refresh();
      window.dispatchEvent(new CustomEvent("solivoc-admin-recovery-complete", { detail: { userId: selectedUserId } }));
    } catch (error) {
      status(error.message || "Не удалось восстановить прогресс.", true);
    }
  }

  function closeRecovery() {
    setPanelOpen(false);
    selectedUserId = "";
    currentDetail = null;
    status("");
  }

  $r("#adminRecoveryClose")?.addEventListener("click", closeRecovery);
  $r("#adminRecoveryReload")?.addEventListener("click", () => openRecovery(selectedUserId));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) closeRecovery(); });

  $r("#adminRecoveryDailyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const daily = {
        currentStreak: Number($r("#recoveryCurrentStreak").value) || 0,
        bestStreak: Number($r("#recoveryBestStreak").value) || 0,
        lastDate: $r("#recoveryLastDate").value || "",
        dailyCompleted: Number($r("#recoveryDailyCompleted").value) || 0,
        completedDates: parseJsonField("#recoveryCompletedDates", []),
        dailyStars: parseJsonField("#recoveryDailyStars", {}),
        dailyQuests: parseJsonField("#recoveryDailyQuests", {}),
        mascotDaily: parseJsonField("#recoveryMascotDaily", {}),
      };
      const periodic = {
        weekly: parseJsonField("#recoveryWeekly", {}),
        monthly: parseJsonField("#recoveryMonthly", {}),
        weeklyCompleted: Number(currentDetail?.progress?.stats?.weeklyCompleted) || 0,
        monthlyCompleted: Number(currentDetail?.progress?.stats?.monthlyCompleted) || 0,
      };
      runRecovery({ action: "progress_restore_daily", daily, periodic }, "Применить восстановление ежедневного и периодического прогресса? Перед изменением будет создана контрольная точка.");
    } catch (error) { status(error.message, true); }
  });

  $r("#adminRecoverySnapshotForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const progress = parseJsonField("#recoveryFullSnapshot", null);
      runRecovery({ action: "progress_restore_snapshot", progress }, "Заменить восстанавливаемые области профиля значениями из JSON? Перед изменением будет создана контрольная точка.");
    } catch (error) { status(error.message, true); }
  });

  $r("#adminRecoveryCheckpoints")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore-checkpoint]");
    if (!button) return;
    runRecovery({ action: "progress_restore_checkpoint", checkpointId: button.dataset.restoreCheckpoint }, "Откатить игровой прогресс к этой контрольной точке? Текущее состояние тоже будет сохранено перед откатом.");
  });

  function detailUserId() {
    const id = document.querySelector("#adminPlayerDetail .admin-player-title small")?.textContent?.trim() || "";
    return /^u_/.test(id) ? id : "";
  }

  function injectRecoveryAction() {
    const hero = document.querySelector("#adminPlayerDetail .admin-player-hero");
    if (!hero || hero.querySelector("[data-open-player-recovery]")) return;
    const userId = detailUserId();
    if (!userId) return;
    const title = hero.querySelector(".admin-player-title");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-player-recovery-primary";
    button.dataset.openPlayerRecovery = userId;
    button.innerHTML = "<span>↺</span> Восстановить прогресс";
    title?.appendChild(button);
  }

  document.addEventListener("click", (event) => {
    const primary = event.target.closest("[data-open-player-recovery]");
    if (primary) {
      event.preventDefault();
      return openRecovery(primary.dataset.openPlayerRecovery);
    }
    const legacy = event.target.closest("[data-recovery-user]");
    if (legacy) {
      event.preventDefault();
      return openRecovery(legacy.dataset.recoveryUser);
    }
  });

  const detail = document.querySelector("#adminPlayerDetail") || document.querySelector("#adminPanel");
  if (detail) new MutationObserver(() => injectRecoveryAction()).observe(detail, { childList: true, subtree: true });
  injectRecoveryAction();

  window.openAdminProgressRecovery = openRecovery;
})();
