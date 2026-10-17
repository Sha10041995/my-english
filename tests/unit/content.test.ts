import { describe, expect, it } from "vitest";
import { ACTIVITIES } from "@/content/activities";
import { PLACEMENT_BANK } from "@/content/placement";
import { VOCABULARY, VOCAB_BY_ID, detectVocabulary } from "@/content/vocabulary";
import { LEVELS } from "@/types/domain";

describe("content integrity", () => {
  it("has unique ids everywhere", () => {
    for (const ids of [VOCABULARY.map((v) => v.id), ACTIVITIES.map((a) => a.id), PLACEMENT_BANK.map((p) => p.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
    const qs = ACTIVITIES.flatMap((a) => ("questions" in a ? a.questions.map((x) => x.id) : []));
    expect(new Set(qs).size).toBe(qs.length);
  });

  it("every activity references existing vocabulary and has Uzbek + English objectives", () => {
    for (const a of ACTIVITIES) {
      for (const id of a.vocab) expect(VOCAB_BY_ID[id], `${a.id} → ${id}`).toBeDefined();
      expect(a.objectives.en.length).toBeGreaterThan(5);
      expect(a.objectives.uz.length).toBeGreaterThan(5);
    }
  });

  it("every question has a valid answer and an explanation in both languages", () => {
    for (const a of ACTIVITIES) {
      if (!("questions" in a)) continue;
      for (const q of a.questions) {
        expect(q.choices.some((c) => c.id === q.answer), q.id).toBe(true);
        expect(q.explanation.en && q.explanation.uz, q.id).toBeTruthy();
      }
    }
  });

  it("vocabulary entries are complete and their example contains one of their own forms", () => {
    for (const v of VOCABULARY) {
      expect(v.meaningUz && v.meaningEn && v.example, v.id).toBeTruthy();
      expect(v.forms.length, v.id).toBeGreaterThan(0);
      expect(detectVocabulary(v.example, [v]).length, `${v.id}: example should contain a listed form`).toBe(1);
    }
  });

  it("covers every level for each module and enough breadth overall", () => {
    for (const kind of ["reading", "listening", "writing", "speaking"] as const) {
      const levels = new Set(ACTIVITIES.filter((a) => a.kind === kind).map((a) => a.level));
      expect(levels.has("A1") && levels.has("B1") && levels.has("B2"), kind).toBe(true);
    }
    expect(VOCABULARY.length).toBeGreaterThanOrEqual(90);
    for (const lv of LEVELS.slice(1)) expect(VOCABULARY.filter((v) => v.level === lv).length).toBeGreaterThanOrEqual(8);
    expect(PLACEMENT_BANK.length).toBeGreaterThanOrEqual(36);
    for (const skill of ["vocabulary", "grammar", "reading", "listening"]) {
      for (const lv of ["A1", "A2", "B1", "B2"]) {
        expect(PLACEMENT_BANK.some((p) => p.skill === skill && p.level === lv), `${skill}/${lv}`).toBe(true);
      }
    }
  });
});
