import { ACTIVITIES } from "@/content/activities";
import { CORE_SKILLS, type Activity, type Localized, type Skill } from "@/types/domain";
import { isDue } from "@/lib/vocabulary/srs";
import { levelToNumber } from "./levels";
import { difficultyAdjustment } from "./proficiency";
import { dayKey, estimateOf, type LearnerState } from "./state";

export interface Candidate {
  activity: Activity;
  score: number;
  reasons: Localized[];
}

const DAY = 86_400_000;

/**
 * Transparent, deterministic scoring (see docs/LEARNING_ENGINE.md). Each term adds a human-readable
 * reason so the UI can explain "why this activity".
 */
export function rankActivities(state: LearnerState, now: Date, availableMinutes: number, pool: Activity[] = ACTIVITIES): Candidate[] {
  const out: Candidate[] = [];
  const lastAttempts = state.attempts.slice(-6);
  const lastKind = state.attempts.at(-1)?.kind;

  for (const activity of pool) {
    const skill = activity.kind as Skill;
    const est = estimateOf(state, skill);
    const adj = difficultyAdjustment(est);
    const target = est.theta + (adj === "scaffold" ? -0.3 : adj === "stretch" ? 0.6 : 0.25);
    const gap = levelToNumber(activity.level) - target;
    // Far-too-hard material is excluded; the engine never "throws the learner in the deep end".
    if (gap > 1.3) continue;

    const reasons: Localized[] = [];
    let score = -Math.abs(gap) * 2;
    if (Math.abs(gap) <= 0.7) reasons.push({ en: "Matches your current level", uz: "Hozirgi darajangizga mos" });
    if (adj === "scaffold") reasons.push({ en: "Easier step to build confidence", uz: "Ishonchni oshirish uchun osonroq qadam" });
    if (adj === "stretch") reasons.push({ en: "You've been doing well – a small stretch", uz: "Yaxshi natija – biroz qiyinroq mashq" });

    const need = (4 - est.theta) * 0.25;
    score += need;
    const lastOfSkill = [...state.attempts].reverse().find((a) => a.skill === skill);
    const staleDays = lastOfSkill ? Math.min(7, (now.getTime() - new Date(lastOfSkill.at).getTime()) / DAY) : 7;
    score += staleDays * 0.3;
    if (staleDays >= 3) reasons.push({ en: "You haven't practised this skill recently", uz: "Bu ko'nikmani yaqinda mashq qilmagansiz" });

    const doneBefore = state.attempts.filter((a) => a.activityId === activity.id);
    if (lastAttempts.some((a) => a.activityId === activity.id)) score -= 3;
    else if (doneBefore.length) score -= 0.8 * Math.min(3, doneBefore.length);
    if (doneBefore.length === 0) {
      score += 0.6;
      reasons.push({ en: "New activity", uz: "Yangi mashq" });
    }

    if (lastKind === activity.kind) score -= 1;

    const dueCount = activity.vocab.filter((id) => state.vocab[id] && isDue(state.vocab[id], now)).length;
    if (dueCount) {
      score += Math.min(2, dueCount * 0.6);
      reasons.push({ en: `Revisits ${dueCount} word(s) that are due for review`, uz: `Takrorlash vaqti kelgan ${dueCount} ta so'z uchraydi` });
    }

    if (state.profile.interests.includes(activity.topic)) {
      score += 1;
      reasons.push({ en: "Fits your interests", uz: "Qiziqishlaringizga mos" });
    }

    if (state.profile.examTarget !== "none") {
      if (activity.kind === "writing") score += 0.5;
      if ((activity.kind === "reading" || activity.kind === "listening") && levelToNumber(activity.level) >= 3) score += 0.4;
      if (levelToNumber(activity.level) >= 3) reasons.push({ en: "Supports your exam target", uz: "Imtihon maqsadingizga mos" });
    }

    if (activity.minutes > availableMinutes) score -= (activity.minutes - availableMinutes) * 0.4;
    else if (activity.minutes <= availableMinutes) reasons.push({ en: `Fits your ${availableMinutes}-minute session`, uz: `${availableMinutes} daqiqalik sessiyaga sig'adi` });

    out.push({ activity, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface PlanItem {
  type: "activity" | "review";
  activityId?: string;
  title: string;
  kind: string;
  minutes: number;
  reasons: Localized[];
  href: string;
}

const KIND_ROUTE: Record<string, string> = { reading: "/reading", listening: "/listening", writing: "/writing", speaking: "/speaking" };
export const activityHref = (a: Activity) => `${KIND_ROUTE[a.kind]}?a=${a.id}`;

export function dueVocabCount(state: LearnerState, now: Date): number {
  return Object.values(state.vocab).filter((v) => isDue(v, now)).length;
}

/** Daily path: a small, varied set (never all four skills if the session is short). */
export function dailyPlan(state: LearnerState, now: Date, minutesOverride?: number): PlanItem[] {
  const minutes = minutesOverride ?? state.profile.minutesPerDay;
  const maxItems = minutes <= 5 ? 1 : minutes <= 12 ? 2 : minutes <= 25 ? 3 : 4;
  const plan: PlanItem[] = [];
  let remaining = minutes;
  const usedKinds = new Set<string>();
  const due = dueVocabCount(state, now);
  if (due >= 3 && minutes > 3) {
    plan.push({
      type: "review",
      title: "Vocabulary review",
      kind: "review",
      minutes: 3,
      href: "/vocabulary?review=1",
      reasons: [{ en: `${due} items are due for review`, uz: `${due} ta birlik takrorlashga tayyor` }],
    });
    remaining -= 3;
  }
  const ranked = rankActivities(state, now, Math.max(3, remaining));
  for (const cand of ranked) {
    if (plan.length >= maxItems) break;
    if (usedKinds.has(cand.activity.kind)) continue;
    if (plan.length > 0 && cand.activity.minutes > remaining + 1) continue;
    usedKinds.add(cand.activity.kind);
    remaining -= cand.activity.minutes;
    plan.push({
      type: "activity",
      activityId: cand.activity.id,
      title: cand.activity.title,
      kind: cand.activity.kind,
      minutes: cand.activity.minutes,
      reasons: cand.reasons.slice(0, 3),
      href: activityHref(cand.activity),
    });
  }
  return plan;
}

export function weakestCoreSkill(state: LearnerState): Skill {
  return [...CORE_SKILLS].sort((a, b) => estimateOf(state, a).theta - estimateOf(state, b).theta)[0];
}

export const today = (now: Date) => dayKey(now);
