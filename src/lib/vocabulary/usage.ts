import { detectVocabulary } from "@/content/vocabulary";

/** Tracked items found in the learner's text, excluding any that merely echo the task prompt. */
export function independentUses(learnerText: string, promptText: string): string[] {
  const echoed = new Set(detectVocabulary(promptText).map((v) => v.id));
  return detectVocabulary(learnerText)
    .map((v) => v.id)
    .filter((id) => !echoed.has(id));
}
