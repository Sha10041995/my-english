import { describe, expect, it } from "vitest";
import { DEFAULT_SRS, estimateVocabulary, isDue, needsReview, recordEncounter, recordRetrieval, stageOf } from "@/lib/vocabulary/srs";

const t0 = new Date("2026-01-01T09:00:00Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

describe("vocabulary state machine", () => {
  it("exposure alone never advances beyond 'encountered'", () => {
    let v = recordEncounter(undefined, "afford", "read-1", t0);
    for (let i = 0; i < 10; i++) v = recordEncounter(v, "afford", `ctx-${i}`, days(i));
    expect(stageOf(v)).toBe("encountered");
    expect(v.successCount).toBe(0);
    expect(v.exposureCount).toBe(11);
  });

  it("a single correct recognition gives 'recognized', not durable recall", () => {
    let v = recordEncounter(undefined, "afford", "r", t0);
    v = recordRetrieval(v, "afford", { mode: "recognition", success: true, contextId: "q" }, days(1));
    expect(stageOf(v)).toBe("recognized");
    expect(estimateVocabulary([v]).receptiveConfirmed).toBe(0);
  });

  it("assisted recall moves recognized -> recalled", () => {
    let v = recordEncounter(undefined, "a", "r", t0);
    v = recordRetrieval(v, "a", { mode: "recognition", success: true, contextId: "q" }, days(1));
    v = recordRetrieval(v, "a", { mode: "assisted", success: true, contextId: "q" }, days(2));
    expect(v.recognition).toBe("recalled");
    expect(stageOf(v)).toBe("recalled_assisted");
  });

  it("independent use in two contexts -> multi_context; one context -> independent", () => {
    let v = recordRetrieval(undefined, "a", { mode: "independent", success: true, contextId: "write-1" }, t0);
    expect(stageOf(v)).toBe("used_independently");
    v = recordRetrieval(v, "a", { mode: "independent", success: true, contextId: "write-1" }, days(1));
    expect(stageOf(v)).toBe("used_independently");
    v = recordRetrieval(v, "a", { mode: "independent", success: true, contextId: "speak-1" }, days(2));
    expect(stageOf(v)).toBe("used_multi_context");
  });

  it("failure shortens the interval, counts a lapse and demotes recalled words", () => {
    let v = recordRetrieval(undefined, "a", { mode: "independent", success: true, contextId: "x" }, t0);
    v = recordRetrieval(v, "a", { mode: "independent", success: true, contextId: "x" }, days(1));
    const before = v.intervalDays;
    v = recordRetrieval(v, "a", { mode: "assisted", success: false, contextId: "x" }, days(5));
    expect(v.intervalDays).toBe(DEFAULT_SRS.lapseInterval);
    expect(v.intervalDays).toBeLessThan(before);
    expect(v.lapses).toBe(1);
    expect(v.recognition).toBe("recognized");
  });

  it("intervals grow with successes and are capped", () => {
    let v = recordEncounter(undefined, "a", "r", t0);
    let prev = 0;
    for (let i = 0; i < 30; i++) {
      v = recordRetrieval(v, "a", { mode: "assisted", success: true, contextId: "q" }, days(i));
      expect(v.intervalDays).toBeGreaterThanOrEqual(prev);
      prev = v.intervalDays;
    }
    expect(v.intervalDays).toBeLessThanOrEqual(DEFAULT_SRS.maxIntervalDays);
  });

  it("recognition grows more slowly than independent use", () => {
    const a = recordRetrieval(recordRetrieval(undefined, "a", { mode: "recognition", success: true, contextId: "q" }, t0), "a", { mode: "recognition", success: true, contextId: "q" }, days(1));
    const b = recordRetrieval(recordRetrieval(undefined, "b", { mode: "independent", success: true, contextId: "q" }, t0), "b", { mode: "independent", success: true, contextId: "q" }, days(1));
    expect(b.intervalDays).toBeGreaterThan(a.intervalDays);
  });

  it("due / needs-review flags", () => {
    const v = recordEncounter(undefined, "a", "r", t0);
    expect(isDue(v, t0)).toBe(false);
    expect(isDue(v, days(1))).toBe(true);
    expect(needsReview(v, days(1))).toBe(true);
  });

  it("confirmed receptive requires a success >= 3 days after first sight", () => {
    let v = recordEncounter(undefined, "a", "r", t0);
    v = recordRetrieval(v, "a", { mode: "assisted", success: true, contextId: "q" }, days(1));
    v = recordRetrieval(v, "a", { mode: "assisted", success: true, contextId: "q" }, days(2));
    expect(estimateVocabulary([v]).receptiveConfirmed).toBe(0);
    v = recordRetrieval(v, "a", { mode: "assisted", success: true, contextId: "q" }, days(4));
    expect(estimateVocabulary([v]).receptiveConfirmed).toBe(1);
  });
});
