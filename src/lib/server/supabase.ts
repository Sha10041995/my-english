import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export function supabaseConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export interface AuthedContext {
  user: User;
  /** Client acting as the user; Row Level Security applies. */
  db: SupabaseClient;
}

/**
 * Validate the bearer token with Supabase Auth. The returned client carries the user's JWT, so every
 * query is evaluated under RLS – the service-role key is never needed for user data.
 */
export async function authenticate(req: Request): Promise<AuthedContext | null> {
  if (!supabaseConfigured()) return null;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, db };
}
