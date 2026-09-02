import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/client-stability-hardening.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("frontend bundle loads the client stability guard before app bootstrap", () => {
  assert.match(build, /client-stability-hardening\.js/);
  assert.match(build, /missingPatchTags/);
  assert.match(build, /appScriptTag/);
});

test("profile persistence uses verified backup and emergency snapshots", () => {
  assert.match(source, /worditaire-profile-v7-backup/);
  assert.match(source, /worditaire-profile-v7-emergency/);
  assert.match(source, /profile_write_verify_failed/);
  assert.match(source, /local_write_failed/);
});

test("pending cloud sync survives failed or interrupted requests", () => {
  assert.match(source, /solivoc-account-sync-pending-v1/);
  assert.match(source, /markPending/);
  assert.match(source, /clearPending/);
  assert.match(source, /sync_failed/);
});

test("mobile lifecycle forces local checkpoint and keepalive sync", () => {
  assert.match(source, /pagehide/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /freeze/);
  assert.match(source, /keepalive: true/);
  assert.match(source, /flushProfileSave/);
});

test("transient unauthorized sync is revalidated before logout sticks", () => {
  assert.match(source, /confirmSessionAfterUnauthorized/);
  assert.match(source, /apiFetch\("\/api\/auth"/);
  assert.match(source, /retry_after_transient_401/);
  assert.match(source, /accountState\.status = "signed_in"/);
});
