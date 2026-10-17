import { LISTENING, READING } from "@/content/activities";
import type { Level, ListeningActivity, McqQuestion, ReadingActivity } from "@/types/domain";

/**
 * Exam formats are configuration. The built-in "generic-b2-practice" format is NOT any official
 * exam; official formats differ in tasks, timing and scoring and must be configured and validated
 * before being offered (see docs/ASSESSMENT.md).
 */
export interface ExamSection {
  id: "reading" | "listening" | "writing";
  minutes: number;
  /** minimum activity level included */
  minLevel: Level;
}

export interface ExamFormat {
  id: string;
  name: string;
  official: false;
  sections: ExamSection[];
  /** thresholds on combined reading+listening percentage for the readiness label */
  thresholds: { consistent: number; approaching: number };
}

export const EXAM_FORMATS: Record<string, ExamFormat> = {
  "generic-b2-practice": {
    id: "generic-b2-practice",
    name: "Generic B2 practice mock (unofficial)",
    official: false,
    sections: [
      { id: "reading", minutes: 15, minLevel: "B1" },
      { id: "listening", minutes: 10, minLevel: "B1" },
      { id: "writing", minutes: 20, minLevel: "B2" },
    ],
    thresholds: { consistent: 0.75, approaching: 0.55 },
  },
};

const order: Level[] = ["A0", "A1", "A2", "B1", "B2"];

export function examReading(format: ExamFormat): ReadingActivity[] {
  const s = format.sections.find((x) => x.id === "reading")!;
  return READING.filter((a) => order.indexOf(a.level) >= order.indexOf(s.minLevel));
}

export function examListening(format: ExamFormat): ListeningActivity[] {
  const s = format.sections.find((x) => x.id === "listening")!;
  return LISTENING.filter((a) => order.indexOf(a.level) >= order.indexOf(s.minLevel));
}

export const allQuestions = (acts: { questions: McqQuestion[] }[]) => acts.flatMap((a) => a.questions);

export interface MockResult {
  readingPct: number;
  listeningPct: number;
  writingPct: number | null;
  readiness: "below" | "approaching" | "consistent";
  /** more mocks → more trustworthy */
  confidence: "low" | "medium";
}

/**
 * Readiness is an estimate from ONE mock's receptive sections (productive skills are rule-based and
 * excluded from the label) and is explicitly separate from estimated CEFR level and any official result.
 */
export function evaluateMock(format: ExamFormat, readingPct: number, listeningPct: number, writingPct: number | null, previousMocks: number): MockResult {
  const combined = (readingPct + listeningPct) / 2;
  const readiness = combined >= format.thresholds.consistent ? "consistent" : combined >= format.thresholds.approaching ? "approaching" : "below";
  return { readingPct, listeningPct, writingPct, readiness, confidence: previousMocks >= 2 ? "medium" : "low" };
}
