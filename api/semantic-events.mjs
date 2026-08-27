import { checkRateLimit, currentSession, json, sameOrigin } from "./_auth-lib.mjs";
import { appendSemanticCommand, normalizeSemanticCommand, readSemanticEvents } from "./_semantic-lib.mjs";
import { advanceForestProjectionCache, ensureForestProjection } from "./_forest-projection-store.mjs";

export function OPTIONS() { return json({ ok: true }); }

function routingProjectionView(projection) {
  return {
    world_id: projection?.world_id || "forest",
    source_sequence: Math.max(0, Number(projection?.source_sequence) || 0),
    projection_version: Math.max(0, Number(projection?.projection_version) || 0),
    routing_snapshot: projection?.routing_snapshot && typeof projection.routing_snapshot === "object"
      ? projection.routing_snapshot
      : {},
    encounters: {
      completed_ids: Array.isArray(projection?.encounters?.completed_ids)
        ? projection.encounters.completed_ids
        : [],
    },
  };
}

export async function GET(request) {
  try {
    if (!(await checkRateLimit(request, "semantic-read", 240, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const url = new URL(request.url);
    if (url.searchParams.get("projection") === "1") {
      const data = await ensureForestProjection(session.userId);
      // Client Story routing receives only the explainable routing view.
      // Hidden KnowledgeProjection/backend subject refs never cross this boundary.
      return json({
        ok: true,
        projection: routingProjectionView(data.projection),
        version: data.version,
        rebuilt: data.rebuilt,
        mode: data.mode,
      });
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

    let projection = { ok: false, error: "projection_not_updated" };
    try {
      const projected = result.replayed === true
        ? await ensureForestProjection(session.userId)
        : await advanceForestProjectionCache(session.userId, result.accepted || []);
      projection = {
        ok: true,
        sourceSequence: Number(projected.projection?.source_sequence) || 0,
        projectionVersion: Number(projected.projection?.projection_version) || projected.version || 0,
        rebuilt: projected.rebuilt === true,
        mode: projected.mode,
      };
    } catch (projectionError) {
      // Canonical append-only history wins. Projection is rebuildable and may repair on the next GET/write.
      console.error("semantic projection update", projectionError);
      projection = { ok: false, error: "projection_update_failed" };
    }

    return json({ ...result, projection });
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number(error?.status) || 500));
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (status < 500) return json({ error: error?.code || "invalid_request" }, status);
    console.error("semantic-events POST", error);
    return json({ error: "server_error" }, 500);
  }
}
