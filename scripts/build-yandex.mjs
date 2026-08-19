import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "yandex-function");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, "api"), path.join(out, "api"), { recursive: true });

const adapter = (await readFile(path.join(root, "yandex", "index.mjs"), "utf8"))
  .replaceAll('"../api/', '"./api/');
await writeFile(path.join(out, "adapter.mjs"), adapter, "utf8");
await writeFile(path.join(out, "index.js"), `let adapterPromise;\nmodule.exports.handler = async function handler(event, context) {\n  adapterPromise ||= import("./adapter.mjs");\n  const adapter = await adapterPromise;\n  return adapter.handler(event, context);\n};\n`, "utf8");

const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const functionPackage = {
  name: "slovasyans-yandex-function",
  private: true,
  dependencies: rootPackage.dependencies || {},
};
await writeFile(path.join(out, "package.json"), JSON.stringify(functionPackage, null, 2) + "\n", "utf8");
console.log(`Yandex function bundle generated: ${path.relative(root, out)}`);
