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

test("v34 does not own round checkpoint scheduling", () => {
  assert.doesNotMatch(source, /v34SafeSave/);
  assert.doesNotMatch(source, /emergencyRoundCheckpoint/);
  assert.doesNotMatch(source, /setInterval\([\s\S]*8000/);
  assert.match(source, /history\.length > 2/);
});

test("iOS stability retains event-driven fault checkpoint", () => {
  assert.match(iosSource, /save\?\.\(\{ immediate: true \}\)/);
  assert.match(iosSource, /window\.addEventListener\("error"/);
  assert.match(iosSource, /window\.addEventListener\("unhandledrejection"/);
  assert.doesNotMatch(iosSource, /setInterval\([\s\S]*8000/);
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
