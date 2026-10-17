/**
 * Row Level Security + schema tests on a REAL PostgreSQL engine (PGlite = Postgres compiled to WASM).
 *
 * What this proves: the migrations apply cleanly, constraints hold, the app's projection rows fit the schema,
 * and the RLS policies isolate users, block anon, and keep content tables read-only.
 * What it does NOT prove: Supabase-hosted specifics (PostgREST, GoTrue JWT verification, grants applied by the
 * platform). `auth.users`, `auth.uid()` and the `anon` / `authenticated` roles are stubbed below the same way
 * Supabase defines them (uid() reads the JWT `sub` claim).
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, MISSION_DEFS } from "@/lib/gamification/rewards";
import { scorePlacement, PLACEMENT_SKILLS, type PlacementResponse } from "@/lib/assessment/placement";
import { PLACEMENT_BANK } from "@/content/placement";
import { applyAttempt, applyPlacement, ensureMissions } from "@/lib/learning-engine/apply";
import { createInitialState, type LearnerState } from "@/lib/learning-engine/state";
import { projectState, stableUuid, USER_TABLES, writeProjection, type TableWrite } from "@/lib/server/normalize";

const root = path.resolve(__dirname, "../..");
const sql = (f: string) => readFileSync(path.join(root, "supabase", f), "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let pg: PGlite;

const JSONB = new Set(["responses", "feedback"]);
const ARRAYS = new Set(["contexts"]);

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role ${user ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

/** Same contract as the Supabase upsert used by the API route, executed as the current role. */
async function writer(w: TableWrite): Promise<string | null> {
  const cols = Object.keys(w.rows[0]);
  const conflict = w.onConflict.split(",");
  for (const row of w.rows) {
    const params = cols.map((c) => {
      const v = row[c];
      if (ARRAYS.has(c)) return `{${(v as string[]).map((x) => `"${x}"`).join(",")}}`;
      if (JSONB.has(c)) return JSON.stringify(v);
      return v;
    });
    const placeholders = cols.map((c, i) => `$${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(",");
    const update = cols.filter((c) => !conflict.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ");
    try {
      await pg.query(`insert into public.${w.table} (${cols.join(",")}) values (${placeholders}) on conflict (${conflict.join(",")}) do ${update ? `update set ${update}` : "nothing"}`, params);
    } catch (e) {
      return (e as Error).message;
    }
  }
  return null;
}

function richState(): LearnerState {
  const now = new Date("2026-03-10T10:00:00");
  let s = ensureMissions(createInitialState(now), now);
  s = { ...s, profile: { ...s.profile, displayName: "Aziz", onboarded: true } };
  const responses: PlacementResponse[] = PLACEMENT_BANK.filter((p) => PLACEMENT_SKILLS.includes(p.skill)).slice(0, 12).map((p, i) => ({ itemId: p.id, choice: p.answer, correct: i % 3 !== 0, skill: p.skill, level: p.level }));
  s = applyPlacement(s, scorePlacement(responses, "standard", [], now), now);
  s = applyAttempt(s, { activityId: "read-a2-market", kind: "reading", skill: "reading", level: "A2", score: 0.9, durationSeconds: 100, source: "auto-graded", encounteredVocab: ["afford", "expensive"] }, now).state;
  s = applyAttempt(s, { activityId: "write-b1-opinion", kind: "writing", skill: "writing", level: "B1", score: 0.7, durationSeconds: 200, source: "rule-based", independentVocab: ["afford"], errorTags: ["i-am-agree"] }, now).state;
  s = applyAttempt(s, { activityId: "vocab-review", kind: "review", skill: "vocabulary", level: "A2", score: 1, durationSeconds: 30, source: "auto-graded", retrievals: [{ itemId: "expensive", mode: "recognition", success: true }], units: 1, skipSkillUpdate: true }, now).state;
  return {
    ...s,
    assessments: [...s.assessments, { id: "mock-1", type: "mock-exam", at: now.toISOString(), rubricVersion: "lq-rubric-1.0", responses: [], perSkill: {}, sections: [{ name: "reading", score: 70, total: 100 }] }],
  };
}

const count = async (table: string, where = "true") => Number((await pg.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${where}`)).rows[0].n);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
  `);
  await pg.exec(sql("migrations/0001_init.sql"));
  await pg.exec(sql("migrations/0002_content_in_bundle.sql"));
  await pg.exec(sql("seed.sql"));
  // Platform-style grants: RLS (not grants) must be what protects the data.
  await pg.exec("grant select, insert, update, delete on all tables in schema public to anon, authenticated;");
  await pg.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`);
  // Populate A's data through the same code path the API uses.
  const err = await as(A, () => writeProjection(projectState(A, richState()), writer));
  expect(err).toBeNull();
  // …and a little data for B so we can verify B's rows are untouched by A.
  expect(await as(B, () => writeProjection(projectState(B, createInitialState()), writer))).toBeNull();
  await as(B, () => pg.query("insert into public.learner_snapshots (user_id, state) values ($1, '{}'::jsonb)", [B]));
}, 60_000);

