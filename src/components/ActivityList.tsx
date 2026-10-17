"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { rankActivities } from "@/lib/learning-engine/recommend";
import type { Activity, ActivityKind } from "@/types/domain";
import { ACTIVITIES } from "@/content/activities";
import { reportedLevel } from "@/lib/learning-engine/proficiency";
import { estimateOf } from "@/lib/learning-engine/state";
import { useApp } from "./AppProvider";
import { Card, EmptyState, Pill } from "./ui";

export function useActivityId(): string | null {
  return useSearchParams().get("a");
}

/** Wraps a module page: shows the picker when no `?a=` is set, the player otherwise. */
export function ModuleShell<T extends Activity>({
  kind,
  title,
  eyebrow,
  render,
  intro,
}: {
  kind: ActivityKind;
  title: string;
  eyebrow: string;
  intro?: ReactNode;
  render: (activity: T) => ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <ModuleInner kind={kind} title={title} eyebrow={eyebrow} render={render as (a: Activity) => ReactNode} intro={intro} />
    </Suspense>
  );
}

function ModuleInner({ kind, title, eyebrow, render, intro }: { kind: ActivityKind; title: string; eyebrow: string; render: (a: Activity) => ReactNode; intro?: ReactNode }) {
  const id = useActivityId();
  const { state, now, lang } = useApp();
  const items = ACTIVITIES.filter((a) => a.kind === kind);
  const active = id ? items.find((a) => a.id === id) : undefined;
  const ranked = rankActivities(state, now, state.profile.minutesPerDay, items);
  const recommendedId = ranked[0]?.activity.id;
  const est = reportedLevel(estimateOf(state, kind));

  if (id && !active) {
    return <EmptyState title={lang === "uz" ? "Mashq topilmadi" : "Activity not found"} body={lang === "uz" ? "Havola eskirgan bo'lishi mumkin." : "The link may be outdated."} action={<Link className="font-semibold text-brand" href={`/${kind}`}>{lang === "uz" ? "Ro'yxatga qaytish" : "Back to list"}</Link>} />;
  }
  if (active) {
    return (
      <div>
        <Link href={`/${kind}`} className="mb-3 inline-block text-sm font-semibold text-brand">← {lang === "uz" ? "Barcha mashqlar" : "All activities"}</Link>
        {render(active)}
      </div>
    );
  }
  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {lang === "uz" ? "Taxminiy daraja" : "Estimated level"}: <strong>{estimateOf(state, kind).evidence === 0 ? (lang === "uz" ? "hali aniqlanmagan" : "not measured yet") : est}</strong>
        </p>
      </header>
      {intro}
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => {
          const done = state.attempts.filter((x) => x.activityId === a.id);
          const best = done.length ? Math.max(...done.map((x) => x.score)) : null;
          return (
            <li key={a.id}>
              <Card as="div" className="flex h-full flex-col gap-2 hover:border-brand">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{a.level}</Pill>
                  <Pill tone="neutral">{a.minutes} {lang === "uz" ? "daqiqa" : "min"}</Pill>
                  {a.id === recommendedId && <Pill tone="sun">{lang === "uz" ? "Tavsiya" : "Recommended"}</Pill>}
                  {best !== null && <Pill tone="leaf">{lang === "uz" ? "Eng yaxshi" : "Best"}: {Math.round(best * 100)}%</Pill>}
                </div>
                <h2 className="text-lg font-bold">{a.title}</h2>
                <p className="text-sm text-muted">{a.objectives[lang]}</p>
                <Link href={`/${kind}?a=${a.id}`} className="mt-auto inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
                  {done.length ? (lang === "uz" ? "Qayta urinish →" : "Try again →") : lang === "uz" ? "Boshlash →" : "Start →"}
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
