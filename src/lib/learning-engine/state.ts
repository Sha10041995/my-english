import { z } from "zod";
import { SKILLS, type Skill } from "@/types/domain";
import { emptyEstimate, type SkillEstimate } from "./proficiency";
import type { UserVocab } from "@/lib/vocabulary/srs";

export const STATE_VERSION = 1;

const levelSchema = z.enum(["A0", "A1", "A2", "B1", "B2"]);

const estimateSchema = z.object({
  theta: z.number(),
  evidence: z.number(),
  b2Correct: z.number(),
  b2Total: z.number(),
  recent: z.array(z.number()),
  updatedAt: z.string().nullable(),
});

const vocabSchema = z.object({
  itemId: z.string(),
  recognition: z.enum(["unseen", "encountered", "recognized", "recalled"]),
  productive: z.enum(["none", "assisted", "independent", "multi_context"]),
  exposureCount: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  independentUses: z.number(),
  contexts: z.array(z.string()),
  encounterContexts: z.array(z.string()),
  intervalDays: z.number(),
  ease: z.number(),
  lapses: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastSuccessAt: z.string().nullable(),
  nextReviewAt: z.string().nullable(),
});

const attemptSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  kind: z.enum(["reading", "listening", "writing", "speaking", "review", "exam"]),
  skill: z.enum(SKILLS),
  level: levelSchema,
  score: z.number(),
  durationSeconds: z.number(),
  at: z.string(),
  xp: z.number(),
  source: z.enum(["rule-based", "ai", "auto-graded"]),
  /** short, non-sensitive summary – raw learner text is not stored in attempts */
  note: z.string().optional(),
  /** items answered / retrieval count (used by missions) */
  units: z.number().optional(),
  /** tracked vocabulary items used independently in this attempt */
  independentUses: z.number().optional(),
});

const assessmentSchema = z.object({
  id: z.string(),
  type: z.enum(["placement", "mock-exam"]),
  at: z.string(),
  rubricVersion: z.string(),
  responses: z.array(z.object({ itemId: z.string(), choice: z.string().nullable(), correct: z.boolean(), skill: z.enum(SKILLS), level: levelSchema })),
  perSkill: z.record(z.string(), z.object({ level: levelSchema, confidence: z.number(), correct: z.number(), total: z.number() })),
  notes: z.string().optional(),
  sections: z.array(z.object({ name: z.string(), score: z.number(), total: z.number() })).optional(),
});

export const learnerStateSchema = z.object({
  version: z.literal(STATE_VERSION),
  profile: z.object({
    displayName: z.string().max(60),
    explanationLanguage: z.enum(["uz", "en"]),
    goal: z.enum(["conversation", "work", "study", "exam", "travel", "general"]),
    minutesPerDay: z.number().min(3).max(120),
    interests: z.array(z.string()),
    examTarget: z.enum(["none", "generic-b2", "cambridge-b2", "ielts", "other"]),
    correctionIntensity: z.enum(["gentle", "balanced", "detailed"]),
    /** consent to record microphone audio and send it for transcription (revocable in Settings) */
    audioConsent: z.enum(["unknown", "granted", "denied"]).default("unknown"),
    onboarded: z.boolean(),
    createdAt: z.string(),
  }),
  skills: z.record(z.string(), estimateSchema),
  placementDone: z.boolean(),
  placementAt: z.string().nullable(),
  vocab: z.record(z.string(), vocabSchema),
  errors: z.record(z.string(), z.number()),
  attempts: z.array(attemptSchema),
  assessments: z.array(assessmentSchema),
  conversations: z.array(
    z.object({
      id: z.string(),
      activityId: z.string(),
      startedAt: z.string(),
      turns: z.array(z.object({ role: z.enum(["tutor", "learner"]), text: z.string(), source: z.enum(["demo", "ai"]).optional() })),
    }),
  ),
  xp: z.number(),
  xpByDay: z.record(z.string(), z.number()),
  minutesByDay: z.record(z.string(), z.number()),
  streak: z.object({
    current: z.number(),
    best: z.number(),
    lastActiveDay: z.string().nullable(),
    freezes: z.number(),
    freezeEarnedAt: z.string().nullable(),
  }),
  missions: z.object({
    day: z.string().nullable(),
    items: z.array(z.object({ id: z.string(), done: z.boolean() })),
    miniMode: z.boolean(),
  }),
  achievements: z.record(z.string(), z.string()),
  personalBests: z.object({ dailyXp: z.number(), writingScore: z.number(), readingScore: z.number() }),
});

export type LearnerState = z.infer<typeof learnerStateSchema>;
export type Attempt = LearnerState["attempts"][number];
export type AssessmentRecord = LearnerState["assessments"][number];

export function createInitialState(now: Date = new Date()): LearnerState {
  const skills: Record<string, SkillEstimate> = {};
  for (const s of SKILLS) skills[s] = emptyEstimate();
  return {
    version: STATE_VERSION,
    profile: {
      displayName: "",
      explanationLanguage: "uz",
      goal: "general",
      minutesPerDay: 10,
      interests: [],
      examTarget: "none",
      correctionIntensity: "balanced",
      audioConsent: "unknown",
      onboarded: false,
      createdAt: now.toISOString(),
    },
    skills,
    placementDone: false,
    placementAt: null,
    vocab: {},
    errors: {},
    attempts: [],
    assessments: [],
    conversations: [],
    xp: 0,
    xpByDay: {},
    minutesByDay: {},
    streak: { current: 0, best: 0, lastActiveDay: null, freezes: 1, freezeEarnedAt: null },
    missions: { day: null, items: [], miniMode: false },
    achievements: {},
    personalBests: { dailyXp: 0, writingScore: 0, readingScore: 0 },
  };
}

export function estimateOf(state: LearnerState, skill: Skill): SkillEstimate {
  return state.skills[skill] ?? emptyEstimate();
}

export type VocabMap = Record<string, UserVocab>;

/** Validate untrusted persisted/imported state. Returns null when invalid. */
export function parseState(raw: unknown): LearnerState | null {
  const r = learnerStateSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
