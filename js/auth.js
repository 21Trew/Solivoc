/* Offline-first account layer: guest profile, secure server session and cloud profile merge. */
const ACCOUNT_STATE_KEY = "solivoc-account-v1";
const ACCOUNT_BACKUP_PREFIX = "solivoc-account-backup:";
let accountSyncTimer = null,
  accountSyncBusy = false,
  accountApplyingCloud = false,
  accountState = loadAccountState();

function loadAccountState() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNT_STATE_KEY) || "null");
    if (!raw || typeof raw !== "object") return { status: "guest", userId: "", email: "", version: 0, lastSyncAt: 0, pendingLogout: false };
    return {
      status: ["guest", "signed_in", "signed_out"].includes(raw.status) ? raw.status : "guest",
      userId: String(raw.userId || "").slice(0, 64),
      email: String(raw.email || "").slice(0, 160),
      version: Math.max(0, Number(raw.version) || 0),
      lastSyncAt: Math.max(0, Number(raw.lastSyncAt) || 0),
      pendingLogout: !!raw.pendingLogout,
    };
  } catch {
    return { status: "guest", userId: "", email: "", version: 0, lastSyncAt: 0, pendingLogout: false };
  }
}
function persistAccountState() {
  try { localStorage.setItem(ACCOUNT_STATE_KEY, JSON.stringify(accountState)); } catch {}
}
function accountSignedIn() { return accountState.status === "signed_in" && !!accountState.userId; }
function accountKnown() { return !!accountState.userId || !!accountState.email; }
function accountCanUseServer() { return /^https?:$/.test(location.protocol) && navigator.onLine !== false; }
function accountStatusLabel() {
  if (accountSignedIn()) return accountState.email || "Аккаунт подключён";
  if (accountState.status === "signed_out" && accountKnown()) return "Нужно снова войти";
  return "Гостевой профиль";
}
function accountStatusHint() {
  if (accountSignedIn()) return navigator.onLine === false ? "Играешь офлайн · синхронизация продолжится позже" : "Прогресс сохраняется на этом устройстве и в облаке";
  if (accountState.status === "signed_out" && accountKnown()) return "Локальный прогресс сохранён. Войди, чтобы продолжить синхронизацию.";
  return "Играй без регистрации или сохрани прогресс в аккаунте.";
}

