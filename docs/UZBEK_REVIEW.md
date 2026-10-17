# Uzbek text review workflow

All Uzbek UI text, glosses and explanations in this repo are **drafts written by an AI assistant** and have **not** been reviewed by a native speaker. Do not treat them as validated.

## For the reviewer
1. `npm run uz:export` → creates `docs/uzbek-review.csv` (≈670 strings: file, line, kind, English, Uzbek draft, empty `uzbek_reviewed`, `reviewer_notes`).
2. Open it in Excel/Google Sheets (UTF-8). Fill `uzbek_reviewed` only where the draft should change (leave blank if it's fine). Write doubts in `reviewer_notes`.
3. Check especially: natural register for learners, grammar-term translations (e.g. "o'timli/majhul nisbat"), apostrophes (`'` vs `ʻ`), and Latin-script spelling consistency.

## For the developer
- `npm run uz:apply` patches each reviewed string in the source (exact literal replacement; skipped with a warning if the literal appears more than once in a file) and writes `docs/uzbek-review-status.json` with counts.
- Strings built with template literals (≈6, mostly in `src/app/vocabulary`, `src/components/ResultPanel`, `src/features/*`) are **not** in the CSV and need manual review.
- After applying, run `npm test` (content integrity tests) and re-export to confirm the CSV matches the source.

## Status
Reviewed by a native speaker: **0 of ~670** (see `docs/uzbek-review-status.json` once a review is applied).
