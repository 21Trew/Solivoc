import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/v34-product-update.js", import.meta.url), "utf8");
const iosSource = await readFile(new URL("../js/ios-round-stability-v2.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/v34-product.css", import.meta.url), "utf8");

test("active-round predicate excludes completed and failed rounds", async () => {
  await import(new URL(`../js/v34-product-update.js?stability=${Date.now()}`, import.meta.url));
  const api = globalThis.__solivocV34Test;
  assert.equal(api.isActiveRoundSnapshot({ run:{}, totalCategories:6, rewarded:false, failed:false }), true);
  assert.equal(api.isActiveRoundSnapshot({ run:{}, totalCategories:6, rewarded:true }), false);
  assert.equal(api.isActiveRoundSnapshot({ run:{}, totalCategories:6, failed:true }), false);
});

test("fault checkpoint has one current owner", () => {
  assert.match(source, /window\.addEventListener\("error", emergencyRoundCheckpoint/);
  assert.match(source, /window\.addEventListener\("unhandledrejection", emergencyRoundCheckpoint/);
  assert.doesNotMatch(iosSource, /runtime_fault_checkpoint/);
  assert.doesNotMatch(iosSource, /window\.addEventListener\("error"/);
  assert.doesNotMatch(iosSource, /window\.addEventListener\("unhandledrejection"/);
});

test("constrained undo history remains bounded", () => {
  assert.match(source, /history\.length > 2/);
});

test("mascot switching is blocked during an active round", () => {
  assert.match(source, /Сменить после расклада/);
  assert.match(source, /Напарника можно сменить после расклада/);
  assert.match(source, /state, "mascotLockId"/);
});

test("without a tamed mascot only Menu and Restart layout remains", () => {
  assert.match(source, /for \(const selector of \["#undo", "#hint"\]\)/);
  assert.match(css, /\.controls\.mascot-actions-locked>#undo/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("challenge reward border and chapter dropdown arrow are removed", () => {
  assert.match(css, /\.v32-challenge-reward[\s\S]*border:0!important/);
  assert.match(css, /\.chapter-head \.v32-chapter-trigger::after[\s\S]*content:none!important/);
});
