/* First-run account choice and social sign-in UI. No runtime function overrides. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocFirstRunAccount) return;

  let accountObserver = null;

  const profileReady = () => typeof profile !== "undefined" && profile && typeof profile === "object";
  const signedIn = () => typeof accountSignedIn === "function" && accountSignedIn();
  const modal = () => document.querySelector("#onboardingModal");
  const content = () => document.querySelector("#onboardingContent");

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

  function socialReturnTo() {
    return `${location.origin}${location.pathname}${location.search}${location.hash || ""}`;
  }

  function startOauth(provider) {
    const path = provider === "google" ? "/api/oauth-google" : "/api/oauth-yandex";
    markAsked();
    location.href = apiUrl(`${path}?action=start&returnTo=${encodeURIComponent(socialReturnTo())}`);
  }

  function waitForAccountFlow() {
    return new Promise((resolve) => {
      const accountModal = document.querySelector("#accountModal");
      if (!accountModal) return resolve();
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
        if (!accountModal.classList.contains("show")) finish();
      };
      const observer = new MutationObserver(check);
      observer.observe(accountModal, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
      const timer = setInterval(check, 350);
      setTimeout(check, 50);
    });
  }

  async function openAccount(mode) {
    markAsked();
    const onboarding = modal();
    onboarding?.classList.remove("show");
    onboarding?.setAttribute("aria-hidden", "true");
    openAccountModal?.(mode);
    await waitForAccountFlow();
  }

  function providerButton(provider, label, mark) {
    return `<button type="button" class="first-run-account-button first-run-account-provider first-run-account-${provider}" data-first-run-oauth="${provider}"><i>${mark}</i><span>${label}</span></button>`;
  }

  function renderCreateStep(host, finishGuest) {
    host.innerHTML = `<div class="first-run-account-flow" data-first-run-step="create">
      <div class="first-run-account-head">
        <p class="first-run-account-kicker">Создание аккаунта</p>
        <h2>Как удобнее зарегистрироваться?</h2>
        <p class="first-run-account-copy">Выбери способ. Прогресс будет храниться в облаке и восстановится на другом устройстве.</p>
      </div>
      <div class="first-run-account-providers">
        <button type="button" class="first-run-account-button first-run-account-provider first-run-account-email" data-first-run-email><i>✉</i><span>Почта</span></button>
        ${providerButton("yandex", "Яндекс", "Я")}
        ${providerButton("google", "Gmail", "G")}
      </div>
      <p class="first-run-account-note">Любой способ создаёт один и тот же игровой аккаунт.</p>
      <button type="button" class="first-run-account-link" data-first-run-back>← Назад</button>
    </div>`;
    host.querySelector("[data-first-run-email]")?.addEventListener("click", () => openAccount("register"));
    host.querySelectorAll("[data-first-run-oauth]").forEach((button) => button.addEventListener("click", () => startOauth(button.dataset.firstRunOauth)));
    host.querySelector("[data-first-run-back]")?.addEventListener("click", () => renderChoiceStep(host, finishGuest));
  }

  function renderChoiceStep(host, finishGuest) {
    host.innerHTML = `<div class="first-run-account-flow" data-first-run-step="choice">
      <div class="first-run-account-head">
        <p class="first-run-account-kicker">Первый запуск</p>
        <h2>У тебя уже есть аккаунт?</h2>
        <p class="first-run-account-copy">Войди, чтобы вернуть свой прогресс. Если аккаунта ещё нет — создадим его за минуту.</p>
      </div>
      <div class="first-run-account-actions">
        <button type="button" class="first-run-account-button first-run-account-primary" data-first-run-login>Да, войти</button>
        <button type="button" class="first-run-account-button first-run-account-secondary" data-first-run-create>Нет, создать</button>
      </div>
      <button type="button" class="first-run-account-link" data-first-run-skip>Продолжить без аккаунта</button>
    </div>`;
    host.querySelector("[data-first-run-login]")?.addEventListener("click", () => openAccount("login"));
    host.querySelector("[data-first-run-create]")?.addEventListener("click", () => renderCreateStep(host, finishGuest));
    host.querySelector("[data-first-run-skip]")?.addEventListener("click", finishGuest);
  }

  function run() {
    ensureStyles();
    if (!profileReady() || profile.onboardingAccountAsked || signedIn()) return Promise.resolve(false);
    const onboarding = modal(), host = content();
    if (!onboarding || !host) return Promise.resolve(false);
    return new Promise((resolve) => {
      let finished = false;
      const finishGuest = () => {
        if (finished) return;
        finished = true;
        markAsked();
        onboarding.classList.remove("show");
        onboarding.setAttribute("aria-hidden", "true");
        resolve(true);
      };
      renderChoiceStep(host, finishGuest);
      onboarding.classList.add("show");
      onboarding.setAttribute("aria-hidden", "false");
    });
  }

  function ensureAccountProviders() {
    const accountModal = document.querySelector("#accountModal");
    const mode = accountModal?.dataset.mode || "";
    if (!accountModal || signedIn() || !["register", "login"].includes(mode)) return;
    const form = document.querySelector("#accountForm");
    if (!form) return;
    document.querySelectorAll(".v30-social-auth,.v31-social-auth").forEach((node) => node.remove());
    let box = document.querySelector(".account-social-auth");
    if (!box) {
      box = document.createElement("div");
      box.className = "account-social-auth";
      box.innerHTML = `<div class="account-social-divider">или</div>${providerButton("yandex", "Продолжить через Яндекс", "Я")}${providerButton("google", "Продолжить через Google", "G")}`;
      form.after(box);
    }
    box.querySelectorAll("[data-first-run-oauth]").forEach((button) => {
      button.onclick = () => startOauth(button.dataset.firstRunOauth);
    });
  }

  function handleOauthReturn() {
    try {
      const url = new URL(location.href);
      const provider = url.searchParams.get("oauth");
      const result = url.searchParams.get("oauth_result");
      const error = url.searchParams.get("oauth_error") || "";
      if (!["google", "yandex"].includes(provider) || !result) return;
      const name = provider === "google" ? "Google" : "Яндекс";
      setTimeout(() => showToast?.(result === "ok" ? `${name} подключён — прогресс синхронизируется` : (error === "oauth_not_configured" ? `Вход через ${name} ещё не настроен на сервере` : `Не удалось войти через ${name}`)), 900);
      url.searchParams.delete("oauth");
      url.searchParams.delete("oauth_result");
      url.searchParams.delete("oauth_error");
      history.replaceState(history.state, "", url.pathname + (url.search || "") + url.hash);
    } catch {}
  }

  function install() {
    ensureStyles();
    handleOauthReturn();
    if (accountObserver) return;
    const start = () => {
      const accountModal = document.querySelector("#accountModal");
      if (!accountModal) return;
      accountObserver = new MutationObserver(() => queueMicrotask(ensureAccountProviders));
      accountObserver.observe(accountModal, { attributes: true, childList: true, subtree: true, attributeFilter: ["class", "data-mode"] });
      ensureAccountProviders();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }

  root.SolivocFirstRunAccount = Object.freeze({ run, install, ensureAccountProviders });
  install();
})();
