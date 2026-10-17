/**
 * Vocabulary state machine + spaced-repetition scheduler.
 *
 * Principles (documented in docs/LEARNING_ENGINE.md):
 *  - Exposure alone never advances mastery. Only retrieval (a graded attempt) or
 *    detected independent use does.
 *  - Receptive (recognition) and productive (use) knowledge are tracked separately.
 *  - Failures shorten the interval but do not erase history.
 */

export type RecognitionState = "unseen" | "encountered" | "recognized" | "recalled";
export type ProductiveState = "none" | "assisted" | "independent" | "multi_context";
export type RetrievalMode = "recognition" | "assisted" | "independent";

export interface SrsConfig {
  /** Interval (days) after the first successful retrieval. */
  firstInterval: number;
  startEase: number;
  minEase: number;
  maxEase: number;
  maxIntervalDays: number;
  /** Multiplier on interval growth per retrieval mode (easier modes grow more slowly). */
  modeWeight: Record<RetrievalMode, number>;
  /** Interval (days) applied after a failure. */
  lapseInterval: number;
  /** Distinct contexts of independent use required for "multi_context". */
  multiContextThreshold: number;
  /** Successful recognition-only retrievals required before "recognized" becomes "recalled". */
  recallThreshold: number;
}

export const DEFAULT_SRS: SrsConfig = {
  firstInterval: 1,
  startEase: 2.3,
  minEase: 1.3,
  maxEase: 3.0,
  maxIntervalDays: 180,
  modeWeight: { recognition: 0.7, assisted: 1.0, independent: 1.25 },
  lapseInterval: 1,
  multiContextThreshold: 2,
  recallThreshold: 3,
};

export interface UserVocab {
  itemId: string;
  recognition: RecognitionState;
  productive: ProductiveState;
  exposureCount: number;
  successCount: number;
  failureCount: number;
  independentUses: number;
  /** Contexts where the item was used independently. */
  contexts: string[];
  /** Contexts where the item was encountered (not necessarily used). */
  encounterContexts: string[];
  intervalDays: number;
  ease: number;
  lapses: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSuccessAt: string | null;
  nextReviewAt: string | null;
}

export function newUserVocab(itemId: string, now: Date, cfg: SrsConfig = DEFAULT_SRS): UserVocab {
  return {
    itemId,
    recognition: "unseen",
    productive: "none",
    exposureCount: 0,
    successCount: 0,
    failureCount: 0,
    independentUses: 0,
    contexts: [],
    encounterContexts: [],
    intervalDays: 0,
    ease: cfg.startEase,
    lapses: 0,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    lastSuccessAt: null,
    nextReviewAt: null,
  };
}

const DAY = 86_400_000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY).toISOString();

/** Passive exposure in a context. Moves unseen → encountered only, and makes a first check due. */
export function recordEncounter(
  v: UserVocab | undefined,
  itemId: string,
  contextId: string,
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS,
): UserVocab {
  const base = v ?? newUserVocab(itemId, now, cfg);
  return {
    ...base,
    recognition: base.recognition === "unseen" ? "encountered" : base.recognition,
    exposureCount: base.exposureCount + 1,
    encounterContexts: base.encounterContexts.includes(contextId)
      ? base.encounterContexts
      : [...base.encounterContexts, contextId].slice(-12),
    lastSeenAt: now.toISOString(),
    nextReviewAt: base.nextReviewAt ?? addDays(now, 0.5),
  };
}

export interface RetrievalInput {
  mode: RetrievalMode;
  success: boolean;
  contextId: string;
}

