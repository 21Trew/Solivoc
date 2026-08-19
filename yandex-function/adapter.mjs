import * as account from "./api/account.mjs";
import * as admin from "./api/admin.mjs";
import * as analytics from "./api/analytics.mjs";
import * as auth from "./api/auth.mjs";
import * as bootstrap from "./api/bootstrap.mjs";
import * as challenges from "./api/challenges.mjs";
import * as duelShare from "./api/duel-share.mjs";
import * as leaderboard from "./api/leaderboard.mjs";
import * as push from "./api/push.mjs";
import * as reminders from "./api/reminders.mjs";
import * as version from "./api/version.mjs";

const ROUTES = new Map([
  ["account", account],
  ["admin", admin],
  ["analytics", analytics],
  ["auth", auth],
  ["bootstrap", bootstrap],
  ["challenges", challenges],
  ["leaderboard", leaderboard],
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

function eventMethod(event) {
  return String(event?.requestContext?.http?.method || event?.httpMethod || "GET").toUpperCase();
}

function eventPath(event) {
  return String(event?.rawPath || event?.path || event?.url || "/").split("?")[0] || "/";
}

function eventQuery(event) {
  if (typeof event?.rawQueryString === "string") return event.rawQueryString;
  const params = new URLSearchParams();
  const multi = event?.multiValueQueryStringParameters;
  if (multi && typeof multi === "object") {
    for (const [key, values] of Object.entries(multi)) {
      for (const value of Array.isArray(values) ? values : [values]) if (value != null) params.append(key, String(value));
    }
    return params.toString();
  }
  for (const [key, value] of Object.entries(event?.queryStringParameters || {})) if (value != null) params.set(key, String(value));
  return params.toString();
}

function requestFromEvent(event) {
  const method = eventMethod(event);
  const path = eventPath(event);
  const headers = normalizeHeaders(event?.headers);
  if (Array.isArray(event?.cookies) && event.cookies.length && !headers.has("cookie")) headers.set("cookie", event.cookies.join("; "));
  const sourceIp = event?.requestContext?.http?.sourceIp || event?.requestContext?.identity?.sourceIp || "";
  if (sourceIp && !headers.has("x-forwarded-for")) headers.set("x-forwarded-for", sourceIp);
  const host = headers.get("host") || process.env.API_HOST || "api.solivoc.ru";
  const query = eventQuery(event);
  const url = `https://${host}${path}${query ? `?${query}` : ""}`;
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD" && event?.body != null) {
    init.body = event.isBase64Encoded ? Buffer.from(String(event.body), "base64") : String(event.body);
  }
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

function corsHeaders(request) {
  const origin = corsOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Admin-Key,X-Solivoc-Owner-Token,X-Solivoc-Guest-Token,Authorization",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function preflight(request) {
  if (!corsOrigin(request)) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function routeRequest(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return preflight(request);

  if (url.pathname.startsWith("/d/")) {
    const code = url.pathname.slice(3).split("/")[0];
    const shareUrl = new URL(request.url);
    shareUrl.pathname = "/api/duel-share";
    shareUrl.search = `?c=${encodeURIComponent(code)}`;
    return duelShare.GET(new Request(shareUrl, { method: "GET", headers: request.headers }));
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
  const headers = {};
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") cookies.push(value);
    else headers[key] = value;
  }
  if (typeof response.headers.getSetCookie === "function") {
    const values = response.headers.getSetCookie();
    if (values?.length) cookies.splice(0, cookies.length, ...values);
  }
  Object.assign(headers, corsHeaders(request));
  const body = await response.text();
  const result = {
    statusCode: response.status,
    headers,
    body,
    isBase64Encoded: false,
  };
  if (cookies.length) {
    result.cookies = cookies;
    result.multiValueHeaders = { "Set-Cookie": cookies };
  }
  return result;
}

export async function handler(event) {
  const request = requestFromEvent(event || {});
  try {
    const response = await routeRequest(request);
    return toGatewayResponse(response, request);
  } catch (error) {
    console.error("yandex gateway", error);
    const response = Response.json({ error: "server_error" }, { status: 500 });
    return toGatewayResponse(response, request);
  }
}
