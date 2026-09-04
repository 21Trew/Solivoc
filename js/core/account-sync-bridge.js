/* Narrow bridge from classic auth globals to runtime sync modules. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocAccountSyncBridge) return;

  const state = () => typeof accountState !== "undefined" ? accountState : null;
  const owner = () => String(state()?.userId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const signedIn = () => typeof accountSignedIn === "function" && accountSignedIn();
  const canUseServer = () => typeof accountCanUseServer !== "function" || accountCanUseServer();
  const version = () => Math.max(0, Number(state()?.version) || 0);

  function updateMeta(data = {}) {
    const current = state();
    if (!current) return false;
    current.version = Math.max(Number(current.version) || 0, Number(data.version) || 0);
    current.lastSyncAt = Number(data.syncedAt) || Date.now();
    try { persistAccountState?.(); } catch {}
    return true;
  }

  function markSignedOut() {
    const current = state();
    if (!current) return false;
    current.status = "signed_out";
    try { persistAccountState?.(); } catch {}
    try { updateAccountModalIfOpen?.(); } catch {}
    return true;
  }

  root.SolivocAccountSyncBridge = Object.freeze({
    owner,
    signedIn,
    canUseServer,
    version,
    snapshot: () => typeof accountProfileSnapshot === "function" ? accountProfileSnapshot() : {},
    request: (...args) => accountRequest(...args),
    applyProfile: (profileValue, options) => applyAccountCloudProfile?.(profileValue, options),
    updateMeta,
    markSignedOut,
    updateUi: () => updateAccountModalIfOpen?.(),
  });
})();