function cloneAccountValue(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}
function accountArrayKey(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return `${typeof value}:${String(value)}`;
  try { return JSON.stringify(value); } catch { return String(value); }
}
function mergeAccountProgress(local, cloud) {
  if (cloud == null) return cloneAccountValue(local);
  if (local == null) return cloneAccountValue(cloud);
  if (Array.isArray(local) && Array.isArray(cloud)) {
    const seen = new Set(), out = [];
    for (const item of [...local, ...cloud]) {
      const key = accountArrayKey(item);
      if (seen.has(key)) continue;
      seen.add(key); out.push(cloneAccountValue(item));
    }
    return out.slice(-1000);
  }
  if (typeof local === "number" && typeof cloud === "number") return Math.max(local, cloud);
  if (typeof local === "boolean" && typeof cloud === "boolean") return local || cloud;
  if (typeof local === "object" && typeof cloud === "object" && !Array.isArray(local) && !Array.isArray(cloud)) {
    const out = { ...local };
    for (const [key, value] of Object.entries(cloud)) out[key] = mergeAccountProgress(out[key], value);
    return out;
  }
  return cloneAccountValue(cloud);
}
function mergeAccountProfiles(localProfile, cloudProfile) {
  const local = localProfile && typeof localProfile === "object" ? localProfile : {};
  const cloud = cloudProfile && typeof cloudProfile === "object" ? cloudProfile : {};
  const merged = mergeAccountProgress(local, cloud);
  // Campaign v2 is a corrective migration. When the cloud still contains the old
  // inflated campaign counters, the repaired local star map must win once instead
  // of being unioned with the obsolete synthetic tail.
  if ((+local.campaignProgressVersion || 0) >= 2 && (+cloud.campaignProgressVersion || 0) < 2) {
    merged.starsByLevel = cloneAccountValue(local.starsByLevel || {});
    merged.currentLevel = +local.currentLevel || 1;
    merged.campaignProgressVersion = 2;
    merged.stats = { ...(merged.stats || {}), levelsCompleted: +(local.stats?.levelsCompleted || 0), chapterFinalsCompleted: +(local.stats?.chapterFinalsCompleted || 0) };
    if (local.campaignRepairXpAdjusted) {
      merged.xp = Math.max(0, +local.xp || 0);
      merged.campaignRepairXpAdjusted = true;
    }
  }
  const cloudPreferenceRoots = ["playerName","avatarEmoji","titleId","theme","cardBack","effect","frame","soundPack","favoriteCategory","featuredAchievements","customRules","patchSeenVersion"];
  for (const key of cloudPreferenceRoots) if (Object.prototype.hasOwnProperty.call(cloud, key)) merged[key] = cloneAccountValue(cloud[key]);
  if (cloud.settings && typeof cloud.settings === "object") merged.settings = { ...(local.settings || {}), ...cloud.settings };

  // These belong to a concrete browser/device and are intentionally never synchronized.
  for (const key of ["analyticsClientId","pushClientId","retention","activeMarathon","sentChallenges","receivedChallenges","pendingChallengeSubmissions","pendingRankUp"]) {
    if (Object.prototype.hasOwnProperty.call(local, key)) merged[key] = cloneAccountValue(local[key]);
  }
  merged.settings = {
    ...(merged.settings || {}),
    notifications: !!local.settings?.notifications,
    notificationPrompted: !!local.settings?.notificationPrompted,
  };
  if (accountState.userId) merged.playerId = accountState.userId;
  return merged;
}

function accountProfileSnapshot() {
  reconcileCampaignProgress?.(profile);
  const copy = cloneAccountValue(profile || {});
  if (!copy || typeof copy !== "object") return {};
  delete copy.analyticsClientId;
  delete copy.pushClientId;
  delete copy.retention;
  delete copy.activeMarathon;
  delete copy.sentChallenges;
  delete copy.receivedChallenges;
  delete copy.pendingChallengeSubmissions;
  delete copy.pendingRankUp;
  if (copy.settings) {
    copy.settings = { ...copy.settings };
    delete copy.settings.notifications;
    delete copy.settings.notificationPrompted;
  }
  if (accountState.userId) copy.playerId = accountState.userId;
  return copy;
}

function applyAccountCloudProfile(cloudProfile, { version = 0 } = {}) {
  if (!cloudProfile || typeof cloudProfile !== "object") return false;
  const merged = mergeAccountProfiles(profile, cloudProfile);
  accountApplyingCloud = true;
  try {
    profile = {
      ...defaultProfile(),
      ...merged,
      stats: { ...DEFAULT_STATS, ...(merged.stats || {}) },
      settings: { ...defaultProfile().settings, ...(merged.settings || {}) },
      daily: { ...defaultProfile().daily, ...(merged.daily || {}), weekRewards: { ...(merged.daily?.weekRewards || {}) } },
      retention: { ...defaultProfile().retention, ...(merged.retention || {}), openDays: Array.isArray(merged.retention?.openDays) ? merged.retention.openDays : [] },
      weekly: { ...defaultProfile().weekly, ...(merged.weekly || {}) },
      monthly: { ...defaultProfile().monthly, ...(merged.monthly || {}) },
      dailyQuests: { ...defaultProfile().dailyQuests, ...(merged.dailyQuests || {}), modes: Array.isArray(merged.dailyQuests?.modes) ? merged.dailyQuests.modes : [], progress: { ...(merged.dailyQuests?.progress || {}) }, rewarded: { ...(merged.dailyQuests?.rewarded || {}) } },
      challengeMetrics: { ...defaultProfile().challengeMetrics, ...(merged.challengeMetrics || {}) },
      customRules: { ...defaultProfile().customRules, ...(merged.customRules || {}) },
    };
    if (accountState.userId) profile.playerId = accountState.userId;
    migrateMetaProfile?.();
    saveProfile({ skipCloud: true });
    accountState.version = Math.max(accountState.version || 0, Number(version) || 0);
    accountState.lastSyncAt = Date.now();
    persistAccountState();
    renderGlobalProfileHeaders?.();
    updateProfileMailBadge?.();
    return true;
  } finally {
    accountApplyingCloud = false;
  }
}

