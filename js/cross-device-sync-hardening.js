/* Cross-device account sync: cloud-first login + resilient cloud refresh. */
(() => {
  const REFRESH_GUARD_MS = 15000;
  let lastRefreshAt = 0;
  let refreshBusy = false;

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  };

  async function fetchAuthenticatedProfile({ timeout = 8000 } = {}) {
    if (typeof accountCanUseServer === "function" && !accountCanUseServer()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await apiFetch("/api/auth", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || !data?.authenticated) return null;
      if (!response.ok) throw new Error(data?.error || `http_${response.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshAccountFromCloud({ force = false } = {}) {
    if (refreshBusy || (typeof accountSignedIn === "function" && !accountSignedIn())) return false;
    if (typeof accountCanUseServer === "function" && !accountCanUseServer()) return false;
    if (!force && Date.now() - lastRefreshAt < REFRESH_GUARD_MS) return false;
    if (typeof activelyPlayingRound === "function" && activelyPlayingRound()) return false;

    refreshBusy = true;
    try {
      const data = await fetchAuthenticatedProfile({ timeout: 8000 });
      if (!data?.profile) return false;
      saveAccountIdentity?.(data.user, "signed_in", data.version);
      applyAccountCloudProfile?.(data.profile, { version: data.version });
      lastRefreshAt = Date.now();
      return true;
    } catch (error) {
      try { recordStabilityEvent?.("cloud_refresh_failed", { message: String(error?.message || "unknown").slice(0, 80) }); } catch {}
      return false;
    } finally {
      refreshBusy = false;
    }
  }

  if (typeof loginAccount === "function" && !window.__solivocCloudFirstLogin) {
    window.__solivocCloudFirstLogin = true;
    loginAccount = async function cloudFirstLogin(email, password) {
      const normalizedEmail = normalizeEmail(email);
      const knownSameAccount = !!accountState?.userId
        && normalizeEmail(accountState?.email) === normalizedEmail;
      const localBeforeLogin = knownSameAccount ? clone(profile) : null;

      // Existing-account login must not write this device's local profile into the
      // cloud before the server profile is downloaded. This is essential for a
      // fresh second phone/browser.
      const data = await accountRequest("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", email, password, profile: {} }),
      });

      saveAccountIdentity(data.user, "signed_in", data.version);
      if (knownSameAccount && localBeforeLogin) {
        const reconciled = mergeAccountProfiles(localBeforeLogin, data.profile || {});
        applyAccountCloudProfile(reconciled, { version: data.version });
        // This device may contain legitimate offline progress for the same account.
        scheduleAccountSync?.(250);
      } else {
        applyAccountCloudProfile(data.profile, { version: data.version });
      }
      grantStarterCompanions?.({ notify: true });
      syncBossCompanionsFromProgress?.({ notify: false });
      saveProfile?.({ skipCloud: true });
      syncLeaderboardNonBlocking?.();
      lastRefreshAt = Date.now();
      return data;
    };
  }

  if (typeof restoreAccountSessionOnBoot === "function" && !window.__solivocResilientSessionRestore) {
    window.__solivocResilientSessionRestore = true;
    restoreAccountSessionOnBoot = async function resilientSessionRestore() {
      if (typeof accountCanUseServer === "function" && !accountCanUseServer()) return false;
      if (accountState?.pendingLogout) {
        await completePendingServerLogout?.();
        return false;
      }
      try {
        const data = await fetchAuthenticatedProfile({ timeout: 8000 });
        if (!data?.authenticated) {
          if (accountState?.status === "signed_in") {
            accountState.status = "signed_out";
            persistAccountState?.();
          }
          return false;
        }
        saveAccountIdentity?.(data.user, "signed_in", data.version);
        applyAccountCloudProfile?.(data.profile, { version: data.version });
        grantStarterCompanions?.({ notify: false });
        syncBossCompanionsFromProgress?.({ notify: false });
        saveProfile?.({ skipCloud: true });
        lastRefreshAt = Date.now();
        scheduleAccountSync?.(1500);
        return true;
      } catch (error) {
        // A slow or temporarily unavailable mobile network must not silently turn
        // into a permanent stale session. Keep the local session state and retry.
        setTimeout(() => refreshAccountFromCloud({ force: true }), 5000);
        return false;
      }
    };
  }

  const queueRefresh = (delay = 250) => {
    setTimeout(() => refreshAccountFromCloud(), delay);
  };

  window.addEventListener("online", () => queueRefresh(100));
  window.addEventListener("focus", () => queueRefresh(250));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") queueRefresh(250);
  });

  window.refreshAccountFromCloud = refreshAccountFromCloud;
})();
