import { z } from "zod";
import { getSpeechConfig } from "@/lib/ai/config";
import { errorJson, guardExpensive, parseBody } from "@/lib/server/http";

export const runtime = "nodejs";
const schema = z.object({ text: z.string().trim().min(1).max(800) });

export async function POST(req: Request) {
  const blocked = await guardExpensive(req, "tts", 30);
  if (blocked) return blocked;
  const cfg = getSpeechConfig();
  if (!cfg.enabled) return errorJson("speech_unavailable", "Server text-to-speech is not configured.", 503);
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  try {
    const res = await fetch(`${cfg.baseUrl}/audio/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: cfg.ttsModel, voice: cfg.ttsVoice, input: body.data.text, response_format: "mp3" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return errorJson("speech_provider_error", "Speech service failed.", 502);
    return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch {
    return errorJson("speech_timeout", "Speech service timed out.", 504);
  }
}
