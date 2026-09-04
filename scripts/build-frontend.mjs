import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-frontend");
const staticDirs = ["data", "icons", "js", "styles"];
const rootFiles = ["index.html", "admin.html", "about.html", "robots.txt", "sitemap.xml"];
const buildId = String(process.env.GITHUB_SHA || process.env.SOLIVOC_BUILD_ID || "dev")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 12) || "dev";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const dir of staticDirs) await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
for (const file of rootFiles) await cp(path.join(root, file), path.join(out, file));
for (const entry of await readdir(root)) if (entry.endsWith(".webmanifest")) await cp(path.join(root, entry), path.join(out, entry));

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
        { "@type": "WebSite", "@id": "https://solivoc.ru/#website", url: "https://solivoc.ru/", name: "Словасьянс", alternateName: "Solivoc", inLanguage: "ru" },
        { "@type": "SoftwareApplication", "@id": "https://solivoc.ru/#game", url: "https://solivoc.ru/", name: "Словасьянс", description: "Бесплатная браузерная игра в ассоциации и словесный пасьянс на русском языке.", applicationCategory: "GameApplication", operatingSystem: "Web", inLanguage: "ru", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" } },
      ],
    })}</script>`;
  indexHtml = indexHtml.replace(/(\s*<title>)/, `${seoHead}$1`);
}

const appScriptTag = '    <script src="./js/app.js"></script>';
const patchScripts = [
  "./js/core/scheduler.js",
  "./js/core/lifecycle.js",
  "./js/core/persistence.js",
  "./js/core/pending-events.js",
  "./js/game/engine/core.js",
  "./js/game/engine/controller.js",
  "./js/game/renderer/knowledge-events.js",
  "./js/game/renderer/dirty-zones.js",
  "./js/game/renderer/board-renderer.js",
  "./js/v30-patch.js",
  "./js/v31-patch.js",
  "./js/v31-first-run-ui.js",
  "./js/v32-ui-fixes.js",
  "./js/v33-fox-journey.js",
  "./js/v34-product-update.js",
  "./js/v39-rarity-collectibles.js",
  "./js/persistence-bridge.js",
  "./js/core/account-sync-bridge.js",
  "./js/core/pending-event-sync.js",
  "./js/client-stability-hardening.js",
  "./js/mobile-consistency-hardening.js",
  "./js/cross-device-sync-hardening.js",
  "./js/canonical-sync-hardening.js",
  "./js/core/sync-manager.js",
  "./js/core/update-manager.js",
  "./js/ios-round-stability-v2.js",
  "./js/core/runtime-diagnostics.js",
];
const missingPatchTags = patchScripts
  .filter((src) => !indexHtml.includes(`src="${src}"`))
  .map((src) => `    <script src="${src}"></script>`);
if (missingPatchTags.length) {
  if (!indexHtml.includes(appScriptTag)) throw new Error("index.html is missing app.js script tag");
  indexHtml = indexHtml.replace(appScriptTag, `${missingPatchTags.join("\n")}\n${appScriptTag}`);
}

indexHtml = indexHtml.replace(/(<meta name="slovasyans-build" content=")[^"]*(" \/>)/, `$1${buildId}$2`);
await writeFile(indexPath, indexHtml, "utf8");

// Production app bootstrap must have a single service-worker update owner.
// Keep the legacy source function as a rollback reference, but replace only the
// copied production bundle with a thin facade to SolivocUpdateManager.
const appPath = path.join(out, "js", "app.js");
let appSource = await readFile(appPath, "utf8");
const pwaStart = appSource.indexOf("function registerPwa() {");
const pwaEnd = appSource.indexOf("\n\nlet challengeSyncBusy", pwaStart);
if (pwaStart < 0 || pwaEnd < 0) throw new Error("app.js PWA owner markers not found");
const pwaFacade = `function registerPwa() {\n  return window.SolivocUpdateManager?.start?.();\n}`;
appSource = `${appSource.slice(0, pwaStart)}${pwaFacade}${appSource.slice(pwaEnd)}`;
await writeFile(appPath, appSource, "utf8");

const adminPath = path.join(out, "admin.html");
let adminHtml = await readFile(adminPath, "utf8");
for (const src of ["./js/admin.js", "./styles/admin.css", "./js/admin-mail.js", "./js/admin-recovery.js", "./styles/admin-mail.css", "./styles/admin-recovery.css"]) {
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  adminHtml = adminHtml.replace(new RegExp(`(${escaped})(?:\\?v=[^\"]*)?`), `$1?v=${buildId}`);
}
await writeFile(adminPath, adminHtml, "utf8");

function cleanLocalAsset(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("./")) return "";
  return raw.split(/[?#]/, 1)[0];
}

async function collectCriticalShell(html) {
  const assets = new Set(["./", "./index.html"]);
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
    const asset = cleanLocalAsset(match[1]);
    if (!asset || !/\.(?:js|css)$/i.test(asset)) continue;
    assets.add(asset);
  }

  // Discover boot-time local fetch/import dependencies from the actual JS that
  // the final HTML loads. This keeps data/categories.json in sync without a
  // hand-maintained SW asset list.
  const queue = [...assets].filter((asset) => asset.endsWith(".js"));
  const scanned = new Set();
  while (queue.length) {
    const asset = queue.shift();
    if (!asset || scanned.has(asset)) continue;
    scanned.add(asset);
    const sourcePath = path.join(out, asset.replace(/^\.\//, ""));
    let source = "";
    try { source = await readFile(sourcePath, "utf8"); }
    catch { throw new Error(`critical asset missing from dist: ${asset}`); }
    for (const match of source.matchAll(/(?:fetch|import)\(\s*["'](\.\/[^"]+?)["']/g)) {
      const dependency = cleanLocalAsset(match[1]);
      if (!dependency) continue;
      const dependencyPath = path.join(out, dependency.replace(/^\.\//, ""));
      try { await readFile(dependencyPath); }
      catch { continue; }
      if (!assets.has(dependency)) {
        assets.add(dependency);
        if (dependency.endsWith(".js")) queue.push(dependency);
      }
    }
  }

  return [...assets].sort();
}

const criticalShell = await collectCriticalShell(indexHtml);
const swSource = await readFile(path.join(root, "sw.js"), "utf8");
if (!swSource.includes("__SOLIVOC_BUILD__")) throw new Error("sw.js is missing __SOLIVOC_BUILD__ placeholder");
if (!swSource.includes("__SOLIVOC_CORE__")) throw new Error("sw.js is missing __SOLIVOC_CORE__ placeholder");
const builtSw = swSource
  .replaceAll("__SOLIVOC_BUILD__", buildId)
  .replace("__SOLIVOC_CORE__", JSON.stringify(criticalShell, null, 2));
await writeFile(path.join(out, "sw.js"), builtSw, "utf8");
await writeFile(path.join(out, "critical-shell.json"), JSON.stringify({ build: buildId, assets: criticalShell }, null, 2), "utf8");
console.log(`Frontend bundle generated: ${path.relative(root, out)} (${buildId}; ${criticalShell.length} critical assets)`);
