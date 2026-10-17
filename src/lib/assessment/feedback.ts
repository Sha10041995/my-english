import { z } from "zod";
import type { Level, Localized, SpeakingActivity, WritingActivity } from "@/types/domain";
import { applyFixes, detectIssues, levelHint, textStats, type DetectedIssue } from "./text-rules";

export const RUBRIC_VERSION = "lq-rubric-1.0";

/** Documented rubric (0–5 per dimension). Used for both rule-based and AI evaluation. */
export const RUBRIC_DIMENSIONS = [
  { id: "task", name: { en: "Task completion", uz: "Topshiriqni bajarish" } },
  { id: "organization", name: { en: "Organisation & coherence", uz: "Tuzilma va izchillik" } },
  { id: "vocabulary", name: { en: "Vocabulary range", uz: "Lug'at boyligi" } },
  { id: "grammar", name: { en: "Grammatical range & accuracy", uz: "Grammatika xilma-xilligi va aniqligi" } },
  { id: "register", name: { en: "Register & effectiveness", uz: "Uslub va ta'sirchanlik" } },
] as const;

export const dimensionSchema = z.object({
  id: z.enum(["task", "organization", "vocabulary", "grammar", "register"]),
  score: z.number().min(0).max(5),
  comment: z.string().max(400),
});

export const correctionSchema = z.object({
  original: z.string().max(300),
  suggestion: z.string().max(300),
  why_en: z.string().max(400),
  why_uz: z.string().max(400),
  priority: z.number().min(1).max(3),
});

export const writingFeedbackSchema = z.object({
  dimensions: z.array(dimensionSchema).min(1).max(5),
  strengths: z.array(z.string().max(300)).max(5),
  corrections: z.array(correctionSchema).max(6),
  revisedExample: z.string().max(1500).optional(),
  nextStep: z.string().max(400),
  estimatedLevel: z.enum(["A0", "A1", "A2", "B1", "B2"]).optional(),
});

export type WritingFeedbackCore = z.infer<typeof writingFeedbackSchema>;

export interface WritingFeedback extends WritingFeedbackCore {
  source: "rule-based" | "ai";
  /** 0..1 overall used for XP and skill updates */
  overall: number;
  words: number;
  errorTags: string[];
  trackedVocabIds: string[];
  /** set when AI was requested but fell back */
  fallbackReason?: string;
}

const clamp5 = (n: number) => Math.max(0, Math.min(5, Math.round(n * 10) / 10));

export function ruleBasedWritingFeedback(text: string, activity: WritingActivity): WritingFeedback {
  const stats = textStats(text);
  const issues = detectIssues(text);
  const hint = levelHint(stats, issues.length);

  const completion = Math.min(1, stats.words / activity.targetWords);
  const task = clamp5(completion * 4 + (stats.words >= activity.minWords ? 1 : 0));
  const connectorCount = new Set(stats.connectors.map((c) => c.word)).size;
  const organization = clamp5(1 + Math.min(2, connectorCount * 0.6) + (stats.sentences >= 3 ? 1 : 0) + (activity.genre === "essay" && stats.paragraphs >= 3 ? 1 : 0) + (activity.genre !== "essay" && stats.sentences >= 4 ? 0.5 : 0));
  const vocabulary = clamp5(1 + stats.uniqueRatio * 1.5 + Math.min(1.5, stats.longWordRatio * 8) + Math.min(1, stats.trackedVocabIds.length * 0.5));
  const errorsPer20 = issues.length / Math.max(1, stats.words / 20);
  const grammar = clamp5(4.5 - errorsPer20 * 1.5 + (stats.avgSentenceLength > 10 ? 0.3 : 0));
  const hasGreeting = /\b(dear|hi|hello)\b/i.test(text);
  const hasClose = /\b(regards|thanks|thank you|best wishes|sincerely)\b/i.test(text);
  const informal = /\b(gonna|wanna|u r|lol)\b/i.test(text);
  let register = 3 - (informal ? 1.5 : 0);
  if (activity.genre === "message") register += (hasGreeting ? 1 : -0.5) + (hasClose ? 0.8 : 0);
  else register += 0.7;
  const dims: [string, number, Localized][] = [
    ["task", task, { en: `${stats.words} words (target about ${activity.targetWords}).`, uz: `${stats.words} ta so'z (maqsad taxminan ${activity.targetWords}).` }],
    ["organization", organization, { en: connectorCount ? `Linking words found: ${[...new Set(stats.connectors.map((c) => c.word))].join(", ")}.` : "No linking words found yet.", uz: connectorCount ? `Bog'lovchilar: ${[...new Set(stats.connectors.map((c) => c.word))].join(", ")}.` : "Hali bog'lovchi so'zlar topilmadi." }],
    ["vocabulary", vocabulary, { en: `${Math.round(stats.uniqueRatio * 100)}% different words; ${stats.trackedVocabIds.length} tracked phrase(s) used.`, uz: `So'zlarning ${Math.round(stats.uniqueRatio * 100)}% turlicha; ${stats.trackedVocabIds.length} ta kuzatilayotgan ibora ishlatildi.` }],
    ["grammar", grammar, { en: `${issues.length} common pattern issue(s) detected (rule-based, not exhaustive).`, uz: `${issues.length} ta keng tarqalgan xato namunasi topildi (qoidaga asoslangan, to'liq emas).` }],
    ["register", clamp5(register), { en: "Based on greeting/closing and informal words.", uz: "Salomlashish/xayrlashish va norasmiy so'zlarga asoslangan." }],
  ];

  const strengths: string[] = [];
  if (stats.words >= activity.minWords) strengths.push("You reached the minimum length – that takes effort.");
  if (connectorCount) strengths.push(`You linked ideas with: ${[...new Set(stats.connectors.map((c) => c.word))].slice(0, 3).join(", ")}.`);
  if (stats.trackedVocabIds.length) strengths.push("You used phrases from your vocabulary list in your own writing.");
  if (issues.length === 0 && stats.words >= 8) strengths.push("No common pattern errors were detected.");
  if (strengths.length === 0) strengths.push("You started writing – that is the hardest part.");

  const corrections = issues.slice(0, 4).map((i) => ({
    original: i.original,
    suggestion: i.suggestion,
    why_en: i.explain.en,
    why_uz: i.explain.uz,
    priority: i.priority,
  }));

  const weakest = [...dims].sort((a, b) => a[1] - b[1])[0][0];
  const nextByDim: Record<string, string> = {
    task: "Add one more detail or example to reach the target length.",
    organization: "Add a linking word (because, however, for example) to connect two ideas.",
    vocabulary: "Replace one simple word with a more precise one, or use a phrase from your vocabulary list.",
    grammar: corrections.length ? "Fix the top correction above, then rewrite the whole sentence." : "Re-read each sentence once, checking the verb forms.",
    register: "Check the greeting/closing and avoid very informal words.",
  };

  const overall = dims.reduce((s, d) => s + d[1], 0) / (dims.length * 5);
  const fixed = applyFixes(text);
  return {
    source: "rule-based",
    dimensions: dims.map(([id, score, comment]) => ({ id: id as WritingFeedbackCore["dimensions"][number]["id"], score, comment: comment.en })),
    strengths,
    corrections,
    // Only a minimal fix of detected spans is shown – not a rewrite of the learner's text.
    revisedExample: fixed !== text ? fixed : undefined,
    nextStep: nextByDim[weakest],
    estimatedLevel: hint,
    overall,
    words: stats.words,
    errorTags: issues.map((i) => i.ruleId),
    trackedVocabIds: stats.trackedVocabIds,
  };
}