afterAll(async () => {
  await pg.close();
});

describe("schema + migrations", () => {
  it("applies cleanly and enables RLS on every table", async () => {
    const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(r.rows.length).toBeGreaterThanOrEqual(13);
    expect(r.rows.filter((x) => !x.relrowsecurity).map((x) => x.relname)).toEqual([]);
  });

  it("creates a profile automatically for new auth users", async () => {
    expect(await count("profiles", `id = '${A}'`)).toBe(1);
  });

  it("seed covers every achievement and mission id the app can produce", async () => {
    const ach = (await pg.query<{ id: string }>("select id from public.achievements")).rows.map((r) => r.id);
    const mis = (await pg.query<{ id: string }>("select id from public.daily_missions")).rows.map((r) => r.id);
    for (const a of ACHIEVEMENTS) expect(ach).toContain(a.id);
    for (const id of Object.keys(MISSION_DEFS)) expect(mis).toContain(id);
  });

  it("stored the projected data with sane content", async () => {
    expect(await count("skill_progress", `user_id='${A}'`)).toBe(6);
    expect(await count("user_vocabulary", `user_id='${A}'`)).toBeGreaterThanOrEqual(2);
    expect(await count("activity_attempts", `user_id='${A}'`)).toBe(3);
    expect(await count("assessment_attempts", `user_id='${A}'`)).toBe(2);
    expect(await count("user_achievements", `user_id='${A}'`)).toBeGreaterThanOrEqual(1);
    const v = (await pg.query<{ productive_state: string; independent_use_count: number }>(`select productive_state, independent_use_count from public.user_vocabulary where user_id='${A}' and vocabulary_item_id='afford'`)).rows[0];
    expect(v.productive_state).toBe("independent");
    expect(v.independent_use_count).toBe(1);
  });

  it("projection is idempotent (re-sync does not duplicate rows)", async () => {
    const before = await count("activity_attempts", `user_id='${A}'`);
    expect(await as(A, () => writeProjection(projectState(A, richState()), writer))).toBeNull();
    expect(await count("activity_attempts", `user_id='${A}'`)).toBe(before);
    expect(stableUuid(A, "attempt", "x")).toBe(stableUuid(A, "attempt", "x"));
    expect(stableUuid(A, "attempt", "x")).not.toBe(stableUuid(B, "attempt", "x"));
  });

  it("rejects invalid data via constraints", async () => {
    await expect(as(A, () => pg.query("insert into public.activity_attempts (user_id, activity_id, score) values ($1, 'x', 1.5)", [A]))).rejects.toThrow();
    await expect(as(A, () => pg.query("insert into public.skill_progress (user_id, skill, estimated_level) values ($1, 'reading', 'C2') on conflict (user_id, skill) do update set estimated_level='C2'", [A]))).rejects.toThrow();
    await expect(as(A, () => pg.query("update public.profiles set preferred_language='fr' where id=$1", [A]))).rejects.toThrow();
  });
});

