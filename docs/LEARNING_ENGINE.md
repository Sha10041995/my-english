# Learning engine rules (transparent, deterministic)

## Proficiency
- Per skill, `theta` on a 0–4 scale (A0=0 … B2=4). Update: `theta += k·(score − expected)`, `expected = logistic(theta − itemLevel)`, `k = clamp(1.1/√(n+1.5), 0.12, 0.8)`.
- Reported level guard rails: 0 observations → "not measured"; <3 observations → at most A1; B2 requires ≥3 B2-difficulty observations with ≥2/3 successful.
- Confidence = n/(n+5), capped 0.9.
- Difficulty adjustment: last two scores <50% → *scaffold* (target −0.3); last three ≥85% → *stretch* (+0.6); otherwise +0.25.

## Next-activity scoring (`rankActivities`)
`score = −2·|levelGap| + 0.25·(4−theta) + 0.3·staleDays(≤7) + 0.6 (new) − 3 (done in last 6 attempts) − 0.8·repeats − 1 (same kind as last) + 0.6·dueVocab(≤2) + 1 (interest) + exam bonus − 0.4·minutesOverBudget`. Activities >1.3 levels above target are excluded. Each term emits a human-readable reason shown under "Why this activity?".
Daily plan: 1 item (≤5 min), 2 (≤12), 3 (≤25), else 4; one per skill kind; a vocabulary review is added when ≥3 items are due.

## Vocabulary
States: unseen → encountered → recognized → recalled (receptive) and none → assisted → independent → multi_context (productive).
- Encounter only increments exposure; it schedules a first check ~12 h later.
- Successful retrieval: encountered→recognized; recognized→recalled after an assisted/independent success or 3 recognition successes.
- Independent use (detected in writing/speaking text, excluding words echoed from the prompt, or a validated review sentence) → `independent`; ≥2 distinct activities → `multi_context`.
- Failure: interval reset to 1 day, ease −0.2, lapse+1, recalled→recognized.
- Interval after success: `prev × ease × modeWeight` (recognition 0.7, assisted 1.0, independent 1.25), first interval 1 day, max 180 days; ease 1.3–3.0. All values in `DEFAULT_SRS`.
- "Confirmed" receptive = recalled with a success ≥3 days after first sight; "confirmed" productive = multi-context, or independent ≥2 times.
- New-word budget: 2/3/5 per session by study time; 0 if ≥12 items are still encountered/recognized.

## Rewards
XP = base(kind) × (0.4 + 0.6·score); 0 if finished faster than a per-kind minimum; ×0.25 for same-day repeat; +5 for ≥15-point improvement; +retrievals, +independent uses; cap 60. Rushed attempts (0 XP) don't count for streaks or missions.
Streak: +1 per active day; one missed day is covered by a freeze (earn 1 per 7 days, max 2); longer gaps halve the streak (min 1) – best streak is kept.
