import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("beta deployment is manual and never targets the Production environment", async () => {
  const workflow = await read(".github/workflows/deploy-beta.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /push:\s*\n/);
  assert.doesNotMatch(workflow, /environment:\s*Production/);
  assert.match(workflow, /environment:\s*Beta/g);
  for (const name of ["BETA_YC_BUCKET", "BETA_YC_FUNCTION_ID", "BETA_YC_GATEWAY_ID", "BETA_YC_SA_ID", "BETA_APP_URL", "BETA_API_URL"]) assert.match(workflow, new RegExp(name));
});

test("beta gateway CORS contains only the injected beta app origin", async () => {
  const template = await read("yandex/api-gateway.beta.template.yaml");
  assert.match(template, /<APP_ORIGIN>/);
  assert.doesNotMatch(template, /https:\/\/(?:www\.|admin\.|api\.)?solivoc\.ru/);
  assert.match(template, /<FUNCTION_ID>/);
  assert.match(template, /<SERVICE_ACCOUNT_ID>/);
});

test("beta render guard rejects production hostnames and requires beta hostname", async () => {
  const source = await read("scripts/render-beta-api-gateway.mjs");
  assert.match(source, /hostname must contain beta/);
  assert.match(source, /production hostname is forbidden for beta/);
  assert.match(source, /BETA_YC_FUNCTION_ID/);
  assert.match(source, /BETA_YC_GATEWAY_INVOKER_SA_ID/);
});

test("beta frontend build injects its API before runtime-config and is noindex", async () => {
  const source = await read("scripts/prepare-beta-frontend.mjs");
  assert.match(source, /window\.SOLIVOC_BETA=true/);
  assert.match(source, /window\.SOLIVOC_API_BASE=/);
  assert.match(source, /noindex,nofollow,noarchive/);
  assert.match(source, /Disallow: \/\\n/);
  assert.match(source, /runtime_config_injection_failed/);
});

test("production deployment workflows remain main-only", async () => {
  for (const file of [".github/workflows/deploy-frontend.yml", ".github/workflows/deploy-backend.yml", ".github/workflows/deploy-gateway.yml"]) {
    const workflow = await read(file);
    assert.match(workflow, /main/);
    assert.doesNotMatch(workflow, /forest-world-campaign/);
  }
});
