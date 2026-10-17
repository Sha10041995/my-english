export const LEVELS = ["A0", "A1", "A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export const SKILLS = ["speaking", "listening", "reading", "writing", "vocabulary", "grammar"] as const;
export type Skill = (typeof SKILLS)[number];
export const CORE_SKILLS = ["speaking", "listening", "reading", "writing"] as const satisfies readonly Skill[];

export type ActivityKind = "reading" | "listening" | "writing" | "speaking";

export interface Localized {
  uz: string;
  en: string;
}

export interface Choice {
  id: string;
  text: string;
}

export interface McqQuestion {
  id: string;
  prompt: string;
  choices: Choice[];
  answer: string;
  type: "main-idea" | "detail" | "inference" | "vocab-in-context" | "grammar" | "vocabulary";
  explanation: Localized;
}

export interface ActivityBase {
  id: string;
  kind: ActivityKind;
  level: Level;
  topic: string;
  title: string;
  minutes: number;
  /** vocabulary item ids that appear in this activity */
  vocab: string[];
  objectives: Localized;
}

export interface ReadingActivity extends ActivityBase {
  kind: "reading";
  text: string;
  glossary: Record<string, Localized>;
  questions: McqQuestion[];
}

export interface ListeningActivity extends ActivityBase {
  kind: "listening";
  speakers: { name: string; voice: "female" | "male" }[];
  script: { speaker: number; line: string }[];
  rate: number;
  questions: McqQuestion[];
}

export interface WritingActivity extends ActivityBase {
  kind: "writing";
  prompt: string;
  minWords: number;
  targetWords: number;
  genre: "sentence" | "paragraph" | "message" | "opinion" | "essay";
  starters: string[];
  timedMinutes?: number;
}

export interface SpeakingActivity extends ActivityBase {
  kind: "speaking";
  opening: string;
  openingUz: string;
  starters: string[];
  followUps: string[];
}

export type Activity = ReadingActivity | ListeningActivity | WritingActivity | SpeakingActivity;

export interface PlacementItem {
  id: string;
  skill: Skill;
  level: Level;
  topic: string;
  stem: string;
  passage?: string;
  audioText?: string;
  choices: Choice[];
  answer: string;
  explanation: Localized;
  vocab?: string[];
}

export interface VocabItem {
  id: string;
  lemma: string;
  /** multi-word expression if the item is a phrase */
  phrase?: string;
  /** inflected forms / variants to detect in learner text */
  forms: string[];
  level: Level;
  pos: string;
  meaningUz: string;
  meaningEn: string;
  example: string;
  collocations: string[];
}
