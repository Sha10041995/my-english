"use client";

import { useApp } from "@/components/AppProvider";
import { Card, LinkButton, PageHeader, Pill } from "@/components/ui";
import { ACTIVITIES } from "@/content/activities";
import { activityHref, rankActivities } from "@/lib/learning-engine/recommend";
import { levelToNumber } from "@/lib/learning-engine/levels";
import { t } from "@/lib/i18n";
import { LEVELS, type Level, type Localized } from "@/types/domain";

const PATHWAY: Record<Level, { goals: Localized; can: Localized }> = {
  A0: { goals: { en: "Greetings, numbers, the alphabet, simple words.", uz: "Salomlashish, sonlar, alifbo, oddiy so'zlar." }, can: { en: "Recognise a few familiar words.", uz: "Bir nechta tanish so'zlarni tanish." } },
  A1: { goals: { en: "Introduce yourself, routines, shopping basics.", uz: "O'zini tanishtirish, kundalik tartib, xarid asoslari." }, can: { en: "Use familiar everyday expressions and very simple sentences.", uz: "Tanish iboralar va juda oddiy gaplarni ishlatish." } },
  A2: { goals: { en: "Short messages, plans, past events, simple descriptions.", uz: "Qisqa xabarlar, rejalar, o'tgan voqealar, oddiy tasvir." }, can: { en: "Handle simple routine tasks and exchanges.", uz: "Oddiy kundalik vazifalar va muloqotni bajarish." } },
  B1: { goals: { en: "Opinions with reasons, narratives, work emails, main ideas of clear speech.", uz: "Sababli fikr, hikoya, ish xatlari, ravshan nutqning asosiy fikri." }, can: { en: "Deal with most situations while travelling; describe experiences and give reasons.", uz: "Sayohatdagi ko'p vaziyatlarni hal qilish; tajriba va sabablarni bayon qilish." } },
  B2: { goals: { en: "Structured arguments, inference, abstract topics, timed exam tasks.", uz: "Tuzilgan dalillar, xulosa chiqarish, mavhum mavzular, vaqt cheklangan topshiriqlar." }, can: { en: "Interact fluently with a degree of spontaneity; produce clear detailed text.", uz: "Ma'lum darajada erkin muloqot qilish; aniq va batafsil matn yaratish." } },
};

export default function LearnPage() {
  const { state, lang, now } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const ranked = rankActivities(state, now, state.profile.minutesPerDay).slice(0, 6);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={L("Yo'l xaritasi", "Pathway")} title={t("nav.learn", lang)} />
      <Card>
        <h2 className="text-lg font-bold">{L("Siz uchun tavsiya etilgan", "Recommended for you")}</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {ranked.map((c) => (
            <li key={c.activity.id} className="flex flex-col gap-1 rounded-xl border border-line p-3">
              <div className="flex gap-2"><Pill>{c.activity.kind}</Pill><Pill tone="neutral">{c.activity.level}</Pill></div>
              <strong>{c.activity.title}</strong>
              <span className="text-xs text-muted">{c.reasons.slice(0, 2).map((r) => r[lang]).join(" · ")}</span>
              <LinkButton href={activityHref(c.activity)} variant="secondary" className="mt-2 self-start">{t("common.start", lang)}</LinkButton>
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="path">
        <h2 id="path" className="mb-3 text-lg font-bold">{L("A0 → B2 yo'li", "A0 → B2 pathway")}</h2>
        <ol className="grid gap-3">
          {LEVELS.map((lv) => {
            const acts = ACTIVITIES.filter((a) => a.level === lv);
            const done = new Set(state.attempts.map((a) => a.activityId));
            const doneCount = acts.filter((a) => done.has(a.id)).length;
            const skills = (["reading", "listening", "writing", "speaking"] as const).map((k) => ({ k, theta: state.skills[k]?.theta ?? 0, ev: state.skills[k]?.evidence ?? 0 }));
            const reached = skills.filter((s) => s.ev >= 3 && s.theta >= levelToNumber(lv) + 0.5).length;
            return (
              <li key={lv}>
                <Card as="div">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-extrabold">{lv}</h3>
                    <div className="flex gap-2">
                      <Pill tone="neutral">{doneCount}/{acts.length} {L("mashq", "activities")}</Pill>
                      <Pill tone={reached === 4 ? "leaf" : "neutral"}>{reached}/4 {L("ko'nikma ishonchli", "skills consistent")}</Pill>
                    </div>
                  </div>
                  <p className="mt-2 text-sm"><strong>{L("Maqsadlar", "Objectives")}:</strong> {PATHWAY[lv].goals[lang]}</p>
                  <p className="text-sm text-muted">{PATHWAY[lv].can[lang]}</p>
                </Card>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-muted">{L("“Ishonchli” — kamida 3 ta dalil va shu darajadan yuqori taxmin. Faollik (XP) darajani bildirmaydi.", "“Consistent” needs at least 3 observations and an estimate above that level. XP does not indicate level.")}</p>
      </section>
    </div>
  );
}
