import { getAiConfig, getSpeechConfig } from "@/lib/ai/config";
import { json } from "@/lib/server/http";
import { supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";

/** Public capability report. Contains no secrets – only which features are live vs demo. */
export async function GET() {
  const ai = getAiConfig();
  const speech = getSpeechConfig();
  return json({
    llm: ai.provider === "none" ? "demo" : ai.provider,
    speechServer: speech.enabled,
    accounts: supabaseConfigured(),
  });
}
