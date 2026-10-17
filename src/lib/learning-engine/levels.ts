import { LEVELS, type Level } from "@/types/domain";

/** Numeric proficiency scale: A0=0 .. B2=4. Item difficulty is the numeric level. */
export function levelToNumber(level: Level): number {
  return LEVELS.indexOf(level);
}

export function numberToLevel(n: number): Level {
  if (n < 0.75) return "A0";
  if (n < 1.6) return "A1";
  if (n < 2.5) return "A2";
  if (n < 3.4) return "B1";
  return "B2";
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
