import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { completeJson, extractJson } from "@/lib/ai/llm";
import { getAiConfig } from "@/lib/ai/config";
import { runTutor, runWritingFeedback } from "@/lib/server/ai-services";
import { rateLimit, resetRateLimits } from "@/lib/server/rate-limit";
import { createInitialState, parseState } from "@/lib/learning-engine/state";

const cfg = { provider: "anthropic" as const, apiKey: "secret-key", model: "m", baseUrl: "http://x", timeoutMs: 200 };
const reply = (obj: unknown) => new Response(JSON.stringify({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }] }), { status: 200 });

const tutorReq = { activityId: "speak-a2-routine", learnerText: "I wake up at six and I go to work.", history: [], turnIndex: 0, intensity: "balanced" as const, explanationLanguage: "uz" as const, trackedPhrases: [] };
const goodTutor = { reply: "Nice routine!", followUp: "What do you eat for breakfast?", corrections: [], praise: ["Clear sentences."] };

describe("AI provider layer", () => {
  it("is in demo mode without keys", () => {
    expect(getAiConfig({}).provider).toBe("none");
    expect(getAiConfig({ AI_PROVIDER: "anthropic" }).provider).toBe("none");
    expect(getAiConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "x" }).provider).toBe("anthropic");
  });

  it("extracts JSON from fenced/prose output and rejects garbage", () => {
    expect(extractJson("Sure!\n```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
    expect(() => extractJson("no json")).toThrow();
  });

  it("returns validated AI output and labels it as ai", async () => {
    const f = vi.fn().mockResolvedValue(reply(goodTutor));
    const turn = await runTutor(tutorReq, { cfg, fetchImpl: f });
    expect(turn.source).toBe("ai");
    expect(turn.followUp).toMatch(/breakfast/);
    expect(f).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.messages[0].content).toContain("<learner_text>");
  });

  it("falls back to the demo tutor on malformed output (after one retry)", async () => {
    const f = vi.fn().mockImplementation(async () => reply("totally not json"));
    const turn = await runTutor(tutorReq, { cfg, fetchImpl: f });
    expect(turn.source).toBe("demo");
    expect(turn.fallbackReason).toBe("malformed");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("falls back on schema violations", async () => {
    const f = vi.fn().mockImplementation(async () => reply({ reply: 5, followUp: "x", corrections: [], praise: [] }));
    expect((await runTutor(tutorReq, { cfg, fetchImpl: f })).source).toBe("demo");
  });

  it("falls back on HTTP errors and on timeouts", async () => {
    const f500 = vi.fn().mockImplementation(async () => new Response("err", { status: 500 }));
    const t = await runTutor(tutorReq, { cfg, fetchImpl: f500 });
    expect(t.source).toBe("demo");
    expect(t.fallbackReason).toBe("http");
    const slow = vi.fn().mockImplementation(
      (_u: string, init?: RequestInit) =>
        new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    );
    const t2 = await runTutor(tutorReq, { cfg: { ...cfg, timeoutMs: 30 }, fetchImpl: slow });
    expect(t2.fallbackReason).toBe("timeout");
  });

  it("returns only schema fields and never echoes the API key", async () => {
    const evil = { ...goodTutor, reply: "<script>alert(1)</script>", extra: "ignore me" };
    const turn = await runTutor(tutorReq, { cfg, fetchImpl: vi.fn().mockResolvedValue(reply(evil)) });
    expect(JSON.stringify(turn)).not.toContain("secret-key");
    expect((turn as unknown as Record<string, unknown>).extra).toBeUndefined();
  });

  it("writing: AI feedback validated; failure keeps the rule-based result", async () => {
    const ai = {
      dimensions: ["task", "organization", "vocabulary", "grammar", "register"].map((id) => ({ id, score: 4, comment: "ok" })),
      strengths: ["good"],
      corrections: [],
      nextStep: "Rewrite the intro.",
    };
    const req = { activityId: "write-b1-opinion", text: "I think a teacher is useful because she explains well. However, apps are cheaper.", explanationLanguage: "en" as const };
    const ok = await runWritingFeedback(req, { cfg, fetchImpl: vi.fn().mockResolvedValue(reply(ai)) });
    expect(ok.source).toBe("ai");
    expect(ok.overall).toBeCloseTo(0.8);
    const bad = await runWritingFeedback(req, { cfg, fetchImpl: vi.fn().mockImplementation(async () => new Response("x", { status: 503 })) });
    expect(bad.source).toBe("rule-based");
    expect(bad.fallbackReason).toBe("http");
  });

  it("rejects unknown activities", async () => {
    await expect(runTutor({ ...tutorReq, activityId: "nope" }, { cfg: { ...cfg, provider: "none" } })).rejects.toThrow();
  });

  it("does not call out when no provider is configured", async () => {
    const f = vi.fn();
    await expect(completeJson({ ...cfg, provider: "none" }, "s", "u", z.object({}), f)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());
  it("blocks after the limit and recovers after the window", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 1000 + i).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, 1010);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("k", 3, 1000, 2500).ok).toBe(true);
    expect(rateLimit("other", 3, 1000, 1010).ok).toBe(true);
  });
});

describe("persisted state validation", () => {
  it("round-trips valid state and rejects tampered state", () => {
    const s = createInitialState();
    expect(parseState(JSON.parse(JSON.stringify(s)))).not.toBeNull();
    expect(parseState({ ...s, xp: "lots" })).toBeNull();
    expect(parseState({ ...s, profile: { ...s.profile, explanationLanguage: "fr" } })).toBeNull();
    expect(parseState(null)).toBeNull();
  });
});