async function accountRequest(path, options = {}) {
  if (!accountCanUseServer()) throw new Error("offline");
  const controller = options.signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), options.timeout || 8000) : null;
  try {
    const response = await fetch(path, {
      ...options,
      signal: options.signal || controller?.signal,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `http_${response.status}`);
      error.code = data.error || "request_failed";
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function authErrorText(error) {
  const code = error?.code || error?.message || "";
  return ({
    offline: "Сейчас нет интернета. Одиночная игра продолжит работать офлайн.",
    invalid_email: "Проверь адрес электронной почты.",
    weak_password: "Пароль должен содержать минимум 8 символов.",
    email_exists: "Аккаунт с этой почтой уже существует.",
    invalid_credentials: "Неверная почта или пароль.",
    invalid_recovery: "Не удалось подтвердить код восстановления.",
    rate_limited: "Слишком много попыток. Попробуй немного позже.",
    redis_not_configured: "Облачное хранилище пока не подключено на сервере.",
    profile_too_large: "Профиль слишком большой для синхронизации.",
    unauthorized: "Сессия закончилась. Войди снова.",
  })[code] || "Не удалось выполнить действие. Попробуй ещё раз.";
}

function saveAccountIdentity(user, status = "signed_in", version = 0) {
  accountState = {
    status,
    userId: String(user?.id || accountState.userId || "").slice(0, 64),
    email: String(user?.email || accountState.email || "").slice(0, 160),
    version: Math.max(Number(version) || 0, accountState.version || 0),
    lastSyncAt: status === "signed_in" ? Date.now() : accountState.lastSyncAt || 0,
    pendingLogout: false,
  };
  persistAccountState();
}

async function registerAccount(email, password) {
  const data = await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", email, password, profile: accountProfileSnapshot() }) });
  saveAccountIdentity(data.user, "signed_in", data.version);
  applyAccountCloudProfile(data.profile, { version: data.version });
  syncLeaderboardNonBlocking?.();
  return data;
}
async function loginAccount(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const switchingAccount = accountState.status === "signed_out" && !!accountState.email && normalizedEmail !== String(accountState.email).trim().toLowerCase();
  const data = await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "login", email, password, profile: switchingAccount ? {} : accountProfileSnapshot() }) });
  if (switchingAccount) {
    try { if (accountState.userId) localStorage.setItem(`${ACCOUNT_BACKUP_PREFIX}${accountState.userId}`, JSON.stringify(profile)); } catch {}
    profile = freshGuestProfileFromDevice(profile);
  }
  saveAccountIdentity(data.user, "signed_in", data.version);
  applyAccountCloudProfile(data.profile, { version: data.version });
  syncLeaderboardNonBlocking?.();
  return data;
}
async function recoverAccount(email, recoveryCode, newPassword) {
  const data = await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "recover", email, recoveryCode, newPassword }) });
  saveAccountIdentity(data.user, "signed_in", data.version);
  applyAccountCloudProfile(data.profile, { version: data.version });
  return data;
}

