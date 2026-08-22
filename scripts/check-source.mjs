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
