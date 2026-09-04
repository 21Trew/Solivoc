/* Offline-first account layer: guest profile, secure server session and cloud profile merge. */
const ACCOUNT_STATE_KEY = "solivoc-account-v1";
const ACCOUNT_BACKUP_PREFIX = "solivoc-account-backup:";
const ACCOUNT_VERIFICATION_KEY = "solivoc-auth-flow-v1";
let accountSyncBusy = false,
  accountApplyingCloud = false,
  accountState = loadAccountState();
let accountVerificationTimer = null;
let accountVerification = loadAccountVerification();

function loadAccountVerification() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(ACCOUNT_VERIFICATION_KEY) || "null");
    const purpose = ["register", "recover"].includes(raw?.purpose) ? raw.purpose : "";
    const email = String(raw?.email || "").trim().toLowerCase().slice(0, 160);
    const expiresAt = Math.max(0, Number(raw?.expiresAt) || 0);
    const resendAt = Math.max(0, Number(raw?.resendAt) || 0);
    if (!purpose || !email || expiresAt <= Date.now()) {
      sessionStorage.removeItem(ACCOUNT_VERIFICATION_KEY);
      return { purpose: "", email: "", expiresAt: 0, resendAt: 0 };
    }
    return { purpose, email, expiresAt, resendAt };
  } catch {
    return { purpose: "", email: "", expiresAt: 0, resendAt: 0 };
  }
}
function persistAccountVerification() {
  try {
    if (!accountVerification.email) sessionStorage.removeItem(ACCOUNT_VERIFICATION_KEY);
    else sessionStorage.setItem(ACCOUNT_VERIFICATION_KEY, JSON.stringify(accountVerification));
  } catch {}
}

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
function mergeDailyQuestSnapshots(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" ? localValue : {}, cloud = cloudValue && typeof cloudValue === "object" ? cloudValue : {};
  const ld=String(local.date||""), cd=String(cloud.date||"");
  if (ld && cd && ld !== cd) return cloneAccountValue(ld > cd ? local : cloud);
  if (!ld) return cloneAccountValue(cloud);
  if (!cd) return cloneAccountValue(local);
  const modes = Array.isArray(cloud.modes) && cloud.modes.length ? cloud.modes.slice(0,3) : (Array.isArray(local.modes)?local.modes.slice(0,3):[]), progress={}, rewarded={};
  for (const id of modes) {
    progress[id]=Math.max(0,Math.min(5,Math.max(+local.progress?.[id]||0,+cloud.progress?.[id]||0)));
    rewarded[id]=!!local.rewarded?.[id]||!!cloud.rewarded?.[id];
  }
  return { date: ld || cd, modes, progress, rewarded };
}
function mergeAccountProfiles(localProfile, cloudProfile) {
  const local = localProfile && typeof localProfile === "object" ? localProfile : {};
  const cloud = cloudProfile && typeof cloudProfile === "object" ? cloudProfile : {};
  const merged = mergeAccountProgress(local, cloud);
  merged.dailyQuests = mergeDailyQuestSnapshots(local.dailyQuests, cloud.dailyQuests);
  // Mascot/entity progression has bounded choice arrays and timestamped loadouts.
  // Generic array union would create impossible states (for example 4 developed
  // traits instead of 2), so these domains use purpose-built conflict resolution.
  if (typeof mergeMascotProgressSnapshots === "function") merged.mascotProgress = mergeMascotProgressSnapshots(local.mascotProgress, cloud.mascotProgress);
  if (typeof mergeGodProgressSnapshots === "function") merged.godProgress = mergeGodProgressSnapshots(local.godProgress, cloud.godProgress);
  if (typeof mergeProgressionMilestonesSnapshots === "function") merged.progressionMilestones = mergeProgressionMilestonesSnapshots(local.progressionMilestones, cloud.progressionMilestones);
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
    const response = await apiFetch(path, {
      ...options,
      signal: options.signal || controller?.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `http_${response.status}`);
      error.code = data.error || "request_failed";
      error.status = response.status;
      error.data = data;
      error.retryAfter = Math.max(0, Number(data.retryAfter) || 0);
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
    password_unchanged: "Новый пароль совпадает со старым. Придумай другой пароль.",
    email_exists: "Аккаунт с этой почтой уже существует.",
    invalid_credentials: "Неверная почта или пароль.",
    verification_required: "Обнови игру: регистрация теперь требует подтверждения почты.",
    verification_code_required: "Введи шестизначный код из письма.",
    invalid_verification_code: "Код не подходит. Проверь цифры и попробуй ещё раз.",
    verification_expired: "Код истёк. Запроси новый код.",
    verification_not_started: "Срок регистрации истёк. Введи почту и пароль ещё раз.",
    verification_attempts_exceeded: "Слишком много неверных кодов. Запроси новый код.",
    verification_resend_too_soon: "Новый код можно запросить через несколько секунд.",
    verification_send_limit: "Отправка кодов временно приостановлена. Попробуй позже.",
    recovery_code_required: "Введи шестизначный код из письма.",
    invalid_recovery_code: "Код не подходит. Проверь цифры и попробуй ещё раз.",
    recovery_expired: "Код истёк. Запроси новый код.",
    recovery_attempts_exceeded: "Слишком много неверных кодов. Запроси новый код.",
    recovery_resend_too_soon: "Новый код можно запросить через несколько секунд.",
    email_send_failed: "Не удалось отправить письмо. Попробуй ещё раз чуть позже.",
    email_not_configured: "Отправка писем пока не настроена на сервере.",
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

function accountVerificationActive(purpose = "") {
  return !!accountVerification.email
    && accountVerification.expiresAt > Date.now()
    && (!purpose || accountVerification.purpose === purpose);
}
function clearAccountVerification() {
  accountVerification = { purpose: "", email: "", expiresAt: 0, resendAt: 0 };
  persistAccountVerification();
  clearInterval(accountVerificationTimer);
  accountVerificationTimer = null;
}
function setAccountVerification(email, data = {}, purpose = "register") {
  const now = Date.now();
  accountVerification = {
    purpose,
    email: String(data.email || email || "").trim().toLowerCase().slice(0, 160),
    expiresAt: now + Math.max(1, Number(data.expiresIn) || 600) * 1000,
    resendAt: now + Math.max(0, Number(data.resendAfter) || 60) * 1000,
  };
  persistAccountVerification();
}
async function startRegistration(email, password) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "register_start", email, password }),
    timeout: 15000,
  });
  setAccountVerification(email, data, "register");
  return data;
}
async function resendRegistrationCode(email) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "register_resend", email }),
    timeout: 15000,
  });
  setAccountVerification(email, data, "register");
  return data;
}
async function verifyRegistration(email, code) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "register_verify", email, code, profile: accountProfileSnapshot() }),
    timeout: 12000,
  });
  clearAccountVerification();
  saveAccountIdentity(data.user, "signed_in", data.version);
  applyAccountCloudProfile(data.profile, { version: data.version });
  grantStarterCompanions?.({ notify: true });
  syncBossCompanionsFromProgress?.({ notify: false });
  saveProfile?.();
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
  grantStarterCompanions?.({ notify: true });
  syncBossCompanionsFromProgress?.({ notify: false });
  saveProfile?.();
  syncLeaderboardNonBlocking?.();
  return data;
}
async function startPasswordRecovery(email) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "recover_start", email }),
    timeout: 15000,
  });
  setAccountVerification(email, data, "recover");
  return data;
}
async function resendPasswordRecoveryCode(email) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "recover_resend", email }),
    timeout: 15000,
  });
  setAccountVerification(email, data, "recover");
  return data;
}
async function recoverAccount(email, code, newPassword) {
  const data = await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "recover_verify", email, code, newPassword }),
    timeout: 15000,
  });
  clearAccountVerification();
  saveAccountIdentity(data.user, "signed_in", data.version);
  applyAccountCloudProfile(data.profile, { version: data.version });
  grantStarterCompanions?.({ notify: true });
  syncBossCompanionsFromProgress?.({ notify: false });
  saveProfile?.();
  syncLeaderboardNonBlocking?.();
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
async function deleteAccount(password) {
  if (!accountSignedIn()) throw Object.assign(new Error("unauthorized"), { code: "unauthorized" });
  if (!accountCanUseServer()) throw Object.assign(new Error("offline"), { code: "offline" });
  const oldId = accountState.userId;
  await accountRequest("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "delete_account", password }),
    timeout: 15000,
  });

  SolivocScheduler.cancel("sync.account");
  accountState = { status: "guest", userId: "", email: "", version: 0, lastSyncAt: 0, pendingLogout: false };
  persistAccountState();
  if (oldId) {
    try { localStorage.removeItem(`${ACCOUNT_BACKUP_PREFIX}${oldId}`); } catch {}
  }
  accountApplyingCloud = true;
  try {
    profile = freshGuestProfileFromDevice(profile);
    try {
      if (typeof SAVE_KEY !== "undefined") localStorage.removeItem(SAVE_KEY);
      if (typeof OLD_SAVE_KEY !== "undefined") localStorage.removeItem(OLD_SAVE_KEY);
    } catch {}
    saveProfile({ skipCloud: true });
  } finally { accountApplyingCloud = false; }
  clearAccountVerification();
  renderGlobalProfileHeaders?.();
  return true;
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
  const playing = typeof activelyPlayingRound === "function" && activelyPlayingRound();
  SolivocScheduler.timeout("sync.account", () => flushAccountSync(), Math.max(delay, playing ? 12000 : 1800));
}
async function flushAccountSync({ keepalive = false } = {}) {
  if (accountSyncBusy || !accountSignedIn() || !accountCanUseServer() || document.visibilityState === "hidden") return false;
  if (!keepalive && typeof activelyPlayingRound === "function" && activelyPlayingRound()) {
    scheduleAccountSync(12000);
    return false;
  }
  accountSyncBusy = true;
  SolivocScheduler.cancel("sync.account");
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
    const response = await apiFetch("/api/auth", { cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      if (accountState.status === "signed_in") { accountState.status = "signed_out"; persistAccountState(); }
      return false;
    }
    if (!response.ok || !data?.authenticated) return false;
    saveAccountIdentity(data.user, "signed_in", data.version);
    applyAccountCloudProfile(data.profile, { version: data.version });
    grantStarterCompanions?.({ notify: false });
    syncBossCompanionsFromProgress?.({ notify: false });
    saveProfile?.({ skipCloud: true });
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

function accountPasswordField({ label = "Пароль", autocomplete = "current-password", id = "accountPassword", required = true } = {}) {
  return `<label>${label}<span class="account-password-field"><input id="${authEsc(id)}" type="password" autocomplete="${authEsc(autocomplete)}" minlength="8" maxlength="128" ${required ? "required" : ""}><button class="account-password-toggle" type="button" aria-label="Показать пароль" aria-pressed="false" title="Показать пароль"><svg class="account-password-eye account-password-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg><svg class="account-password-eye account-password-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 6.15A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.2 2.9M6.25 6.35C3.8 8.15 2.5 12 2.5 12s3.5 6 9.5 6c1.25 0 2.38-.26 3.4-.67"></path><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"></path></svg></button></span></label>`;
}

function bindAccountPasswordToggle() {
  document.querySelectorAll(".account-password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.closest(".account-password-field");
      const input = field?.querySelector("input");
      if (!input || input.disabled) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-pressed", String(reveal));
      button.setAttribute("aria-label", reveal ? "Скрыть пароль" : "Показать пароль");
      button.title = reveal ? "Скрыть пароль" : "Показать пароль";
      field.classList.toggle("is-visible", reveal);
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    });
  });
}