function freshGuestProfileFromDevice(current) {
  const next = defaultProfile();
  next.settings = { ...next.settings, ...(current?.settings || {}) };
  next.analyticsClientId = current?.analyticsClientId || "";
  next.pushClientId = current?.pushClientId || "";
  next.retention = { ...next.retention, ...(current?.retention || {}) };
  next.playerId = `p_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-6)}`;
  return next;
}
async function logoutAccount() {
  const oldId = accountState.userId;
  if (oldId) {
    try { localStorage.setItem(`${ACCOUNT_BACKUP_PREFIX}${oldId}`, JSON.stringify(profile)); } catch {}
  }
  let serverLoggedOut = false;
  if (accountCanUseServer()) {
    try { await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }), timeout: 5000 }); serverLoggedOut = true; } catch {}
  }
  accountState = { status: "guest", userId: "", email: "", version: 0, lastSyncAt: 0, pendingLogout: !serverLoggedOut };
  persistAccountState();
  accountApplyingCloud = true;
  try {
    profile = freshGuestProfileFromDevice(profile);
    saveProfile({ skipCloud: true });
  } finally { accountApplyingCloud = false; }
  renderGlobalProfileHeaders?.();
  syncLeaderboardNonBlocking?.();
}
async function completePendingServerLogout() {
  if (!accountState.pendingLogout || !accountCanUseServer()) return false;
  try {
    await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }), timeout: 4500 });
    accountState.pendingLogout = false; persistAccountState(); return true;
  } catch { return false; }
}

function scheduleAccountSync(delay = 5000) {
  if (accountApplyingCloud || !accountSignedIn() || !accountCanUseServer() || document.visibilityState === "hidden") return;
  clearTimeout(accountSyncTimer);
  const playing = typeof activelyPlayingRound === "function" && activelyPlayingRound();
  accountSyncTimer = setTimeout(() => flushAccountSync(), Math.max(delay, playing ? 12000 : 1800));
}
async function flushAccountSync({ keepalive = false } = {}) {
  if (accountSyncBusy || !accountSignedIn() || !accountCanUseServer() || document.visibilityState === "hidden") return false;
  if (!keepalive && typeof activelyPlayingRound === "function" && activelyPlayingRound()) {
    scheduleAccountSync(12000);
    return false;
  }
  accountSyncBusy = true;
  clearTimeout(accountSyncTimer);
  try {
    const bodyText = JSON.stringify({ profile: accountProfileSnapshot(), version: accountState.version || 0 });
    const canKeepalive = keepalive && bodyText.length < 60000;
    const data = await accountRequest("/api/account", {
      method: "POST",
      body: bodyText,
      keepalive: canKeepalive,
      timeout: canKeepalive ? 4500 : 8000,
    });
    accountState.version = Math.max(accountState.version || 0, Number(data.version) || 0);
    accountState.lastSyncAt = Number(data.syncedAt) || Date.now();
    persistAccountState();
    // The server may contain progress from another device. Merge it back without
    // overwriting this device's notification/push state.
    applyAccountCloudProfile(data.profile, { version: data.version });
    updateAccountModalIfOpen?.();
    return true;
  } catch (error) {
    if (error?.status === 401) {
      accountState.status = "signed_out";
      persistAccountState();
      updateAccountModalIfOpen?.();
    }
    return false;
  } finally { accountSyncBusy = false; }
}

async function restoreAccountSessionOnBoot() {
  if (!accountCanUseServer()) return false;
  if (accountState.pendingLogout) { await completePendingServerLogout(); return false; }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch("/api/auth", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      if (accountState.status === "signed_in") { accountState.status = "signed_out"; persistAccountState(); }
      return false;
    }
    if (!response.ok || !data?.authenticated) return false;
    saveAccountIdentity(data.user, "signed_in", data.version);
    applyAccountCloudProfile(data.profile, { version: data.version });
    scheduleAccountSync(1200); // Upload any progress that was earned while offline.
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}

function authEsc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]);
}
function accountSyncTimeLabel() {
  if (!accountState.lastSyncAt) return "Ещё не синхронизировался";
  try { return `Синхронизировано ${new Date(accountState.lastSyncAt).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}`; }
  catch { return "Прогресс синхронизирован"; }
}

