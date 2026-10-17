"use client";

import { useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Quiz, type QuizAnswer } from "@/components/Quiz";
import { ResultPanel } from "@/components/ResultPanel";
import { Button, Card, Notice, Pill } from "@/components/ui";
import { activityHref, rankActivities } from "@/lib/learning-engine/recommend";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { useSpeaker } from "@/lib/speech-client";
import type { ListeningActivity } from "@/types/domain";

export function ListeningPlayer({ activity }: { activity: ListeningActivity }) {
  const { lang, recordAttempt, state, now } = useApp();
  const [startedAtInit] = useState(() => Date.now());
  const startedAt = useRef(startedAtInit);
  const [phase, setPhase] = useState<"listen" | "quiz" | "done">("listen");
  const [plays, setPlays] = useState(0);
  const [slow, setSlow] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [result, setResult] = useState<{ res: ApplyResult; pct: number; next?: string } | null>(null);
  const { speak, cancel, speaking, supported } = useSpeaker();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  function play() {
    setPlays((p) => p + 1);
    void speak(activity.script.map((s) => ({ text: s.line, voice: activity.speakers[s.speaker]?.voice, rate: (slow ? 0.7 : 1) * activity.rate })));
  }

  function onFinish(answers: QuizAnswer[]) {
    const correct = answers.filter((a) => a.correct).length;
    const score = correct / activity.questions.length;
    // Peeking at the transcript before answering weakens the evidence for listening ability.
    const adjusted = showScript ? score * 0.8 : score;
    const res = recordAttempt({
      activityId: activity.id,
      kind: "listening",
      skill: "listening",
      level: activity.level,
      score: adjusted,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      source: "auto-graded",
      note: `${correct}/${activity.questions.length}${showScript ? " (transcript viewed)" : ""} plays:${plays}`,
      encounteredVocab: activity.vocab,
      units: activity.questions.length,
    });
    const next = rankActivities(res.state, now, state.profile.minutesPerDay).find((c) => c.activity.id !== activity.id);
    setResult({ res, pct: Math.round(score * 100), next: next ? activityHref(next.activity) : undefined });
    setPhase("done");
    setShowScript(true);
  }

  return (
    <div className="grid gap-4">
      <header>
        <div className="flex flex-wrap gap-2"><Pill>{activity.level}</Pill><Pill tone="neutral">{activity.topic}</Pill></div>
        <h1 className="mt-2 text-2xl font-extrabold">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted">{L("Maqsad", "Goal")}: {activity.objectives[lang]}</p>
      </header>

      <Card>
        {!supported ? (
          <Notice tone="warn">{L("Brauzeringiz ovoz sintezini qo'llamaydi, shuning uchun audio ijro etilmaydi. Skriptni o'qib, savollarga javob berishingiz mumkin (bu tinglash mashqi hisoblanmaydi — natija kamaytiriladi).", "Your browser has no speech synthesis, so audio can't play. You can read the transcript and still answer, but this counts as weaker listening evidence.")}</Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={play} disabled={speaking} aria-label={L("Audioni ijro etish", "Play audio")}>▶ {plays === 0 ? L("Tinglash", "Play") : L("Qayta tinglash", "Replay")}</Button>
              {speaking && <Button variant="secondary" onClick={cancel}>{L("To'xtatish", "Stop")}</Button>}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
                {L("Sekinroq", "Slower")}
              </label>
              <span className="text-sm text-muted">{L("Ijrolar", "Plays")}: {plays}</span>
            </div>
            <p className="mt-3 text-xs text-muted">
              {L("Ovoz — brauzerning sintezlangan ovozi, haqiqiy ona tilida so'zlovchilar yozuvi emas.", "Audio is synthetic browser speech, not recordings of native speakers.")}
            </p>
          </>
        )}
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setShowScript((s) => !s)} aria-expanded={showScript}>
            {showScript ? L("Skriptni yashirish", "Hide transcript") : L("Skriptni ko'rsatish", "Show transcript")}
          </Button>
          {showScript && phase !== "done" && <p className="mt-1 text-xs text-berry">{L("Eslatma: javobdan oldin skriptni ko'rsangiz, natija kamroq hisoblanadi.", "Note: viewing the transcript before answering lowers the evidence weight.")}</p>}
          {showScript && (
            <ul className="mt-3 space-y-2 rounded-xl bg-canvas p-4 text-sm leading-relaxed">
              {activity.script.map((s, i) => (
                <li key={i}><strong>{activity.speakers[s.speaker]?.name}:</strong> {s.line}</li>
              ))}
            </ul>
          )}
        </div>
        {phase === "listen" && (
          <div className="mt-5 flex justify-end">
            <Button onClick={() => { cancel(); setPhase("quiz"); }} disabled={supported && plays === 0}>{L("Savollarga o'tish", "Go to questions")}</Button>
          </div>
        )}
      </Card>

      {phase === "quiz" && <Quiz questions={activity.questions} lang={lang} onFinish={onFinish} />}
      {phase === "done" && result && <ResultPanel result={result.res} scorePct={result.pct} lang={lang} vocabIds={activity.vocab} nextHref={result.next} />}
    </div>
  );
}
