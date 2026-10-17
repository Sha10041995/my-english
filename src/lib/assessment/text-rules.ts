import type { Level, Localized } from "@/types/domain";
import { detectVocabulary } from "@/content/vocabulary";

/**
 * Rule-based text analysis. These are transparent heuristics for beginners' common
 * patterns – NOT an AI evaluation and NOT an official CEFR/exam score.
 */

export interface ErrorRule {
  id: string;
  pattern: RegExp;
  fix: (m: RegExpMatchArray) => string;
  explain: Localized;
  /** higher = more likely to block meaning / fossilise */
  priority: 1 | 2 | 3;
}

const BASE_VERBS = "go|have|do|like|want|work|live|play|study|need|make|take|come|know|think|eat|read|write|watch|speak|get|see|say";
const third = (v: string) => (v === "go" ? "goes" : v === "have" ? "has" : v === "do" ? "does" : v.endsWith("y") && !/[aeiou]y$/.test(v) ? v.slice(0, -1) + "ies" : /(s|sh|ch|x|z)$/.test(v) ? v + "es" : v + "s");

export const ERROR_RULES: ErrorRule[] = [
  {
    id: "i-am-agree",
    pattern: /\bI am agree\b/gi,
    fix: () => "I agree",
    explain: { en: "\"Agree\" is a verb, so we don't use \"am\": I agree.", uz: "\"Agree\" fe'l, shuning uchun \"am\" kerak emas: I agree." },
    priority: 3,
  },
  {
    id: "very-like",
    pattern: /\bI very (like|love|want|need)\b/gi,
    fix: (m) => `I really ${m[1].toLowerCase()}`,
    explain: { en: "\"Very\" doesn't go before a verb. Use \"really\" or put \"very much\" after: I really like it / I like it very much.", uz: "\"Very\" fe'ldan oldin kelmaydi. \"Really\" ishlating yoki \"very much\" ni oxirga qo'ying." },
    priority: 2,
  },
  {
    id: "third-person-s",
    pattern: new RegExp(`(?<!\\b(?:can|will|could|would|should|must|to|does|did|do|not|may|might|and|let's|n't|don't|didn't)\\s)\\b(he|she|it)\\s+(${BASE_VERBS})\\b`, "gi"),
    fix: (m) => `${m[1]} ${third(m[2].toLowerCase())}`,
    explain: { en: "With he/she/it in the present simple, add -s/-es to the verb: she goes, he has.", uz: "he/she/it bilan Present Simple'da fe'lga -s/-es qo'shiladi: she goes, he has." },
    priority: 3,
  },
  {
    id: "double-comparative",
    pattern: /\bmore (better|bigger|easier|cheaper|faster|worse|smaller|older)\b/gi,
    fix: (m) => m[1].toLowerCase(),
    explain: { en: "Short comparatives already mean \"more\": better, bigger – not \"more better\".", uz: "Qisqa qiyosiy sifatlar o'zi \"more\" ma'nosini beradi: better, bigger." },
    priority: 2,
  },
  {
    id: "have-years",
    pattern: /\bI have (\d{1,2}) years?( old)?\b/gi,
    fix: (m) => `I am ${m[1]} years old`,
    explain: { en: "In English we use \"be\" for age: I am 20 years old.", uz: "Yoshni ifodalashda \"be\" ishlatiladi: I am 20 years old." },
    priority: 3,
  },
  {
    id: "depend-of",
    pattern: /\bdepends? of\b/gi,
    fix: (m) => m[0].replace(/of/i, "on"),
    explain: { en: "The preposition is \"on\": depend on.", uz: "Predlog \"on\": depend on." },
    priority: 2,
  },
  {
    id: "discuss-about",
    pattern: /\bdiscuss(ed|es|ing)? about\b/gi,
    fix: (m) => `discuss${m[1] ?? ""}`,
    explain: { en: "\"Discuss\" doesn't need \"about\": we discussed the plan.", uz: "\"Discuss\" dan keyin \"about\" kerak emas." },
    priority: 2,
  },
  {
    id: "uncountable-plural",
    pattern: /\b(informations|advices|furnitures|knowledges|homeworks)\b/gi,
    fix: (m) => m[1].slice(0, -1),
    explain: { en: "This noun is uncountable and has no plural: information, advice.", uz: "Bu ot sanalmaydi va ko'plik shakli yo'q: information, advice." },
    priority: 2,
  },
  {
    id: "did-past",
    pattern: /\b(didn't|did not|doesn't|does not|don't|do not) (went|had|came|saw|took|made|ate|wrote|got|said)\b/gi,
    fix: (m) => {
      const base: Record<string, string> = { went: "go", had: "have", came: "come", saw: "see", took: "take", made: "make", ate: "eat", wrote: "write", got: "get", said: "say" };
      return `${m[1]} ${base[m[2].toLowerCase()]}`;
    },
    explain: { en: "After did/does/do (not), use the base verb: I didn't go.", uz: "did/does/do dan keyin fe'lning asosiy shakli ishlatiladi: I didn't go." },
    priority: 3,
  },
  {
    id: "people-is",
    pattern: /\bpeople (is|was)\b/gi,
    fix: (m) => `people ${m[1].toLowerCase() === "is" ? "are" : "were"}`,
    explain: { en: "\"People\" is plural: people are.", uz: "\"People\" ko'plik: people are." },
    priority: 2,
  },
  {
    id: "am-base-verb",
    pattern: /\bI am (go|work|study|live|like|play|read|write|eat)\b/gi,
    fix: (m) => `I ${m[1].toLowerCase()}`,
    explain: { en: "Don't mix \"am\" with a base verb. Say \"I work\" or \"I am working\".", uz: "\"am\" ni fe'lning asosiy shakli bilan aralashtirmang: \"I work\" yoki \"I am working\"." },
    priority: 3,
  },
  {
    id: "article-a-an-vowel",
    pattern: /\ba ((?!uni|use|eu|one|ur|us)[aeiou]\w*)\b/gi,
    fix: (m) => `an ${m[1]}`,
    explain: { en: "Use \"an\" before a vowel sound: an apple.", uz: "Unli tovush oldidan \"an\" ishlatiladi: an apple." },
    priority: 1,
  },
  {
    id: "article-an-consonant",
    pattern: /\ban ((?!hour|honest|honou?r|heir)[bcdfgjklmnpqrstvwxyz]\w*)\b/gi,
    fix: (m) => `a ${m[1]}`,
    explain: { en: "Use \"a\" before a consonant sound: a book.", uz: "Undosh tovush oldidan \"a\" ishlatiladi: a book." },
    priority: 1,
  },
];

// Case-sensitive: lowercase pronoun "i".
const LOWER_I = /(^|[\s.!?"(])i(?=[\s',.!?])/g;

export interface DetectedIssue {
  ruleId: string;
  original: string;
  suggestion: string;
  explain: Localized;
  priority: 1 | 2 | 3;
}

export function detectIssues(text: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  for (const rule of ERROR_RULES) {
    for (const m of text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g"))) {
      issues.push({ ruleId: rule.id, original: m[0], suggestion: rule.fix(m), explain: rule.explain, priority: rule.priority });
    }
  }
  if (LOWER_I.test(text)) {
    LOWER_I.lastIndex = 0;
    issues.push({
      ruleId: "lowercase-i",
      original: "i",
      suggestion: "I",
      explain: { en: "The pronoun \"I\" is always a capital letter.", uz: "\"I\" olmoshi doim bosh harf bilan yoziladi." },
      priority: 1,
    });
  }
  LOWER_I.lastIndex = 0;
  return issues.sort((a, b) => b.priority - a.priority);
}

/** Apply fixes for the detected issues to produce a "more natural" version. Only touches matched spans. */
export function applyFixes(text: string): string {
  let out = text;
  for (const rule of ERROR_RULES) {
    out = out.replace(new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g"), (...args) => {
      const groups = args.slice(0, -2) as unknown as RegExpMatchArray;
      return rule.fix(groups);
    });
  }
  return out.replace(LOWER_I, (_m, pre) => `${pre}I`);
}

const CONNECTORS: { level: Level; words: string[] }[] = [
  { level: "A1", words: ["and", "but", "because", "then", "so"] },
  { level: "A2", words: ["after that", "first", "also", "when", "while", "before", "after"] },
  { level: "B1", words: ["however", "although", "for example", "on the other hand", "as a result", "in my opinion", "therefore", "in addition"] },
  { level: "B2", words: ["whereas", "nevertheless", "admittedly", "moreover", "in conclusion", "despite", "furthermore", "consequently", "in the long run"] },
];

export interface TextStats {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  uniqueRatio: number;
  longWordRatio: number;
  paragraphs: number;
  connectors: { level: Level; word: string }[];
  highestConnectorLevel: Level;
  trackedVocabIds: string[];
}

export function textStats(text: string): TextStats {
  const clean = text.trim();
  const tokens = clean.toLowerCase().match(/[a-z']+/g) ?? [];
  const sentences = clean.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const lower = ` ${clean.toLowerCase().replace(/\s+/g, " ")} `;
  const connectors: TextStats["connectors"] = [];
  for (const group of CONNECTORS) {
    for (const w of group.words) if (new RegExp(`[\\s,.;(]${w}[\\s,.;)]`).test(lower)) connectors.push({ level: group.level, word: w });
  }
  const order: Level[] = ["A0", "A1", "A2", "B1", "B2"];
  const highest = connectors.reduce<Level>((h, c) => (order.indexOf(c.level) > order.indexOf(h) ? c.level : h), "A0");
  return {
    words: tokens.length,
    sentences: sentences.length,
    avgSentenceLength: sentences.length ? tokens.length / sentences.length : 0,
    uniqueRatio: tokens.length ? new Set(tokens).size / tokens.length : 0,
    longWordRatio: tokens.length ? tokens.filter((t) => t.length >= 7).length / tokens.length : 0,
    paragraphs: clean ? clean.split(/\n\s*\n/).filter(Boolean).length : 0,
    connectors,
    highestConnectorLevel: highest,
    trackedVocabIds: detectVocabulary(clean).map((v) => v.id),
  };
}

/** Rough level hint from surface features. Low-confidence by design. */
export function levelHint(stats: TextStats, issueCount: number): Level {
  if (stats.words < 6) return "A0";
  const errorRate = issueCount / Math.max(1, stats.words / 20);
  let score = 1;
  if (stats.avgSentenceLength >= 8) score += 0.5;
  if (stats.avgSentenceLength >= 12) score += 0.5;
  if (stats.longWordRatio > 0.12) score += 0.5;
  if (stats.highestConnectorLevel === "B1") score += 0.7;
  if (stats.highestConnectorLevel === "B2") score += 1.2;
  if (stats.uniqueRatio > 0.7 && stats.words > 40) score += 0.3;
  score -= Math.min(1.2, errorRate * 0.5);
  if (score < 1.3) return "A1";
  if (score < 2.3) return "A2";
  if (score < 3.2) return "B1";
  return "B2";
}
