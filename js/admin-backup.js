const $ = (q) => document.querySelector(q);

function status(message = "", danger = false) {
  const node = $("#backupStatus");
  node.textContent = message;
  node.classList.toggle("danger", !!danger);
}
function loginStatus(message = "", danger = false) {
  const node = $("#backupLoginStatus");
  node.textContent = message;
  node.classList.toggle("danger", !!danger);
}

async function backupRequest(path = "", options = {}) {
  const response = await apiFetch(`/api/backup${path}`, {
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

function showLogin(message = "") {
  $("#backupAuth").hidden = false;
  $("#backupPanel").hidden = true;
  if (message) loginStatus(message, true);
}
function showPanel() {
  $("#backupAuth").hidden = true;
  $("#backupPanel").hidden = false;
  loginStatus("");
}
function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

$("#backupLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const login = $("#backupLogin").value.trim();
  const password = $("#backupPassword").value;
  if (!login || !password) return;
  $("#backupConnect").disabled = true;
  loginStatus("Проверяю…");
  try {
    await backupRequest("", {
      method: "POST",
      body: JSON.stringify({ action: "login", login, password }),
    });
    $("#backupPassword").value = "";
    showPanel();
  } catch (error) {
    $("#backupPassword").value = "";
    loginStatus(error.code === "invalid_credentials" ? "Неверный логин или пароль." : error.message, true);
  } finally {
    $("#backupConnect").disabled = false;
  }
});

$("#backupLogout").addEventListener("click", async () => {
  try {
    await backupRequest("", { method: "POST", body: JSON.stringify({ action: "logout" }) });
  } catch {}
  showLogin();
});

$("#backupDownload").addEventListener("click", async () => {
  const button = $("#backupDownload");
  button.disabled = true;
  const entries = [];
  let cursor = "0";
  let pages = 0;
  try {
    do {
      const page = await backupRequest(`?cursor=${encodeURIComponent(cursor)}`);
      if (page.format !== "solivoc-redis-dump-v1") throw new Error("Неизвестный формат backup.");
      entries.push(...(page.entries || []));
      cursor = String(page.cursor || "0");
      pages++;
      status(`Считываю Redis… ${entries.length} ключей`);
      if (pages > 5000) throw new Error("Слишком много страниц Redis — выгрузка остановлена.");
    } while (cursor !== "0");

    const backup = {
      format: "solivoc-redis-dump-v1",
      createdAt: new Date().toISOString(),
      source: "production",
      keyCount: entries.length,
      entries,
    };
    const text = JSON.stringify(backup);
    const digest = await sha256Hex(text);
    const stamp = backup.createdAt.replace(/[:.]/g, "-");
    downloadBlob(text, `solivoc-redis-backup-${stamp}.json`);
    status(`Готово: ${entries.length} ключей. SHA-256: ${digest}`);
  } catch (error) {
    if (error.status === 401) {
      showLogin("Сессия истекла. Войди снова.");
    } else {
      status(error.message || "Не удалось создать backup.", true);
    }
  } finally {
    button.disabled = false;
  }
});

(async () => {
  try {
    await backupRequest("?session=1");
    showPanel();
  } catch {
    showLogin();
  }
})();