function accountGuestMarkup(mode = "register") {
  const login = mode === "login", recover = mode === "recover";
  if (recover) return `<div class="account-hero recovery"><span>↺</span><div><small>ВОССТАНОВЛЕНИЕ</small><h2>Верни доступ</h2><p>Укажи почту аккаунта. Если такой аккаунт есть, мы отправим шестизначный код.</p></div></div>
    <form class="account-form" id="accountForm"><label>Почта<input id="accountEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${authEsc(accountState.email)}" placeholder="name@example.com" required></label><p class="account-security-note">Мы не сообщаем, зарегистрирован ли этот адрес. Это защищает аккаунты от перебора.</p><div class="account-error" id="accountError" aria-live="polite"></div><button class="account-primary" type="submit">Получить код</button></form><button class="account-link" type="button" data-account-mode="login" data-account-reset-verification="1">← Вернуться ко входу</button>`;
  return `<div class="account-hero"><span>${login ? "↗" : "☁"}</span><div><small>${login ? "ВХОД" : "АККАУНТ"}</small><h2>${login ? "С возвращением" : "Сохрани прогресс"}</h2><p>${login ? "Войди, чтобы вернуть облачный прогресс на это устройство." : "Гостевой прогресс останется на устройстве и будет привязан к аккаунту."}</p></div></div>
    <form class="account-form" id="accountForm"><label>Почта<input id="accountEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${authEsc(accountState.email)}" placeholder="name@example.com" required></label>${accountPasswordField({ autocomplete: login ? "current-password" : "new-password" })}${login ? "" : `<small class="account-password-note">Минимум 8 символов. Перед созданием аккаунта подтвердим почту шестизначным кодом.</small>`}<div class="account-error" id="accountError" aria-live="polite"></div><button class="account-primary" type="submit">${login ? "Войти" : "Получить код"}</button></form>
    <button class="account-link" type="button" data-account-mode="${login ? "register" : "login"}" data-account-reset-verification="1">${login ? "Нет аккаунта? Создать аккаунт" : "Уже есть аккаунт? Войти"}</button>${login ? `<button class="account-link subtle" type="button" data-account-mode="recover" data-account-reset-verification="1">Забыл пароль? Восстановить по почте</button>` : ""}`;
}
function accountSignedInMarkup() {
  return `<div class="account-hero signed"><span>✓</span><div><small>АККАУНТ ПОДКЛЮЧЁН</small><h2>${authEsc(accountState.email || "Игрок")}</h2><p>${authEsc(accountStatusHint())}</p></div></div>
    <div class="account-cloud-card"><div><span>Облачное сохранение</span><b>${navigator.onLine === false ? "Офлайн" : "Включено"}</b><small>${authEsc(accountSyncTimeLabel())}</small></div><button id="accountSyncNow" ${navigator.onLine === false ? "disabled" : ""}>Синхронизировать</button></div>
    <p class="account-note">Одиночная игра продолжает работать без интернета. После возвращения сети прогресс объединится с облачной копией.</p>
    <div class="account-actions">
      <button class="account-danger" id="accountLogout" type="button">Выйти из аккаунта</button>
      <button class="account-delete-open" id="accountDeleteOpen" type="button">Удалить аккаунт</button>
    </div>
    <div class="account-delete-panel" id="accountDeletePanel" hidden>
      <b>Удалить аккаунт безвозвратно?</b>
      <p>Будут удалены аккаунт, облачный прогресс, записи лидерборда и серверные дуэли. На этом устройстве игра начнётся с нового гостевого профиля.</p>
      ${accountPasswordField({ label: "Пароль для подтверждения", autocomplete: "current-password", id: "accountDeletePassword", required: false })}
      <div class="account-error" id="accountDeleteError" aria-live="polite"></div>
      <button class="account-delete-confirm" id="accountDeleteConfirm" type="button" ${navigator.onLine === false ? "disabled" : ""}>Удалить навсегда</button>
    </div>`;
}
function accountVerificationMarkup(mode = "verify-email") {
  const recovering = mode === "recover-verify";
  const email = authEsc(accountVerification.email);
  const passwordField = recovering ? `${accountPasswordField({ label: "Новый пароль", autocomplete: "new-password" })}<small class="account-password-note">Новый пароль должен отличаться от прежнего. После смены пароля старые сессии на других устройствах будут завершены.</small>` : "";
  const deliveryText = recovering
    ? `Если аккаунт существует, шестизначный код отправлен на <b>${email}</b>.`
    : `Мы отправили шестизначный код на <b>${email}</b>.`;
  return `<div class="account-hero ${recovering ? "recovery" : "verify"}"><span>${recovering ? "↺" : "✉"}</span><div><small>${recovering ? "ВОССТАНОВЛЕНИЕ" : "ПОДТВЕРЖДЕНИЕ"}</small><h2>${recovering ? "Код для сброса пароля" : "Проверь почту"}</h2><p>${deliveryText}</p></div></div>
    <form class="account-form" id="accountForm"><label>Код из письма<div class="account-code-row"><input class="account-code-input" id="accountVerificationCode" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required><button type="button" class="account-paste-code" id="accountPasteCode">Вставить</button></div></label>${passwordField}<small class="account-password-note" id="accountVerificationHint">Код действует 10 минут. На iPhone код из письма может появиться над клавиатурой автоматически.</small><div class="account-error" id="accountError" aria-live="polite"></div><button class="account-primary" type="submit">${recovering ? "Сменить пароль и войти" : "Подтвердить и создать аккаунт"}</button></form>
    <div class="account-verification-actions"><button class="account-link" id="accountResendCode" type="button">Отправить код ещё раз</button><button class="account-link subtle" type="button" data-account-mode="${recovering ? "recover" : "register"}" data-account-reset-verification="1">← ${recovering ? "Изменить почту" : "Изменить почту или пароль"}</button></div>`;
}

