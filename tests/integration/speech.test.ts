import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/speech/transcribe/route";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { mapGetUserMediaError, transcribeBlob } from "@/lib/audio-client";

const audio = (size = 2000, type = "audio/webm") => new File([new Uint8Array(size)], "speech.webm", { type });
const req = (file: File | null, headers: Record<string, string> = { "x-audio-consent": "granted" }) => {
  const form = new FormData();
  if (file) form.set("audio", file);
  return new Request("http://localhost/api/speech/transcribe", { method: "POST", body: form, headers });
};

const ENV = ["SPEECH_PROVIDER", "SPEECH_API_KEY", "SPEECH_BASE_URL", "OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  resetRateLimits();
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const configure = () => {
  process.env.SPEECH_PROVIDER = "openai-compatible";
  process.env.SPEECH_API_KEY = "stt-secret";
  process.env.SPEECH_BASE_URL = "http://provider.test/v1";
};

describe("POST /api/speech/transcribe", () => {
  it("requires explicit consent (header set only after the consent dialog)", async () => {
    configure();
    const r = await POST(req(audio(), {}));
    expect(r.status).toBe(403);
  });

  it("reports 503 'unavailable' (not a user error) when no provider is configured", async () => {
    const r = await POST(req(audio()));
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("speech_unavailable");
  });

  it("validates the upload: missing, too short, too large, wrong type", async () => {
    configure();
    expect((await POST(req(null))).status).toBe(400);
    expect((await POST(req(audio(100)))).status).toBe(400);
    expect((await POST(req(audio(6 * 1024 * 1024)))).status).toBe(413);
    expect((await POST(req(audio(2000, "application/pdf")))).status).toBe(415);
  });

  it("returns only a transcript, with no pronunciation score, and keeps the key server-side", async () => {
    configure();
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "I usually wake up at six." }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await POST(req(audio()));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ text: "I usually wake up at six.", pronunciationScore: null });
    expect(JSON.stringify(body)).not.toContain("stt-secret");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://provider.test/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer stt-secret");
  });

  it("maps provider failures to 502 and timeouts to 504", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    expect((await POST(req(audio()))).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })));
    expect((await POST(req(audio()))).status).toBe(504);
  });

  it("requires a session when accounts are configured", async () => {
    configure();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect((await POST(req(audio()))).status).toBe(401);
  });

  it("rate limits repeated calls", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ text: "ok" }), { status: 200 })));
    const codes: number[] = [];
    for (let i = 0; i < 17; i++) codes.push((await POST(req(audio()))).status);
    expect(codes.slice(0, 15).every((c) => c === 200)).toBe(true);
    expect(codes.slice(15)).toEqual([429, 429]);
  });
});

describe("client helpers", () => {
  it("maps getUserMedia errors to actionable categories", () => {
    expect(mapGetUserMediaError({ name: "NotAllowedError" })).toBe("permission-denied");
    expect(mapGetUserMediaError({ name: "NotFoundError" })).toBe("no-microphone");
    expect(mapGetUserMediaError({ name: "NotReadableError" })).toBe("mic-busy");
    expect(mapGetUserMediaError(new Error("x"))).toBe("unknown");
  });

  it("distinguishes service-unavailable from user errors when transcribing", async () => {
    const blob = new Blob([new Uint8Array(2000)], { type: "audio/webm" });
    const cases: [number, string][] = [[503, "unavailable"], [403, "consent"], [413, "too-large"], [415, "bad-type"], [429, "rate-limited"], [504, "timeout"], [400, "too-short"], [502, "provider"]];
    for (const [status, reason] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
      expect(await transcribeBlob(blob)).toEqual({ ok: false, reason });
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await transcribeBlob(blob)).toEqual({ ok: false, reason: "network" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: " hello " }), { status: 200 })));
    expect(await transcribeBlob(blob)).toEqual({ ok: true, text: "hello" });
  });

  it("sends the consent header and a named audio part", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await transcribeBlob(new Blob([new Uint8Array(10)], { type: "audio/mp4" }));
    const init = f.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-audio-consent"]).toBe("granted");
    expect(((init.body as FormData).get("audio") as File).name).toBe("speech.mp4");
  });
});
