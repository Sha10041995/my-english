import { describe, expect, it } from "vitest";
import { confidence, difficultyAdjustment, emptyEstimate, reportedLevel, updateEstimate } from "@/lib/learning-engine/proficiency";
import { nextPlacementItem, scorePlacement, type PlacementResponse } from "@/lib/assessment/placement";
import { PLACEMENT_BANK } from "@/content/placement";

describe("proficiency", () => {
  it("correct hard answers raise theta, wrong ones lower it", () => {
    const up = updateEstimate(emptyEstimate(), "B1", 1);
    const down = updateEstimate(emptyEstimate(), "B1", 0);
    expect(up.theta).toBeGreaterThan(0.8);
    expect(down.theta).toBeLessThan(0.8);
  });

  it("never reports B2 without enough B2 evidence", () => {
    let e = emptyEstimate(3.8);
    for (let i = 0; i < 6; i++) e = updateEstimate(e, "B1", 1);
    expect(reportedLevel(e)).not.toBe("B2");
    for (let i = 0; i < 4; i++) e = updateEstimate(e, "B2", 1);
    expect(reportedLevel(e)).toBe("B2");
  });

  it("caps level with little evidence and reports A0 with none", () => {
    expect(reportedLevel(emptyEstimate(3.5))).toBe("A0");
    const e = updateEstimate(emptyEstimate(3.5), "B1", 1);
    expect(["A0", "A1"]).toContain(reportedLevel(e));
  });

  it("confidence is bounded below 1 and grows with evidence", () => {
    let e = emptyEstimate();
    const c0 = confidence(e);
    for (let i = 0; i < 50; i++) e = updateEstimate(e, "A2", 1);
    expect(confidence(e)).toBeGreaterThan(c0);
    expect(confidence(e)).toBeLessThanOrEqual(0.9);
  });

  it("scaffold after repeated failure, stretch after sustained success", () => {
    let e = emptyEstimate();
    e = updateEstimate(updateEstimate(e, "A2", 0.2), "A2", 0.3);
    expect(difficultyAdjustment(e)).toBe("scaffold");
    let f = emptyEstimate();
    for (let i = 0; i < 3; i++) f = updateEstimate(f, "A2", 0.95);
    expect(difficultyAdjustment(f)).toBe("stretch");
  });
});

describe("placement", () => {
  const answerAll = (correct: (i: number) => boolean, entry: "beginner" | "standard" = "standard") => {
    const responses: PlacementResponse[] = [];
    for (;;) {
      const item = nextPlacementItem(responses, entry);
      if (!item) break;
      responses.push({ itemId: item.id, choice: item.answer, correct: correct(responses.length), skill: item.skill, level: item.level });
    }
    return responses;
  };

  it("never repeats an item and stops at the configured length", () => {
    const r = answerAll(() => true);
    expect(new Set(r.map((x) => x.itemId)).size).toBe(r.length);
    expect(r.length).toBeLessThanOrEqual(16);
  });

  it("adapts: strong answers reach harder items than weak answers", () => {
    const strong = answerAll(() => true);
    const weak = answerAll(() => false);
    const avg = (rs: PlacementResponse[]) => rs.reduce((s, r) => s + ["A0", "A1", "A2", "B1", "B2"].indexOf(r.level), 0) / rs.length;
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });

  it("beginner path stops early after four wrong answers", () => {
    expect(answerAll(() => false, "beginner").length).toBe(4);
  });

  it("all-correct run is still provisional and speaking is not assessed", () => {
    const out = scorePlacement(answerAll(() => true), "standard", []);
    expect(out.record.perSkill.speaking.confidence).toBe(0);
    expect(out.overallConfidence).toBeLessThanOrEqual(0.9);
    expect(out.record.notes).toMatch(/Provisional/);
  });

  it("a handful of B2 multiple-choice answers does not make a learner B2", () => {
    const b2 = PLACEMENT_BANK.filter((p) => p.level === "B2").slice(0, 3);
    const r: PlacementResponse[] = b2.map((p) => ({ itemId: p.id, choice: p.answer, correct: true, skill: p.skill, level: p.level }));
    expect(scorePlacement(r, "standard", []).overall).not.toBe("B2");
  });

  it("bank items have required metadata and a valid answer", () => {
    for (const p of PLACEMENT_BANK) {
      expect(p.choices.some((c) => c.id === p.answer)).toBe(true);
      expect(Boolean(p.explanation.en && p.explanation.uz)).toBe(true);
    }
  });
});