function accountGuestMarkup(mode = "register") {
  const login = mode === "login", recover = mode === "recover";
  if (recover) return `<div class="account-hero"><span>↺</span><div><small>ВОССТАНОВЛЕНИЕ</small><h2>Новый пароль</h2><p>Введи код восстановления, который был показан при регистрации.</p></div></div>
    <form class="account-form" id="accountForm"><label>Почта<input id="accountEmail" type="email" autocomplete="email" value="${authEsc(accountState.email)}" required></label><label>Код восстановления<input id="accountRecovery" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required></label><label>Новый пароль<input id="accountPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><div class="account-error" id="accountError"></div><button class="account-primary" type="submit">Сменить пароль и войти</button></form><button class="account-link" type="button" data-account-mode="login">← Вернуться ко входу</button>`;
  return `<div class="account-hero"><span>${login ? "↗" : "☁"}</span><div><small>${login ? "ВХОД" : "АККАУНТ"}</small><h2>${login ? "С возвращением" : "Сохрани прогресс"}</h2><p>${login ? "Войди, чтобы вернуть облачный прогресс на это устройство." : "Гостевой прогресс останется на устройстве и будет привязан к аккаунту."}</p></div></div>
    <form class="account-form" id="accountForm"><label>Почта<input id="accountEmail" type="email" autocomplete="email" value="${authEsc(accountState.email)}" placeholder="name@example.com" required></label><label>Пароль<input id="accountPassword" type="password" autocomplete="${login ? "current-password" : "new-password"}" minlength="8" maxlength="128" required></label>${login ? "" : `<small class="account-password-note">Минимум 8 символов. После регистрации покажем резервный код восстановления.</small>`}<div class="account-error" id="accountError"></div><button class="account-primary" type="submit">${login ? "Войти" : "Создать аккаунт"}</button></form>
    <button class="account-link" type="button" data-account-mode="${login ? "register" : "login"}">${login ? "Нет аккаунта? Создать аккаунт" : "Уже есть аккаунт? Войти"}</button>${login ? `<button class="account-link subtle" type="button" data-account-mode="recover">Забыл пароль · восстановить по коду</button>` : ""}`;
}
function accountSignedInMarkup() {
  return `<div class="account-hero signed"><span>✓</span><div><small>АККАУНТ ПОДКЛЮЧЁН</small><h2>${authEsc(accountState.email || "Игрок")}</h2><p>${authEsc(accountStatusHint())}</p></div></div>
    <div class="account-cloud-card"><div><span>Облачное сохранение</span><b>${navigator.onLine === false ? "Офлайн" : "Включено"}</b><small>${authEsc(accountSyncTimeLabel())}</small></div><button id="accountSyncNow" ${navigator.onLine === false ? "disabled" : ""}>Синхронизировать</button></div>
    <p class="account-note">Одиночная игра продолжает работать без интернета. После возвращения сети прогресс объединится с облачной копией.</p>
    <div class="account-actions"><button class="account-danger" id="accountLogout" type="button">Выйти из аккаунта</button></div>`;
}
function accountRecoveryMarkup(code) {
  return `<div class="account-hero recovery"><span>🔑</span><div><small>ВАЖНО</small><h2>Сохрани резервный код</h2><p>Он понадобится, если забудешь пароль. Мы показываем его только сейчас.</p></div></div><div class="recovery-code" id="accountRecoveryCode">${authEsc(code)}</div><button class="account-primary" id="accountCopyRecovery" type="button">Скопировать код</button><button class="account-link" id="accountRecoveryDone" type="button">Код сохранён →</button>`;
}

