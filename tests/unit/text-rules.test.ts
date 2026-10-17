import { describe, expect, it } from "vitest";
import { applyFixes, detectIssues } from "@/lib/assessment/text-rules";
import { demoTutorTurn, ruleBasedWritingFeedback, tutorTurnSchema, writingFeedbackSchema } from "@/lib/assessment/feedback";
import { SPEAKING, WRITING } from "@/content/activities";
import { detectVocabulary } from "@/content/vocabulary";
import { independentUses } from "@/lib/vocabulary/usage";
import { tutorRequestSchema } from "@/lib/validation/schemas";

describe("error rules", () => {
  it.each([
    ["I am agree with you.", "I agree with you."],
    ["I very like music.", "I really like music."],
    ["She go to school.", "She goes to school."],
    ["It depend of the weather.", "It depend on the weather."],
    ["I have 20 years.", "I am 20 years old."],
    ["I didn't went home.", "I didn't go home."],
    ["These informations help.", "These information help."],
  ])("fixes %s", (input, expected) => expect(applyFixes(input)).toBe(expected));

  it("does not flag correct text", () => {
    expect(detectIssues("She goes to school. I can go home. He doesn't like tea.").map((i) => i.ruleId)).toEqual([]);
  });
  it("flags lowercase i", () => expect(detectIssues("yesterday i went home").some((i) => i.ruleId === "lowercase-i")).toBe(true));
});

describe("vocabulary detection", () => {
  it("finds inflected forms and phrases", () => {
    const ids = detectVocabulary("Yesterday I gave it a try, but I could not afford the ticket.").map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(["give-it-a-try", "afford", "ticket"]));
  });
  it("ignores items that merely echo the prompt", () => {
    expect(independentUses("I can't afford a car.", "Tell me what you can't afford.")).toEqual([]);
    expect(independentUses("I can't afford a car.", "Tell me about cars.")).toContain("afford");
  });
});

describe("feedback", () => {
  it("rule-based writing feedback is schema-valid and flags source", () => {
    const fb = ruleBasedWritingFeedback("I think learning with a teacher is useful because she go slowly. However, I am agree that apps help.", WRITING.find((w) => w.id === "write-b1-opinion")!);
    expect(writingFeedbackSchema.safeParse(fb).success).toBe(true);
    expect(fb.source).toBe("rule-based");
    expect(fb.corrections.length).toBeGreaterThan(0);
    expect(fb.overall).toBeGreaterThan(0);
    expect(fb.overall).toBeLessThanOrEqual(1);
  });
  it("tutor limits corrections by intensity and never invents pronunciation data", () => {
    const text = "I am agree. She go home. I very like it. I have 20 years. It depend of you.";
    const act = SPEAKING[0];
    const gentle = demoTutorTurn({ activity: act, learnerText: text, turnIndex: 0, intensity: "gentle", explanationLanguage: "uz" });
    const detailed = demoTutorTurn({ activity: act, learnerText: text, turnIndex: 0, intensity: "detailed", explanationLanguage: "uz" });
    expect(gentle.corrections).toHaveLength(1);
    expect(detailed.corrections.length).toBeGreaterThan(gentle.corrections.length);
    expect(tutorTurnSchema.safeParse(gentle).success).toBe(true);
    expect(JSON.stringify(gentle)).not.toMatch(/pronunciation/i);
    expect(gentle.source).toBe("demo");
  });
});

describe("input validation", () => {
  it("rejects empty / oversized tutor input", () => {
    expect(tutorRequestSchema.safeParse({ activityId: "a", learnerText: "" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ activityId: "a", learnerText: "x".repeat(5000) }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ activityId: "a", learnerText: "hello", intensity: "extreme" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ activityId: "a", learnerText: "hello" }).success).toBe(true);
  });
});
