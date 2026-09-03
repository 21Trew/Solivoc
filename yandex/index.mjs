import * as account from "../api/account.mjs";
import * as accountLogin from "../api/account-login.mjs";
import * as admin from "../api/admin.mjs";
import * as adminRecovery from "../api/admin-recovery.mjs";
import * as analytics from "../api/analytics.mjs";
import * as auth from "../api/auth.mjs";
import * as backup from "../api/backup.mjs";
import * as bootstrap from "../api/bootstrap.mjs";
import * as challenges from "../api/challenges.mjs";
import * as developerMail from "../api/developer-mail.mjs";
import * as duelShare from "../api/duel-share.mjs";
import * as leaderboard from "../api/leaderboard.mjs";
import * as oauthYandex from "../api/oauth-yandex.mjs";
import * as oauthGoogle from "../api/oauth-google.mjs";
import * as push from "../api/push.mjs";
import * as reminders from "../api/reminders.mjs";
import * as version from "../api/version.mjs";

const ROUTES = new Map([
  ["account", account],
  ["account-login", accountLogin],
  ["admin", admin],
  ["analytics", analytics],
  ["auth", auth],
  ["bootstrap", bootstrap],
  ["challenges", challenges],
  ["developer-mail", developerMail],
  ["leaderboard", leaderboard],
  ["oauth-yandex", oauthYandex],
  ["oauth-google", oauthGoogle],
  ["push", push],
  ["reminders", reminders],
  ["version", version],
]);

function normalizeHeaders(input = {}) {
  const out = new Headers();
  for (const [key, value] of Object.entries(input || {})) {
    if (value == null) continue;
    out.set(key, String(value));
  }
  return out;
}
function eventMethod(event) { return String(event?.requestContext?.http?.method || event?.httpMethod || "GET").toUpperCase(); }
function eventPath(event) { return String(event?.rawPath || event?.path || event?.url || "/").split("?")[0] || "/"; }
function eventQuery(event) {
  if (typeof event?.rawQueryString === "string") return event.rawQueryString;
  const params = new URLSearchParams();
  const multi = event?.multiValueQueryStringParameters;
  if (multi && typeof multi === "object") {
    for (const [key, values] of Object.entries(multi)) for (const value of Array.isArray(values) ? values : [values]) if (value != null) params.append(key, String(value));
    return params.toString();
  }
  for (const [key, value] of Object.entries(event?.queryStringParameters || {})) if (value != null) params.set(key, String(value));
  return params.toString();
}
function requestFromEvent(event) {
  const method = eventMethod(event), path = eventPath(event), headers = normalizeHeaders(event?.headers);
  if (Array.isArray(event?.cookies) && event.cookies.length && !headers.has("cookie")) headers.set("cookie", event.cookies.join("; "));
  const sourceIp = event?.requestContext?.http?.sourceIp || event?.requestContext?.identity?.sourceIp || "";
  if (sourceIp && !headers.has("x-forwarded-for")) headers.set("x-forwarded-for", sourceIp);
  const host = headers.get("host") || process.env.API_HOST || "api.solivoc.ru";
  const query = eventQuery(event), url = `https://${host}${path}${query ? `?${query}` : ""}`;
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD" && event?.body != null) init.body = event.isBase64Encoded ? Buffer.from(String(event.body), "base64") : String(event.body);
  return new Request(url, init);
}
function allowedOrigins() {
  const defaults = ["https://solivoc.ru", "https://www.solivoc.ru", "https://admin.solivoc.ru"];
  const configured = String(process.env.APP_ORIGINS || "").split(",").map((x) => x.trim().replace(/\/$/, "")).filter(Boolean);
  return new Set([...defaults, ...configured]);
}
function corsOrigin(request) {
  const origin = String(request.headers.get("origin") || "").replace(/\/$/, "");
  if (!origin) return "";
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return allowedOrigins().has(origin) ? origin : "";
}
function preflight(request) { return corsOrigin(request) ? new Response(null, { status: 204 }) : Response.json({ error: "origin_not_allowed" }, { status: 403 }); }

async function routeRequest(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return preflight(request);
  if (url.pathname.startsWith("/d/")) {
    const code = url.pathname.slice(3).split("/")[0], shareUrl = new URL(request.url);
    shareUrl.pathname = "/api/duel-share"; shareUrl.search = `?c=${encodeURIComponent(code)}`;
    return duelShare.GET(new Request(shareUrl, { method: "GET", headers: request.headers }));
  }
  if (request.method === "GET" && url.pathname === "/api/admin" && url.searchParams.get("backup") === "1") return backup.GET(request);
  if (url.pathname === "/api/admin/mail") {
    const methodHandler = developerMail[request.method];
    return typeof methodHandler === "function" ? methodHandler(request) : Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (url.pathname === "/api/admin/recovery") {
    const methodHandler = adminRecovery[request.method];
    return typeof methodHandler === "function" ? methodHandler(request) : Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  const match = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/i);
  if (!match) return Response.json({ error: "not_found" }, { status: 404 });
  const module = ROUTES.get(match[1]);
  if (!module) return Response.json({ error: "not_found" }, { status: 404 });
  const methodHandler = module[request.method];
  if (typeof methodHandler !== "function") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: Object.keys(module).filter((key) => /^[A-Z]+$/.test(key)).join(", ") } });
  return methodHandler(request);
}
async function toGatewayResponse(response, request) {
  const headers = {}, cookies = [];
  for (const [key, value] of response.headers.entries()) { if (key.toLowerCase() === "set-cookie") cookies.push(value); else headers[key] = value; }
  if (typeof response.headers.getSetCookie === "function") { const values = response.headers.getSetCookie(); if (values?.length) cookies.splice(0, cookies.length, ...values); }
  const result = { statusCode: response.status, headers, body: await response.text(), isBase64Encoded: false };
  if (cookies.length) { result.cookies = cookies; result.multiValueHeaders = { "Set-Cookie": cookies }; }
  return result;
}
function timerMessage(event) {
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  return messages.find((item) => item?.event_metadata?.event_type === "yandex.cloud.events.serverless.triggers.TimerMessage") || null;
}
async function handleTimerEvent(event) {
  const message = timerMessage(event), payload = String(message?.details?.payload || "").trim();
  if (payload !== "reminders") { console.warn("Ignoring unknown timer payload", payload || "<empty>"); return { ok: true, ignored: true }; }
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) throw new Error("CRON_SECRET is not configured");
  const request = new Request(`https://${process.env.API_HOST || "api.solivoc.ru"}/api/reminders`, { method: "GET", headers: { Authorization: `Bearer ${secret}`, "X-Solivoc-Internal-Trigger": "yandex-timer" } });
  const response = await reminders.GET(request), body = await response.text();
  if (!response.ok) { console.error("Reminder timer failed", response.status, body); throw new Error(`Reminder timer failed with HTTP ${response.status}`); }
  let result = body; try { result = JSON.parse(body); } catch {}
  console.log("Reminder timer completed", result); return { ok: true, result };
}
export async function handler(event) {
  if (timerMessage(event)) return handleTimerEvent(event || {});
  const request = requestFromEvent(event || {});
  try { return toGatewayResponse(await routeRequest(request), request); }
  catch (error) { console.error("yandex gateway", error); return toGatewayResponse(Response.json({ error: "server_error" }, { status: 500 }), request); }
}