function openAccountModal(mode = null) {
  const modal = document.querySelector("#accountModal"), content = document.querySelector("#accountContent");
  if (!modal || !content) return;
  modal.dataset.mode = mode || (accountSignedIn() ? "signed" : accountState.status === "signed_out" ? "login" : "register");
  renderAccountModal();
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
}
function closeAccountModal() {
  const modal = document.querySelector("#accountModal");
  modal?.classList.remove("show"); modal?.setAttribute("aria-hidden", "true");
}
function updateAccountModalIfOpen() {
  if (document.querySelector("#accountModal")?.classList.contains("show")) renderAccountModal();
}
function setAccountFormBusy(busy, text = "") {
  const form = document.querySelector("#accountForm"), button = form?.querySelector("button[type='submit']");
  if (button) { button.disabled = busy; button.dataset.label ||= button.textContent; button.textContent = busy ? (text || "Подключаю…") : button.dataset.label; }
  form?.querySelectorAll("input").forEach((input) => { input.disabled = busy; });
}
function showAccountError(error) {
  const box = document.querySelector("#accountError");
  if (box) box.textContent = authErrorText(error);
}
function renderAccountModal() {
  const modal = document.querySelector("#accountModal"), content = document.querySelector("#accountContent");
  if (!modal || !content) return;
  const mode = modal.dataset.mode || "register";
  content.innerHTML = mode === "recovery-code" ? accountRecoveryMarkup(modal.dataset.recoveryCode || "") : accountSignedIn() && mode === "signed" ? accountSignedInMarkup() : accountGuestMarkup(mode);
  content.querySelectorAll("[data-account-mode]").forEach((button) => button.onclick = () => { modal.dataset.mode = button.dataset.accountMode; renderAccountModal(); });

  const form = document.querySelector("#accountForm");
  if (form) form.onsubmit = async (event) => {
    event.preventDefault(); const errorBox=document.querySelector("#accountError"); if(errorBox)errorBox.textContent="";
    const email = document.querySelector("#accountEmail")?.value?.trim() || "", password = document.querySelector("#accountPassword")?.value || "";
    setAccountFormBusy(true, mode === "login" ? "Вхожу…" : mode === "recover" ? "Восстанавливаю…" : "Создаю…");
    try {
      if (mode === "login") {
        await loginAccount(email, password); modal.dataset.mode = "signed"; renderAccountModal(); showToast?.("Аккаунт подключён");
      } else if (mode === "recover") {
        const recovery = document.querySelector("#accountRecovery")?.value || "";
        await recoverAccount(email, recovery, password); modal.dataset.mode = "signed"; renderAccountModal(); showToast?.("Пароль обновлён");
      } else {
        const data = await registerAccount(email, password);
        modal.dataset.recoveryCode = data.recoveryCode || ""; modal.dataset.mode = "recovery-code"; renderAccountModal();
      }
    } catch (error) { showAccountError(error); setAccountFormBusy(false); }
  };
  document.querySelector("#accountSyncNow")?.addEventListener("click", async (event) => { const b=event.currentTarget;b.disabled=true;b.textContent="Синхронизирую…";const ok=await flushAccountSync();renderAccountModal();showToast?.(ok?"Прогресс синхронизирован":"Синхронизация пока недоступна"); });
  document.querySelector("#accountLogout")?.addEventListener("click", async (event) => { const b=event.currentTarget;b.disabled=true;b.textContent="Выхожу…";await logoutAccount();modal.dataset.mode="register";renderAccountModal();showToast?.("Теперь ты играешь как гость"); });
  document.querySelector("#accountCopyRecovery")?.addEventListener("click", async () => { const code=modal.dataset.recoveryCode||"";try{await navigator.clipboard.writeText(code);showToast?.("Код скопирован");}catch{showToast?.("Сохрани код вручную");} });
  document.querySelector("#accountRecoveryDone")?.addEventListener("click", () => { modal.dataset.recoveryCode="";modal.dataset.mode="signed";renderAccountModal(); });
}

function bindAccountUi() {
  const modal = document.querySelector("#accountModal");
  document.querySelector("#accountClose")?.addEventListener("click", closeAccountModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeAccountModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal?.classList.contains("show")) closeAccountModal(); });
  window.addEventListener("online", async () => { if (accountState.pendingLogout) await completePendingServerLogout(); if (accountSignedIn()) scheduleAccountSync(350); updateAccountModalIfOpen(); });
  window.addEventListener("offline", updateAccountModalIfOpen);
  document.addEventListener("visibilitychange", () => {
    // Do not start a cloud request while iOS is suspending the PWA. The local
    // save is authoritative offline; upload it after the app becomes visible.
    if (document.visibilityState === "visible") scheduleAccountSync(1800);
  });
}
