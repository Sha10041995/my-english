"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ResultPanel } from "@/components/ResultPanel";
import { Bar, Button, Card, Notice, Pill, SourceBadge, Spinner } from "@/components/ui";
import { RUBRIC_DIMENSIONS, ruleBasedWritingFeedback, type WritingFeedback } from "@/lib/assessment/feedback";
import { VOCAB_BY_ID } from "@/content/vocabulary";
import { activityHref, rankActivities } from "@/lib/learning-engine/recommend";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { independentUses } from "@/lib/vocabulary/usage";
import type { WritingActivity } from "@/types/domain";

export function WritingPlayer({ activity }: { activity: WritingActivity }) {
  const { lang, recordAttempt, state, now, toast } = useApp();
  const [startedAtInit] = useState(() => Date.now());
  const startedAt = useRef(startedAtInit);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fb, setFb] = useState<WritingFeedback | null>(null);
  const [res, setRes] = useState<{ r: ApplyResult; next?: string } | null>(null);
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(activity.timedMinutes ? activity.timedMinutes * 60 : null);
  const [timerOn, setTimerOn] = useState(false);
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  useEffect(() => {
    if (!timerOn || secondsLeft === null) return;
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [timerOn, secondsLeft]);

  async function submit() {
    setBusy(true);
    setError(null);
    let feedback: WritingFeedback;
    try {
      const r = await fetch("/api/ai/writing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityId: activity.id, text, explanationLanguage: lang }),
      });
      if (r.status === 429) throw new Error("rate");
      if (!r.ok) throw new Error("server");
      feedback = (await r.json()) as WritingFeedback;
    } catch (e) {
      // Network/server failure: keep the learner's work and fall back to local rule-based feedback.
      feedback = { ...ruleBasedWritingFeedback(text, activity), fallbackReason: e instanceof Error ? e.message : "network" };
      setError(
        feedback.fallbackReason === "rate"
          ? L("Juda ko'p so'rov. Mahalliy (qoidaga asoslangan) fikr ko'rsatildi.", "Too many requests. Showing local rule-based feedback instead.")
          : L("Server bilan aloqa yo'q. Mahalliy (qoidaga asoslangan) fikr ko'rsatildi; matningiz saqlanib qoldi.", "Couldn't reach the server. Showing local rule-based feedback; your text is kept."),
      );
    }
    const independent = independentUses(text, activity.prompt);
    const result = recordAttempt({
      activityId: activity.id,
      kind: "writing",
      skill: "writing",
      level: activity.level,
      score: feedback.overall,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      source: feedback.source === "ai" ? "ai" : "rule-based",
      note: `${feedback.words} words, round ${round}`,
      encounteredVocab: activity.vocab,
      independentVocab: independent,
      errorTags: feedback.errorTags,
    });
    const next = rankActivities(result.state, now, state.profile.minutesPerDay).find((c) => c.activity.id !== activity.id);
    setRes({ r: result, next: next ? activityHref(next.activity) : undefined });
    setFb(feedback);
    setBusy(false);
    if (independent.length) toast(L(`Ibora mustaqil ishlatildi: ${VOCAB_BY_ID[independent[0]].lemma}`, `Used independently: ${VOCAB_BY_ID[independent[0]].lemma}`));
  }

  function rewrite() {
    setRound((r) => r + 1);
    setFb(null);
    setRes(null);
    startedAt.current = Date.now();
  }

  const tooShort = words < Math.min(5, activity.minWords);
  const mm = secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : null;

  return (
    <div className="grid gap-4">
      <header>
        <div className="flex flex-wrap gap-2"><Pill>{activity.level}</Pill><Pill tone="neutral">{activity.genre}</Pill></div>
        <h1 className="mt-2 text-2xl font-extrabold">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted">{L("Maqsad", "Goal")}: {activity.objectives[lang]}</p>
      </header>

      <Card>
        <p className="font-semibold leading-relaxed">{activity.prompt}</p>
        <p className="mt-2 text-xs text-muted">{L("Boshlash uchun", "Starters")}: {activity.starters.join("  ·  ")}</p>
        {activity.timedMinutes && (
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" onClick={() => setTimerOn((t) => !t)}>{timerOn ? L("Taymerni to'xtatish", "Pause timer") : L("⏱ Taymerni yoqish (imtihon rejimi)", "⏱ Start timer (exam mode)")}</Button>
            <span aria-live="off" className={`font-mono text-lg font-bold ${secondsLeft === 0 ? "text-berry" : ""}`}>{mm}</span>
          </div>
        )}
        <label htmlFor="writing-text" className="mt-4 block text-sm font-semibold">{L("Sizning matningiz", "Your text")} (round {round})</label>
        <textarea
          id="writing-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={activity.genre === "essay" ? 12 : 7}
          maxLength={4000}
          disabled={busy}
          className="mt-1 w-full rounded-xl border-2 border-line bg-surface p-3 text-base leading-relaxed focus:border-brand"
          placeholder={activity.starters[0]}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={words >= activity.minWords ? "font-semibold text-leaf" : "text-muted"}>
            {words} / {activity.targetWords} {L("so'z", "words")} ({L("kamida", "min")} {activity.minWords})
          </span>
          <Button onClick={submit} disabled={busy || tooShort}>{busy ? L("Tekshirilmoqda…", "Checking…") : L("Fikr-mulohaza olish", "Get feedback")}</Button>
        </div>
        {busy && <div className="mt-3"><Spinner label={L("Matn tahlil qilinmoqda…", "Analysing your text…")} /></div>}
        <p className="mt-3 text-xs text-muted">
          {L("Matningiz tahlil uchun serverga yuboriladi. AI sozlangan bo'lsa, u uchinchi tomon AI xizmatiga yuborilishi mumkin. Maxfiy ma'lumot yozmang.", "Your text is sent to the server for analysis. If an AI provider is configured it may be forwarded to that provider. Don't write private information.")}
        </p>
      </Card>

      {error && <Notice tone="warn">{error}</Notice>}

      {fb && res && (
        <>
          <Card className="pop-in">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold">{L("Fikr-mulohaza", "Feedback")}</h2>
              <SourceBadge source={fb.source} lang={lang} />
              {fb.fallbackReason && fb.source === "rule-based" && fb.fallbackReason !== "rate" && fb.fallbackReason !== "server" && fb.fallbackReason !== "network" && <Pill tone="berry">{L("AI mavjud emas — qoidaga o'tildi", "AI unavailable — used rules")}: {fb.fallbackReason}</Pill>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {L("Bu o'quv fikri, rasmiy imtihon bahosi emas. Baholash mezoni: ", "This is learning feedback, not an official exam score. Rubric: ")}
              {RUBRIC_DIMENSIONS.map((d) => d.name[lang]).join(", ")} (0–5).
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {fb.dimensions.map((d) => {
                const meta = RUBRIC_DIMENSIONS.find((x) => x.id === d.id);
                return (
                  <li key={d.id}>
                    <div className="flex items-baseline justify-between text-sm"><strong>{meta?.name[lang]}</strong><span>{d.score.toFixed(1)} / 5</span></div>
                    <Bar value={d.score / 5} label={meta?.name.en ?? d.id} />
                    <p className="mt-1 text-xs text-muted">{d.comment}</p>
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-5 font-bold">{L("Yaxshi bajarilgan", "What went well")}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">{fb.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            <h3 className="mt-5 font-bold">{L("Eng muhim tuzatishlar", "Most important corrections")}</h3>
            {fb.corrections.length === 0 ? <p className="mt-1 text-sm text-muted">{L("Umumiy xato namunalari topilmadi (bu hamma xatolarni topmaydi).", "No common error patterns found (this does not catch every error).")}</p> : (
              <ul className="mt-2 grid gap-3">
                {fb.corrections.map((c, i) => (
                  <li key={i} className="rounded-xl border border-line p-3 text-sm">
                    <p><span className="rounded bg-berry-soft px-1.5 py-0.5 line-through">{c.original}</span> → <span className="rounded bg-leaf-soft px-1.5 py-0.5 font-semibold">{c.suggestion}</span></p>
                    <p className="mt-1.5 text-muted">{c.why_en}{lang === "uz" && <><br />{c.why_uz}</>}</p>
                  </li>
                ))}
              </ul>
            )}
            {fb.revisedExample && (
              <>
                <h3 className="mt-5 font-bold">{L("Namuna (faqat topilgan joylar tuzatilgan)", "Revised example (only detected spots fixed)")}</h3>
                <p className="mt-1 whitespace-pre-wrap rounded-xl bg-canvas p-3 text-sm leading-relaxed">{fb.revisedExample}</p>
              </>
            )}
            <h3 className="mt-5 font-bold">{L("Keyingi qadam: qayta yozing", "Next step: rewrite")}</h3>
            <p className="mt-1 text-sm">{fb.nextStep}</p>
            <div className="mt-4"><Button onClick={rewrite}>{L("Matnni qayta yozish", "Rewrite my text")}</Button></div>
          </Card>
          <ResultPanel result={res.r} scorePct={Math.round(fb.overall * 100)} lang={lang} vocabIds={fb.trackedVocabIds} nextHref={res.next} />
        </>
      )}
    </div>
  );
}
