/* Reusable presentational helpers shared across the hub and retention views. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function progressMeterMarkup(ratio, className = "ui-progress") {
  const value = Math.max(0, Math.min(1, +ratio || 0));
  return `<span class="${className}"><i style="width:${value * 100}%"></i></span>`;
}

function modeCardMarkup({ id, icon, label, className = "", description = "", meta = "" }) {
  const nearest = typeof modeNearestAchievementMarkup === "function" ? modeNearestAchievementMarkup(id) : "";
  return `<button class="mode-card ${className}" data-game-mode="${id}"><i>${icon}</i><b>${escapeHtml(label)}</b><span>${escapeHtml(description)}</span>${meta ? `<em>${escapeHtml(meta)}</em>` : ""}${nearest}</button>`;
}

function statBoxMarkup(value, label) {
  return `<div class="stat-box"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function pillMarkup(icon, title, subtitle = "", className = "") {
  return `<span class="ui-pill ${className}"><i>${icon}</i><span><b>${escapeHtml(title)}</b>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}</span></span>`;
}

/* Production mascot art. The old SVG files remain as safe fallbacks. */
const MASCOT_FORM_ASSETS = Object.freeze({
  owl: Object.freeze([
    "./icons/mascots/owl/owl-1.webp",
    "./icons/mascots/owl/owl-2.webp",
    "./icons/mascots/owl/owl-3.webp",
  ]),
  cat: Object.freeze([
    "./icons/mascots/cat/cat-1.webp",
    "./icons/mascots/cat/cat-2.webp",
    "./icons/mascots/cat/cat-3.webp",
  ]),
  fox: Object.freeze([
    "./icons/mascots/fox/fox-1.webp",
    "./icons/mascots/fox/fox-2.webp",
    "./icons/mascots/fox/fox-3.webp",
    "./icons/mascots/fox/fox-4.webp",
    "./icons/mascots/fox/fox-5.webp",
  ]),
});

const LEGACY_MASCOT_ASSET_IDS = Object.freeze({
  "./icons/mascot-owl.svg": "owl",
  "./icons/mascot-cat.svg": "cat",
  "./icons/mascot-fox.svg": "fox",
});

function mascotFormAssets(defOrId) {
  const id = typeof defOrId === "string" ? defOrId : defOrId?.id;
  return MASCOT_FORM_ASSETS[id] || null;
}

function mascotBossPreviewActive(def, p = profile) {
  if (!def || typeof state === "undefined" || !state?.special?.boss) return false;
  if (state.special.bossCompanionId !== def.id) return false;
  return typeof companionUnlocked !== "function" || !companionUnlocked(def, p);
}

function mascotVisualFormIndex(def, p = profile) {
  const forms = mascotFormAssets(def);
  if (!forms?.length) return 0;
  if (mascotBossPreviewActive(def, p)) return forms.length - 1;

  const raw = p?.mascotProgress?.[def.id] || {};
  const level = Math.max(1, Math.trunc(Number(raw.level) || 1));

  if (forms.length === 5) {
    // Fox: one art form for each of the five mascot levels.
    return Math.min(4, level - 1);
  }

  if (forms.length === 3) {
    // Owl and Cat: early / developed / legendary.
    return level >= 5 ? 2 : level >= 3 ? 1 : 0;
  }

  return Math.min(forms.length - 1, Math.max(0, level - 1));
}
function mascotVisualStage(def, p = profile) {
  const forms = mascotFormAssets(def);
  return forms?.length ? mascotVisualFormIndex(def, p) + 1 : 0;
}

// Override the legacy helper from config.js after profile/runtime are loaded.
companionAsset = function companionAsset(def, p = profile) {
  const forms = mascotFormAssets(def);
  if (forms?.length) return forms[mascotVisualFormIndex(def, p)] || forms[0];
  return def?.image || emojiSvgDataUri(def?.emoji || "✨");
};

function patchLegacyMascotImage(img) {
  if (!(img instanceof HTMLImageElement)) return;
  const id = LEGACY_MASCOT_ASSET_IDS[img.getAttribute("src")];
  if (!id) return;
  const def = typeof entityDef === "function" ? entityDef(id) : null;
  if (!def) return;
  img.src = companionAsset(def);
  if (!img.alt) img.alt = def.name || "";
}

function syncMascotImageAssets(root = document) {
  if (root instanceof HTMLImageElement) patchLegacyMascotImage(root);
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('img[src="./icons/mascot-owl.svg"],img[src="./icons/mascot-cat.svg"],img[src="./icons/mascot-fox.svg"]')
    .forEach(patchLegacyMascotImage);
}

function installMascotAssetObserver() {
  syncMascotImageAssets(document);
  if (typeof MutationObserver === "undefined" || !document.documentElement) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node?.nodeType === 1) syncMascotImageAssets(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

queueMicrotask(installMascotAssetObserver);
