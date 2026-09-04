/* Single owner for service-worker update checks and safe activation. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocUpdateManager) return;

  const UPDATE_RELOAD_KEY = "solivoc-explicit-update";
  const CHECK_INTERVAL_MS = 120000;
  const CHECK_GUARD_MS = 15000;

  let started = false;
  let registration = null;
  let pendingWorker = null;
  let updateRequested = false;
  let refreshing = false;
  let checkBusy = false;
  let lastCheckAt = 0;
  let activationTimer = null;

  const scheduler = () => root.SolivocScheduler;
  const lifecycle = () => root.SolivocLifecycle;
  const hasController = () => !!navigator.serviceWorker?.controller;
  const activeRound = () => typeof root.activelyPlayingRound === "function" && root.activelyPlayingRound();
  const safePoint = () => !activeRound();
  const banner = () => document.querySelector("#updateBanner");
  const updateButton = () => document.querySelector("#updateNow");

  function hideUpdate() {
    banner()?.classList.remove("show");
    banner()?.setAttribute("aria-hidden", "true");
    const button = updateButton();
    if (button) {
      button.disabled = false;
      button.textContent = "Обновить";
    }
  }

  function showUpdate(worker = null) {
    if (!hasController()) {
      pendingWorker = null;
      hideUpdate();
      return false;
    }
    if (worker) pendingWorker = worker;
    banner()?.classList.add("show");
    banner()?.setAttribute("aria-hidden", "false");
    const button = updateButton();
    if (button && !updateRequested) {
      button.disabled = false;
      button.textContent = "Обновить";
    }
    return true;
  }

  function checkpointBeforeReload() {
    try { root.save?.({ immediate: true }); } catch {}
    try { root.flushProfileSave?.({ skipCloud: false }); } catch {
      try { root.saveProfile?.(); } catch {}
    }
    try { root.markStabilityStage?.("updating"); } catch {}
  }

  function clearExplicitFlag() {
    try { sessionStorage.removeItem(UPDATE_RELOAD_KEY); } catch {}
  }

  function explicitFlag() {
    try { return sessionStorage.getItem(UPDATE_RELOAD_KEY) === "1"; }
    catch { return false; }
  }

  function finishReload() {
    if (refreshing || !explicitFlag()) return false;
    refreshing = true;
    clearTimeout(activationTimer);
    checkpointBeforeReload();
    clearExplicitFlag();
    location.reload();
    return true;
  }

  function armActivationFallback() {
    clearTimeout(activationTimer);
    activationTimer = setTimeout(() => {
      if (!updateRequested || refreshing) return;
      finishReload();
    }, 5000);
  }

  function requestActivation(worker, { explicit = false } = {}) {
    if (!worker || worker.state !== "installed" || !hasController()) return false;
    pendingWorker = worker;
    if (!explicit && !safePoint()) return false;
    if (explicit) {
      updateRequested = true;
      checkpointBeforeReload();
      try { sessionStorage.setItem(UPDATE_RELOAD_KEY, "1"); } catch {}
    }
    if (!updateRequested) return true;
    try { worker.postMessage({ type: "SKIP_WAITING" }); }
    catch { return false; }
    armActivationFallback();
    return true;
  }

  function watchWorker(worker) {
    if (!worker) return;
    const onState = () => {
      if (worker.state === "installed") {
        if (!hasController()) {
          pendingWorker = null;
          hideUpdate();
          return;
        }
        pendingWorker = worker;
        showUpdate(worker);
        if (updateRequested) requestActivation(worker, { explicit: true });
        return;
      }
      if (["activated", "redundant"].includes(worker.state) && pendingWorker === worker) {
        pendingWorker = null;
        if (!updateRequested) hideUpdate();
      }
    };
    onState();
    worker.addEventListener("statechange", onState);
  }

  async function checkForUpdate({ force = false } = {}) {
    if (!registration || checkBusy || navigator.onLine === false || document.visibilityState === "hidden") return false;
    if (activeRound()) return false;
    const now = Date.now();
    if (!force && now - lastCheckAt < CHECK_GUARD_MS) return false;
    lastCheckAt = now;
    checkBusy = true;
    try {
      await registration.update();
      if (registration.waiting && hasController()) {
        showUpdate(registration.waiting);
        return true;
      }
      watchWorker(registration.installing);
      return false;
    } catch {
      return false;
    } finally {
      checkBusy = false;
    }
  }

  async function activateRequestedUpdate() {
    const button = updateButton();
    if (button) {
      button.disabled = true;
      button.textContent = "Обновляю…";
    }
    updateRequested = true;
    try { sessionStorage.setItem(UPDATE_RELOAD_KEY, "1"); } catch {}

    const ready = registration?.waiting || pendingWorker;
    if (ready && requestActivation(ready, { explicit: true })) return true;

    if (activeRound()) {
      updateRequested = false;
      clearExplicitFlag();
      if (button) {
        button.disabled = false;
        button.textContent = "Обновить";
      }
      root.showToast?.("Обновление проверю после завершения расклада");
      return false;
    }

    await checkForUpdate({ force: true });
    const afterCheck = registration?.waiting || pendingWorker;
    if (afterCheck && requestActivation(afterCheck, { explicit: true })) return true;

    updateRequested = false;
    clearExplicitFlag();
    hideUpdate();
    root.showToast?.("Уже установлена последняя версия");
    return false;
  }

  function bindRegistration(reg) {
    registration = reg;
    pendingWorker = reg.waiting || null;
    if (reg.waiting && hasController()) showUpdate(reg.waiting);
    else if (!hasController()) hideUpdate();
    watchWorker(reg.installing);
    reg.addEventListener("updatefound", () => watchWorker(reg.installing));

    const button = updateButton();
    if (button) button.onclick = () => activateRequestedUpdate();

    navigator.serviceWorker.addEventListener("controllerchange", () => finishReload());
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SOLIVOC_SW_ACTIVATED") finishReload();
    });

    lifecycle()?.on?.("resume", "pwa.update", () => checkForUpdate({ force: true }));
    lifecycle()?.on?.("online", "pwa.update", () => checkForUpdate({ force: true }));
    scheduler()?.interval?.("pwa.update-check", () => checkForUpdate(), CHECK_INTERVAL_MS, { visibleOnly: true });
  }

  async function setup() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return false;
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      bindRegistration(reg);
      if (explicitFlag() && reg.waiting) {
        updateRequested = true;
        requestActivation(reg.waiting, { explicit: true });
        return true;
      }
      if (safePoint() && hasController()) checkForUpdate({ force: true });
      return true;
    } catch (error) {
      try { console.warn("Service worker:", error); } catch {}
      return false;
    }
  }

  function start() {
    if (started) return true;
    started = true;
    if (document.readyState === "complete") setup();
    else root.addEventListener("load", setup, { once: true });
    return true;
  }

  function status() {
    return {
      started,
      registered: !!registration,
      waiting: !!(registration?.waiting || pendingWorker),
      updateRequested,
      checkBusy,
      lastCheckAt,
      activeRound: activeRound(),
      safePoint: safePoint(),
    };
  }

  root.SolivocUpdateManager = Object.freeze({ start, checkForUpdate, status });
})();
