import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-frontend");
const staticDirs = ["content", "data", "icons", "js", "styles"];
const rootFiles = ["index.html", "admin.html", "about.html", "robots.txt", "sitemap.xml"];
const buildId = String(process.env.GITHUB_SHA || process.env.SOLIVOC_BUILD_ID || "dev")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 12) || "dev";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const dir of staticDirs) {
  await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
}
for (const file of rootFiles) {
  await cp(path.join(root, file), path.join(out, file));
}
for (const entry of await readdir(root)) {
  if (entry.endsWith(".webmanifest")) {
    await cp(path.join(root, entry), path.join(out, entry));
  }
}

async function rewriteDistFile(relativePath, transform) {
  const filePath = path.join(out, relativePath);
  const before = await readFile(filePath, "utf8");
  const after = transform(before);
  if (typeof after !== "string" || !after.length) throw new Error(`Invalid hardening output: ${relativePath}`);
  if (after !== before) await writeFile(filePath, after, "utf8");
  return after;
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Frontend hardening marker missing: ${label}`);
  return source.replace(needle, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) throw new Error(`Frontend hardening range missing: ${label}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

// Legacy product patches predate the current lifecycle/persistence layer. Harden
// the deploy artifact centrally so stale auto-update and watchdog code cannot
// regress iOS stability while those patches are gradually retired from source.
await rewriteDistFile("js/host-routing.js", (source) => {
  source = replaceRequired(
    source,
    '  const APP_ORIGIN = "https://solivoc.ru";\n  const API_ORIGIN = "https://api.solivoc.ru";',
    '  const BETA_HOST = String(window.location.hostname || "").toLowerCase() === "beta.solivoc.ru";\n  const APP_ORIGIN = BETA_HOST ? "https://beta.solivoc.ru" : "https://solivoc.ru";\n  const API_ORIGIN = BETA_HOST ? "https://api-beta.solivoc.ru" : "https://api.solivoc.ru";',
    "host-specific API origin",
  );
  source = replaceRequired(
    source,
    '    setInterval(repairTutorial, 450);\n    document.addEventListener("visibilitychange", () => {\n      if (!document.hidden) setTimeout(repairTutorial, 80);\n    });',
    '    let tutorialRepairTimer = null;\n    const scheduleTutorialRepair = () => {\n      clearTimeout(tutorialRepairTimer);\n      tutorialRepairTimer = null;\n      if (document.hidden) return;\n      try { if (typeof state === "undefined" || state?.mode !== "tutorial") return; } catch { return; }\n      tutorialRepairTimer = setTimeout(() => { repairTutorial(); scheduleTutorialRepair(); }, 900);\n    };\n    repairTutorial();\n    scheduleTutorialRepair();\n    document.addEventListener("visibilitychange", () => {\n      if (document.hidden) { clearTimeout(tutorialRepairTimer); tutorialRepairTimer = null; return; }\n      setTimeout(() => { repairTutorial(); scheduleTutorialRepair(); }, 80);\n    });',
    "tutorial watchdog",
  );
  return source;
});

await rewriteDistFile("js/runtime-config.js", (source) => replaceRequired(
  source,
  '    window.SOLIVOC_API_BASE =\n      !local && /^https?:$/.test(protocol)\n        ? "https://api.solivoc.ru"\n        : "";',
  '    window.SOLIVOC_API_BASE =\n      !local && /^https?:$/.test(protocol)\n        ? (host === "beta.solivoc.ru" ? "https://api-beta.solivoc.ru" : "https://api.solivoc.ru")\n        : "";',
  "runtime beta API",
));

await rewriteDistFile("js/v31-patch.js", (source) => {
  source = source.replace("      #updateBanner{display:none!important}\n", "");
  source = replaceBetween(
    source,
    "  function installAutoUpdate() {",
    "\n\n  installStyles();",
    '  function installAutoUpdate() {\n    // app.js owns update checks and reloads only after explicit user action.\n    // Automatic controllerchange reloads caused beta/PWA tabs to restart while idle.\n    try { sessionStorage.removeItem(AUTO_UPDATE_PENDING_KEY); } catch {}\n  }',
    "v31 auto update",
  );
  return source;
});

await rewriteDistFile("js/v34-product-update.js", (source) => {
  source = replaceBetween(
    source,
    "  /* On iOS/low-memory devices checkpoint every board mutation and keep fewer undo JSON snapshots. */",
    '  if (typeof pushHistory === "function") {',
    '  /* Persistence is already debounced in game/state.js and synchronously flushed\n     on pagehide/freeze/visibility lifecycle events. Do not force localStorage\n     writes after every board mutation on iOS. */\n',
    "v34 immediate-save override",
  );
  source = replaceRequired(
    source,
    '  setInterval(() => {\n    if (document.visibilityState !== "visible" || !activeRound()) return;\n    if (typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode()) emergencyRoundCheckpoint();\n  }, 8000);\n',
    "",
    "v34 eight-second checkpoint",
  );
  return source;
});

await rewriteDistFile("js/narrative/story-dialogue-layer.js", (source) => {
  source = replaceBetween(
    source,
    "  function stabilizeGameplayGuide() {",
    "\n\n  function installFocusSafety() {",
    "",
    "story render stabilizer",
  );
  source = source.replace("    installRenderStabilizer();\n", "");
  source = source.replace("    stabilizeGameplayGuide();\n", "");
  return source;
});

await rewriteDistFile("js/game/feedback.js", (source) => replaceRequired(
  source,
  '  if (!AudioCtor) return null;\n  if (!audioCtx) audioCtx = new AudioCtor();',
  '  if (!AudioCtor) return null;\n  const activation = navigator.userActivation;\n  if (!audioCtx && activation && activation.hasBeenActive === false) return null;\n  if (!audioCtx) audioCtx = new AudioCtor();',
  "audio user activation",
));

await rewriteDistFile("js/api-client.js", (source) => replaceRequired(
  source,
  '    document.addEventListener("click", () => { fetchAlerts(); setTimeout(showNext, 400); }, { passive: true });\n',
  "",
  "per-click developer alert poll",
));

// Build-time SEO metadata keeps the source game shell uncluttered while the
// deployed HTML remains fully crawlable without executing JavaScript.
const indexPath = path.join(out, "index.html");
let indexHtml = await readFile(indexPath, "utf8");
const seoMarker = '<meta name="description" content="Словасьянс';
if (!indexHtml.includes(seoMarker)) {
  const seoHead = `
    <meta name="description" content="Словасьянс — бесплатная игра в ассоциации и словесный пасьянс на русском языке: уровни, ежедневные расклады, дуэли и режимы прямо в браузере." />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://solivoc.ru/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Словасьянс" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content="Словасьянс — пасьянс ассоциаций" />
    <meta property="og:description" content="Собирай связанные слова по категориям, проходи расклады и играй в дуэли с друзьями." />
    <meta property="og:url" content="https://solivoc.ru/" />
    <meta property="og:image" content="https://solivoc.ru/icons/share-duel.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Словасьянс — пасьянс ассоциаций" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Словасьянс — пасьянс ассоциаций" />
    <meta name="twitter:description" content="Бесплатная браузерная игра в слова и ассоциации на русском языке." />
    <meta name="twitter:image" content="https://solivoc.ru/icons/share-duel.png" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://solivoc.ru/#website",
          url: "https://solivoc.ru/",
          name: "Словасьянс",
          alternateName: "Solivoc",
          inLanguage: "ru",
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://solivoc.ru/#game",
          url: "https://solivoc.ru/",
          name: "Словасьянс",
          description: "Бесплатная браузерная игра в ассоциации и словесный пасьянс на русском языке.",
          applicationCategory: "GameApplication",
          operatingSystem: "Web",
          inLanguage: "ru",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
        },
      ],
    })}</script>`;
  indexHtml = indexHtml.replace(/(\s*<title>)/, `${seoHead}$1`);
}

// Product patches are intentionally injected at build time after all core
// modules they extend, but before app.js starts bootstrap. This keeps the
// source HTML clean and guarantees first-run UX hooks are installed in time.
const appScriptTag = '    <script src="./js/app.js"></script>';
const patchScripts = [
  "./js/v30-patch.js",
  "./js/v31-patch.js",
  "./js/v31-first-run-ui.js",
  "./js/v32-ui-fixes.js",
  "./js/v33-fox-journey.js",
  "./js/v34-product-update.js",
  "./js/v39-rarity-collectibles.js",
  "./js/narrative/story-dialogue-layer.js",
  "./js/narrative/story-ux-polish.js",
];
const missingPatchTags = patchScripts
  .filter((src) => !indexHtml.includes(`src="${src}"`))
  .map((src) => `    <script src="${src}"></script>`);
if (missingPatchTags.length) {
  if (!indexHtml.includes(appScriptTag)) throw new Error("index.html is missing app.js script tag");
  indexHtml = indexHtml.replace(appScriptTag, `${missingPatchTags.join("\n")}\n${appScriptTag}`);
}

indexHtml = indexHtml.replace(
  /(<meta name="slovasyans-build" content=")[^"]*(" \/>)/,
  `$1${buildId}$2`,
);
await writeFile(indexPath, indexHtml, "utf8");

// Admin assets get a commit-specific URL without hard-coding dated cache keys
// in the source HTML.
const adminPath = path.join(out, "admin.html");
let adminHtml = await readFile(adminPath, "utf8");
for (const src of ["./js/admin.js", "./js/admin-mail.js", "./styles/admin-mail.css"]) {
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  adminHtml = adminHtml.replace(new RegExp(`(${escaped})(?:\\?v=[^\"]*)?`), `$1?v=${buildId}`);
}
await writeFile(adminPath, adminHtml, "utf8");

// A different sw.js body is emitted for every frontend commit, so every
// deployment creates a distinct PWA cache generation automatically.
let swSource = await readFile(path.join(root, "sw.js"), "utf8");
if (!swSource.includes("__SOLIVOC_BUILD__")) {
  throw new Error("sw.js is missing __SOLIVOC_BUILD__ placeholder");
}
for (const asset of [
  "./js/v39-rarity-collectibles.js",
  "./js/narrative/story-dialogue-layer.js",
  "./js/narrative/story-ux-polish.js",
]) {
  if (swSource.includes(`"${asset}"`)) continue;
  swSource = replaceRequired(
    swSource,
    '  "./js/app.js"\n];',
    `  "${asset}",\n  "./js/app.js"\n];`,
    `service worker core ${asset}`,
  );
}
await writeFile(
  path.join(out, "sw.js"),
  swSource.replaceAll("__SOLIVOC_BUILD__", buildId),
  "utf8",
);

// Fail the build if a known high-risk regression survives hardening.
const stabilityChecks = [
  ["js/v31-patch.js", "location.reload()", false],
  ["js/v31-patch.js", "observer.observe(document.body", false],
  ["js/v34-product-update.js", "}, 8000);", false],
  ["js/host-routing.js", "setInterval(repairTutorial, 450)", false],
  ["js/narrative/story-dialogue-layer.js", "installRenderStabilizer", false],
  ["js/api-client.js", 'document.addEventListener("click", () => { fetchAlerts()', false],
  ["js/host-routing.js", "https://api-beta.solivoc.ru", true],
];
for (const [relativePath, needle, shouldExist] of stabilityChecks) {
  const source = await readFile(path.join(out, relativePath), "utf8");
  const exists = source.includes(needle);
  if (exists !== shouldExist) throw new Error(`Stability contract failed: ${relativePath} :: ${needle}`);
}

console.log(`Frontend bundle generated: ${path.relative(root, out)} (${buildId})`);
