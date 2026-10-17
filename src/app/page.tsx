"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { Bar, Card, LinkButton, Pill } from "@/components/ui";
import { MISSION_DEFS } from "@/lib/gamification/rewards";
import { reportedLevel, confidence } from "@/lib/learning-engine/proficiency";
import { dailyPlan, dueVocabCount } from "@/lib/learning-engine/recommend";
import { dayKey, estimateOf } from "@/lib/learning-engine/state";
import { t } from "@/lib/i18n";
import { CORE_SKILLS } from "@/types/domain";

export default function Dashboard() {
  const { state, lang, now, setMiniMode } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const mini = state.missions.miniMode;
  const plan = dailyPlan(state, now, mini ? 4 : undefined);
  const due = dueVocabCount(state, now);
  const doneToday = state.missions.items.filter((m) => m.done).length;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86_400_000);
    return { key: dayKey(d), label: d.toLocaleDateString(lang === "uz" ? "uz" : "en", { weekday: "short" }), xp: state.xpByDay[dayKey(d)] ?? 0 };
  });
  const maxXp = Math.max(20, ...week.map((w) => w.xp));

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{now.toLocaleDateString(lang === "uz" ? "uz" : "en", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{t("dash.hello", lang)}{state.profile.displayName ? `, ${state.profile.displayName}` : ""}!</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="sun">🔥 {state.streak.current} {t("dash.days", lang)}</Pill>
          <Pill tone="neutral">❄ {state.streak.freezes} {L("muzlatgich", "freeze(s)")}</Pill>
          <Pill>{state.xp} XP</Pill>
        </div>
      </header>

      {!state.placementDone && (
        <Card className="border-brand/30 bg-brand-soft">
          <p className="font-semibold">{t("dash.noPlacement", lang)}</p>
          <div className="mt-3"><LinkButton href="/placement">{t("dash.takePlacement", lang)}</LinkButton></div>
        </Card>
      )}

      <section aria-labelledby="plan" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="plan" className="text-lg font-bold">{t("dash.today", lang)}</h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-5 w-5" checked={mini} onChange={(e) => setMiniMode(e.target.checked)} />
            {t("dash.mini", lang)}
          </label>
        </div>
        {plan.length === 0 ? (
          <Card><p className="text-sm text-muted">{L("Bugungi reja bo'sh. “O'rganish” bo'limidan mashq tanlang.", "No plan items right now. Pick an activity in Learn.")}</p></Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {plan.map((p) => (
              <li key={p.href}>
                <Card as="div" className="flex h-full flex-col gap-2">
                  <div className="flex items-center gap-2"><Pill>{p.kind}</Pill><Pill tone="neutral">{p.minutes} {t("common.minutes", lang)}</Pill></div>
                  <h3 className="text-lg font-bold">{p.title}</h3>
                  <details className="text-sm text-muted">
                    <summary className="min-h-8 cursor-pointer font-medium text-brand">{t("common.why", lang)}</summary>
                    <ul className="mt-1 list-disc pl-5">{p.reasons.map((r, i) => <li key={i}>{r[lang]}</li>)}</ul>
                  </details>
                  <div className="mt-auto pt-2"><LinkButton href={p.href}>{t("common.start", lang)}</LinkButton></div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("dash.missions", lang)}</h2>
            <Pill tone={doneToday === state.missions.items.length && doneToday > 0 ? "leaf" : "neutral"}>{doneToday}/{state.missions.items.length}</Pill>
          </div>
          <ul className="mt-3 grid gap-2">
            {state.missions.items.map((m) => {
              const def = MISSION_DEFS[m.id];
              if (!def) return null;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <span className="flex items-center gap-2 text-sm"><span aria-hidden="true">{m.done ? "✅" : "⬜"}</span><span className={m.done ? "text-muted line-through" : ""}>{def.title[lang]}</span></span>
                  {m.done ? <Pill tone="leaf">+{def.xp} XP</Pill> : <Link href={def.route} className="min-h-11 content-center text-sm font-semibold text-brand">{t("common.start", lang)} →</Link>}
                </li>
              );
            })}
          </ul>
          {due > 0 && <p className="mt-3 text-sm">{t("dash.due", lang)}: <strong>{due}</strong> <Link href="/vocabulary?review=1" className="font-semibold text-brand">→</Link></p>}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t("dash.skills", lang)}</h2>
          <ul className="mt-3 grid gap-3">
            {CORE_SKILLS.map((s) => {
              const e = estimateOf(state, s);
              const none = e.evidence === 0;
              return (
                <li key={s}>
                  <div className="flex items-baseline justify-between text-sm">
                    <strong className="capitalize">{s}</strong>
                    <span>{none ? t("level.noEvidence", lang) : `${reportedLevel(e)} · ${L("ishonch", "confidence")} ${Math.round(confidence(e) * 100)}%`}</span>
                  </div>
                  <Bar value={none ? 0 : e.theta / 4} label={`${s} level`} />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">{t("level.note", lang)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold">{t("dash.week", lang)}</h2>
        <ol className="mt-4 flex h-32 items-end gap-2" aria-label="XP per day">
          {week.map((w) => (
            <li key={w.key} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-muted">{w.xp || ""}</span>
              <div className={`w-full max-w-9 rounded-t-lg ${w.key === dayKey(now) ? "bg-brand" : "bg-brand/35"}`} style={{ height: `${Math.max(4, (w.xp / maxXp) * 80)}%` }} role="img" aria-label={`${w.label}: ${w.xp} XP`} />
              <span className="text-xs">{w.label}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
