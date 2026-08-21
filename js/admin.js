const $ = (q) => document.querySelector(q);
let adminData = null;

function setLoginStatus(message = "", danger = false) {
  const node = $("#adminLoginStatus");
  node.textContent = message;
  node.classList.toggle("danger", !!danger);
}

function setAdminStatus(message = "", danger = false) {
  const node = $("#adminStatus");
  node.textContent = message;
  node.classList.toggle("danger", !!danger);
}

function showLogin(message = "") {
  $("#adminAuth").hidden = false;
  $("#adminPanel").hidden = true;
  if (message) setLoginStatus(message, true);
}

function showPanel() {
  $("#adminAuth").hidden = true;
  $("#adminPanel").hidden = false;
  setLoginStatus("");
}

function errorMessage(error) {
  if (error?.code === "invalid_credentials") return "Неверный логин или пароль.";
  if (error?.code === "rate_limited") return "Слишком много попыток входа. Попробуй позже.";
  if (error?.code === "admin_not_configured") return "Вход в админку ещё не настроен на сервере.";
  if (error?.status === 401) return "Сессия истекла. Войди снова.";
  return error?.message || "Не удалось выполнить запрос.";
}

async function requestAdmin(path = "", options = {}) {
  const response = await apiFetch(`/api/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function render(data) {
  adminData = data;
  showPanel();
  $("#adminSummary").innerHTML = `<div><b>${data.accounts ?? 0}</b><br><span>аккаунтов</span></div><div><b>${data.profiles ?? data.repaired ?? 0}</b><br><span>облачных профилей</span></div><div><b>${data.leaderboardRecords ?? data.players?.length ?? 0}</b><br><span>записей лидерборда</span></div>${data.deduped != null ? `<div><b>${data.deduped}</b><br><span>дублей удалено</span></div>` : ""}`;
  $("#adminPlayers").innerHTML = (data.players || []).map((player) => `<tr>
    <td>${escapeHtml(player.name || "Игрок")}</td>
    <td>${player.email ? escapeHtml(player.email) : '<span class="admin-muted">—</span>'}</td>
    <td><code>${escapeHtml(player.id || "")}</code></td>
    <td>${player.levels || 0}</td>
    <td>${player.stars || 0}</td>
    <td>${player.duels ?? player.duel ?? 0}</td>
    <td>${player.account ? `<button class="admin-delete-account" type="button" data-delete-account="${escapeHtml(player.id || "")}" data-delete-email="${escapeHtml(player.email || "")}" data-delete-name="${escapeHtml(player.name || "Игрок")}">Удалить</button>` : '<span class="admin-muted">legacy</span>'}</td>
  </tr>`).join("");
}

async function refresh() {
  setAdminStatus("Загружаю…");
  try {
    const data = await requestAdmin();
    render(data);
    setAdminStatus("Данные актуальны");
  } catch (error) {
    if (error.status === 401) {
      showLogin("Сессия истекла. Войди снова.");
      return;
    }
    setAdminStatus(errorMessage(error), true);
  }
}

async function restoreSession() {
  try {
    await requestAdmin("?session=1");
    showPanel();
    await refresh();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    showLogin(errorMessage(error));
  }
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const login = $("#adminLogin").value.trim();
  const password = $("#adminPassword").value;
  if (!login || !password) return;
  $("#adminConnect").disabled = true;
  setLoginStatus("Проверяю…");
  try {
    await requestAdmin("", {
      method: "POST",
      body: JSON.stringify({ action: "login", login, password }),
    });
    $("#adminPassword").value = "";
    showPanel();
    await refresh();
  } catch (error) {
    $("#adminPassword").value = "";
    setLoginStatus(errorMessage(error), true);
  } finally {
    $("#adminConnect").disabled = false;
  }
});

$("#adminPasswordToggle").addEventListener("click", () => {
  const input = $("#adminPassword");
  const button = $("#adminPasswordToggle");
  const reveal = input.type === "password";
  input.type = reveal ? "text" : "password";
  button.textContent = reveal ? "Скрыть" : "Показать";
  button.setAttribute("aria-label", reveal ? "Скрыть пароль" : "Показать пароль");
  button.setAttribute("aria-pressed", String(reveal));
});

$("#adminLogout").addEventListener("click", async () => {
  try {
    await requestAdmin("", { method: "POST", body: JSON.stringify({ action: "logout" }) });
  } catch {}
  adminData = null;
  $("#adminPlayers").innerHTML = "";
  $("#adminSummary").innerHTML = "";
  setAdminStatus("");
  showLogin();
});

$("#adminRefresh").onclick = refresh;
$("#adminRepair").onclick = async () => {
  if (!confirm("Пересчитать уровни, звёзды и синхронизировать лидерборды для всех профилей?")) return;
  setAdminStatus("Пересчитываю…");
  try {
    const data = await requestAdmin("", { method: "POST", body: JSON.stringify({ action: "repair_all" }) });
    render(data);
    setAdminStatus(`Готово: профилей ${data.repaired}, уровней исправлено ${data.levelsChanged}, звёзд ${data.starsChanged}, дублей ${data.deduped}`);
  } catch (error) {
    if (error.status === 401) return showLogin("Сессия истекла. Войди снова.");
    setAdminStatus(errorMessage(error), true);
  }
};
$("#adminDedupe").onclick = async () => {
  if (!confirm("Удалить безопасные дубли из таблиц лидеров?")) return;
  setAdminStatus("Ищу дубли…");
  try {
    const data = await requestAdmin("", { method: "POST", body: JSON.stringify({ action: "dedupe" }) });
    setAdminStatus(`Удалено дублей: ${data.deduped}`);
    await refresh();
  } catch (error) {
    if (error.status === 401) return showLogin("Сессия истекла. Войди снова.");
    setAdminStatus(errorMessage(error), true);
  }
};


$("#adminPlayers").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-account]");
  if (!button) return;
  const userId = String(button.dataset.deleteAccount || "");
  const email = String(button.dataset.deleteEmail || "");
  const name = String(button.dataset.deleteName || "Игрок");
  const label = email || userId;
  if (!confirm(`Удалить аккаунт ${name} (${label})?

Будут удалены облачный профиль, лидерборд, серверные дуэли и все активные сессии. Действие необратимо.`)) return;

  button.disabled = true;
  button.textContent = "Удаляю…";
  setAdminStatus(`Удаляю ${label}…`);
  try {
    const data = await requestAdmin("", {
      method: "POST",
      body: JSON.stringify({ action: "delete_account", userId }),
    });
    render(data);
    setAdminStatus(`Аккаунт ${label} удалён`);
  } catch (error) {
    if (error.status === 401) return showLogin("Сессия истекла. Войди снова.");
    button.disabled = false;
    button.textContent = "Удалить";
    setAdminStatus(errorMessage(error), true);
  }
});

restoreSession();
