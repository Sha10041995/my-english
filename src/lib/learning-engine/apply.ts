import { VOCAB_BY_ID } from "@/content/vocabulary";
import { ACHIEVEMENTS, computeXp, MISSION_DEFS, pickMissions, updateStreak, type AttemptKind } from "@/lib/gamification/rewards";
import type { PlacementOutcome } from "@/lib/assessment/placement";
import { recordEncounter, recordRetrieval, type RetrievalMode } from "@/lib/vocabulary/srs";
import type { Level, Skill } from "@/types/domain";
import { updateEstimate } from "./proficiency";
import { weakestCoreSkill } from "./recommend";
import { dayKey, estimateOf, type Attempt, type LearnerState } from "./state";

export interface AttemptInput {
  activityId: string;
  kind: AttemptKind;
  skill: Skill;
  level: Level;
  /** 0..1 */
  score: number;
  durationSeconds: number;
  source: Attempt["source"];
  note?: string;
  encounteredVocab?: string[];
  retrievals?: { itemId: string; mode: RetrievalMode; success: boolean }[];
  independentVocab?: string[];
  errorTags?: string[];
  units?: number;
  /** skip the skill-estimate update (e.g. vocabulary review is handled item by item) */
  skipSkillUpdate?: boolean;
}

export interface ApplyResult {
  state: LearnerState;
  xpGained: number;
  xpReasons: string[];
  newAchievements: string[];
  completedMissions: string[];
  streakEvent: "none" | "continued" | "started" | "froze" | "comeback";
}

const MAX_ATTEMPTS = 600;

/** Make sure today's missions exist (regenerates when the day or mini-mode changes). */
export function ensureMissions(state: LearnerState, now: Date, mini?: boolean): LearnerState {
  const day = dayKey(now);
  const wantMini = mini ?? state.missions.miniMode;
  if (state.missions.day === day && state.missions.miniMode === wantMini) return state;
  const ids = pickMissions(state, wantMini, weakestCoreSkill(state));
  return { ...state, missions: { day, miniMode: wantMini, items: ids.map((id) => ({ id, done: false })) } };
}