// ---------------------------------------------------------------- speaking
export const tutorTurnSchema = z.object({
  reply: z.string().min(1).max(600),
  followUp: z.string().min(1).max(300),
  corrections: z.array(correctionSchema).max(4),
  naturalVersion: z.string().max(600).optional(),
  praise: z.array(z.string().max(200)).max(3),
  hintUz: z.string().max(400).optional(),
  clarity: z.number().min(0).max(1).optional(),
});

export type TutorTurnCore = z.infer<typeof tutorTurnSchema>;

export interface TutorTurn extends TutorTurnCore {
  source: "demo" | "ai";
  errorTags: string[];
  trackedVocabIds: string[];
  words: number;
  fallbackReason?: string;
  /** 0..1 score used for skill updates (communication evidence, not pronunciation) */
  score: number;
}

export type Intensity = "gentle" | "balanced" | "detailed";
const MAX_CORRECTIONS: Record<Intensity, number> = { gentle: 1, balanced: 2, detailed: 4 };

/**
 * Demo tutor: deterministic and rule-based. It does NOT understand the content of the answer;
 * it reacts to length, linking words and a library of common error patterns, and follows the
 * activity's scripted follow-up questions. The UI labels it as demo.
 */
export function demoTutorTurn(args: {
  activity: SpeakingActivity;
  learnerText: string;
  turnIndex: number;
  intensity: Intensity;
  explanationLanguage: "uz" | "en";
}): TutorTurn {
  const { activity, learnerText, turnIndex, intensity, explanationLanguage } = args;
  const stats = textStats(learnerText);
  const issues: DetectedIssue[] = detectIssues(learnerText);
  // Prioritise errors that block meaning; skip trivial ones unless detailed mode.
  const filtered = issues.filter((i) => intensity === "detailed" || i.priority >= 2);
  const chosen = filtered.slice(0, MAX_CORRECTIONS[intensity]);
  const praise: string[] = [];
  if (stats.words >= 12) praise.push("You gave a full answer with detail.");
  if (stats.connectors.length) praise.push(`Nice linking: "${stats.connectors[0].word}".`);
  if (stats.trackedVocabIds.length) praise.push("You used a phrase from your vocabulary list – excellent!");
  if (praise.length === 0 && stats.words > 0) praise.push("Good – you answered in English.");

  const short = stats.words < 6;
  const followUp = short
    ? "Can you tell me a little more? Try adding a reason with \"because\"."
    : activity.followUps[turnIndex % activity.followUps.length];
  const reply = short ? "Thank you. I'd like to hear more." : "Thanks for sharing that. I understand your main idea.";
  const natural = applyFixes(learnerText);
  const score = Math.max(0.2, Math.min(1, 0.35 + Math.min(stats.words, 30) / 60 + (stats.connectors.length ? 0.1 : 0) - issues.length * 0.05));

  return {
    source: "demo",
    reply,
    followUp,
    corrections: chosen.map((i) => ({ original: i.original, suggestion: i.suggestion, why_en: i.explain.en, why_uz: i.explain.uz, priority: i.priority })),
    naturalVersion: natural !== learnerText ? natural : undefined,
    praise,
    hintUz: explanationLanguage === "uz" ? "Javobingizni bitta sabab bilan kengaytirib ko'ring." : undefined,
    errorTags: issues.map((i) => i.ruleId),
    trackedVocabIds: stats.trackedVocabIds,
    words: stats.words,
    score,
  };
}

/** Score a level hint comparison used for placement (writing/speaking). */
export function placementTextScore(text: string): { level: Level; score: number } {
  const stats = textStats(text);
  const issues = detectIssues(text);
  return { level: levelHint(stats, issues.length), score: stats.words < 6 ? 0.2 : 0.6 };
}
