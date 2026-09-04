/* Durable profile/account persistence for mobile/PWA lifecycle failures. */
(() => {
  const PROFILE_PRIMARY = "worditaire-profile-v7";
  const PROFILE_BACKUP = "worditaire-profile-v7-backup";
  const PROFILE_EMERGENCY = "worditaire-profile-v7-emergency";
  const SYNC_PENDING_KEY = "solivoc-account-sync-pending-v1";
  const MAX_EMERGENCY_AGE = 1000 * 60 * 60 * 24 * 30;

  const parse = (raw) => {
    try {
      const value = JSON.parse(raw || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch { return null; }
  };
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  };
  const progressScore = (p) => Math.max(
    Number(p?.stats?.levelsCompleted) || 0,
    Math.max(0, (Number(p?.currentLevel) || 1) - 1),
    Number(p?.campaignProgressFloor) || 0,
  );
  const newerProfile = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const as = progressScore(a), bs = progressScore(b);
    if (as !== bs) return bs > as ? b : a;
    const ax = Number(a.xp) || 0, bx = Number(b.xp) || 0;
    if (ax !== bx) return bx > ax ? b : a;
    return b;
  };
  function readEnvelope(key) {
    try {
      const value = parse(localStorage.getItem(key));
      if (!value) return null;
      if (value.profile && typeof value.profile === "object") return value;
      return { at: 0, profile: value };
    } catch { return null; }
  }
  function writeEnvelope(key, value) {
    const payload = { at: Date.now(), profile: clone(value) };
    localStorage.setItem(key, JSON.stringify(payload));
    const verify = readEnvelope(key);
    if (!verify?.profile) throw new Error("profile_write_verify_failed");
    return true;
  }
  function markPending(reason = "profile_changed") {
    try { localStorage.setItem(SYNC_PENDING_KEY, JSON.stringify({ at: Date.now(), reason })); } catch {}
  }
  function clearPending() {
    try { localStorage.removeItem(SYNC_PENDING_KEY); } catch {}
  }
  function hasPending() {
    try { return !!localStorage.getItem(SYNC_PENDING_KEY); } catch { return false; }
  }

  try {
    const primary = parse(localStorage.getItem(PROFILE_PRIMARY));
    const backup = readEnvelope(PROFILE_BACKUP);
    const emergency = readEnvelope(PROFILE_EMERGENCY);
    const emergencyFresh = emergency?.at && Date.now() - emergency.at <= MAX_EMERGENCY_AGE ? emergency.profile : null;
    let recovered = newerProfile(primary, backup?.profile || null);
    recovered = newerProfile(recovered, emergencyFresh);
    if (recovered && typeof profile !== "undefined" && progressScore(recovered) > progressScore(profile)) {
      profile = {
        ...defaultProfile(),
        ...recovered,
        stats: { ...DEFAULT_STATS, ...(recovered.stats || {}) },
        settings: { ...defaultProfile().settings, ...(recovered.settings || {}) },
        daily: { ...defaultProfile().daily, ...(recovered.daily || {}), weekRewards: { ...(recovered.daily?.weekRewards || {}) } },
        dailyQuests: { ...defaultProfile().dailyQuests, ...(recovered.dailyQuests || {}), modes: Array.isArray(recovered.dailyQuests?.modes) ? recovered.dailyQuests.modes : [], progress: { ...(recovered.dailyQuests?.progress || {}) }, rewarded: { ...(recovered.dailyQuests?.rewarded || {}) } },
      };
      migrateMetaProfile?.();
      markPending("recovered_profile");
    }
  } catch (error) {
    console.warn("Profile recovery failed", error);
  }

  if (typeof saveProfile === "function" && !window.__solivocDurableProfileSave) {
    window.__solivocDurableProfileSave = true;
    const baseSaveProfile = saveProfile;
    saveProfile = function durableSaveProfile(options = {}) {
      let serialized = "";
      try {
        pruneProfileHistories?.();
        recomputeStars?.();
        serialized = JSON.stringify(profile);
        const previous = parse(localStorage.getItem(PROFILE_PRIMARY));
        if (previous) writeEnvelope(PROFILE_BACKUP, previous);
        writeEnvelope(PROFILE_EMERGENCY, profile);
      } catch (error) {
        console.warn("Profile checkpoint failed", error);
      }
      baseSaveProfile(options);
      let verified = false;
      try {
        const stored = localStorage.getItem(PROFILE_PRIMARY);
        verified = !!stored && (!serialized || stored === serialized || !!parse(stored));
      } catch {}
      if (!verified) {
        markPending("local_write_failed");
        try { recordStabilityEvent?.("profile_write_failed", { level: Number(profile?.currentLevel) || 1 }); } catch {}
      } else if (!options.skipCloud) {
        markPending("profile_changed");
      }
      return verified;
    };
  }

  if (typeof flushAccountSync === "function" && !window.__solivocDurableAccountSync) {
    window.__solivocDurableAccountSync = true;
    const baseFlushAccountSync = flushAccountSync;

    async function confirmSessionAfterUnauthorized() {
      if (typeof accountCanUseServer === "function" && !accountCanUseServer()) return false;
      try {
        const response = await apiFetch("/api/auth", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.authenticated) return false;
        saveAccountIdentity?.(data.user, "signed_in", data.version);
        if (data.profile) applyAccountCloudProfile?.(data.profile, { version: data.version });
        return true;
      } catch { return false; }
    }

    flushAccountSync = async function durableFlushAccountSync(options = {}) {
      const lifecycle = !!options.keepalive;
      if (lifecycle && document.visibilityState === "hidden") {
        if (accountSyncBusy || !accountSignedIn?.() || !accountCanUseServer?.()) return false;
        accountSyncBusy = true;
        clearTimeout(accountSyncTimer);
        try {
          const bodyText = JSON.stringify({ profile: accountProfileSnapshot(), version: accountState.version || 0 });
          if (bodyText.length >= 60000) { markPending("lifecycle_payload_large"); return false; }
          const data = await accountRequest("/api/account", {
            method: "POST",
            body: bodyText,
            keepalive: true,
            timeout: 4500,
          });
          accountState.version = Math.max(accountState.version || 0, Number(data.version) || 0);
          accountState.lastSyncAt = Number(data.syncedAt) || Date.now();
          persistAccountState();
          applyAccountCloudProfile?.(data.profile, { version: data.version });
          clearPending();
          return true;
        } catch (error) {
          markPending(error?.status === 401 ? "unauthorized_pending_recheck" : "lifecycle_sync_failed");
          return false;
        } finally { accountSyncBusy = false; }
      }

      const beforeStatus = accountState?.status;
      const result = await baseFlushAccountSync(options);
      if (result) { clearPending(); return true; }
      if (beforeStatus === "signed_in" && accountState?.status === "signed_out") {
        const restored = await confirmSessionAfterUnauthorized();
        if (restored) {
          accountState.status = "signed_in";
          persistAccountState();
          markPending("retry_after_transient_401");
          SolivocScheduler.timeout("sync.retry-after-401", () => { try { scheduleAccountSync?.(250); } catch {} }, 0);
          return false;
        }
      }
      markPending("sync_failed");
      return false;
    };
  }

  function lifecycleCheckpoint() {
    try { flushProfileSave?.({ skipCloud: false }); }
    catch { try { saveProfile?.(); } catch {} }
    if (hasPending() || (typeof accountSignedIn === "function" && accountSignedIn())) {
      try { flushAccountSync?.({ keepalive: true }); } catch {}
    }
  }

  const schedulePendingSync = (delay) => {
    if (!hasPending()) return;
    SolivocScheduler.timeout("sync.pending-account", () => { try { scheduleAccountSync?.(250); } catch {} }, delay);
  };

  SolivocLifecycle.on("pagehide", "durability.profile", lifecycleCheckpoint);
  SolivocLifecycle.on("freeze", "durability.profile", lifecycleCheckpoint);
  SolivocLifecycle.on("hidden", "durability.profile", lifecycleCheckpoint);
  SolivocLifecycle.on("beforeunload", "durability.profile", lifecycleCheckpoint);
  SolivocLifecycle.on("visible", "durability.profile-resume", () => schedulePendingSync(0));
  SolivocLifecycle.on("online", "durability.profile-online", () => schedulePendingSync(0));
})();
