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
const swSource = await readFile(path.join(root, "sw.js"), "utf8");
if (!swSource.includes("__SOLIVOC_BUILD__")) {
  throw new Error("sw.js is missing __SOLIVOC_BUILD__ placeholder");
}
await writeFile(
  path.join(out, "sw.js"),
  swSource.replaceAll("__SOLIVOC_BUILD__", buildId),
  "utf8",
);

console.log(`Frontend bundle generated: ${path.relative(root, out)} (${buildId})`);
