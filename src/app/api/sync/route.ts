import { parseState } from "@/lib/learning-engine/state";
import { errorJson, json } from "@/lib/server/http";
import { projectState, USER_TABLES, writeProjection } from "@/lib/server/normalize";
import { authenticate, supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
const MAX_BYTES = 1_500_000;

async function ctx(req: Request) {
  if (!supabaseConfigured()) return { res: errorJson("not_configured", "Accounts are not configured on this server.", 501) } as const;
  const auth = await authenticate(req);
  if (!auth) return { res: errorJson("unauthorized", "Sign in required.", 401) } as const;
  return { auth } as const;
}

/** Load the signed-in user's own snapshot. The user id comes from the verified token, never from the request. */
export async function GET(req: Request) {
  const c = await ctx(req);
  if ("res" in c) return c.res;
  const { data, error } = await c.auth.db.from("learner_snapshots").select("state, updated_at").eq("user_id", c.auth.user.id).maybeSingle();
  if (error) return errorJson("db_error", "Could not load progress.", 500);
  return json({ state: data?.state ?? null, updatedAt: data?.updated_at ?? null });
}

export async function PUT(req: Request) {
  const c = await ctx(req);
  if ("res" in c) return c.res;
  const text = await req.text();
  if (text.length > MAX_BYTES) return errorJson("too_large", "State too large.", 413);
  let body: { state?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson("bad_json", "Invalid JSON.", 400);
  }
  const state = parseState(body.state);
  if (!state) return errorJson("invalid_input", "State did not pass validation.", 400);
  const { error } = await c.auth.db
    .from("learner_snapshots")
    .upsert({ user_id: c.auth.user.id, state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return errorJson("db_error", "Could not save progress.", 500);
  // Derived, idempotent projection into the normalised tables (all under the user's JWT, so RLS applies).
  const projErr = await writeProjection(projectState(c.auth.user.id, state), async (w) => {
    const { error: e } = await c.auth.db.from(w.table).upsert(w.rows, { onConflict: w.onConflict });
    return e ? e.message : null;
  });
  if (projErr) {
    console.error("[sync] projection failed", projErr.split(":")[0]);
    return json({ ok: true, snapshot: true, normalized: false, failedTable: projErr.split(":")[0] });
  }
  return json({ ok: true, snapshot: true, normalized: true });
}

/** Erase the signed-in user's server-side data. */
export async function DELETE(req: Request) {
  const c = await ctx(req);
  if ("res" in c) return c.res;
  for (const table of USER_TABLES) {
    const { error } = await c.auth.db.from(table).delete().eq("user_id", c.auth.user.id);
    if (error) return errorJson("db_error", `Could not delete data (${table}).`, 500);
  }
  const { error } = await c.auth.db.from("profiles").delete().eq("id", c.auth.user.id);
  if (error) return errorJson("db_error", "Could not delete profile.", 500);
  return json({ ok: true });
}
