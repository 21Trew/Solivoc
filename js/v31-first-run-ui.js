/* Two-step first-run account UX layered over v31 account gate. */
(() => {
  if (window.__solivocV31FirstRunUiInstalled) return;
  window.__solivocV31FirstRunUiInstalled = true;

  const style = document.createElement("style");
  style.id = "v31FirstRunUiStyles";
  style.textContent = `
    #onboardingContent .v31-first-account[hidden]{display:none!important}

    .v31f-flow{
      display:grid;
      gap:16px;
      width:100%;
      color:#fff;
      text-align:left;
    }
    .v31f-head{
      display:grid;
      gap:8px;
    }
    .v31f-kicker{
      margin:0;
      color:rgba(255,255,255,.62);
      font-size:11px;
      font-weight:900;
      letter-spacing:.12em;
      text-transform:uppercase;
    }
    .v31f-flow h2{
      margin:0;
      color:#fff;
      font-size:clamp(27px,7.5vw,36px);
      line-height:1.06;
      letter-spacing:-.02em;
    }
    .v31f-copy{
      margin:0;
      color:rgba(255,255,255,.76);
      font-size:15px;
      line-height:1.48;
    }
    .v31f-actions{
      display:grid;
      gap:10px;
    }
    .v31f-providers{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }
    .v31f-button{
      appearance:none;
      width:100%;
      min-height:58px;
      border:1px solid transparent;
      border-radius:18px;
      padding:14px 16px;
      font:inherit;
      font-size:16px;
      font-weight:900;
      line-height:1.15;
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
      transition:transform .14s ease,filter .14s ease,background .14s ease;
    }
    .v31f-button:active{transform:scale(.985)}
    .v31f-button:focus-visible{
      outline:3px solid rgba(130,196,255,.9);
      outline-offset:3px;
    }
    .v31f-primary{
      background:linear-gradient(120deg,#6f5cff,#3aa9e6);
      color:#fff;
      box-shadow:0 10px 24px rgba(30,39,115,.28);
    }
    .v31f-secondary{
      background:rgba(255,255,255,.12);
      border-color:rgba(255,255,255,.23);
      color:#fff;
    }
    .v31f-secondary:hover{background:rgba(255,255,255,.16)}

    .v31f-provider{
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      min-height:56px;
    }
    .v31f-provider-mark{
      width:24px;
      height:24px;
      flex:0 0 24px;
      display:grid;
      place-items:center;
      border-radius:8px;
      font-size:14px;
      font-weight:950;
      font-style:normal;
    }
    .v31f-google{
      background:#fff;
      border-color:#fff;
      color:#202124;
    }
    .v31f-google .v31f-provider-mark{
      color:#4285f4;
      background:#f3f6ff;
    }
    .v31f-yandex{
      background:#fc3f1d;
      border-color:#fc3f1d;
      color:#fff;
    }
    .v31f-yandex .v31f-provider-mark{
      background:#fff;
      color:#fc3f1d;
    }
    .v31f-email{
      grid-column:1/-1;
      background:rgba(255,255,255,.12);
      border-color:rgba(255,255,255,.23);
      color:#fff;
    }
    .v31f-email .v31f-provider-mark{
      background:rgba(255,255,255,.12);
      color:#fff;
    }

    .v31f-tertiary{
      appearance:none;
      width:max-content;
      max-width:100%;
      justify-self:center;
      border:0;
      background:transparent;
      color:rgba(255,255,255,.68);
      padding:5px 8px;
      font:inherit;
      font-size:14px;
      font-weight:750;
      line-height:1.3;
      text-decoration:underline;
      text-decoration-color:rgba(255,255,255,.28);
      text-underline-offset:3px;
      cursor:pointer;
    }
    .v31f-tertiary:focus-visible{
      outline:2px solid rgba(130,196,255,.9);
      outline-offset:3px;
      border-radius:8px;
    }
    .v31f-back{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      text-decoration:none;
    }
    .v31f-note{
      margin:-3px 0 0;
      color:rgba(255,255,255,.52);
      font-size:12px;
      line-height:1.4;
      text-align:center;
    }

    @media (max-width:520px){
      .v31f-flow{gap:14px}
      .v31f-flow h2{font-size:30px}
      .v31f-copy{font-size:14px}
      .v31f-button{min-height:56px;font-size:15px;border-radius:17px}
    }
  `;
  document.head.appendChild(style);

  function clickOriginal(button) {
    if (!button) return;
    button.click();
  }

  function enhance(original) {
    if (!original || original.dataset.v31UiEnhanced === "1") return;
    original.dataset.v31UiEnhanced = "1";

    const loginButton = original.querySelector("[data-v31-account-login]");
    const registerButtons = [...original.querySelectorAll("[data-v31-account-register]")];
    const registerButton = registerButtons.at(-1) || registerButtons[0];
    const googleButton = original.querySelector("[data-v31-oauth='google']");
    const yandexButton = original.querySelector("[data-v31-oauth='yandex']");
    const skipButton = original.querySelector("[data-v31-account-skip]");

    original.hidden = true;

    const flow = document.createElement("div");
    flow.className = "v31f-flow";
    flow.setAttribute("role", "group");
    flow.setAttribute("aria-label", "Первый запуск");

    const renderStepOne = () => {
      flow.dataset.step = "choice";
      flow.innerHTML = `
        <div class="v31f-head">
          <p class="v31f-kicker">Первый запуск</p>
          <h2>У тебя уже есть аккаунт?</h2>
          <p class="v31f-copy">Войди, чтобы вернуть свой прогресс. Если аккаунта ещё нет — создадим его за минуту.</p>
        </div>
        <div class="v31f-actions">
          <button type="button" class="v31f-button v31f-primary" data-v31f-login>Да, войти</button>
          <button type="button" class="v31f-button v31f-secondary" data-v31f-create>Нет, создать</button>
        </div>
        ${skipButton ? '<button type="button" class="v31f-tertiary" data-v31f-skip>Продолжить без аккаунта</button>' : ""}
      `;
      flow.querySelector("[data-v31f-login]")?.addEventListener("click", () => clickOriginal(loginButton));
      flow.querySelector("[data-v31f-create]")?.addEventListener("click", renderStepTwo);
      flow.querySelector("[data-v31f-skip]")?.addEventListener("click", () => clickOriginal(skipButton));
    };

    const renderStepTwo = () => {
      flow.dataset.step = "create";
      flow.innerHTML = `
        <div class="v31f-head">
          <p class="v31f-kicker">Создание аккаунта</p>
          <h2>Как удобнее зарегистрироваться?</h2>
          <p class="v31f-copy">Выбери способ. Прогресс будет храниться в облаке и восстановится на другом устройстве.</p>
        </div>
        <div class="v31f-providers">
          <button type="button" class="v31f-button v31f-provider v31f-email" data-v31f-email>
            <i class="v31f-provider-mark">✉</i><span>Почта</span>
          </button>
          <button type="button" class="v31f-button v31f-provider v31f-yandex" data-v31f-yandex>
            <i class="v31f-provider-mark">Я</i><span>Яндекс</span>
          </button>
          <button type="button" class="v31f-button v31f-provider v31f-google" data-v31f-google>
            <i class="v31f-provider-mark">G</i><span>Gmail</span>
          </button>
        </div>
        <p class="v31f-note">Любой способ создаёт один и тот же игровой аккаунт.</p>
        <button type="button" class="v31f-tertiary v31f-back" data-v31f-back>← Назад</button>
      `;
      flow.querySelector("[data-v31f-google]")?.addEventListener("click", () => clickOriginal(googleButton));
      flow.querySelector("[data-v31f-yandex]")?.addEventListener("click", () => clickOriginal(yandexButton));
      flow.querySelector("[data-v31f-email]")?.addEventListener("click", () => clickOriginal(registerButton));
      flow.querySelector("[data-v31f-back]")?.addEventListener("click", renderStepOne);
    };

    original.before(flow);
    renderStepOne();
  }

  function scan() {
    document
      .querySelectorAll("#onboardingContent .v31-first-account:not([data-v31-ui-enhanced='1'])")
      .forEach(enhance);
  }

  const observer = new MutationObserver(scan);
  const start = () => {
    const content = document.querySelector("#onboardingContent");
    if (!content) return;
    observer.observe(content, { childList: true, subtree: true });
    scan();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
