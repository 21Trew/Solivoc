import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "yandex", "api-gateway.beta.template.yaml");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "yandex", "api-gateway.beta.generated.yaml");

const functionId = String(process.env.BETA_YC_FUNCTION_ID || "").trim();
const serviceAccountId = String(process.env.BETA_YC_GATEWAY_INVOKER_SA_ID || "").trim();
const appOrigin = String(process.env.BETA_APP_URL || "").trim().replace(/\/$/, "");

if (!functionId) throw new Error("BETA_YC_FUNCTION_ID is required");
if (!serviceAccountId) throw new Error("BETA_YC_GATEWAY_INVOKER_SA_ID is required");
if (!appOrigin) throw new Error("BETA_APP_URL is required");

const idPattern = /^[a-z0-9]{10,64}$/;
if (!idPattern.test(functionId)) throw new Error("BETA_YC_FUNCTION_ID has invalid format");
if (!idPattern.test(serviceAccountId)) throw new Error("BETA_YC_GATEWAY_INVOKER_SA_ID has invalid format");

let parsedOrigin;
try { parsedOrigin = new URL(appOrigin); } catch { throw new Error("BETA_APP_URL has invalid format"); }
if (parsedOrigin.protocol !== "https:") throw new Error("BETA_APP_URL must use https");
const host = parsedOrigin.hostname.toLowerCase();
if (!host.includes("beta")) throw new Error("BETA_APP_URL hostname must contain beta");
if (["solivoc.ru", "www.solivoc.ru", "admin.solivoc.ru", "api.solivoc.ru"].includes(host)) throw new Error("production hostname is forbidden for beta");

let spec = await readFile(templatePath, "utf8");
spec = spec
  .replaceAll("<FUNCTION_ID>", functionId)
  .replaceAll("<SERVICE_ACCOUNT_ID>", serviceAccountId)
  .replaceAll("<APP_ORIGIN>", parsedOrigin.origin);

for (const marker of ["<FUNCTION_ID>", "<SERVICE_ACCOUNT_ID>", "<APP_ORIGIN>"]) {
  if (spec.includes(marker)) throw new Error(`Beta API Gateway template still contains ${marker}`);
}

if (/https:\/\/(?:www\.|admin\.|api\.)?solivoc\.ru(?:\s|$)/m.test(spec)) {
  throw new Error("production origin leaked into beta gateway specification");
}

await writeFile(outputPath, spec, "utf8");
console.log(`Beta API Gateway specification generated: ${outputPath}`);
