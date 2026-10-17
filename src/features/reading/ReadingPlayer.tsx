"use client";

import { useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Quiz, type QuizAnswer } from "@/components/Quiz";
import { ResultPanel } from "@/components/ResultPanel";
import { Button, Card, Notice, Pill } from "@/components/ui";
import { VOCAB_BY_ID } from "@/content/vocabulary";
import { activityHref, rankActivities } from "@/lib/learning-engine/recommend";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { useSpeaker } from "@/lib/speech-client";
import type { ReadingActivity } from "@/types/domain";

export function ReadingPlayer({ activity }: { activity: ReadingActivity }) {
  const { lang, recordAttempt, state, now } = useApp();
  const [startedAtInit] = useState(() => Date.now());
  const startedAt = useRef(startedAtInit);
  const [phase, setPhase] = useState<"read" | "quiz" | "done">("read");
  const [result, setResult] = useState<{ res: ApplyResult; pct: number; next?: string } | null>(null);
  const [gloss, setGloss] = useState<string | null>(null);
  const { speak, cancel, speaking, supported } = useSpeaker();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  function onFinish(answers: QuizAnswer[]) {
    const correct = answers.filter((a) => a.correct).length;
    const score = correct / activity.questions.length;
    const vocabFound = activity.vocab;
    const res = recordAttempt({
      activityId: activity.id,
      kind: "reading",
      skill: "reading",
      level: activity.level,
      score,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      source: "auto-graded",
      note: `${correct}/${activity.questions.length}`,
      encounteredVocab: vocabFound,
      units: activity.questions.length,
    });
    const next = rankActivities(res.state, now, state.profile.minutesPerDay).find((c) => c.activity.id !== activity.id);
    setResult({ res, pct: Math.round(score * 100), next: next ? activityHref(next.activity) : undefined });
    setPhase("done");
  }

  const paragraphs = activity.text.split("\n\n");
  const glossEntries = Object.entries(activity.glossary);

  return (
    <div className="grid gap-4">
      <header>
        <div className="flex flex-wrap gap-2"><Pill>{activity.level}</Pill><Pill tone="neutral">{activity.topic}</Pill></div>
        <h1 className="mt-2 text-2xl font-extrabold">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted">{L("Maqsad", "Goal")}: {activity.objectives[lang]}</p>
      </header>

      {phase !== "done" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{L("Matn", "Text")}</h2>
            {supported && (
              <Button variant="secondary" onClick={() => (speaking ? cancel() : speak([{ text: activity.text.replace(/\n+/g, " "), rate: 0.9 }]))}>
                {speaking ? L("To'xtatish", "Stop") : L("🔊 Matnni tinglash", "🔊 Listen to the text")}
              </Button>
            )}
          </div>
          <div className="space-y-3 text-base leading-8">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {glossEntries.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{L("Tarjima kerak bo'lsa bosing", "Tap a word only if you need help")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {glossEntries.map(([w]) => (
                  <button key={w} type="button" onClick={() => setGloss(gloss === w ? null : w)} aria-pressed={gloss === w} className="min-h-10 rounded-full border border-line px-3 text-sm font-medium hover:border-brand">
                    {w}
                  </button>
                ))}
              </div>
              {gloss && <p role="status" className="mt-2 rounded-lg bg-brand-soft p-3 text-sm"><strong>{gloss}</strong>: {activity.glossary[gloss].en}{lang === "uz" && ` — ${activity.glossary[gloss].uz}`}</p>}
            </div>
          )}
          {activity.vocab.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{L("Diqqat qiling", "Look out for")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {activity.vocab.map((id) => VOCAB_BY_ID[id] && <li key={id}><Pill tone="sun">{VOCAB_BY_ID[id].lemma}</Pill></li>)}
              </ul>
            </div>
          )}
          {phase === "read" && <div className="mt-5 flex justify-end"><Button onClick={() => { cancel(); setPhase("quiz"); }}>{L("Savollarga o'tish", "Go to questions")}</Button></div>}
        </Card>
      )}

      {phase === "quiz" && (
        <>
          <Notice>{L("Matnga qayta qarashingiz mumkin. Har bir savolga bitta urinish.", "You can scroll up to re-read. One attempt per question.")}</Notice>
          <Quiz questions={activity.questions} lang={lang} onFinish={onFinish} />
        </>
      )}

      {phase === "done" && result && (
        <ResultPanel result={result.res} scorePct={result.pct} lang={lang} vocabIds={activity.vocab} nextHref={result.next} />
      )}
    </div>
  );
}
