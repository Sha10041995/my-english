# LinguaQuest AI

Adaptive English-learning platform for Uzbek-speaking learners (A0 → toward CEFR B2): placement check, daily plan, Reading, Listening, Writing, AI Speaking, contextual vocabulary with spaced repetition, missions/streaks, mock exam and honest progress reporting.

> **Honesty notes.** Levels shown are *provisional estimates*, not official CEFR results. Nothing here guarantees a B2 certificate. In demo mode the "tutor" and "writing feedback" are rule-based heuristics, not AI, and are labelled as such. Pronunciation is **never** scored (audio is not analysed). Uzbek UI strings and glosses are drafts that need native-speaker review.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  (demo mode, no keys needed)
```

Checks:

```bash
npm run lint
npm run typecheck
npm test             # Vitest unit + integration
npm run build
npm run test:e2e     # Playwright against the production build (uses installed Microsoft Edge;
                     # set PW_CHANNEL=chromium after `npx playwright install chromium` otherwise)
```

## Modes

| Capability | Demo (no env vars) | Configured |
|---|---|---|
| Writing feedback | Rule-based (common-error patterns + rubric heuristics), labelled | LLM via `AI_PROVIDER`, schema-validated, labelled "AI-generated"; falls back to rule-based on timeout / HTTP error / malformed JSON |
| Speaking tutor | Scripted follow-ups + error patterns, labelled demo | LLM turn (reply, follow-up, corrections, natural version) validated by Zod |
| Speech input | Browser `SpeechRecognition` dictation (if supported) else typing | In-app microphone recording (`MediaRecorder`) → `/api/speech/transcribe` (OpenAI-compatible STT), **only after an explicit consent dialog**; transcript is editable before sending; audio is not stored; no pronunciation score |
| Speech output | Browser `speechSynthesis` (synthetic voices, disclosed in UI) | `/api/speech/synthesize` available |
| Persistence | `localStorage` (export / import / delete in Settings) | Supabase Auth + `/api/sync`: JSON snapshot **plus** a derived projection into the normalised tables (profiles, skill_progress, user_vocabulary, activity_attempts, assessment_attempts, user_achievements, user_missions); explicit Save/Load buttons |

## Environment variables
See [.env.example](.env.example). Required: **none**. `AI_PROVIDER=anthropic` needs `ANTHROPIC_API_KEY`; `openai-compatible` needs `OPENAI_API_KEY`; Supabase needs the URL + anon key. The service-role key is never used by the app.

## Database (Supabase)
1. Create a project; enable Email auth (magic link).
2. Run `supabase/migrations/0001_init.sql`, `0002_content_in_bundle.sql`, then `supabase/seed.sql` (SQL editor or `supabase db push`).
3. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

All user tables have RLS with owner-only policies (`user_id = auth.uid()`); content tables are read-only to signed-in users. The API validates the bearer token server-side and queries with the *user's* JWT, so RLS is the final authority. When accounts are configured, AI/speech endpoints also require a valid session.

## Architecture
```
src/
  app/                 Next.js routes (UI pages + /api route handlers)
  components/          AppShell, AppProvider (state), UI kit, Quiz, ResultPanel
  features/            reading, listening, writing, speaking, vocabulary player components
  content/             original learning content (vocabulary, placement bank, activities)
  lib/
    learning-engine/   proficiency estimation, recommendation, applyAttempt, state schema
    assessment/        placement (adaptive), text rules, feedback/rubric, mock-exam config
    vocabulary/        SRS state machine, review selection, usage detection
    gamification/      XP, streaks, missions, achievements
    ai/ + server/      provider abstraction (timeouts, retry, Zod validation), rate limit, auth
supabase/              migrations + seed
tests/                 unit/, integration/, e2e/
docs/LEARNING_ENGINE.md  transparent rules
```
Domain logic is pure TypeScript (no React/IO) and covered by unit tests; AI providers sit behind `completeJson()`; model output is schema-validated and rendered only as text.

## What is tested (and what isn't)
Automated (all run in this repo):
- **Unit/integration (Vitest, 98 tests):** SRS/state transitions, estimator guard rails (no B2 on thin evidence), adaptive placement, XP/streak/mission logic, error-pattern rules, content integrity (unique ids, valid answers, vocabulary references, example sentences contain their own forms), AI fallback/timeout/malformed-output handling (mocked fetch), speech route (consent, validation, provider errors, rate limit, auth), rate limiting, state validation.
- **RLS + schema on real PostgreSQL (PGlite, 21 tests):** both migrations and the seed are executed; the app's projection rows are written through the same code path as `/api/sync`; user B cannot read/update/delete/insert user A's rows in every user table; anon sees nothing; content tables are read-only; erasure removes only the caller's rows; a mutation check proves the harness would catch a missing policy.
- **E2E (Playwright, 11 tests, Edge with a fake microphone):** onboarding → placement → activities → feedback → vocabulary tracking, responsive nav, API validation/rate limit, auth enforcement (unreachable Supabase URL), voice-recording consent / refusal / blocked microphone / service outage.

**Not tested:** real LLM / STT / TTS providers (only mocked HTTP), a *hosted* Supabase project (PGlite stubs `auth.users`, `auth.uid()` and the `anon`/`authenticated` roles; PostgREST and JWT verification are not exercised), real microphones/speech quality, screen readers, Safari/Firefox.

## Known limitations
- Content is still small (96 vocabulary items, 44 placement items, 12 readings, 7 listenings, 8 writings, 8 speaking topics). Level labels are authors' estimates, not calibrated.
- **Uzbek text is unreviewed AI-drafted text** (0 of ~670 strings reviewed). Use `npm run uz:export` / `uz:apply` — see [docs/UZBEK_REVIEW.md](docs/UZBEK_REVIEW.md).
- Placement is short (≤16 items) and low-confidence; writing/speaking placement are rule-based.
- Rule-based feedback only catches a fixed list of common errors (typical for Uzbek speakers); it does not understand meaning.
- Cloud sync is last-write-wins and manual. The snapshot is the source of truth; normalised tables are a derived projection (no raw learner text is projected). Writes to separate tables are not one transaction — if projection fails the snapshot is still saved and the API reports `normalized: false`.
- Rate limiter is in-memory (per instance). Conversation text is stored in local state (and in the snapshot if synced).
- Mock exam is a generic unofficial format; no official exam format is implemented.
- Browser speech APIs vary; Firefox lacks `SpeechRecognition`.

## Deployment
Any Node host / Vercel: set env vars, `npm run build && npm start`. For multiple instances, replace the in-memory rate limiter with a shared store.

See [docs/GO_LIVE.md](docs/GO_LIVE.md) for the owner-only steps (API keys, Supabase project, deploy, Uzbek review) and `node scripts/smoke-supabase.mjs` for the hosted-Supabase smoke test.

## Next priorities
1. Get a native speaker to review `docs/uzbek-review.csv`, then keep growing and calibrating content with real learner data.
2. Run the migrations and a smoke test against a hosted Supabase project (JWT, PostgREST, grants), and move reads to the normalised tables.
3. Pronunciation feedback only once a real analyser is integrated; add a streaming/short-utterance STT mode and evaluate STT quality on Uzbek-accented English.
