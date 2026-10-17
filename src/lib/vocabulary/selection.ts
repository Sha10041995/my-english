import { VOCABULARY } from "@/content/vocabulary";
import { levelToNumber } from "@/lib/learning-engine/levels";
import { estimateOf, type LearnerState } from "@/lib/learning-engine/state";
import type { VocabItem } from "@/types/domain";
import { isDue, stageOf, type UserVocab } from "./srs";

export type ReviewMode = "recognition" | "assisted" | "independent";

export interface ReviewCard {
  item: VocabItem;
  mode: ReviewMode;
  early: boolean;
}

/** Cognitive-load guard: few new items per session, none while a backlog of unconsolidated items exists. */
export function newWordBudget(state: LearnerState): number {
  const backlog = Object.values(state.vocab).filter((v) => stageOf(v) === "encountered" || stageOf(v) === "recognized").length;
  if (backlog >= 12) return 0;
  const minutes = state.profile.minutesPerDay;
  const base = minutes <= 5 ? 2 : minutes <= 15 ? 3 : 5;
  return Math.max(0, Math.min(base, 12 - backlog));
}

export function pickNewWords(state: LearnerState, n: number): VocabItem[] {
  const theta = estimateOf(state, "vocabulary").theta;
  const maxLevel = Math.min(4, Math.ceil(theta + 0.6));
  return VOCABULARY.filter((v) => !state.vocab[v.id] && levelToNumber(v.level) <= maxLevel)
    .sort((a, b) => {
      // closest to the learner's level first; ties broken by a stable id order
      const da = Math.abs(levelToNumber(a.level) - theta);
      const db = Math.abs(levelToNumber(b.level) - theta);
      return da - db || a.id.localeCompare(b.id);
    })
    .slice(0, n);
}

export function modeFor(v: UserVocab): ReviewMode {
  const stage = stageOf(v);
  if (stage === "encountered" || stage === "unseen") return "recognition";
  if (stage === "recognized") return "assisted";
  return "independent";
}

/** Due items first (most overdue first), then early practice of soonest-due items. */
export function buildReviewQueue(state: LearnerState, now: Date, max = 8): ReviewCard[] {
  const all = Object.values(state.vocab).filter((v) => VOCABULARY.some((x) => x.id === v.itemId));
  const due = all.filter((v) => isDue(v, now)).sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
  const upcoming = all
    .filter((v) => !isDue(v, now))
    .sort((a, b) => new Date(a.nextReviewAt ?? 0).getTime() - new Date(b.nextReviewAt ?? 0).getTime());
  const picked: ReviewCard[] = [];
  for (const v of due) {
    if (picked.length >= max) break;
    picked.push({ item: VOCABULARY.find((x) => x.id === v.itemId)!, mode: modeFor(v), early: false });
  }
  for (const v of upcoming) {
    if (picked.length >= Math.min(max, 5)) break;
    picked.push({ item: VOCABULARY.find((x) => x.id === v.itemId)!, mode: modeFor(v), early: true });
  }
  return picked;
}

/** Deterministic pseudo-shuffle so tests and re-renders are stable. */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function distractors(item: VocabItem, n = 3): VocabItem[] {
  const pool = VOCABULARY.filter((v) => v.id !== item.id && v.pos.split("/")[0] === item.pos.split("/")[0]);
  const pool2 = pool.length >= n ? pool : VOCABULARY.filter((v) => v.id !== item.id);
  return seededShuffle(pool2, item.id).slice(0, n);
}

/** Does `answer` match the item (any known form, case-insensitive, trimmed)? */
export function matchesItem(answer: string, item: VocabItem): boolean {
  const a = answer.trim().toLowerCase().replace(/\s+/g, " ");
  return item.forms.some((f) => f.toLowerCase() === a) || item.lemma.toLowerCase() === a || (item.phrase?.toLowerCase() === a);
}
