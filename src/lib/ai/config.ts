/** Server-only configuration. Never import this from client components. */
export type LlmProviderName = "anthropic" | "openai-compatible" | "none";

export interface AiConfig {
  provider: LlmProviderName;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

export function getAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const requested = (env.AI_PROVIDER ?? "none").toLowerCase();
  const timeoutMs = Number(env.AI_TIMEOUT_MS ?? 20000) || 20000;
  if (requested === "anthropic" && env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      baseUrl: env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
      timeoutMs,
    };
  }
  if (requested === "openai-compatible" && env.OPENAI_API_KEY) {
    return {
      provider: "openai-compatible",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
      baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      timeoutMs,
    };
  }
  return { provider: "none", apiKey: "", model: "", baseUrl: "", timeoutMs };
}

export interface SpeechConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export function getSpeechConfig(env: Record<string, string | undefined> = process.env): SpeechConfig {
  const key = env.SPEECH_API_KEY ?? env.OPENAI_API_KEY ?? "";
  return {
    enabled: env.SPEECH_PROVIDER === "openai-compatible" && key.length > 0,
    apiKey: key,
    baseUrl: env.SPEECH_BASE_URL ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    sttModel: env.SPEECH_STT_MODEL ?? "whisper-1",
    ttsModel: env.SPEECH_TTS_MODEL ?? "tts-1",
    ttsVoice: env.SPEECH_TTS_VOICE ?? "alloy",
  };
}
