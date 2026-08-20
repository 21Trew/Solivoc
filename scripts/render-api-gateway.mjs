import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "yandex", "api-gateway.template.yaml");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "yandex", "api-gateway.generated.yaml");

const functionId = String(process.env.YC_FUNCTION_ID || "").trim();
const serviceAccountId = String(process.env.YC_GATEWAY_INVOKER_SA_ID || "").trim();

if (!functionId) throw new Error("YC_FUNCTION_ID is required");
if (!serviceAccountId) throw new Error("YC_GATEWAY_INVOKER_SA_ID is required");

const idPattern = /^[a-z0-9]{10,64}$/;
if (!idPattern.test(functionId)) throw new Error("YC_FUNCTION_ID has invalid format");
if (!idPattern.test(serviceAccountId)) throw new Error("YC_GATEWAY_INVOKER_SA_ID has invalid format");

let spec = await readFile(templatePath, "utf8");
spec = spec
  .replaceAll("<FUNCTION_ID>", functionId)
  .replaceAll("<SERVICE_ACCOUNT_ID>", serviceAccountId);

if (spec.includes("<FUNCTION_ID>") || spec.includes("<SERVICE_ACCOUNT_ID>")) {
  throw new Error("API Gateway template still contains unresolved placeholders");
}

await writeFile(outputPath, spec, "utf8");
console.log(`API Gateway specification generated: ${outputPath}`);
