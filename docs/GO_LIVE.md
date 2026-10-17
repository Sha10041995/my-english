# Go-live checklist (what only the owner can do)

Everything below needs an account, a secret or a human. The code is ready for each step.

## A. Try it locally (2 minutes, no accounts)
```
npm.cmd install
npm.cmd run dev        # http://localhost:3000
```
(`npm.cmd` avoids the PowerShell script-policy error.)

## B. Real AI feedback (optional, ~5 minutes)
Create `.env.local` (never commit it):
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...your key...
```
Restart `npm run dev`. Settings → "AI & speech status" should show `anthropic`. Writing/Speaking feedback is then labelled "AI-generated" and falls back to rules if the provider fails.

## C. Voice recording + transcription (optional)
```
SPEECH_PROVIDER=openai-compatible
SPEECH_API_KEY=...        # or reuse OPENAI_API_KEY
```
The Speaking page then shows **Record** (after the consent dialog). Without it, browser dictation / typing is used.

## D. Accounts + cloud backup on Supabase (~10 minutes)
1. supabase.com → New project.
2. SQL Editor → run, in order: `supabase/migrations/0001_init.sql`, `0002_content_in_bundle.sql`, `supabase/seed.sql`.
3. Authentication → Providers → Email: enable. For the smoke test below, temporarily turn **off** "Confirm email".
4. Project Settings → API: copy the Project URL and the **anon** key (NOT the service-role key) into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. `node scripts/smoke-supabase.mjs` → expect `17/17 checks passed` (isolation between two throw-away users, anon blocked, content read-only).
6. Delete the two `smoke-*@example.com` users in Authentication → Users; turn "Confirm email" back **on**; add your site URL under Authentication → URL Configuration.

## E. Deploy (Vercel or any Node host)
Set the same environment variables in the host's dashboard, `npm run build && npm start`. Multi-instance deployments should replace the in-memory rate limiter with a shared store (Redis/Upstash).

## F. Uzbek review (a person is required)
Send `docs/uzbek-review.csv` (`npm run uz:export`) to a native speaker/teacher; then `npm run uz:apply`. See `docs/UZBEK_REVIEW.md`.
