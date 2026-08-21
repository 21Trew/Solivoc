import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-frontend");
const staticDirs = ["data", "icons", "js", "styles"];
const rootFiles = ["index.html", "admin.html"];
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

// Temporary standalone backup UI is obsolete. Keep production clean even if a
// stale branch still contains these files until the repository cleanup lands.
await rm(path.join(out, "js", "admin-backup.js"), { force: true });
await rm(path.join(out, "js", "admin-20260821.js"), { force: true });

// Admin assets get a commit-specific URL without hard-coding dated cache keys
// in the source HTML.
const adminPath = path.join(out, "admin.html");
const adminHtml = (await readFile(adminPath, "utf8")).replace(
  /(\.\/js\/admin\.js)(?:\?v=[^"]*)?/,
  `$1?v=${buildId}`,
);
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
