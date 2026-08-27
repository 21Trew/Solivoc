import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function requiredHttpsUrl(value, name) {
  const text = String(value || "").trim().replace(/\/$/, "");
  let url;
  try { url = new URL(text); } catch { throw new Error(`${name}_invalid`); }
  if (url.protocol !== "https:") throw new Error(`${name}_must_be_https`);
  return url.toString().replace(/\/$/, "");
}

export function injectBetaRuntime(html, apiBase) {
  if (!/runtime-config\.js/.test(html)) throw new Error("runtime_config_script_missing");
  if (html.includes('id="solivocBetaConfig"')) return html;
  const payload = `<script id="solivocBetaConfig">window.SOLIVOC_BETA=true;window.SOLIVOC_API_BASE=${JSON.stringify(apiBase)};</script>`;
  const next = html.replace(/(<script[^>]+src=["'][^"']*js\/runtime-config\.js[^"']*["'][^>]*><\/script>)/, `${payload}$1`);
  if (next === html) throw new Error("runtime_config_injection_failed");
  return next;
}

export function injectNoIndex(html) {
  if (/name=["']robots["']/i.test(html)) return html;
  if (!/<\/head>/i.test(html)) throw new Error("html_head_missing");
  return html.replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="googlebot" content="noindex,nofollow,noarchive"></head>');
}

export async function prepareBetaFrontend(rootDir, { apiBase, build = "local" } = {}) {
  const root = path.resolve(rootDir);
  const api = requiredHttpsUrl(apiBase, "BETA_API_URL");
  const indexPath = path.join(root, "index.html");
  const index = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(indexPath, injectNoIndex(injectBetaRuntime(index, api)), "utf8");

  for (const name of ["about.html", "admin.html"]) {
    const file = path.join(root, name);
    try {
      const html = await fs.readFile(file, "utf8");
      await fs.writeFile(file, injectNoIndex(html), "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  await fs.writeFile(path.join(root, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
  await fs.writeFile(path.join(root, "beta-build.json"), JSON.stringify({ environment: "beta", apiBase: api, build: String(build || "local") }, null, 2) + "\n", "utf8");
  return { apiBase: api, build: String(build || "local") };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const root = process.argv[2] || "dist-frontend";
  prepareBetaFrontend(root, { apiBase: process.env.BETA_API_URL, build: process.env.GITHUB_SHA || "local" })
    .then(({ apiBase, build }) => console.log(`Beta frontend prepared: ${root} -> ${apiBase} (${build.slice(0, 12)})`))
    .catch((error) => { console.error(error?.stack || error); process.exit(1); });
}
