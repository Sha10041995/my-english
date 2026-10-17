import { PLACEMENT_BANK } from "@/content/placement";
import { levelToNumber } from "@/lib/learning-engine/levels";
import { confidence, emptyEstimate, reportedLevel, updateEstimate, type SkillEstimate } from "@/lib/learning-engine/proficiency";
import type { AssessmentRecord } from "@/lib/learning-engine/state";
import { SKILLS, type Level, type PlacementItem, type Skill } from "@/types/domain";
import { RUBRIC_VERSION } from "./feedback";

export const PLACEMENT_SKILLS: Skill[] = ["vocabulary", "grammar", "reading", "listening"];
export const PLACEMENT_LENGTH = 16;

export interface PlacementResponse {
  itemId: string;
  choice: string | null;
  correct: boolean;
  skill: Skill;
  level: Level;
}

export type EntryPoint = "beginner" | "standard";

/** Replay responses through the estimator to get the current per-skill estimates. */
export function estimatesFromResponses(responses: PlacementResponse[], entry: EntryPoint): Record<string, SkillEstimate> {
  const start = entry === "beginner" ? 0.3 : 1.2;
  const est: Record<string, SkillEstimate> = {};
  for (const s of SKILLS) est[s] = emptyEstimate(start);
  for (const r of responses) est[r.skill] = updateEstimate(est[r.skill], r.level, r.correct ? 1 : 0);
  return est;
}

/**
 * Choose the next adaptive item:
 *  1. rotate skills so every area gets evidence (fewest answers first),
 *  2. within the skill pick the unseen item whose level is closest to the current estimate
 *     (ties go to the easier item, keeping early experiences encouraging).
 * Returns null when the test should stop.
 */
export function nextPlacementItem(
  responses: PlacementResponse[],
  entry: EntryPoint,
  excluded: string[] = [],
  bank: PlacementItem[] = PLACEMENT_BANK,
): PlacementItem | null {
  if (responses.length >= PLACEMENT_LENGTH) return null;
  // Early stop for absolute beginners: 4 wrong in a row at the lowest levels.
  const last4 = responses.slice(-4);
  if (entry === "beginner" && last4.length === 4 && last4.every((r) => !r.correct)) return null;

  const est = estimatesFromResponses(responses, entry);
  const answered = new Set([...responses.map((r) => r.itemId), ...excluded]);
  const counts = (s: Skill) => responses.filter((r) => r.skill === s).length;
  const order = [...PLACEMENT_SKILLS].sort((a, b) => counts(a) - counts(b) || PLACEMENT_SKILLS.indexOf(a) - PLACEMENT_SKILLS.indexOf(b));

  for (const skill of order) {
    const pool = bank.filter((i) => i.skill === skill && !answered.has(i.id));
    if (pool.length === 0) continue;
    const theta = est[skill].theta;
    const target = theta + 0.15;
    pool.sort((a, b) => Math.abs(levelToNumber(a.level) - target) - Math.abs(levelToNumber(b.level) - target) || levelToNumber(a.level) - levelToNumber(b.level));
    return pool[0];
  }
  return null;
}

export interface PlacementOutcome {
  record: AssessmentRecord;
  estimates: Record<string, SkillEstimate>;
  overall: Level;
  overallConfidence: number;
  strengths: Skill[];
  weaknesses: Skill[];
}

export interface ProductiveSample {
  skill: "writing" | "speaking";
  level: Level;
  score: number;
}

export function scorePlacement(
  responses: PlacementResponse[],
  entry: EntryPoint,
  productive: ProductiveSample[],
  now: Date = new Date(),
): PlacementOutcome {
  const estimates = estimatesFromResponses(responses, entry);
  for (const p of productive) estimates[p.skill] = updateEstimate(estimates[p.skill], p.level, p.score, now);

  // Skills without direct evidence keep the beginner/standard prior but zero evidence, so confidence is 0
  // and reportedLevel() shows A0/unknown rather than inventing a level.
  const assessed = SKILLS.filter((s) => estimates[s].evidence > 0);
  const perSkill: AssessmentRecord["perSkill"] = {};
  for (const s of SKILLS) {
    perSkill[s] = {
      level: reportedLevel(estimates[s]),
      confidence: Math.round(confidence(estimates[s]) * 100) / 100,
      correct: responses.filter((r) => r.skill === s && r.correct).length,
      total: responses.filter((r) => r.skill === s).length,
    };
  }
  const pooled: SkillEstimate = assessed.reduce(
    (acc, s) => ({
      ...acc,
      theta: acc.theta + estimates[s].theta / assessed.length,
      evidence: acc.evidence + estimates[s].evidence,
      b2Correct: acc.b2Correct + estimates[s].b2Correct,
      b2Total: acc.b2Total + estimates[s].b2Total,
    }),
    { ...emptyEstimate(0), theta: 0 },
  );
  const sorted = [...assessed].sort((a, b) => estimates[b].theta - estimates[a].theta);
  const record: AssessmentRecord = {
    id: `placement-${now.getTime()}`,
    type: "placement",
    at: now.toISOString(),
    rubricVersion: RUBRIC_VERSION,
    responses: responses.map((r) => ({ itemId: r.itemId, choice: r.choice, correct: r.correct, skill: r.skill, level: r.level })),
    perSkill,
    notes: "Provisional placement; not an official CEFR result.",
  };
  return {
    record,
    estimates,
    overall: reportedLevel(pooled),
    overallConfidence: confidence(pooled),
    strengths: sorted.slice(0, 1),
    weaknesses: sorted.length > 1 ? sorted.slice(-1) : [],
  };
}