export function applyAttempt(state0: LearnerState, input: AttemptInput, now: Date = new Date()): ApplyResult {
  const state = ensureMissions(state0, now);
  const day = dayKey(now);

  // ---- vocabulary evidence
  const vocab = { ...state.vocab };
  for (const id of input.encounteredVocab ?? []) {
    if (VOCAB_BY_ID[id]) vocab[id] = recordEncounter(vocab[id], id, input.activityId, now);
  }
  let successes = 0;
  for (const r of input.retrievals ?? []) {
    if (!VOCAB_BY_ID[r.itemId]) continue;
    vocab[r.itemId] = recordRetrieval(vocab[r.itemId], r.itemId, { mode: r.mode, success: r.success, contextId: input.activityId }, now);
    if (r.success) successes++;
  }
  let independent = 0;
  for (const id of input.independentVocab ?? []) {
    if (!VOCAB_BY_ID[id]) continue;
    vocab[id] = recordRetrieval(vocab[id], id, { mode: "independent", success: true, contextId: input.activityId }, now);
    independent++;
  }

  // ---- skill estimate (vocabulary items feed the vocabulary estimate)
  const skills = { ...state.skills };
  if (!input.skipSkillUpdate) skills[input.skill] = updateEstimate(estimateOf(state, input.skill), input.level, input.score, now);
  for (const r of input.retrievals ?? []) {
    const item = VOCAB_BY_ID[r.itemId];
    if (item) skills.vocabulary = updateEstimate(skills.vocabulary ?? estimateOf(state, "vocabulary"), item.level, r.success ? 1 : 0, now);
  }

  // ---- XP
  const prev = [...state.attempts].reverse().find((a) => a.activityId === input.activityId);
  const repeatedToday = state.attempts.some((a) => a.activityId === input.activityId && dayKey(new Date(a.at)) === day);
  const xpRes = computeXp({
    kind: input.kind,
    score: input.score,
    durationSeconds: input.durationSeconds,
    successfulRetrievals: successes,
    repeatedToday,
    previousScoreOnActivity: prev?.score ?? null,
    independentUses: independent,
  });

  // ---- errors
  const errors = { ...state.errors };
  for (const tag of input.errorTags ?? []) errors[tag] = (errors[tag] ?? 0) + 1;

  const attempt: Attempt = {
    id: `${input.activityId}-${now.getTime()}`,
    activityId: input.activityId,
    kind: input.kind,
    skill: input.skill,
    level: input.level,
    score: Math.round(input.score * 100) / 100,
    durationSeconds: Math.round(input.durationSeconds),
    at: now.toISOString(),
    xp: xpRes.xp,
    source: input.source,
    note: input.note,
    units: input.units,
    independentUses: independent || undefined,
  };

  // ---- streak (an activity day counts only if the attempt was genuine, i.e. not rushed)
  const counts = xpRes.reasons.includes("too-fast") ? false : true;
  const streakRes = counts ? updateStreak(state.streak, day) : { streak: state.streak, event: "none" as const };

  let next: LearnerState = {
    ...state,
    skills,
    vocab,
    errors,
    attempts: [...state.attempts, attempt].slice(-MAX_ATTEMPTS),
    xp: state.xp + xpRes.xp,
    xpByDay: { ...state.xpByDay, [day]: (state.xpByDay[day] ?? 0) + xpRes.xp },
    minutesByDay: { ...state.minutesByDay, [day]: (state.minutesByDay[day] ?? 0) + input.durationSeconds / 60 },
    streak: streakRes.streak,
  };

  // ---- missions (derived progress; bonus XP once)
  const completedMissions: string[] = [];
  let bonus = 0;
  const items = next.missions.items.map((m) => {
    const def = MISSION_DEFS[m.id];
    if (!m.done && def && def.progress(next, day) >= 1) {
      completedMissions.push(m.id);
      bonus += def.xp;
      return { ...m, done: true };
    }
    return m;
  });
  next = { ...next, missions: { ...next.missions, items }, xp: next.xp + bonus, xpByDay: { ...next.xpByDay, [day]: (next.xpByDay[day] ?? 0) + bonus } };

  // ---- personal bests
  const pb = { ...next.personalBests };
  pb.dailyXp = Math.max(pb.dailyXp, next.xpByDay[day] ?? 0);
  if (input.kind === "writing") pb.writingScore = Math.max(pb.writingScore, attempt.score);
  if (input.kind === "reading") pb.readingScore = Math.max(pb.readingScore, attempt.score);
  next = { ...next, personalBests: pb };

  // ---- achievements
  const unlocked = { ...next.achievements };
  const newAchievements: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.id] && a.test(next)) {
      unlocked[a.id] = now.toISOString();
      newAchievements.push(a.id);
    }
  }
  next = { ...next, achievements: unlocked };

  return { state: next, xpGained: xpRes.xp + bonus, xpReasons: xpRes.reasons, newAchievements, completedMissions, streakEvent: streakRes.event };
}

export function applyPlacement(state: LearnerState, outcome: PlacementOutcome, now: Date = new Date()): LearnerState {
  const skills = { ...state.skills };
  for (const [skill, est] of Object.entries(outcome.estimates)) skills[skill] = est;
  let next: LearnerState = {
    ...state,
    skills,
    placementDone: true,
    placementAt: now.toISOString(),
    assessments: [...state.assessments, outcome.record].slice(-50),
  };
  const unlocked = { ...next.achievements };
  for (const a of ACHIEVEMENTS) if (!unlocked[a.id] && a.test(next)) unlocked[a.id] = now.toISOString();
  next = { ...next, achievements: unlocked };
  // regenerate missions with new weakest skill
  return ensureMissions({ ...next, missions: { ...next.missions, day: null } }, now);
}