describe("row level security", () => {
  const userTables = ["skill_progress", "assessment_attempts", "activity_attempts", "user_vocabulary", "learning_sessions", "user_achievements", "user_missions", "learner_snapshots"];

  it("owners can read their own rows", async () => {
    const n = await as(A, async () => count("activity_attempts"));
    expect(n).toBe(3);
  });

  it.each(userTables)("user B cannot read, update or delete user A's rows in %s", async (table) => {
    const aRows = await count(table, `user_id='${A}'`);
    // reading
    const seen = await as(B, async () => (await pg.query(`select * from public.${table} where user_id='${A}'`)).rows.length);
    expect(seen).toBe(0);
    // updating / deleting affect zero rows
    const upd = await as(B, async () => (await pg.query(`update public.${table} set user_id = user_id where user_id='${A}'`)).affectedRows ?? 0);
    expect(upd).toBe(0);
    const del = await as(B, async () => (await pg.query(`delete from public.${table} where user_id='${A}'`)).affectedRows ?? 0);
    expect(del).toBe(0);
    expect(await count(table, `user_id='${A}'`)).toBe(aRows);
  });

  it("user B cannot insert rows owned by A (WITH CHECK)", async () => {
    await expect(as(B, () => pg.query("insert into public.activity_attempts (user_id, activity_id, score) values ($1, 'read-a2-market', 0.5)", [A]))).rejects.toThrow(/row-level security/i);
    await expect(as(B, () => pg.query("insert into public.user_vocabulary (user_id, vocabulary_item_id) values ($1, 'afford')", [A]))).rejects.toThrow(/row-level security/i);
  });

  it("a user cannot hand their own row to someone else (UPDATE WITH CHECK)", async () => {
    await expect(as(A, () => pg.query("update public.user_missions set user_id=$1 where user_id=$2", [B, A]))).rejects.toThrow(/row-level security/i);
  });

  it("profiles are private and cannot be re-assigned", async () => {
    const seen = await as(B, async () => (await pg.query(`select * from public.profiles where id='${A}'`)).rows.length);
    expect(seen).toBe(0);
    await as(A, () => pg.query("update public.profiles set display_name='Changed' where id=$1", [A]));
    expect((await pg.query<{ display_name: string }>(`select display_name from public.profiles where id='${A}'`)).rows[0].display_name).toBe("Changed");
    await expect(as(A, () => pg.query("update public.profiles set id=$1 where id=$2", [B, A]))).rejects.toThrow(/row-level security|duplicate key/i);
  });

  it("anonymous (no session) sees and writes nothing", async () => {
    for (const t of userTables) {
      expect(await as(null, async () => (await pg.query(`select * from public.${t}`)).rows.length)).toBe(0);
    }
    expect(await as(null, async () => (await pg.query("select * from public.profiles")).rows.length)).toBe(0);
    await expect(as(null, () => pg.query("insert into public.learner_snapshots (user_id, state) values ($1, '{}'::jsonb)", [A]))).rejects.toThrow();
  });

  it("shared content is readable by signed-in users but not writable", async () => {
    expect(await as(A, async () => (await pg.query("select * from public.achievements")).rows.length)).toBeGreaterThanOrEqual(10);
    await expect(as(A, () => pg.query("insert into public.achievements (id, title, description) values ('hack','{}','{}')"))).rejects.toThrow(/row-level security/i);
    const upd = await as(A, async () => (await pg.query("update public.achievements set title='{}'")).affectedRows ?? 0);
    expect(upd).toBe(0);
    const del = await as(A, async () => (await pg.query("delete from public.daily_missions")).affectedRows ?? 0);
    expect(del).toBe(0);
    expect(await as(null, async () => (await pg.query("select * from public.achievements")).rows.length)).toBe(0);
  });

  it("deleting my data removes only my rows (account erasure path)", async () => {
    const bBefore = await count("skill_progress", `user_id='${B}'`);
    await as(A, async () => {
      for (const t of USER_TABLES) await pg.query(`delete from public.${t} where user_id = $1`, [A]);
      await pg.query("delete from public.profiles where id = $1", [A]);
    });
    for (const t of USER_TABLES) expect(await count(t, `user_id='${A}'`)).toBe(0);
    expect(await count("profiles", `id='${A}'`)).toBe(0);
    expect(await count("skill_progress", `user_id='${B}'`)).toBe(bBefore);
    expect(await count("learner_snapshots", `user_id='${B}'`)).toBe(1);
  });
});

describe("harness sensitivity (mutation check)", () => {
  it("would detect broken isolation: a permissive policy leaks rows, removing it closes the leak", async () => {
    const q = () => as(A, async () => (await pg.query(`select * from public.skill_progress where user_id='${B}'`)).rows.length);
    expect(await q()).toBe(0);
    await pg.exec('create policy "mutant" on public.skill_progress for select using (true)');
    expect(await q()).toBeGreaterThan(0);
    await pg.exec('drop policy "mutant" on public.skill_progress');
    expect(await q()).toBe(0);
    // and with RLS switched off entirely the data is exposed, proving enforcement is what protects it
    await pg.exec("alter table public.skill_progress disable row level security");
    expect(await q()).toBeGreaterThan(0);
    await pg.exec("alter table public.skill_progress enable row level security");
    expect(await q()).toBe(0);
  });
});
