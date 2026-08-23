/* Словасьянс v31: auto-update, first-run account gate, world/chapter picker and Google OAuth UI. */
(() => {
  if (window.__solivocV31Installed) return;
  window.__solivocV31Installed = true;

  const WORLD_NAMES = [
    "Архипелаг первых связей",
    "Сад смыслов",
    "Город созвучий",
    "Архив ассоциаций",
    "Океан понятий",
    "Лабиринт эрудиции",
    "Обсерватория идей",
    "Мастерская контекстов",
    "Хроники языка",
    "За гранью очевидного",
  ];
  const CHAPTER_NAMES = [
    "Порог", "Первые тропы", "Перекрёсток", "Скрытый слой", "Проверка памяти",
    "Тонкие связи", "Ложные следы", "Глубина", "Последний рубеж", "Сердце мира",
  ];
  const AUTO_UPDATE_PENDING_KEY = "solivoc-auto-update-pending-v1";

  function installStyles() {
    if (document.querySelector("#v31Styles")) return;
    const style = document.createElement("style");
    style.id = "v31Styles";
    style.textContent = `
      #updateBanner{display:none!important}
      .v31-google-auth,.v31-yandex-auth{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:16px;padding:13px 16px;font:inherit;font-weight:900;cursor:pointer}
      .v31-google-auth{background:#fff;color:#202124}.v31-google-auth i{font-style:normal;font-weight:900;color:#4285f4}.v31-yandex-auth{background:#fc3f1d;color:#fff;border-color:transparent}
      .v31-first-account{display:grid;gap:14px;text-align:left}.v31-first-account h2{margin:0;font-size:clamp(24px,7vw,34px);line-height:1.05}.v31-first-account>p{margin:0;opacity:.76;line-height:1.45}
      .v31-account-choice{display:grid;gap:10px}.v31-account-choice button{width:100%;border:0;border-radius:18px;padding:14px 16px;font:inherit;font-weight:900;text-align:left}
      .v31-account-login{background:linear-gradient(120deg,#735bff,#37aee2);color:#fff}.v31-account-create{background:color-mix(in srgb,var(--panel,#fff) 88%,#7361ff 12%);color:inherit;border:1px solid color-mix(in srgb,currentColor 12%,transparent)!important}
      .v31-account-create small,.v31-account-login small{display:block;margin-top:3px;font-weight:600;opacity:.76}.v31-account-quick{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v31-account-quick button{text-align:center;padding:12px}
      .v31-account-email{grid-column:1/-1;background:transparent!important;border:1px solid color-mix(in srgb,currentColor 16%,transparent)!important;text-align:center!important}.v31-account-skip{background:transparent!important;text-align:center!important;opacity:.68;text-decoration:underline;padding:8px!important}
      .v31-chapter-picker-hit{cursor:pointer;position:relative;padding-right:26px!important}.v31-chapter-picker-hit::after{content:"⌄";position:absolute;right:4px;top:50%;transform:translateY(-50%);opacity:.62;font-size:18px}.v31-chapter-picker-hit:focus-visible{outline:3px solid color-mix(in srgb,#7b68ff 65%,transparent);outline-offset:4px;border-radius:12px}
      .v31-world-picker{position:fixed;inset:0;z-index:10080;display:grid;place-items:end center;background:rgba(11,9,31,.68);backdrop-filter:blur(10px);padding:16px}.v31-world-picker[hidden]{display:none}
      .v31-world-picker-card{width:min(620px,100%);max-height:min(82vh,760px);overflow:hidden;display:flex;flex-direction:column;border-radius:28px;background:var(--panel,#fbfaff);color:var(--text,#24213c);box-shadow:0 30px 100px rgba(0,0,0,.38)}
      .v31-world-picker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 20px 12px}.v31-world-picker-head small{display:block;letter-spacing:.14em;font-size:10px;font-weight:900;opacity:.6}.v31-world-picker-head h2{margin:4px 0 0;font-size:24px}.v31-world-picker-close{border:0;background:color-mix(in srgb,currentColor 8%,transparent);width:38px;height:38px;border-radius:50%;font:inherit;font-size:22px}
      .v31-world-tabs{display:flex;gap:8px;overflow:auto;padding:0 16px 12px;scrollbar-width:none}.v31-world-tabs::-webkit-scrollbar{display:none}.v31-world-tab{flex:0 0 auto;min-width:148px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:17px;padding:11px 12px;background:transparent;color:inherit;text-align:left;font:inherit}.v31-world-tab.active{background:linear-gradient(120deg,#6759e8,#3f98de);color:#fff;border-color:transparent}.v31-world-tab.locked{opacity:.56}.v31-world-tab b,.v31-world-tab span{display:block}.v31-world-tab span{font-size:11px;opacity:.76;margin-top:3px}
      .v31-chapter-grid{overflow:auto;padding:4px 16px 20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v31-chapter-choice{border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:18px;padding:13px;background:color-mix(in srgb,var(--panel,#fff) 93%,transparent);color:inherit;text-align:left;font:inherit}.v31-chapter-choice.current{outline:2px solid #7566f0;outline-offset:1px}.v31-chapter-choice:disabled{opacity:.45}.v31-chapter-choice b,.v31-chapter-choice small,.v31-chapter-choice span{display:block}.v31-chapter-choice b{font-size:14px}.v31-chapter-choice small{margin-top:3px;opacity:.67}.v31-chapter-choice span{margin-top:8px;font-weight:900;font-size:12px;color:#c59f00}
      .v31-world-summary{padding:0 20px 12px;font-size:12px;opacity:.7}
      @media(max-width:520px){.v31-world-picker{padding:0;place-items:end stretch}.v31-world-picker-card{width:100%;border-radius:26px 26px 0 0;max-height:88vh}.v31-chapter-grid{grid-template-columns:1fr}.v31-account-quick{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function markFirstAccountAsked() {
    if (!profile) return;
    profile.onboardingAccountAsked = true;
    try { saveProfile?.({ skipCloud:true }); } catch {}
  }

  function socialReturnTo() {
    return `${location.origin}${location.pathname}${location.search}${location.hash || ""}`;
  }

  function startSocialOauth(provider) {
    const path = provider === "google" ? "/api/oauth-google" : "/api/oauth-yandex";
    const returnTo = socialReturnTo();
    location.href = apiUrl(`${path}?action=start&returnTo=${encodeURIComponent(returnTo)}`);
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
        if (typeof accountSignedIn === "function" && accountSignedIn()) {
          try { closeAccountModal?.(); } catch {}
          return finish();
        }
        if (!modal.classList.contains("show")) finish();
      };
      const observer = new MutationObserver(check);
      observer.observe(modal, { attributes:true, attributeFilter:["class","aria-hidden"] });
      const timer = setInterval(check, 350);
      setTimeout(check, 50);
    });
  }

  function showFirstAccountGate() {
    if (profile?.onboardingAccountAsked || (typeof accountSignedIn === "function" && accountSignedIn())) return Promise.resolve();
    const modal = document.querySelector("#onboardingModal"), content = document.querySelector("#onboardingContent");
    if (!modal || !content) return Promise.resolve();
    return new Promise((resolve) => {
      const finishGuest = () => {
        markFirstAccountAsked();
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        resolve();
      };
      const openAccount = async (mode) => {
        markFirstAccountAsked();
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        openAccountModal?.(mode);
        await waitForAccountFlow();
        resolve();
      };
      content.innerHTML = `<div class="v31-first-account">
        <small>ПЕРВЫЙ ЗАПУСК</small>
        <h2>У тебя уже есть аккаунт?</h2>
        <p>С аккаунтом прогресс не потеряется при смене телефона или браузера. Если аккаунта ещё нет, его можно создать за минуту.</p>
        <div class="v31-account-choice">
          <button type="button" class="v31-account-login" data-v31-account-login>Да, войти<small>Вернуть облачный прогресс</small></button>
          <button type="button" class="v31-account-create" data-v31-account-register>Нет, создать аккаунт<small>Google, Яндекс или почта</small></button>
        </div>
        <div class="v31-account-quick">
          <button type="button" class="v31-google-auth" data-v31-oauth="google"><i>G</i> Google</button>
          <button type="button" class="v31-yandex-auth" data-v31-oauth="yandex">Я Яндекс</button>
          <button type="button" class="v31-account-email" data-v31-account-register>Создать по почте</button>
        </div>
        <button type="button" class="v31-account-skip" data-v31-account-skip>Пока продолжить без аккаунта</button>
      </div>`;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      content.querySelectorAll("[data-v31-account-login]").forEach((button)=>button.onclick=()=>openAccount("login"));
      content.querySelectorAll("[data-v31-account-register]").forEach((button)=>button.onclick=()=>openAccount("register"));
      content.querySelectorAll("[data-v31-account-skip]").forEach((button)=>button.onclick=finishGuest);
      content.querySelectorAll("[data-v31-oauth]").forEach((button)=>button.onclick=()=>{
        markFirstAccountAsked();
        startSocialOauth(button.dataset.v31Oauth);
      });
    });
  }

  function installFirstRunAccountGate() {
    if (typeof runFirstRunOnboarding !== "function" || runFirstRunOnboarding.__v31AccountGate) return;
    const base = runFirstRunOnboarding;
    runFirstRunOnboarding = async function v31RunFirstRunOnboarding(...args) {
      if (!profile?.onboardingComplete) await showFirstAccountGate();
      return base(...args);
    };
    runFirstRunOnboarding.__v31AccountGate = true;
  }

  function ensureSocialButtons() {
    const modal = document.querySelector("#accountModal"), mode = modal?.dataset.mode || "";
    if (!modal || (typeof accountSignedIn === "function" && accountSignedIn()) || !["register","login"].includes(mode)) return;
    const form = document.querySelector("#accountForm");
    if (!form) return;
    let box = document.querySelector(".v30-social-auth,.v31-social-auth");
    if (!box) {
      box = document.createElement("div");
      box.className = "v30-social-auth v31-social-auth";
      box.innerHTML = `<div class="v30-social-divider">или</div>`;
      form.after(box);
    }
    let yandex = box.querySelector("#v30YandexAuth,[data-v31-social='yandex']");
    if (!yandex) {
      yandex = document.createElement("button");
      yandex.type = "button";
      yandex.className = "v31-yandex-auth";
      yandex.dataset.v31Social = "yandex";
      yandex.textContent = "Продолжить через Яндекс";
      box.appendChild(yandex);
    }
    yandex.onclick = () => startSocialOauth("yandex");
    let google = box.querySelector("[data-v31-social='google']");
    if (!google) {
      google = document.createElement("button");
      google.type = "button";
      google.className = "v31-google-auth";
      google.dataset.v31Social = "google";
      google.innerHTML = `<i>G</i><span>Продолжить через Google</span>`;
      box.appendChild(google);
    }
    google.onclick = () => startSocialOauth("google");
  }

  function installSocialAuth() {
    if (typeof renderAccountModal === "function" && !renderAccountModal.__v31Social) {
      const base = renderAccountModal;
      renderAccountModal = function v31RenderAccountModal(...args) {
        const result = base(...args);
        queueMicrotask(ensureSocialButtons);
        return result;
      };
      renderAccountModal.__v31Social = true;
    }
    try {
      const url = new URL(location.href), provider = url.searchParams.get("oauth"), result = url.searchParams.get("oauth_result"), error = url.searchParams.get("oauth_error") || "";
      if (["google","yandex"].includes(provider) && result) {
        if (provider === "google") setTimeout(()=>showToast?.(result === "ok" ? "Google подключён — прогресс синхронизируется" : (error === "oauth_not_configured" ? "Вход через Google ещё не настроен на сервере" : "Не удалось войти через Google")), 900);
        url.searchParams.delete("oauth");
        url.searchParams.delete("oauth_result");
        url.searchParams.delete("oauth_error");
        history.replaceState(history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
    } catch {}
  }

  function worldForChapter(chapter) { return Math.floor((Math.max(1, chapter) - 1) / 10) + 1; }
  function chapterInWorld(chapter) { return ((Math.max(1, chapter) - 1) % 10) + 1; }
  function worldName(world) { return WORLD_NAMES[world - 1] || `Неизведанный мир ${world}`; }
  function chapterLocalName(chapter) { return CHAPTER_NAMES[chapterInWorld(chapter) - 1] || `Глава ${chapterInWorld(chapter)}`; }
  function chapterEarnedStars(chapter) {
    try { return chapterStarsForProfile?.(profile, chapter)?.reduce((sum, value)=>sum + (+value || 0), 0) || 0; } catch { return 0; }
  }
  function worldEarnedStars(world) {
    let sum = 0;
    for (let local = 1; local <= 10; local++) sum += chapterEarnedStars((world - 1) * 10 + local);
    return sum;
  }
  function chapterUnlocked(chapter) {
    const firstLevel = (chapter - 1) * (Number(CHAPTER_SIZE) || 10) + 1;
    return firstLevel <= Math.max(1, Number(profile?.currentLevel) || 1);
  }

  function getWorldPicker() {
    let modal = document.querySelector("#v31WorldPicker");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "v31WorldPicker";
    modal.className = "v31-world-picker";
    modal.hidden = true;
    modal.innerHTML = `<div class="v31-world-picker-card" role="dialog" aria-modal="true" aria-label="Выбор мира и главы">
      <div class="v31-world-picker-head"><div><small>КАМПАНИЯ</small><h2>Миры и главы</h2></div><button type="button" class="v31-world-picker-close" aria-label="Закрыть">×</button></div>
      <div class="v31-world-tabs"></div><div class="v31-world-summary"></div><div class="v31-chapter-grid"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".v31-world-picker-close").onclick = () => { modal.hidden = true; };
    modal.onclick = (event) => { if (event.target === modal) modal.hidden = true; };
    return modal;
  }

  function renderWorldPicker(selectedWorld) {
    const modal = getWorldPicker(), tabs = modal.querySelector(".v31-world-tabs"), grid = modal.querySelector(".v31-chapter-grid"), summary = modal.querySelector(".v31-world-summary");
    const maxUnlockedChapter = Math.max(1, chapterInfo?.(profile?.currentLevel || 1)?.number || 1);
    const totalWorlds = Math.max(WORLD_NAMES.length, worldForChapter(maxUnlockedChapter));
    const currentChapter = Math.max(1, Number(hubChapterNumber) || maxUnlockedChapter);
    const world = Math.max(1, Math.min(totalWorlds, Number(selectedWorld) || worldForChapter(currentChapter)));
    tabs.innerHTML = Array.from({ length: totalWorlds }, (_, index) => {
      const w = index + 1, firstChapter = (w - 1) * 10 + 1, unlocked = firstChapter <= maxUnlockedChapter;
      return `<button type="button" class="v31-world-tab ${w === world ? "active" : ""} ${unlocked ? "" : "locked"}" data-v31-world="${w}"><b>Мир ${w}</b><span>${escapeHtml(worldName(w))} · ${worldEarnedStars(w)}/300 ★</span></button>`;
    }).join("");
    tabs.querySelectorAll("[data-v31-world]").forEach((button)=>button.onclick=()=>renderWorldPicker(+button.dataset.v31World));
    const first = (world - 1) * 10 + 1;
    const last = first + 9;
    const unlockedInWorld = Math.max(0, Math.min(10, maxUnlockedChapter - first + 1));
    summary.textContent = `${worldName(world)} · открыто ${unlockedInWorld}/10 глав · ${worldEarnedStars(world)}/300 ★`;
    grid.innerHTML = Array.from({ length: 10 }, (_, index) => {
      const chapter = first + index, unlocked = chapterUnlocked(chapter), earned = chapterEarnedStars(chapter), selected = chapter === currentChapter;
      return `<button type="button" class="v31-chapter-choice ${selected ? "current" : ""}" data-v31-chapter="${chapter}" ${unlocked ? "" : "disabled"}><b>Глава ${index + 1} · ${escapeHtml(chapterLocalName(chapter))}</b><small>${unlocked ? `Уровни ${(chapter - 1) * (Number(CHAPTER_SIZE)||10) + 1}–${chapter * (Number(CHAPTER_SIZE)||10)}` : "Пока закрыта"}</small><span>${unlocked ? `${earned}/30 ★` : "🔒"}</span></button>`;
    }).join("");
    grid.querySelectorAll("[data-v31-chapter]:not(:disabled)").forEach((button)=>button.onclick=()=>{
      hubChapterNumber = +button.dataset.v31Chapter;
      modal.hidden = true;
      renderHub?.();
      setTimeout(()=>document.querySelector(".chapter-section")?.scrollIntoView?.({ block:"start", behavior:"smooth" }), 30);
    });
    const active = tabs.querySelector(".v31-world-tab.active");
    active?.scrollIntoView?.({ inline:"center", block:"nearest" });
  }

  function openWorldPicker() {
    const modal = getWorldPicker();
    renderWorldPicker(worldForChapter(Math.max(1, Number(hubChapterNumber) || chapterInfo?.(profile?.currentLevel || 1)?.number || 1)));
    modal.hidden = false;
  }

  function bindWorldPickerTriggers() {
    if (hubTab !== "progress") return;
    const targets = [
      ...document.querySelectorAll(".chapter-section .chapter-head > div"),
      ...document.querySelectorAll(".v30-world-banner"),
    ];
    targets.forEach((target) => {
      if (target.dataset.v31PickerBound) return;
      target.dataset.v31PickerBound = "1";
      target.classList.add("v31-chapter-picker-hit");
      target.setAttribute("role", "button");
      target.setAttribute("tabindex", "0");
      target.setAttribute("aria-label", "Выбрать мир и главу");
      target.addEventListener("click", openWorldPicker);
      target.addEventListener("keydown", (event)=>{
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openWorldPicker(); }
      });
    });
  }

  function installWorldPicker() {
    if (typeof renderHub === "function" && !renderHub.__v31WorldPicker) {
      const base = renderHub;
      renderHub = function v31RenderHub(...args) {
        const result = base(...args);
        queueMicrotask(bindWorldPickerTriggers);
        return result;
      };
      renderHub.__v31WorldPicker = true;
    }
    bindWorldPickerTriggers();
  }

  function installAutoUpdate() {
    const removeLegacyUi = () => document.querySelector("#updateBanner")?.remove();
    removeLegacyUi();
    const observer = new MutationObserver(removeLegacyUi);
    if (document.body) observer.observe(document.body, { childList:true, subtree:true });
    if (!("serviceWorker" in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let pending = false, reloading = false;
    const safeToReload = () => {
      try {
        if (document.querySelector("#hub.show")) return true;
        if (typeof activelyPlayingRound === "function" && activelyPlayingRound()) return false;
      } catch {}
      return true;
    };
    const reloadNow = () => {
      if (reloading) return;
      reloading = true;
      try { sessionStorage.removeItem(AUTO_UPDATE_PENDING_KEY); } catch {}
      location.reload();
    };
    const maybeReload = () => {
      if (!pending) return;
      if (safeToReload()) reloadNow();
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      pending = true;
      try { sessionStorage.setItem(AUTO_UPDATE_PENDING_KEY, "1"); } catch {}
      if (safeToReload()) reloadNow();
      else showToast?.("Обновление установится автоматически после выхода в меню");
    });
    try { pending = sessionStorage.getItem(AUTO_UPDATE_PENDING_KEY) === "1"; } catch {}
    if (typeof openHub === "function" && !openHub.__v31AutoUpdate) {
      const base = openHub;
      openHub = function v31OpenHub(...args) {
        const result = base(...args);
        if (pending) setTimeout(maybeReload, 120);
        return result;
      };
      openHub.__v31AutoUpdate = true;
    }
    window.addEventListener("focus", maybeReload);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) maybeReload(); });
    window.addEventListener("load", () => navigator.serviceWorker.ready.then((reg)=>reg.update().catch(()=>{})).catch(()=>{}), { once:true });
  }

  installStyles();
  installFirstRunAccountGate();
  installSocialAuth();
  installWorldPicker();
  installAutoUpdate();
})();
