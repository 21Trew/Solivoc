/* Компактные карточки недельного и месячного испытаний. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocChallengeCards) return;

  function installStyles() {
    if (typeof document === "undefined" || document.querySelector("#challengeCompactStyles")) return;
    const style = document.createElement("style");
    style.id = "challengeCompactStyles";
    style.textContent = `
      .weekly-card.challenge-card-compact{position:relative}
      .challenge-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
      .weekly-card.challenge-card-compact .challenge-card-top>small{min-width:0;margin:0}
      .challenge-reward{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:0;padding:0;border:0;border-radius:0;outline:0;background:transparent;box-shadow:none;color:rgba(242,239,255,.78);font-size:12px;font-weight:950;line-height:1;white-space:nowrap}
      .challenge-progress-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;margin-top:10px}
      .weekly-card.challenge-card-compact .challenge-progress-row .weekly-progress{min-width:0;margin:0}
      .challenge-progress-meta{margin:0!important;color:inherit;font-style:normal;font-size:12px;font-weight:900;line-height:1.1;white-space:nowrap;opacity:.88}
      .challenge-progress-meta.done{color:#ffe08a}
      @media(max-width:520px){
        .challenge-progress-row{gap:9px}
        .challenge-reward{font-size:11px}
        .challenge-progress-meta{font-size:11px}
      }
    `;
    document.head?.appendChild(style);
  }

  function weeklyCardMarkup() {
    const w = weeklyProgress();
    const daysLeft = typeof daysUntilWeekEnd === "function" ? daysUntilWeekEnd() : 0;
    const reward = Math.max(0, Number(w?.def?.rewardXp) || 0);
    const right = w.completed ? `${w.value}/${w.goal} ✓` : `${w.value}/${w.goal}${daysLeft ? ` · ${daysLeft} дн.` : ""}`;
    return `<section class="weekly-card challenge-card-compact ${w.completed ? "done" : ""}">
      <div class="weekly-icon">${w.def.icon}</div>
      <div class="weekly-copy">
        <div class="challenge-card-top"><small>НЕДЕЛЬНОЕ ИСПЫТАНИЕ</small><span class="challenge-reward">+${reward} XP</span></div>
        <b>${w.def.title}</b>
        <span>${w.def.desc}</span>
        <div class="challenge-progress-row"><div class="weekly-progress"><i style="width:${w.ratio * 100}%"></i></div><em class="challenge-progress-meta ${w.completed ? "done" : ""}">${right}</em></div>
      </div>
    </section>`;
  }

  function monthlyCardMarkup() {
    const m = monthlyProgress();
    const daysLeft = typeof daysUntilMonthEnd === "function" ? daysUntilMonthEnd() : 0;
    const reward = Math.max(0, Number(m?.def?.rewardXp) || 0);
    const right = m.completed ? `${m.value}/${m.goal} ✓` : `${m.value}/${m.goal}${daysLeft ? ` · ${daysLeft} дн.` : ""}`;
    return `<section class="weekly-card monthly-card challenge-card-compact ${m.completed ? "done" : ""}">
      <div class="weekly-icon monthly-icon">${m.def.icon}</div>
      <div class="weekly-copy">
        <div class="challenge-card-top"><small>МЕСЯЧНОЕ ИСПЫТАНИЕ</small><span class="challenge-reward">+${reward} XP</span></div>
        <b>${m.def.title}</b>
        <span>${m.def.desc}</span>
        <div class="challenge-progress-row"><div class="weekly-progress"><i style="width:${m.ratio * 100}%"></i></div><em class="challenge-progress-meta ${m.completed ? "done" : ""}">${right}</em></div>
      </div>
    </section>`;
  }

  function install() {
    installStyles();
    if (typeof root.weeklyMarkup === "function") root.weeklyMarkup = weeklyCardMarkup;
    if (typeof root.monthlyMarkup === "function") root.monthlyMarkup = monthlyCardMarkup;
    return true;
  }

  root.SolivocChallengeCards = Object.freeze({ install, weeklyCardMarkup, monthlyCardMarkup });
  if (typeof document !== "undefined") install();
})();
