import { dayKey, type LearnerState } from "@/lib/learning-engine/state";
import type { Localized } from "@/types/domain";

// ------------------------------------------------------------------ XP
export type AttemptKind = "reading" | "listening" | "writing" | "speaking" | "review" | "exam";

const BASE_XP: Record<AttemptKind, number> = { reading: 15, listening: 15, writing: 25, speaking: 20, review: 6, exam: 40 };
/** Minimum seconds before an attempt can earn XP (guards against click-through guessing). */
const MIN_SECONDS: Record<AttemptKind, number> = { reading: 20, listening: 15, writing: 45, speaking: 20, review: 5, exam: 120 };
const MAX_XP = 60;

export interface XpInput {
  kind: AttemptKind;
  /** 0..1 quality of the attempt */
  score: number;
  durationSeconds: number;
  /** retrievals (review/units) – extra reward only for successful retrieval */
  successfulRetrievals?: number;
  repeatedToday?: boolean;
  previousScoreOnActivity?: number | null;
  independentUses?: number;
}

export interface XpResult {
  xp: number;
  reasons: string[];
}

/**
 * XP rewards effort that produced evidence of learning:
 *  - scaled by quality (never zero for a genuine try, so failure isn't punished harshly),
 *  - nothing for rushed attempts,
 *  - reduced for same-day repeats,
 *  - bonus for improving after feedback, for retrieval and for independent use.
 */
export function computeXp(input: XpInput): XpResult {
  const reasons: string[] = [];
  if (input.durationSeconds < MIN_SECONDS[input.kind]) return { xp: 0, reasons: ["too-fast"] };
  let xp = BASE_XP[input.kind] * (0.4 + 0.6 * Math.max(0, Math.min(1, input.score)));
  if (input.repeatedToday) {
    xp *= 0.25;
    reasons.push("repeat");
  }
  if (input.previousScoreOnActivity != null && input.score >= input.previousScoreOnActivity + 0.15) {
    xp += 5;
    reasons.push("improved");
  }
  if (input.successfulRetrievals) {
    xp += Math.min(10, input.successfulRetrievals);
    reasons.push("retrieval");
  }
  if (input.independentUses) {
    xp += Math.min(10, input.independentUses * 4);
    reasons.push("independent-use");
  }
  return { xp: Math.min(MAX_XP, Math.round(xp)), reasons };
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let needed = 100;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = 100 + (level - 1) * 40;
  }
  return { level, into: remaining, needed };
}

// -------------------------------------------------------------- streaks
export interface StreakState {
  current: number;
  best: number;
  lastActiveDay: string | null;
  freezes: number;
  freezeEarnedAt: string | null;
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);

export interface StreakResult {
  streak: StreakState;
  event: "none" | "continued" | "started" | "froze" | "comeback";
}

/**
 * Recovery-friendly streak:
 *  - consecutive day → +1
 *  - exactly one missed day with a freeze available → freeze is spent, streak continues
 *  - longer gap → streak is halved (min 1) instead of reset to zero ("comeback"); best streak is kept
 *  - one freeze is earned for every 7 days of streak (max 2 stored)
 */
export function updateStreak(prev: StreakState, today: string): StreakResult {
  if (prev.lastActiveDay === today) return { streak: prev, event: "none" };
  let { current, freezes } = prev;
  let event: StreakResult["event"] = "continued";
  if (prev.lastActiveDay === null) {
    current = 1;
    event = "started";
  } else {
    const gap = daysBetween(prev.lastActiveDay, today);
    if (gap === 1) current += 1;
    else if (gap === 2 && freezes > 0) {
      freezes -= 1;
      current += 1;
      event = "froze";
    } else if (gap > 1) {
      current = Math.max(1, Math.floor(current / 2));
      event = "comeback";
    }
  }
  if (current % 7 === 0 && current > 0 && current !== prev.current) freezes = Math.min(2, freezes + 1);
  return {
    streak: { current, best: Math.max(prev.best, current), lastActiveDay: today, freezes, freezeEarnedAt: prev.freezeEarnedAt },
    event,
  };
}

// ------------------------------------------------------------- missions
export interface MissionDef {
  id: string;
  title: Localized;
  xp: number;
  minutes: number;
  /** progress 0..1 derived from the learner's activity today */
  progress: (state: LearnerState, day: string) => number;
  route: string;
}

/** Rushed attempts (0 XP) do not count toward missions. */
const todaysAttempts = (state: LearnerState, day: string) => state.attempts.filter((a) => a.xp > 0 && dayKey(new Date(a.at)) === day);

