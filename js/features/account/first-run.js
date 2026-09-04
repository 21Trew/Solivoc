/* Account-first onboarding and social sign-in integration. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocFirstRunAccount) return;

  let accountObserver = null;

  const signedIn = () => typeof accountSignedIn === "function" && accountSignedIn();
  const profileReady = () => typeof profile !== "undefined" && profile && typeof profile === "object";

  function ensureStyles() {
    if (document.querySelector('link[data-first-run-account-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles/first-run-account.css";
    link.dataset.firstRunAccountStyles = "1";
    document.head?.appendChild(link);
  }

  function markAsked() {
    if (!profileReady()) return;
    profile.onboardingAccountAsked = true;
    try { saveProfile?.({ skipCloud: true }); } catch {}
  }

  function oauthReturnTo() {
    return `${location.origin}${location.pathname}${location.search}${location.hash || ""}`;
  }

  function startOauth(provider) {
    const path = provider === "google" ? "/api/oauth-google" : "/api/oauth-yandex";
    markAsked();
    location.href = apiUrl(`${path}?action=start&returnTo=${encodeURIComponent(oauthReturnTo())}`);
  }

  function waitForAccountFlow() {
    return new Promise((resolve) => {
      const modal = document.querySelector("#accountModal");
      if (!modal) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearInterval(timer);
        resolve();
      };
      const check = () => {
        if (signedIn()) {
          try { closeAccountModal?.(); } catch {}
          return finish();
        }
        if (!modal.classList.contains("show")) finish();
      };
      const observer = new MutationObserver(check);
      observer.observe(modal, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
      const timer = setInterval(check, 350);
      setTimeout(check, 50);
    });
  }

  async function openAccount(mode, onboardingModal) {
    markAsked();
    onboardingModal?.classList.remove("show");
    onboardingModal?.setAttribute("aria-hidden", "true");
    openAccountModal?.(mode);
    await waitForAccountFlow();
  }

  function renderCreateStep(host, onboardingModal, finishGuest) {
    host.innerHTML = `<div class="first-run-account-flow" data-first-run-step="create">
      <div class="first-run-account-head"><p class="first-run-account-kicker">Создание аккаунта</p><h2>Как удобнее зарегистрироваться?</h2><p class="first-run-account-copy">Выбери способ. Прогресс будет храниться в облаке и восстановится на другом устройстве.</p></div>
      <div class="first-run-account-providers">
        <button type="button" class="first-run-account-button first-run-account-provider first-run-account-email" data-first-run-email><i>✉</i><span>Почта</span></button>
        <button type="button" class="first-run-account-button first-run-account-provider first-run-account-yandex" data-first-run-oauth="yandex"><i>Я</i><span>Яндекс</span></button>
        <button type="button" class="first-run-account-button first-run-account-provider first-run-account-google" data-first-run-oauth="google"><i>G</i><span>Gmail</span></button>
      </div>
      <p class="first-run-account-note">Любой способ создаёт один и тот же игровой аккаунт.</p>
      <button type="button" class="first-run-account-link" data-first-run-back>← Назад</button>
    </div>`;
    host.querySelector("[data-first-run-email]")?.addEventListener("click", () => openAccount("register", onboardingModal));
    host.querySelectorAll("[data-first-run-oauth]").forEach((button) => button.addEventListener("click", () => startOauth(button.dataset.firstRunOauth)));
    host.querySelector("[data-first-run-back]")?.addEventListener("click", () => renderChoiceStep(host, onboardingModal, finishGuest));
  }

  function renderChoiceStep(host, onboardingModal, finishGuest) {
    host.innerHTML = `<div class="first-run-account-flow" data-first-run-step="choice">
      <div class="first-run-account-head"><p class="first-run-account-kicker">Первый запуск</p><h2>У тебя уже есть аккаунт?</h2><p class="first-run-account-copy">Войди, чтобы вернуть свой прогресс. Если аккаунта ещё нет — создадим его за минуту.</p></div>
      <div class="first-run-account-actions"><button type="button" class="first-run-account-button first-run-account-primary" data-first-run-login>Да, войти</button><button type="button" class="first-run-account-button first-run-account-secondary" data-first-run-create>Нет, создать</button></div>
      <button type="button" class="first-run-account-link" data-first-run-skip>Продолжить без аккаунта</button>
    </div>`;
    host.querySelector("[data-first-run-login]")?.addEventListener("click", () => openAccount("login", onboardingModal));
    host.querySelector("[data-first-run-create]")?.addEventListener("click", () => renderCreateStep(host, onboardingModal, finishGuest));
    host.querySelector("[data-first-run-skip]")?.addEventListener("click", finishGuest);
  }

  function runGate() {
    if (!profileReady() || profile.onboardingAccountAsked || signedIn()) return Promise.resolve(false);
    const modal = document.querySelector("#onboardingModal"), host = document.querySelector("#onboardingContent");
    if (!modal || !host) return Promise.resolve(false);
    return new Promise((resolve) => {
      let finished = false;
      const finishGuest = () => {
        if (finished) return;
        finished = true;
        markAsked();
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        resolve(true);
      };
      renderChoiceStep(host, modal, finishGuest);
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
    });
  }

  function ensureSocialButtons() {
    const modal = document.querySelector("#accountModal"), mode = modal?.dataset.mode || "";
    if (!modal || signedIn() || !["register", "login"].includes(mode)) return;
    const form = document.querySelector("#accountForm");
    if (!form) return;
    document.querySelectorAll(".v30-social-auth,.v31-social-auth").forEach((node) => node.remove());
    let box = document.querySelector(".account-social-auth");
    if (!box) {
      box = document.createElement("div");
      box.className = "account-social-auth";
      box.innerHTML = `<div class="account-social-divider">или</div><button type="button" class="account-social-button account-social-yandex" data-account-oauth="yandex"><i>Я</i><span>Продолжить через Яндекс</span></button><button type="button" class="account-social-button account-social-google" data-account-oauth="google"><i>G</i><span>Продолжить через Google</span></button>`;
      form.after(box);
    }
    box.querySelectorAll("[data-account-oauth]").forEach((button) => { button.onclick = () => startOauth(button.dataset.accountOauth); });
  }

  function handleOauthReturn() {
    try {
      const url = new URL(location.href), provider = url.searchParams.get("oauth"), result = url.searchParams.get("oauth_result"), error = url.searchParams.get("oauth_error") || "";
      if (!["google", "yandex"].includes(provider) || !result) return;
      const name = provider === "google" ? "Google" : "Яндекс";
      setTimeout(() => showToast?.(result === "ok" ? `${name} подключён — прогресс синхронизируется` : (error === "oauth_not_configured" ? `Вход через ${name} ещё не настроен на сервере` : `Не удалось войти через ${name}`)), 900);
      url.searchParams.delete("oauth"); url.searchParams.delete("oauth_result"); url.searchParams.delete("oauth_error");
      history.replaceState(history.state, "", url.pathname + (url.search || "") + url.hash);
    } catch {}
  }

  function install() {
    ensureStyles();
    handleOauthReturn();
    const startObserver = () => {
      const modal = document.querySelector("#accountModal");
      if (!modal || accountObserver) return;
      accountObserver = new MutationObserver(() => queueMicrotask(ensureSocialButtons));
      accountObserver.observe(modal, { attributes: true, childList: true, subtree: true, attributeFilter: ["class", "data-mode"] });
      ensureSocialButtons();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    else startObserver();
  }

  root.SolivocFirstRunAccount = Object.freeze({ runGate, install, ensureSocialButtons });
  install();
})();