/** A graded retrieval attempt (quiz answer, flashcard, or detected independent use). */
export function recordRetrieval(
  v: UserVocab | undefined,
  itemId: string,
  input: RetrievalInput,
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS,
): UserVocab {
  let cur = v ?? newUserVocab(itemId, now, cfg);
  if (cur.recognition === "unseen") cur = { ...cur, recognition: "encountered" };
  const lastSeenAt = now.toISOString();

  if (!input.success) {
    return {
      ...cur,
      failureCount: cur.failureCount + 1,
      lapses: cur.lapses + 1,
      ease: Math.max(cfg.minEase, cur.ease - 0.2),
      intervalDays: cfg.lapseInterval,
      lastSeenAt,
      nextReviewAt: addDays(now, cfg.lapseInterval),
      // A lapse on a recalled word drops it back to recognized; never below encountered.
      recognition: cur.recognition === "recalled" ? "recognized" : cur.recognition,
    };
  }

  const successCount = cur.successCount + 1;
  const weight = cfg.modeWeight[input.mode];
  const grown = cur.intervalDays === 0 ? cfg.firstInterval : cur.intervalDays * cur.ease * weight;
  const intervalDays = Math.min(cfg.maxIntervalDays, Math.max(cfg.firstInterval, Math.round(grown * 10) / 10));
  const ease = Math.min(cfg.maxEase, cur.ease + (input.mode === "recognition" ? 0.02 : 0.08));

  let recognition = cur.recognition;
  if (recognition === "encountered") {
    recognition = "recognized";
  } else if (recognition === "recognized") {
    if (input.mode !== "recognition" || successCount >= cfg.recallThreshold) recognition = "recalled";
  }

  let productive = cur.productive;
  let independentUses = cur.independentUses;
  let contexts = cur.contexts;
  if (input.mode === "assisted" && productive === "none") productive = "assisted";
  if (input.mode === "independent") {
    independentUses += 1;
    if (!contexts.includes(input.contextId)) contexts = [...contexts, input.contextId].slice(-12);
    productive = contexts.length >= cfg.multiContextThreshold ? "multi_context" : "independent";
    recognition = "recalled";
  }

  return {
    ...cur,
    recognition,
    productive,
    independentUses,
    contexts,
    successCount,
    ease,
    intervalDays,
    lastSeenAt,
    lastSuccessAt: lastSeenAt,
    nextReviewAt: addDays(now, intervalDays),
  };
}

export function isDue(v: UserVocab, now: Date): boolean {
  return v.nextReviewAt !== null && new Date(v.nextReviewAt).getTime() <= now.getTime();
}

/** "Needs review" is derived: overdue, or lapsed at least as often as it succeeded. */
export function needsReview(v: UserVocab, now: Date): boolean {
  return isDue(v, now) || (v.lapses > 0 && v.lapses >= v.successCount);
}

export type VocabStage =
  | "unseen"
  | "encountered"
  | "recognized"
  | "recalled_assisted"
  | "used_independently"
  | "used_multi_context";

/** The single user-facing stage – the strongest evidence wins. */
export function stageOf(v: UserVocab): VocabStage {
  if (v.productive === "multi_context") return "used_multi_context";
  if (v.productive === "independent") return "used_independently";
  if (v.recognition === "recalled" || v.productive === "assisted") return "recalled_assisted";
  if (v.recognition === "recognized") return "recognized";
  if (v.recognition === "encountered") return "encountered";
  return "unseen";
}

export interface VocabEstimate {
  /** Recalled, with a successful retrieval ≥ 3 days after first seen. */
  receptiveConfirmed: number;
  /** Recognised or recalled once, not yet shown to be durable. */
  receptiveEmerging: number;
  productiveConfirmed: number;
  productiveEmerging: number;
  exposedOnly: number;
  total: number;
}

export function estimateVocabulary(items: UserVocab[]): VocabEstimate {
  const est: VocabEstimate = {
    receptiveConfirmed: 0,
    receptiveEmerging: 0,
    productiveConfirmed: 0,
    productiveEmerging: 0,
    exposedOnly: 0,
    total: items.length,
  };
  for (const v of items) {
    const delayed =
      v.lastSuccessAt !== null && new Date(v.lastSuccessAt).getTime() - new Date(v.firstSeenAt).getTime() >= 3 * DAY;
    if (v.recognition === "recalled" && delayed) est.receptiveConfirmed++;
    else if (v.recognition === "recognized" || v.recognition === "recalled") est.receptiveEmerging++;
    else est.exposedOnly++;
    if (v.productive === "multi_context" || (v.productive === "independent" && v.independentUses >= 2))
      est.productiveConfirmed++;
    else if (v.productive === "independent" || v.productive === "assisted") est.productiveEmerging++;
  }
  return est;
}
