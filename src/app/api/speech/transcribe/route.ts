import { getSpeechConfig } from "@/lib/ai/config";
import { errorJson, guardExpensive, json } from "@/lib/server/http";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_BYTES = 800;
const ALLOWED = ["audio/webm", "audio/wav", "audio/x-wav", "audio/mp4", "audio/mpeg", "audio/ogg"];

/**
 * Speech-to-text. Audio is streamed to the provider and never written to disk or logged.
 * The response contains the transcript only – `pronunciationScore` is always null because no
 * pronunciation analysis is performed.
 */
export async function POST(req: Request) {
  const blocked = await guardExpensive(req, "stt", 15);
  if (blocked) return blocked;
  // Defense in depth: the client sends this header only after the user accepted the consent dialog.
  if (req.headers.get("x-audio-consent") !== "granted") return errorJson("consent_required", "Audio consent is required.", 403);
  const cfg = getSpeechConfig();
  if (!cfg.enabled) return errorJson("speech_unavailable", "Server speech recognition is not configured. Use browser dictation or type your answer.", 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson("bad_form", "Expected multipart form data.", 400);
  }
  const file = form.get("audio");
  if (!(file instanceof File)) return errorJson("invalid_input", "Missing audio file.", 400);
  if (file.size > MAX_BYTES) return errorJson("too_large", "Audio is too large (max 5 MB).", 413);
  if (file.size < MIN_BYTES) return errorJson("too_short", "Recording is too short.", 400);
  if (!ALLOWED.some((t) => file.type.startsWith(t))) return errorJson("bad_type", "Unsupported audio type.", 415);

  const out = new FormData();
  out.set("file", file, file.name || "speech.webm");
  out.set("model", cfg.sttModel);
  out.set("language", "en");
  try {
    const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.apiKey}` },
      body: out,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return errorJson("speech_provider_error", "Speech service failed. Please type your answer instead.", 502);
    const data = (await res.json()) as { text?: string };
    return json({ text: String(data.text ?? "").slice(0, 2000), pronunciationScore: null });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return errorJson(timedOut ? "speech_timeout" : "speech_provider_error", "Speech service unavailable. Please type your answer instead.", timedOut ? 504 : 502);
  }
}