function openAccountModal(mode = null) {
  const modal = document.querySelector("#accountModal"), content = document.querySelector("#accountContent");
  if (!modal || !content) return;
  const pendingMode = accountVerificationActive("recover") ? "recover-verify" : accountVerificationActive("register") ? "verify-email" : "";
  modal.dataset.mode = mode || (accountSignedIn() ? "signed" : pendingMode || (accountState.status === "signed_out" ? "login" : "register"));
  renderAccountModal();
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
}
function closeAccountModal() {
  const modal = document.querySelector("#accountModal");
  clearInterval(accountVerificationTimer);
  accountVerificationTimer = null;
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
function updateVerificationControls() {
  if (!accountVerification.email) return;
  const now = Date.now();
  const resend = document.querySelector("#accountResendCode");
  const hint = document.querySelector("#accountVerificationHint");
  const waitSec = Math.max(0, Math.ceil((accountVerification.resendAt - now) / 1000));
  const expiresSec = Math.max(0, Math.ceil((accountVerification.expiresAt - now) / 1000));
  if (resend) {
    resend.disabled = waitSec > 0;
    resend.textContent = waitSec > 0 ? `Отправить ещё раз через ${waitSec} с` : "Отправить код ещё раз";
  }
  if (hint) hint.textContent = expiresSec > 0 ? `Код действует ещё ${Math.max(1, Math.ceil(expiresSec / 60))} мин.` : "Код истёк. Запроси новый.";
}

function renderAccountModal() {
  const modal = document.querySelector("#accountModal"), content = document.querySelector("#accountContent");
  if (!modal || !content) return;
  clearInterval(accountVerificationTimer);
  accountVerificationTimer = null;
  let mode = modal.dataset.mode || "register";
  if (mode === "verify-email" && !accountVerificationActive("register")) mode = modal.dataset.mode = "register";
  if (mode === "recover-verify" && !accountVerification.email) mode = modal.dataset.mode = "recover";
  content.innerHTML = (mode === "verify-email" || mode === "recover-verify")
    ? accountVerificationMarkup(mode)
    : accountSignedIn() && mode === "signed"
      ? accountSignedInMarkup()
      : accountGuestMarkup(mode);

  bindAccountPasswordToggle();

  content.querySelectorAll("[data-account-mode]").forEach((button) => button.onclick = () => {
    if (button.dataset.accountResetVerification) clearAccountVerification();
    modal.dataset.mode = button.dataset.accountMode;
    renderAccountModal();
  });

  if (mode === "verify-email" || mode === "recover-verify") {
    updateVerificationControls();
    accountVerificationTimer = setInterval(updateVerificationControls, 1000);
    const codeInput = document.querySelector("#accountVerificationCode");
    let autoSubmitTimer = 0;
    codeInput?.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
      clearTimeout(autoSubmitTimer);
      if (codeInput.value.length === 6) autoSubmitTimer = setTimeout(() => document.querySelector("#accountForm")?.requestSubmit(), 160);
    });
    codeInput?.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      const code = String(text).match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1] || "";
      if (!code) return;
      event.preventDefault(); codeInput.value = code; codeInput.dispatchEvent(new Event("input", { bubbles:true }));
    });
    let clipboardFocusTried = false;
    codeInput?.addEventListener("focus", async () => {
      if (clipboardFocusTried || codeInput.value) return;
      clipboardFocusTried = true;
      try {
        const text = await navigator.clipboard?.readText?.();
        const code = String(text || "").match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1] || "";
        if (code) { codeInput.value = code; codeInput.dispatchEvent(new Event("input", { bubbles:true })); }
      } catch {}
    }, { once:true });
    document.querySelector("#accountPasteCode")?.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard?.readText?.();
        const code = String(text || "").match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1] || "";
        if (!code) return showToast?.("В буфере нет шестизначного кода");
        codeInput.value = code; codeInput.dispatchEvent(new Event("input", { bubbles:true })); codeInput.focus();
      } catch { showToast?.("Разреши доступ к буферу и нажми «Вставить» ещё раз"); }
    });
    document.querySelector("#accountResendCode")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const errorBox = document.querySelector("#accountError");
      if (errorBox) errorBox.textContent = "";
      button.disabled = true; button.textContent = "Отправляю…";
      try {
        if (mode === "recover-verify") await resendPasswordRecoveryCode(accountVerification.email);
        else await resendRegistrationCode(accountVerification.email);
        updateVerificationControls();
        showToast?.("Новый код отправлен");
      } catch (error) {
        if (error?.code === "verification_not_started" && mode === "verify-email") {
          const message = authErrorText(error);
          clearAccountVerification(); modal.dataset.mode = "register"; renderAccountModal();
          const box = document.querySelector("#accountError"); if (box) box.textContent = message;
        } else { showAccountError(error); updateVerificationControls(); }
      }
    });
  }

  const form = document.querySelector("#accountForm");
  if (form) form.onsubmit = async (event) => {
    event.preventDefault();
    const errorBox = document.querySelector("#accountError"); if (errorBox) errorBox.textContent = "";
    const email = document.querySelector("#accountEmail")?.value?.trim() || accountVerification.email || "";
    const password = document.querySelector("#accountPassword")?.value || "";
    const busyText = mode === "login" ? "Вхожу…"
      : mode === "recover" ? "Отправляю код…"
      : mode === "recover-verify" ? "Меняю пароль…"
      : mode === "verify-email" ? "Проверяю…"
      : "Отправляю код…";
    setAccountFormBusy(true, busyText);
    try {
      if (mode === "login") {
        await loginAccount(email, password);
        modal.dataset.mode = "signed"; renderAccountModal(); showToast?.("Аккаунт подключён");
      } else if (mode === "recover") {
        await startPasswordRecovery(email);
        modal.dataset.mode = "recover-verify"; renderAccountModal();
        showToast?.("Если аккаунт существует, код отправлен на почту");
      } else if (mode === "recover-verify") {
        const code = document.querySelector("#accountVerificationCode")?.value || "";
        await recoverAccount(email, code, password);
        modal.dataset.mode = "signed"; renderAccountModal(); showToast?.("Пароль обновлён");
      } else if (mode === "verify-email") {
        const code = document.querySelector("#accountVerificationCode")?.value || "";
        await verifyRegistration(email, code);
        modal.dataset.mode = "signed"; renderAccountModal(); showToast?.("Аккаунт создан");
      } else {
        await startRegistration(email, password);
        modal.dataset.mode = "verify-email"; renderAccountModal(); showToast?.("Код отправлен на почту");
      }
    } catch (error) {
      if (["verification_expired", "verification_not_started", "verification_attempts_exceeded"].includes(error?.code) && mode === "verify-email") {
        const message = authErrorText(error);
        clearAccountVerification(); modal.dataset.mode = "register"; renderAccountModal();
        const box = document.querySelector("#accountError"); if (box) box.textContent = message;
        return;
      }
      showAccountError(error); setAccountFormBusy(false);
    }
  };
  document.querySelector("#accountSyncNow")?.addEventListener("click", async (event) => { const b=event.currentTarget;b.disabled=true;b.textContent="Синхронизирую…";const ok=await flushAccountSync();renderAccountModal();showToast?.(ok?"Прогресс синхронизирован":"Синхронизация пока недоступна"); });
  document.querySelector("#accountLogout")?.addEventListener("click", async (event) => { const b=event.currentTarget;b.disabled=true;b.textContent="Выхожу…";await logoutAccount();clearAccountVerification();modal.dataset.mode="register";renderAccountModal();showToast?.("Теперь ты играешь как гость"); });
  document.querySelector("#accountDeleteOpen")?.addEventListener("click", () => {
    const panel = document.querySelector("#accountDeletePanel"), button = document.querySelector("#accountDeleteOpen");
    if (!panel) return;
    panel.hidden = false;
    if (button) button.hidden = true;
    document.querySelector("#accountDeletePassword")?.focus();
  });
  document.querySelector("#accountDeleteConfirm")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const password = document.querySelector("#accountDeletePassword")?.value || "";
    const errorBox = document.querySelector("#accountDeleteError");
    if (errorBox) errorBox.textContent = "";
    if (password.length < 8) {
      if (errorBox) errorBox.textContent = "Введи текущий пароль от аккаунта.";
      return;
    }
    if (!confirm("Удалить аккаунт и весь связанный с ним серверный прогресс? Это действие нельзя отменить.")) return;
    button.disabled = true;
    button.textContent = "Удаляю…";
    try {
      await deleteAccount(password);
      showToast?.("Аккаунт удалён");
      closeAccountModal();
      setTimeout(() => location.reload(), 250);
    } catch (error) {
      if (errorBox) errorBox.textContent = authErrorText(error);
      button.disabled = false;
      button.textContent = "Удалить навсегда";
    }
  });
}

function bindAccountUi() {
  const modal = document.querySelector("#accountModal");
  document.querySelector("#accountClose")?.addEventListener("click", closeAccountModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeAccountModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal?.classList.contains("show")) closeAccountModal(); });
  SolivocLifecycle.on("online", "account.ui", async () => {
    if (accountState.pendingLogout) await completePendingServerLogout();
    if (accountSignedIn()) scheduleAccountSync(350);
    updateAccountModalIfOpen();
  });
  SolivocLifecycle.on("offline", "account.ui", updateAccountModalIfOpen);
  SolivocLifecycle.on("visible", "account.ui", () => scheduleAccountSync(1800));
}
