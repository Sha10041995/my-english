import type { Level } from "@/types/domain";
import { clamp, levelToNumber, numberToLevel } from "./levels";

/**
 * Per-skill proficiency estimate. `theta` lives on the same 0..4 scale as levels.
 * `evidence` counts the observations that fed the estimate and drives confidence.
 */
export interface SkillEstimate {
  theta: number;
  evidence: number;
  /** observations at B2-difficulty items – needed before B2 may be reported */
  b2Correct: number;
  b2Total: number;
  recent: number[];
  updatedAt: string | null;
}

export const emptyEstimate = (theta = 0.8): SkillEstimate => ({
  theta,
  evidence: 0,
  b2Correct: 0,
  b2Total: 0,
  recent: [],
  updatedAt: null,
});

const logistic = (x: number) => 1 / (1 + Math.exp(-1.4 * x));

/**
 * Elo/IRT-like update. `score` is 0..1 (partial credit allowed). The step size shrinks
 * as evidence accumulates so a few lucky answers cannot move the estimate far.
 */
export function updateEstimate(est: SkillEstimate, itemLevel: Level, score: number, now: Date = new Date()): SkillEstimate {
  const d = levelToNumber(itemLevel);
  const expected = logistic(est.theta - d);
  const k = clamp(1.1 / Math.sqrt(est.evidence + 1.5), 0.12, 0.8);
  const theta = clamp(est.theta + k * (score - expected), 0, 4.2);
  const isB2 = itemLevel === "B2";
  return {
    theta,
    evidence: est.evidence + 1,
    b2Correct: est.b2Correct + (isB2 && score >= 0.7 ? 1 : 0),
    b2Total: est.b2Total + (isB2 ? 1 : 0),
    recent: [...est.recent, score].slice(-10),
    updatedAt: now.toISOString(),
  };
}

/** 0..0.9 – never fully certain. */
export function confidence(est: SkillEstimate): number {
  return clamp(est.evidence / (est.evidence + 5), 0, 0.9);
}

/**
 * Reported level, with guard rails against over-claiming:
 *  - no evidence → A0 (unknown)
 *  - fewer than 3 observations → capped at A1
 *  - B2 requires ≥3 B2-difficulty observations with ≥2/3 succeeded, else capped at B1
 */
export function reportedLevel(est: SkillEstimate): Level {
  if (est.evidence === 0) return "A0";
  let lvl = numberToLevel(est.theta);
  if (est.evidence < 3 && levelToNumber(lvl) > 1) lvl = "A1";
  if (lvl === "B2" && !(est.b2Total >= 3 && est.b2Correct / est.b2Total >= 2 / 3)) lvl = "B1";
  return lvl;
}

export function recentAverage(est: SkillEstimate, n = 5): number | null {
  const r = est.recent.slice(-n);
  if (r.length === 0) return null;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

/** Scaffold / stretch signal derived from recent performance. */
export function difficultyAdjustment(est: SkillEstimate): "scaffold" | "hold" | "stretch" {
  const r = est.recent.slice(-3);
  if (r.length >= 2 && r.slice(-2).every((s) => s < 0.5)) return "scaffold";
  if (r.length === 3 && r.every((s) => s >= 0.85)) return "stretch";
  return "hold";
}
