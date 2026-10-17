import { describe, expect, it } from "vitest";
import { computeXp, levelFromXp, updateStreak } from "@/lib/gamification/rewards";
import { applyAttempt } from "@/lib/learning-engine/apply";
import { createInitialState } from "@/lib/learning-engine/state";
import { dailyPlan, rankActivities } from "@/lib/learning-engine/recommend";

describe("xp", () => {
  it("gives nothing for rushed attempts", () => {
    expect(computeXp({ kind: "reading", score: 1, durationSeconds: 3 }).xp).toBe(0);
  });
  it("scales with quality but rewards genuine attempts with a failing score", () => {
    const hi = computeXp({ kind: "reading", score: 1, durationSeconds: 60 }).xp;
    const lo = computeXp({ kind: "reading", score: 0, durationSeconds: 60 }).xp;
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThan(0);
  });
  it("reduces same-day repeats and rewards improvement", () => {
    const base = computeXp({ kind: "writing", score: 0.8, durationSeconds: 120 }).xp;
    expect(computeXp({ kind: "writing", score: 0.8, durationSeconds: 120, repeatedToday: true }).xp).toBeLessThan(base);
    expect(computeXp({ kind: "writing", score: 0.8, durationSeconds: 120, previousScoreOnActivity: 0.4 }).reasons).toContain("improved");
  });
  it("level curve is monotonic", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(5000).level).toBeGreaterThan(levelFromXp(500).level);
  });
});

describe("streak", () => {
  const base = { current: 5, best: 5, lastActiveDay: "2026-03-10", freezes: 1, freezeEarnedAt: null };
  it("continues on consecutive days", () => expect(updateStreak(base, "2026-03-11").streak.current).toBe(6));
  it("is unchanged on the same day", () => expect(updateStreak(base, "2026-03-10").event).toBe("none"));
  it("uses a freeze for one missed day", () => {
    const r = updateStreak(base, "2026-03-12");
    expect(r.event).toBe("froze");
    expect(r.streak.current).toBe(6);
    expect(r.streak.freezes).toBe(0);
  });
  it("halves (not zeroes) after a long gap and keeps best", () => {
    const r = updateStreak({ ...base, current: 10, best: 10 }, "2026-03-20");
    expect(r.event).toBe("comeback");
    expect(r.streak.current).toBe(5);
    expect(r.streak.best).toBe(10);
  });
  it("earns a freeze every 7 days", () => {
    const r = updateStreak({ ...base, current: 6, freezes: 0 }, "2026-03-11");
    expect(r.streak.current).toBe(7);
    expect(r.streak.freezes).toBe(1);
  });
});

describe("applyAttempt + recommendations", () => {
  const now = new Date("2026-03-10T10:00:00");
  it("updates skills, xp, streak, vocabulary and missions consistently", () => {
    const res = applyAttempt(createInitialState(now), { activityId: "read-a2-market", kind: "reading", skill: "reading", level: "A2", score: 1, durationSeconds: 90, source: "auto-graded", encounteredVocab: ["afford"] }, now);
    expect(res.state.skills.reading.evidence).toBe(1);
    expect(res.state.xp).toBe(res.xpGained);
    expect(res.state.streak.current).toBe(1);
    expect(res.state.vocab.afford.recognition).toBe("encountered");
    expect(res.state.attempts).toHaveLength(1);
    expect(res.newAchievements).toContain("first-step");
  });
  it("does not count a rushed attempt toward the streak", () => {
    const res = applyAttempt(createInitialState(now), { activityId: "read-a2-market", kind: "reading", skill: "reading", level: "A2", score: 1, durationSeconds: 2, source: "auto-graded" }, now);
    expect(res.state.streak.current).toBe(0);
    expect(res.xpGained).toBe(0);
  });
  it("independent use in two activities reaches multi_context", () => {
    let s = createInitialState(now);
    s = applyAttempt(s, { activityId: "write-b1-opinion", kind: "writing", skill: "writing", level: "B1", score: 0.7, durationSeconds: 200, source: "rule-based", independentVocab: ["afford"] }, now).state;
    s = applyAttempt(s, { activityId: "speak-b1-money", kind: "speaking", skill: "speaking", level: "B1", score: 0.7, durationSeconds: 200, source: "rule-based", independentVocab: ["afford"] }, now).state;
    expect(s.vocab.afford.productive).toBe("multi_context");
  });
  it("recommends level-appropriate, varied activities and excludes far-too-hard ones", () => {
    const s = createInitialState(now);
    const ranked = rankActivities(s, now, 10);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((c) => c.activity.level !== "B2")).toBe(true);
    const kinds = dailyPlan(s, now, 12).map((p) => p.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.length).toBeLessThanOrEqual(2);
  });
  it("mini mode plans a single short item", () => {
    expect(dailyPlan(createInitialState(now), now, 4)).toHaveLength(1);
  });
  it("down-weights a just-completed activity", () => {
    let s = createInitialState(now);
    const first = rankActivities(s, now, 10)[0].activity;
    s = applyAttempt(s, { activityId: first.id, kind: first.kind, skill: first.kind, level: first.level, score: 0.8, durationSeconds: 100, source: "auto-graded" }, now).state;
    expect(rankActivities(s, now, 10)[0].activity.id).not.toBe(first.id);
  });
});
