import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "./rate-limit";
import { authenticate, supabaseConfigured } from "./supabase";

export const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const errorJson = (code: string, message: string, status: number, headers?: Record<string, string>) =>
  json({ error: { code, message } }, status, headers);

/**
 * Common guard for expensive endpoints: when Supabase auth is configured a valid user is required;
 * otherwise (local/demo deployment) callers are accepted but still rate limited per client.
 */
export async function guardExpensive(req: Request, bucket: string, limit = 20, windowMs = 60_000): Promise<NextResponse | null> {
  let who = clientKey(req);
  if (supabaseConfigured()) {
    const auth = await authenticate(req);
    if (!auth) return errorJson("unauthorized", "Sign in to use this feature.", 401);
    who = auth.user.id;
  }
  const rl = rateLimit(`${bucket}:${who}`, limit, windowMs);
  if (!rl.ok) return errorJson("rate_limited", "Too many requests. Please wait a moment.", 429, { "Retry-After": String(rl.retryAfterSec) });
  return null;
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T, maxBytes = 64_000): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, res: errorJson("too_large", "Request body too large.", 413) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: errorJson("bad_json", "Invalid JSON.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: errorJson("invalid_input", "Input did not pass validation.", 400) };
  return { ok: true, data: parsed.data };
}
