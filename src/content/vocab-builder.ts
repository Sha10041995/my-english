import type { Level, VocabItem } from "@/types/domain";

export const v = (
  id: string,
  lemma: string,
  level: Level,
  pos: string,
  meaningUz: string,
  meaningEn: string,
  example: string,
  forms: string[],
  collocations: string[],
  phrase?: string,
): VocabItem => ({ id, lemma, phrase, level, pos, meaningUz, meaningEn, example, forms, collocations });
