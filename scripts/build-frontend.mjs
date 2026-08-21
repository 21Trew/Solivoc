import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-frontend");
const staticDirs = ["data", "icons", "js", "styles"];
const rootFiles = ["index.html", "admin.html", "sw.js"];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const dir of staticDirs) await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
for (const file of rootFiles) await cp(path.join(root, file), path.join(out, file));
for (const entry of await readdir(root)) {
  if (entry.endsWith(".webmanifest")) await cp(path.join(root, entry), path.join(out, entry));
}
await writeFile(
  path.join(out, "js", "runtime-config.js"),
  '/* Production frontend runtime values. */\nwindow.SOLIVOC_API_BASE = "https://api.solivoc.ru";\n',
  "utf8",
);
console.log(`Frontend bundle generated: ${path.relative(root, out)}`);
