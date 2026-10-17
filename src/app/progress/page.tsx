"use client";

import { useApp } from "@/components/AppProvider";
import { Bar, Card, EmptyState, Notice, PageHeader, Pill } from "@/components/ui";
import { ACHIEVEMENTS } from "@/lib/gamification/rewards";
import { ERROR_RULES } from "@/lib/assessment/text-rules";
import { confidence, difficultyAdjustment, recentAverage, reportedLevel } from "@/lib/learning-engine/proficiency";
import { dayKey, estimateOf } from "@/lib/learning-engine/state";
import { t } from "@/lib/i18n";
import { estimateVocabulary } from "@/lib/vocabulary/srs";
import { SKILLS } from "@/types/domain";

export default function ProgressPage() {
  const { state, lang, now } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const weekKeys = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000)));
  const weekAttempts = state.attempts.filter((a) => weekKeys.includes(dayKey(new Date(a.at))));
  const weekXp = weekKeys.reduce((s, k) => s + (state.xpByDay[k] ?? 0), 0);
  const weekMin = Math.round(weekKeys.reduce((s, k) => s + (state.minutesByDay[k] ?? 0), 0));
  const activeDays = weekKeys.filter((k) => (state.xpByDay[k] ?? 0) > 0 || (state.minutesByDay[k] ?? 0) > 0).length;
  const voc = estimateVocabulary(Object.values(state.vocab));
  const topErrors = Object.entries(state.errors).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lastMock = state.assessments.filter((a) => a.type === "mock-exam").at(-1);

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={L("Sizning ma'lumotlaringiz", "Your learning data")} title={t("nav.progress", lang)} />

      <Notice>{L(
        "To'rt narsa alohida ko'rsatiladi: (1) o'rganish faolligi, (2) taxminiy CEFR darajasi, (3) mock-imtihon natijasi, (4) rasmiy imtihon natijasi — oxirgisi bu ilovada kuzatilmaydi.",
        "Four things are kept apart: (1) learning activity, (2) estimated CEFR level, (3) mock-exam performance, (4) official exam results — the last is not tracked here.",
      )}</Notice>

      <Card>
        <h2 className="text-lg font-bold">1 · {L("Haftalik xulosa", "Weekly summary")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={L("Faol kunlar", "Active days")} value={`${activeDays}/7`} />
          <Stat label={L("Mashqlar", "Activities")} value={String(weekAttempts.length)} />
          <Stat label={L("Daqiqalar", "Minutes")} value={String(weekMin)} />
          <Stat label="XP" value={String(weekXp)} />
        </dl>
        <p className="mt-3 text-sm text-muted">
          {L("Eng uzun seriya", "Best streak")}: {state.streak.best} · {L("Rekord XP (kun)", "Best day XP")}: {state.personalBests.dailyXp} · {L("Eng yaxshi Writing", "Best writing")}: {Math.round(state.personalBests.writingScore * 100)}% · {L("Eng yaxshi Reading", "Best reading")}: {Math.round(state.personalBests.readingScore * 100)}%
        </p>
        <p className="mt-1 text-xs text-muted">{L("XP — mashq faolligi o'lchovi. U til darajasini isbotlamaydi.", "XP measures practice activity. It does not prove language level.")}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">2 · {L("Taxminiy daraja (ko'nikma bo'yicha)", "Estimated level by skill")}</h2>
        {state.attempts.length === 0 && !state.placementDone ? (
          <div className="mt-3"><EmptyState title={L("Hali dalil yo'q", "No evidence yet")} body={L("Daraja aniqlashdan o'ting yoki bir nechta mashq bajaring.", "Take the placement check or finish a few activities.")} /></div>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {SKILLS.map((s) => {
              const e = estimateOf(state, s);
              const adj = difficultyAdjustment(e);
              const avg = recentAverage(e);
              return (
                <li key={s}>
                  <div className="flex items-baseline justify-between text-sm">
                    <strong className="capitalize">{s}</strong>
                    <span>{e.evidence === 0 ? t("level.noEvidence", lang) : `${reportedLevel(e)} · ${e.evidence < 3 ? L("dalil kam", "little evidence") : ""}`}</span>
                  </div>
                  <Bar value={e.evidence === 0 ? 0 : e.theta / 4} label={`${s} level`} />
                  <p className="mt-1 text-xs text-muted">
                    {L("Ishonch", "Confidence")} {Math.round(confidence(e) * 100)}% · {e.evidence} {L("kuzatuv", "observations")}
                    {avg !== null && ` · ${L("so'nggi o'rtacha", "recent avg")} ${Math.round(avg * 100)}%`}
                    {adj !== "hold" && ` · ${adj === "scaffold" ? L("yengilroq mashqlar tavsiya", "easier steps suggested") : L("biroz qiyinroq mashqlar", "stretching up")}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">{t("level.note", lang)} {L("B2 faqat B2 darajasidagi yetarli topshiriqlarda barqaror natija bo'lgandagina ko'rsatiladi.", "B2 is only reported after consistent success on enough B2-level tasks.")}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{L("Lug'at", "Vocabulary")}</h2>
        <p className="mt-2 text-sm">
          {L("Retseptiv", "Receptive")}: <strong>{voc.receptiveConfirmed}</strong> {L("tasdiqlangan", "confirmed")} + {voc.receptiveEmerging} {L("shakllanmoqda", "emerging")} · {L("Produktiv", "Productive")}: <strong>{voc.productiveConfirmed}</strong> + {voc.productiveEmerging} · {L("faqat ko'rilgan", "seen only")}: {voc.exposedOnly}
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{L("Takrorlanuvchi xatolar", "Recurring errors")}</h2>
        {topErrors.length === 0 ? <p className="mt-2 text-sm text-muted">{L("Hali yo'q — yozish va suhbat mashqlaridan so'ng paydo bo'ladi.", "None yet — they appear after writing and speaking practice.")}</p> : (
          <ul className="mt-2 grid gap-2 text-sm">
            {topErrors.map(([id, n]) => {
              const rule = ERROR_RULES.find((r) => r.id === id);
              return <li key={id} className="rounded-lg border border-line p-3"><strong>{n}×</strong> {rule ? rule.explain[lang] : id}</li>;
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">3 · {L("Mock-imtihon", "Mock exam")}</h2>
        <p className="mt-2 text-sm text-muted">{lastMock ? `${new Date(lastMock.at).toLocaleDateString()}: ${lastMock.sections?.map((s) => `${s.name} ${s.score}%`).join(" · ")} (${lastMock.notes})` : L("Hali mock topshirilmagan.", "No mock taken yet.")}</p>
        <h2 className="mt-4 text-lg font-bold">4 · {L("Rasmiy imtihon", "Official exam")}</h2>
        <p className="mt-1 text-sm text-muted">{L("Bu ilovada kuzatilmaydi.", "Not tracked in this app.")}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{L("Yutuqlar", "Achievements")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = state.achievements[a.id];
            return (
              <li key={a.id} className={`rounded-xl border p-3 text-sm ${at ? "border-leaf bg-leaf-soft" : "border-line opacity-80"}`}>
                <strong>{at ? "🏅" : "🔒"} {a.title[lang]}</strong>
                <p className="text-muted">{a.description[lang]}</p>
                {at && <Pill tone="leaf">{new Date(at).toLocaleDateString()}</Pill>}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{L("Oxirgi mashqlar", "Recent activity")}</h2>
        {state.attempts.length === 0 ? <p className="mt-2 text-sm text-muted">—</p> : (
          <ul className="mt-2 grid gap-1.5 text-sm">
            {state.attempts.slice(-10).reverse().map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5">
                <span><strong className="capitalize">{a.kind}</strong> · {a.activityId} · {a.level}</span>
                <span className="text-muted">{Math.round(a.score * 100)}% · +{a.xp} XP · {a.source} · {new Date(a.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-extrabold">{value}</dd>
    </div>
  );
}
