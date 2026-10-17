import { z } from "zod";
import type { AiConfig } from "./config";

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "http" | "malformed" | "unavailable",
  ) {
    super(message);
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function callOnce(cfg: AiConfig, system: string, user: string, fetchImpl: FetchLike): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    let res: Response;
    if (cfg.provider === "anthropic") {
      res = await fetchImpl(`${cfg.baseUrl}/v1/messages`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: cfg.model, max_tokens: 1200, system, messages: [{ role: "user", content: user }] }),
      });
    } else if (cfg.provider === "openai-compatible") {
      res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
    } else {
      throw new AiError("No AI provider configured", "unavailable");
    }
    if (!res.ok) throw new AiError(`Provider returned HTTP ${res.status}`, "http");
    const body = (await res.json()) as Record<string, unknown>;
    if (cfg.provider === "anthropic") {
      const content = body.content as { type: string; text?: string }[] | undefined;
      return content?.find((c) => c.type === "text")?.text ?? "";
    }
    const choices = body.choices as { message?: { content?: string } }[] | undefined;
    return choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AiError("Provider timed out", "timeout");
    throw new AiError("Provider request failed", "http");
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from model text (models sometimes wrap JSON in prose or fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("No JSON object in model output", "malformed");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError("Model output was not valid JSON", "malformed");
  }
}

/**
 * Call the provider and validate the response against `schema`. Retries once on transient
 * failures (timeout/http) and once on malformed output. Model output is treated as untrusted:
 * only schema-validated fields are returned, and they are rendered as plain text by the UI.
 */
export async function completeJson<T extends z.ZodType>(
  cfg: AiConfig,
  system: string,
  user: string,
  schema: T,
  fetchImpl: FetchLike = fetch,
): Promise<z.infer<T>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOnce(cfg, system, user, fetchImpl);
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      throw new AiError("Model output failed schema validation", "malformed");
    } catch (e) {
      lastErr = e;
      if (e instanceof AiError && e.code === "unavailable") break;
    }
  }
  throw lastErr instanceof AiError ? lastErr : new AiError("AI request failed", "http");
}