export const MISSION_DEFS: Record<string, MissionDef> = {
  "read-1": {
    id: "read-1",
    title: { en: "Finish a reading activity", uz: "Bitta o'qish mashqini tugating" },
    xp: 10, minutes: 4, route: "/reading",
    progress: (s, d) => (todaysAttempts(s, d).some((a) => a.kind === "reading") ? 1 : 0),
  },
  "listen-1": {
    id: "listen-1",
    title: { en: "Finish a listening activity", uz: "Bitta tinglash mashqini tugating" },
    xp: 10, minutes: 4, route: "/listening",
    progress: (s, d) => (todaysAttempts(s, d).some((a) => a.kind === "listening") ? 1 : 0),
  },
  "speak-1": {
    id: "speak-1",
    title: { en: "Finish a short speaking conversation", uz: "Qisqa suhbatni yakunlang" },
    xp: 12, minutes: 5, route: "/speaking",
    progress: (s, d) => (todaysAttempts(s, d).some((a) => a.kind === "speaking") ? 1 : 0),
  },
  "write-1": {
    id: "write-1",
    title: { en: "Write and get feedback", uz: "Yozing va fikr-mulohaza oling" },
    xp: 12, minutes: 6, route: "/writing",
    progress: (s, d) => (todaysAttempts(s, d).some((a) => a.kind === "writing") ? 1 : 0),
  },
  "review-5": {
    id: "review-5",
    title: { en: "Retrieve 5 words or phrases from memory", uz: "5 ta so'z yoki iborani xotiradan eslang" },
    xp: 10, minutes: 3, route: "/vocabulary",
    progress: (s, d) => Math.min(1, todaysAttempts(s, d).filter((a) => a.kind === "review").reduce((n, a) => n + (a.units ?? 0), 0) / 5),
  },
  "use-1": {
    id: "use-1",
    title: { en: "Use a tracked phrase in your own words", uz: "O'rganilayotgan iborani o'z gapingizda ishlating" },
    xp: 15, minutes: 4, route: "/writing",
    progress: (s, d) => (todaysAttempts(s, d).some((a) => (a.independentUses ?? 0) > 0) ? 1 : 0),
  },
  "any-1": {
    id: "any-1",
    title: { en: "Do one 3-minute activity (any skill)", uz: "3 daqiqalik bitta mashq (istalgan ko'nikma)" },
    xp: 10, minutes: 3, route: "/learn",
    progress: (s, d) => (todaysAttempts(s, d).length > 0 ? 1 : 0),
  },
};

/** Deterministic mission set for a day. `mini` = minimum-effort mode for busy days. */
export function pickMissions(state: LearnerState, mini: boolean, weakestSkill: string): string[] {
  if (mini) return ["any-1", "review-5"];
  const skillMission: Record<string, string> = { reading: "read-1", listening: "listen-1", speaking: "speak-1", writing: "write-1" };
  const first = skillMission[weakestSkill] ?? "read-1";
  const hasVocab = Object.keys(state.vocab).length > 0;
  const set = [first, "review-5", hasVocab ? "use-1" : "any-1"];
  return Array.from(new Set(set));
}

// --------------------------------------------------------- achievements
export interface AchievementDef {
  id: string;
  title: Localized;
  description: Localized;
  test: (s: LearnerState) => boolean;
}

const coreKinds = ["reading", "listening", "writing", "speaking"];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-step", title: { en: "First step", uz: "Birinchi qadam" }, description: { en: "Complete your first activity.", uz: "Birinchi mashqni bajaring." }, test: (s) => s.attempts.length >= 1 },
  { id: "placed", title: { en: "Starting point", uz: "Boshlang'ich nuqta" }, description: { en: "Finish the placement check.", uz: "Daraja aniqlashni tugating." }, test: (s) => s.placementDone },
  { id: "four-skills", title: { en: "All four skills", uz: "To'rt ko'nikma" }, description: { en: "Practise reading, listening, writing and speaking.", uz: "O'qish, tinglash, yozish va gapirishni mashq qiling." }, test: (s) => coreKinds.every((k) => s.attempts.some((a) => a.kind === k)) },
  { id: "streak-3", title: { en: "Three days in a row", uz: "Ketma-ket 3 kun" }, description: { en: "Practise on 3 consecutive days.", uz: "3 kun ketma-ket mashq qiling." }, test: (s) => s.streak.best >= 3 },
  { id: "streak-7", title: { en: "A full week", uz: "To'liq hafta" }, description: { en: "Reach a 7-day streak.", uz: "7 kunlik seriyaga yeting." }, test: (s) => s.streak.best >= 7 },
  { id: "first-own-words", title: { en: "In your own words", uz: "O'z so'zlaringiz bilan" }, description: { en: "Use a tracked phrase independently.", uz: "O'rganilayotgan iborani mustaqil ishlating." }, test: (s) => Object.values(s.vocab).some((v) => v.independentUses > 0) },
  { id: "new-context", title: { en: "New context", uz: "Yangi kontekst" }, description: { en: "Use one item independently in two different activities.", uz: "Bitta iborani ikki xil mashqda mustaqil ishlating." }, test: (s) => Object.values(s.vocab).some((v) => v.productive === "multi_context") },
  { id: "retriever", title: { en: "Memory worker", uz: "Xotira ustasi" }, description: { en: "Successfully retrieve 25 items.", uz: "25 ta birlikni muvaffaqiyatli eslang." }, test: (s) => Object.values(s.vocab).reduce((n, v) => n + v.successCount, 0) >= 25 },
  { id: "improver", title: { en: "Better on the second try", uz: "Ikkinchi urinishda yaxshiroq" }, description: { en: "Improve your score on an activity you repeated.", uz: "Takrorlagan mashqda natijangizni yaxshilang." }, test: (s) => s.attempts.some((a, i) => s.attempts.slice(0, i).some((b) => b.activityId === a.activityId && a.score >= b.score + 0.15)) },
  { id: "mock-done", title: { en: "Mock exam finished", uz: "Sinov imtihon tugadi" }, description: { en: "Complete a practice mock exam.", uz: "Sinov imtihonni tugating." }, test: (s) => s.assessments.some((a) => a.type === "mock-exam") },
];
