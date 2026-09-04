import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set([".git", "node_modules", "dist-frontend", "yandex-function"]);
const syntaxExtensions = new Set([".js", ".mjs"]);
const scanExtensions = new Set([".js", ".mjs", ".json", ".html", ".webmanifest", ".yml", ".yaml"]);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(full);
  }
}

await walk(root);
const failures = [];
const rel = (file) => path.relative(root, file).replaceAll(path.sep, "/");

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (syntaxExtensions.has(ext)) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`${rel(file)}: syntax error\n${result.stderr || result.stdout}`);
  }
}

const secretPatterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/, "GitHub token"],
  [/\by0_[A-Za-z0-9_-]{20,}\b/, "Yandex OAuth token"],
  [/(?:UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN|POSTBOX_SMTP_PASSWORD|VAPID_PRIVATE_KEY|CRON_SECRET|ADMIN_PASSWORD|ANALYTICS_ADMIN_TOKEN)\s*[:=]\s*["'`][^"'`$]{8,}["'`]/, "hard-coded secret"],
];

const redisEnvMarker = /(?:UPSTASH_REDIS_REST_URL|KV_REST_API_URL|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN)/;
const redisEnvAllowed = new Set(["api/_push-lib.mjs", "api/backup.mjs", "scripts/check-source.mjs"]);
const legacyOriginAllowed = new Set(["js/host-routing.js", "scripts/check-source.mjs"]);

// Stage 9 migration guard. These are the only historical runtime layers that
// may still exist while they are being strangled into normal modules. The
// allow-list must shrink; adding a new patch/hardening file is a source-quality
// failure rather than a new architectural escape hatch.
const legacyRuntimeLayers = new Set([
  "js/v30-patch.js",
  "js/v31-patch.js",
  "js/v31-first-run-ui.js",
  "js/v32-ui-fixes.js",
  "js/v33-fox-journey.js",
  "js/v34-product-update.js",
  "js/v39-rarity-collectibles.js",
  "js/client-stability-hardening.js",
  "js/mobile-consistency-hardening.js",
  "js/cross-device-sync-hardening.js",
  "js/canonical-sync-hardening.js",
  "js/ios-round-stability-v2.js",
]);
const runtimeLayerName = /(?:^|\/)(?:v\d+(?:-[^/]*)?-(?:patch|fixes?|update|journey|collectibles)|[^/]*-(?:patch|hardening))(?:\.js|\.mjs)$/i;
const criticalOverrideNames = [
  "finishLevel",
  "saveProfile",
  "flushAccountSync",
  "loginAccount",
  "restoreAccountSessionOnBoot",
  "render",
  "renderHub",
  "openHub",
  "todayKey",
  "reconcileCampaignProgress",
  "syncLeaderboardNonBlocking",
];
const criticalOverridePattern = new RegExp(`\\b(?:${criticalOverrideNames.join("|")})\\s*=\\s*(?:async\\s+)?function\\b`);
const normalRuntimeModule = (name) => ["js/core/", "js/game/", "js/features/"].some((prefix) => name.startsWith(prefix));

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!scanExtensions.has(ext)) continue;
  const name = rel(file);
  const text = await readFile(file, "utf8");
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(text)) failures.push(`${name}: possible ${label}`);
  }
  if (redisEnvMarker.test(text) && !redisEnvAllowed.has(name)) {
    failures.push(`${name}: Redis credentials must be accessed through api/_push-lib.mjs`);
  }
  if (text.includes("solivoc.vercel.app") && !legacyOriginAllowed.has(name)) {
    failures.push(`${name}: unexpected legacy Vercel origin reference`);
  }

  if (name.startsWith("js/") && runtimeLayerName.test(name) && !legacyRuntimeLayers.has(name)) {
    failures.push(`${name}: new runtime patch/hardening layers are forbidden; use a normal module`);
  }
  // Root-level legacy code is intentionally migrated incrementally. New normal
  // runtime owners live in core/game/features and may not reassign critical
  // globals; they must expose explicit services/hooks instead.
  if (normalRuntimeModule(name) && criticalOverridePattern.test(text)) {
    failures.push(`${name}: critical runtime function override is forbidden; add an explicit module hook instead`);
  }
}

for (const obsolete of ["admin-backup.html", "js/admin-backup.js", "js/admin-20260821.js", "vercel.json"]) {
  try {
    if ((await stat(path.join(root, obsolete))).isFile()) failures.push(`${obsolete}: obsolete deployment file must not be tracked`);
  } catch {}
}

for (const required of ["robots.txt", "sitemap.xml", "about.html"]) {
  try {
    if (!(await stat(path.join(root, required))).isFile()) failures.push(`${required}: required SEO file is missing`);
  } catch {
    failures.push(`${required}: required SEO file is missing`);
  }
}

if (failures.length) {
  console.error("Source quality check failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Source quality check passed: ${files.length} tracked/workspace files inspected.`);
