#!/usr/bin/env node
/**
 * Smoke test against YOUR hosted Supabase project (real PostgREST + real JWTs + real RLS).
 *   1. Fill .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (anon key only).
 *   2. In Supabase dashboard: Authentication → Providers → Email → turn OFF "Confirm email" (temporarily).
 *   3. node scripts/smoke-supabase.mjs
 * It creates two throw-away users (smoke-*@example.com), checks isolation, cleans up their rows and exits non-zero on failure.
 * Delete the two test users afterwards in Authentication → Users (needs the dashboard; the anon key cannot delete users).
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (put them in .env.local).");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  → ${detail}` : ""}`);
};
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function user(label) {
  const c = mk();
  const email = `smoke-${label}-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw new Error(`signUp failed: ${error.message}`);
  if (!data.session) throw new Error('No session returned – disable "Confirm email" in Authentication → Providers → Email, then re-run.');
  return { c, id: data.user.id };
}

const state = { version: 1 };
let A, B;
try {
  A = await user("a");
  B = await user("b");
  const anon = mk();

  // ---- A writes its own data
  const own = await A.c.from("learner_snapshots").upsert({ user_id: A.id, state }, { onConflict: "user_id" });
  check("A can write own snapshot", !own.error, own.error?.message);
  const prof = await A.c.from("profiles").select("id").eq("id", A.id);
  check("signup trigger created A's profile", prof.data?.length === 1, prof.error?.message);
  const upd = await A.c.from("profiles").update({ display_name: "Smoke A" }).eq("id", A.id).select();
  check("A can update own profile", upd.data?.length === 1, upd.error?.message);
  const vocab = await A.c.from("user_vocabulary").upsert({ user_id: A.id, vocabulary_item_id: "afford", recognition_state: "recognized", productive_state: "none" }, { onConflict: "user_id,vocabulary_item_id" });
  check("A can write own vocabulary row", !vocab.error, vocab.error?.message);
  const att = await A.c.from("activity_attempts").insert({ user_id: A.id, activity_id: "read-a2-market", score: 0.8, duration_seconds: 60 });
  check("A can write own attempt (no FK on content ids)", !att.error, att.error?.message);

  // ---- B cannot touch A
  for (const t of ["learner_snapshots", "user_vocabulary", "activity_attempts"]) {
    const r = await B.c.from(t).select("*").eq("user_id", A.id);
    check(`B cannot read A's ${t}`, !r.error && r.data.length === 0, r.error?.message ?? `${r.data?.length} rows leaked`);
  }
  const bp = await B.c.from("profiles").select("id").eq("id", A.id);
  check("B cannot read A's profile", !bp.error && bp.data.length === 0);
  const bUpd = await B.c.from("user_vocabulary").update({ lapses: 99 }).eq("user_id", A.id).select();
  check("B cannot update A's rows", !bUpd.error && bUpd.data.length === 0);
  const bDel = await B.c.from("activity_attempts").delete().eq("user_id", A.id).select();
  check("B cannot delete A's rows", !bDel.error && bDel.data.length === 0);
  const bIns = await B.c.from("activity_attempts").insert({ user_id: A.id, activity_id: "x", score: 0.1 });
  check("B cannot insert rows as A", !!bIns.error);
  const still = await A.c.from("activity_attempts").select("id").eq("user_id", A.id);
  check("A's data is intact afterwards", still.data?.length === 1);

  // ---- anon & content
  const an = await anon.from("learner_snapshots").select("*");
  check("anonymous client sees no user data", !an.error && an.data.length === 0, an.error?.message);
  const anIns = await anon.from("learner_snapshots").insert({ user_id: A.id, state });
  check("anonymous client cannot insert", !!anIns.error);
  const ach = await A.c.from("achievements").select("id");
  check("signed-in user can read seeded achievements (seed.sql applied)", (ach.data?.length ?? 0) >= 10, ach.error?.message ?? `${ach.data?.length} rows – run supabase/seed.sql`);
  const achW = await A.c.from("achievements").insert({ id: "hack", title: {}, description: {} });
  check("signed-in user cannot write content tables", !!achW.error);
} catch (e) {
  check("setup", false, e.message);
} finally {
  // best-effort cleanup of rows (the auth users themselves must be removed in the dashboard)
  for (const u of [A, B].filter(Boolean)) {
    for (const t of ["activity_attempts", "user_vocabulary", "learner_snapshots"]) await u.c.from(t).delete().eq("user_id", u.id);
    await u.c.from("profiles").delete().eq("id", u.id);
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.${failed ? " FAILURES above." : ""}`);
process.exit(failed ? 1 : 0);
