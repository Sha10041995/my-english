"use client";

import { ACHIEVEMENTS, MISSION_DEFS } from "@/lib/gamification/rewards";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { VOCAB_BY_ID } from "@/content/vocabulary";
import type { Lang } from "@/lib/i18n";
import { Card, LinkButton, Pill } from "./ui";

/** Honest summary after an activity: what was earned and what it does (not) prove. */
export function ResultPanel({ result, scorePct, lang, vocabIds, nextHref, children }: { result: ApplyResult; scorePct: number; lang: Lang; vocabIds?: string[]; nextHref?: string; children?: React.ReactNode }) {
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  return (
    <Card className="pop-in">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-extrabold">{L("Natija", "Result")}: {scorePct}%</h2>
        {result.xpGained > 0 ? <Pill tone="sun">+{result.xpGained} XP</Pill> : <Pill tone="neutral">{result.xpReasons.includes("too-fast") ? L("XP yo'q: juda tez", "No XP: finished too fast to count") : "0 XP"}</Pill>}
        {result.streakEvent === "froze" && <Pill tone="leaf">{L("Seriya muzlatgich bilan saqlandi", "Streak saved by a freeze")}</Pill>}
        {result.streakEvent === "comeback" && <Pill tone="leaf">{L("Xush kelibsiz! Seriya qayta boshlandi", "Welcome back! Streak restarted from half")}</Pill>}
      </div>
      <p className="mt-2 text-sm text-muted">
        {L("Mashqni tugatish o'zlashtirishni isbotlamaydi — qayta takrorlash va mustaqil ishlatish muhimroq.", "Finishing an activity doesn't prove mastery — repeated retrieval and using words yourself matter more.")}
      </p>
      {result.completedMissions.length > 0 && (
        <p className="mt-3 text-sm font-semibold text-leaf">
          {L("Missiya bajarildi", "Mission complete")}: {result.completedMissions.map((m) => MISSION_DEFS[m]?.title[lang]).join(", ")}
        </p>
      )}
      {result.newAchievements.length > 0 && (
        <p className="mt-2 text-sm font-semibold text-brand-strong">
          🏅 {result.newAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title[lang]).join(", ")}
        </p>
      )}
      {vocabIds && vocabIds.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold">{L("Bu mashqda uchragan iboralar (hali o'zlashtirilmagan):", "Phrases you met (not learned yet):")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {vocabIds.map((id) => VOCAB_BY_ID[id] && <li key={id}><Pill tone="brand">{VOCAB_BY_ID[id].lemma}</Pill></li>)}
          </ul>
          <p className="mt-2 text-xs text-muted">{L("Ular Lug'at bo'limida takrorlash uchun rejalashtirildi.", "They are scheduled for retrieval practice in Vocabulary.")}</p>
        </div>
      )}
      {children}
      <div className="mt-5 flex flex-wrap gap-2">
        {nextHref && <LinkButton href={nextHref}>{L("Keyingi tavsiya", "Recommended next")}</LinkButton>}
        <LinkButton href="/vocabulary?review=1" variant="secondary">{L("Iboralarni takrorlash", "Review phrases")}</LinkButton>
        <LinkButton href="/" variant="ghost">{L("Bosh sahifa", "Dashboard")}</LinkButton>
      </div>
    </Card>
  );
}
