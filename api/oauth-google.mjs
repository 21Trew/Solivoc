import { randomBytes } from "node:crypto";
import {
  checkRateLimit, cleanEmail, createSession, emailKey, mergeCloudProfile, newUserId,
  readJsonKey, sessionCookie, userKey, writeJsonKey,
} from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";

const STATE_TTL = 10 * 60;
const PROVIDER = "google";

function oauthStateKey(state) { return `worditaire:auth:oauth:${PROVIDER}:state:${String(state || "").slice(0, 160)}`; }
function providerKey(providerId) { return `worditaire:auth:oauth:${PROVIDER}:user:${String(providerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128)}`; }

function allowedAppOrigins() {
  const defaults = ["https://solivoc.ru", "https://www.solivoc.ru"];
  const configured = String(process.env.APP_ORIGINS || "")
    .split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  return new Set([...defaults, ...configured]);
}

function safeReturnTo(value) {
  const fallback = "https://solivoc.ru/";
  try {
    const url = new URL(String(value || fallback));
    const origin = url.origin.replace(/\/$/, "");
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || allowedAppOrigins().has(origin)) return url.toString();
  } catch {}
  return fallback;
}

function callbackUri(request) {
  const configured = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.origin}/api/oauth-google`;
}

function requestSessionCookie(request, token, maxAge) {
  const base = sessionCookie(token, maxAge).replace(/;\s*Secure/gi, "");
  let secure = "";
  try { secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; } catch {}
  return `${base}${secure}`;
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", ...headers } });
}

function redirectResult(returnTo, result, detail = "") {
  const url = new URL(safeReturnTo(returnTo));
  url.searchParams.set("oauth", PROVIDER);
  url.searchParams.set("oauth_result", result);
  if (detail) url.searchParams.set("oauth_error", String(detail).slice(0, 80));
  return url.toString();
}

async function consumeState(state) {
  if (!state || state.length > 160) return null;
  const key = oauthStateKey(state);
  const raw = await redis(["GET", key]);
  if (!raw) return null;
  await redis(["DEL", key]).catch(() => {});
  try { return JSON.parse(raw); } catch { return null; }
}

async function exchangeCode(request, code) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw Object.assign(new Error("oauth_not_configured"), { code: "oauth_not_configured" });
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUri(request),
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) throw Object.assign(new Error(data?.error || "token_exchange_failed"), { code: data?.error || "token_exchange_failed" });
  return String(data.access_token);
}

async function fetchGoogleIdentity(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  const providerId = String(data?.sub || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  const email = cleanEmail(data?.email || "");
  if (!response.ok || !providerId) throw Object.assign(new Error("identity_failed"), { code: "identity_failed" });
  if (!email || data?.email_verified === false) throw Object.assign(new Error("email_required"), { code: "email_required" });
  return { providerId, email };
}

async function resolveUser(identity) {
  const pKey = providerKey(identity.providerId);
  let userId = String(await redis(["GET", pKey]) || "");
  let user = userId ? await readJsonKey(userKey(userId)) : null;
  if (userId && !user) {
    await redis(["DEL", pKey]).catch(() => {});
    userId = "";
  }

  if (!userId) {
    const existingId = String(await redis(["GET", emailKey(identity.email)]) || "");
    if (existingId) {
      const existingUser = await readJsonKey(userKey(existingId));
      if (existingUser) { userId = existingId; user = existingUser; }
      else await redis(["DEL", emailKey(identity.email)]).catch(() => {});
    }
  }

  if (!userId) {
    const candidate = newUserId();
    const reserved = await redis(["SET", emailKey(identity.email), candidate, "NX"]);
    if (!reserved) {
      userId = String(await redis(["GET", emailKey(identity.email)]) || "");
      user = userId ? await readJsonKey(userKey(userId)) : null;
      if (!user) throw new Error("email_reservation_failed");
    } else {
      userId = candidate;
      const now = Date.now();
      user = {
        id: userId,
        email: identity.email,
        passwordHash: "",
        createdAt: now,
        passwordChangedAt: 0,
        sessionVersion: 1,
        authProviders: { [PROVIDER]: identity.providerId },
      };
      try {
        await writeJsonKey(userKey(userId), user);
        await mergeCloudProfile(userId, {}, { preferIncomingPreferences: true });
      } catch (error) {
        await Promise.allSettled([redis(["DEL", emailKey(identity.email)]), redis(["DEL", userKey(userId)])]);
        throw error;
      }
    }
  }

  user ||= await readJsonKey(userKey(userId));
  if (!user) throw new Error("user_not_found");
  user.authProviders = { ...(user.authProviders || {}), [PROVIDER]: identity.providerId };
  user.email = cleanEmail(user.email) || identity.email;
  user.sessionVersion = Math.max(1, Number(user.sessionVersion) || 1);
  await Promise.all([
    writeJsonKey(userKey(userId), user),
    redis(["SET", pKey, userId]),
  ]);
  return { userId, user };
}

export async function GET(request) {
  let returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  try {
    if (!(await checkRateLimit(request, "oauth-google", 30, 900))) return redirect(redirectResult(returnTo, "error", "rate_limited"));
    const url = new URL(request.url);
    const action = String(url.searchParams.get("action") || "");
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) return redirect(redirectResult(returnTo, "error", "oauth_not_configured"));

    if (action === "start") {
      returnTo = safeReturnTo(url.searchParams.get("returnTo"));
      const state = randomBytes(24).toString("base64url");
      await redis(["SET", oauthStateKey(state), JSON.stringify({ returnTo, createdAt: Date.now() }), "EX", STATE_TTL]);
      const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("redirect_uri", callbackUri(request));
      authorize.searchParams.set("scope", "openid email profile");
      authorize.searchParams.set("state", state);
      authorize.searchParams.set("access_type", "online");
      authorize.searchParams.set("include_granted_scopes", "true");
      authorize.searchParams.set("prompt", "select_account");
      return redirect(authorize.toString());
    }

    const state = String(url.searchParams.get("state") || "");
    const stored = await consumeState(state);
    if (!stored) return redirect(redirectResult(returnTo, "error", "invalid_state"));
    returnTo = safeReturnTo(stored.returnTo);
    const providerError = String(url.searchParams.get("error") || "");
    if (providerError) return redirect(redirectResult(returnTo, "error", providerError));
    const code = String(url.searchParams.get("code") || "");
    if (!code) return redirect(redirectResult(returnTo, "error", "missing_code"));

    const accessToken = await exchangeCode(request, code);
    const identity = await fetchGoogleIdentity(accessToken);
    const { userId, user } = await resolveUser(identity);
    const token = await createSession(userId, user.sessionVersion);
    return redirect(redirectResult(returnTo, "ok"), { "Set-Cookie": requestSessionCookie(request, token) });
  } catch (error) {
    console.error("oauth google", error?.code || error?.message || error);
    return redirect(redirectResult(returnTo, "error", error?.code || "server_error"));
  }
}
