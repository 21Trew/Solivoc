import { checkRateLimit, currentSession, json, sameOrigin } from "./_auth-lib.mjs";
import { appendSemanticCommand, normalizeSemanticCommand, readSemanticEvents, readSemanticProjection } from "./_semantic-lib.mjs";

export function OPTIONS() { return json({ ok: true }); }

export async function GET(request) {
  try {
    if (!(await checkRateLimit(request, "semantic-read", 240, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const url = new URL(request.url);
    if (url.searchParams.get("projection") === "1") {
      const data = await readSemanticProjection(session.userId, url.searchParams.get("world") || "forest");
      return json({ ok: true, ...data });
    }
    const data = await readSemanticEvents(session.userId, {
      after: url.searchParams.get("after"),
      limit: url.searchParams.get("limit"),
    });
    return json({ ok: true, ...data });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    console.error("semantic-events GET", error);
    return json({ error: "server_error" }, 500);
  }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
    if (!(await checkRateLimit(request, "semantic-write", 180, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const command = normalizeSemanticCommand(session.userId, body);
    const result = await appendSemanticCommand(command);
    return json(result);
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number(error?.status) || 500));
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (status < 500) return json({ error: error?.code || "invalid_request" }, status);
    console.error("semantic-events POST", error);
    return json({ error: "server_error" }, 500);
  }
}
