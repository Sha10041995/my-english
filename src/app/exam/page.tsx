"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Bar, Button, Card, Notice, PageHeader, Pill } from "@/components/ui";
import { WRITING } from "@/content/activities";
import { ruleBasedWritingFeedback, RUBRIC_VERSION } from "@/lib/assessment/feedback";
import { EXAM_FORMATS, evaluateMock, examListening, examReading, type MockResult } from "@/lib/assessment/exam";
import { useSpeaker } from "@/lib/speech-client";
import { t, type Lang } from "@/lib/i18n";
import type { ListeningActivity, McqQuestion, ReadingActivity } from "@/types/domain";

type Phase = "intro" | "reading" | "listening" | "writing" | "result";

const FORMAT = EXAM_FORMATS["generic-b2-practice"];
const minutesOf = (id: "reading" | "listening" | "writing") => FORMAT.sections.find((s) => s.id === id)!.minutes;

/** Countdown that fires `onExpire` exactly once; the latest callback is always used (no stale answers). */
function useCountdown(totalSeconds: number, onExpire: () => void) {
  const [left, setLeft] = useState(totalSeconds);
  const cb = useRef(onExpire);
  useEffect(() => {
    cb.current = onExpire;
  });
  useEffect(() => {
    const end = Date.now() + totalSeconds * 1000;
    let fired = false;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !fired) {
        fired = true;
        clearInterval(id);
        cb.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, [totalSeconds]);
  return left;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function ExamPage() {
  const { state, lang, recordAttempt, update } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const [phase, setPhase] = useState<Phase>("intro");
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [readingPct, setReadingPct] = useState(0);
  const [listeningPct, setListeningPct] = useState(0);
  const [essay, setEssay] = useState("");
  const [result, setResult] = useState<MockResult | null>(null);
  const [startedInit] = useState(() => Date.now());
  const started = useRef(startedInit);
  const mocks = state.assessments.filter((a) => a.type === "mock-exam");

  const readings = useMemo(() => examReading(FORMAT), []);
  const listenings = useMemo(() => examListening(FORMAT), []);
  const essayTask = WRITING.find((w) => w.level === "B2")!;

  const score = (questions: McqQuestion[], answers: Record<string, string>) =>
    questions.length ? questions.filter((q) => answers[q.id] === q.answer).length / questions.length : 0;

  function submitReading() {
    const qs = readings.flatMap((r) => r.questions);
    const pct = score(qs, readingAnswers);
    setReadingPct(pct);
    recordAttempt({ activityId: "mock-reading", kind: "exam", skill: "reading", level: "B2", score: pct, durationSeconds: (Date.now() - started.current) / 1000, source: "auto-graded", note: "mock section", units: qs.length });
    started.current = Date.now();
    setPhase("listening");
  }

  function submitListening() {
    const qs = listenings.flatMap((r) => r.questions);
    const pct = score(qs, listeningAnswers);
    setListeningPct(pct);
    recordAttempt({ activityId: "mock-listening", kind: "exam", skill: "listening", level: "B2", score: pct, durationSeconds: (Date.now() - started.current) / 1000, source: "auto-graded", note: "mock section", units: qs.length });
    setPhase("writing");
  }

  function finish(skipWriting: boolean) {
    const wFb = !skipWriting && essay.trim().split(/\s+/).length >= 20 ? ruleBasedWritingFeedback(essay, essayTask) : null;
    const res = evaluateMock(FORMAT, readingPct, listeningPct, wFb ? wFb.overall : null, mocks.length);
    setResult(res);
    update((s) => ({
      ...s,
      assessments: [
        ...s.assessments,
        {
          id: `mock-${Date.now()}`,
          type: "mock-exam" as const,
          at: new Date().toISOString(),
          rubricVersion: RUBRIC_VERSION,
          responses: [],
          perSkill: {},
          notes: `${FORMAT.id}: readiness=${res.readiness}`,
          sections: [
            { name: "reading", score: Math.round(readingPct * 100), total: 100 },
            { name: "listening", score: Math.round(listeningPct * 100), total: 100 },
            ...(wFb ? [{ name: "writing (rule-based)", score: Math.round(wFb.overall * 100), total: 100 }] : []),
          ],
        },
      ].slice(-50),
    }));
    setPhase("result");
  }

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={L("Sinov imtihon", "Mock exam")} title={t("nav.exam", lang)} />

      {phase === "intro" && (
        <>
          <Card className="grid gap-3">
            <h2 className="text-lg font-bold">{FORMAT.name}</h2>
            <Notice tone="warn">{L(
              "Bu RASMIY imtihon emas va rasmiy bahoga teng emas. Imtihon formatlari (vazifalar, vaqt, baholash) turlicha — aniq imtihonga tayyorlanayotgan bo'lsangiz, uning rasmiy namunalaridan foydalaning. Natija — o'quv maqsadidagi taxmin; B2 sertifikatini kafolatlamaydi.",
              "This is NOT an official exam and not equivalent to an official score. Exam formats (tasks, timing, scoring) differ — if you target a specific exam, practise with its official materials. The result is a learning estimate and does not guarantee any certificate.",
            )}</Notice>
            <ul className="list-disc pl-5 text-sm">
              {FORMAT.sections.map((s) => <li key={s.id}><strong className="capitalize">{s.id}</strong>: {s.minutes} {t("common.minutes", lang)} (≥ {s.minLevel})</li>)}
              <li>Speaking: {L("alohida mashq qiling (AI Suhbat) — mockda baholanmaydi", "practise separately in AI Speaking — not scored in the mock")}</li>
            </ul>
            <div><Button onClick={() => { started.current = Date.now(); setPhase("reading"); }}>{L("Mockni boshlash", "Start mock")}</Button></div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">{L("Oldingi urinishlar", "Previous attempts")}</h2>
            {mocks.length === 0 ? <p className="mt-2 text-sm text-muted">{L("Hali yo'q.", "None yet.")}</p> : (
              <ul className="mt-2 grid gap-2 text-sm">
                {mocks.slice().reverse().map((m) => (
                  <li key={m.id} className="rounded-lg border border-line p-3">
                    {new Date(m.at).toLocaleString()} — {m.sections?.map((s) => `${s.name}: ${s.score}%`).join(" · ")}
                    <br /><span className="text-muted">{m.notes}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {phase === "reading" && (
        <ReadingSection lang={lang} readings={readings} answers={readingAnswers} setAnswer={(id, c) => setReadingAnswers((a) => ({ ...a, [id]: c }))} onSubmit={submitReading} />
      )}
      {phase === "listening" && (
        <ListeningSection lang={lang} items={listenings} answers={listeningAnswers} setAnswer={(id, c) => setListeningAnswers((a) => ({ ...a, [id]: c }))} onSubmit={submitListening} />
      )}
      {phase === "writing" && (
        <WritingSection lang={lang} prompt={essayTask.prompt} essay={essay} setEssay={setEssay} onFinish={finish} />
      )}
      {phase === "result" && result && (
        <ResultSection lang={lang} r={result} onBack={() => { setReadingAnswers({}); setListeningAnswers({}); setEssay(""); setResult(null); setPhase("intro"); }} />
      )}
    </div>
  );
}

function ReadingSection({ lang, readings, answers, setAnswer, onSubmit }: { lang: Lang; readings: ReadingActivity[]; answers: Record<string, string>; setAnswer: (id: string, c: string) => void; onSubmit: () => void }) {
  const left = useCountdown(minutesOf("reading") * 60, onSubmit);
  return (
    <div className="grid gap-4">
      <Timer left={left} label="Reading" />
      {readings.map((r) => (
        <Card key={r.id}>
          <h2 className="font-bold">{r.title} <Pill tone="neutral">{r.level}</Pill></h2>
          <div className="mt-2 space-y-2 text-sm leading-7">{r.text.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div>
          <QuestionList questions={r.questions} answers={answers} onChange={setAnswer} />
        </Card>
      ))}
      <div className="flex justify-end"><Button onClick={onSubmit}>{lang === "uz" ? "Reading'ni topshirish" : "Submit reading"}</Button></div>
    </div>
  );
}

function ListeningSection({ lang, items, answers, setAnswer, onSubmit }: { lang: Lang; items: ListeningActivity[]; answers: Record<string, string>; setAnswer: (id: string, c: string) => void; onSubmit: () => void }) {
  const left = useCountdown(minutesOf("listening") * 60, onSubmit);
  const { speak, speaking, supported } = useSpeaker();
  const [plays, setPlays] = useState<Record<string, number>>({});
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  return (
    <div className="grid gap-4">
      <Timer left={left} label="Listening" />
      {!supported && <Notice tone="warn">{L("Bu brauzerda audio yo'q — bu bo'lim ishonchli baholanmaydi.", "Audio isn't available in this browser — this section can't be scored reliably.")}</Notice>}
      {items.map((a) => (
        <Card key={a.id}>
          <h2 className="font-bold">{a.title} <Pill tone="neutral">{a.level}</Pill></h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={!supported || speaking || (plays[a.id] ?? 0) >= 2}
              onClick={() => { setPlays((p) => ({ ...p, [a.id]: (p[a.id] ?? 0) + 1 })); void speak(a.script.map((s) => ({ text: s.line, voice: a.speakers[s.speaker]?.voice, rate: a.rate }))); }}>
              ▶ {L("Tinglash", "Play")} ({2 - (plays[a.id] ?? 0)} {L("ta qoldi", "left")})
            </Button>
            <span className="text-xs text-muted">{L("Sintezlangan ovoz. Imtihon rejimida skript yo'q.", "Synthetic voice. No transcript in exam mode.")}</span>
          </div>
          <QuestionList questions={a.questions} answers={answers} onChange={setAnswer} />
        </Card>
      ))}
      <div className="flex justify-end"><Button onClick={onSubmit}>{L("Listening'ni topshirish", "Submit listening")}</Button></div>
    </div>
  );
}

function WritingSection({ lang, prompt, essay, setEssay, onFinish }: { lang: Lang; prompt: string; essay: string; setEssay: (s: string) => void; onFinish: (skip: boolean) => void }) {
  const left = useCountdown(minutesOf("writing") * 60, () => onFinish(false));
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  return (
    <div className="grid gap-4">
      <Timer left={left} label="Writing" />
      <Card className="grid gap-3">
        <p className="font-semibold">{prompt}</p>
        <label htmlFor="essay" className="sr-only">Essay</label>
        <textarea id="essay" rows={12} value={essay} onChange={(e) => setEssay(e.target.value)} className="w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" />
        <p className="text-xs text-muted">{L("Yozma qism faqat qoidaga asoslangan tahlil bilan ko'riladi va tayyorlik belgisiga ta'sir qilmaydi.", "The writing task gets rule-based analysis only and does not influence the readiness label.")}</p>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => onFinish(true)}>{L("O'tkazib yuborish", "Skip writing")}</Button>
          <Button onClick={() => onFinish(false)} disabled={essay.trim().split(/\s+/).length < 20}>{L("Yakunlash", "Finish mock")}</Button>
        </div>
      </Card>
    </div>
  );
}

function ResultSection({ lang, r, onBack }: { lang: Lang; r: MockResult; onBack: () => void }) {
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const label = { consistent: L("Bu mockda B2 darajasiga mos natija", "Consistent with B2 on this mock"), approaching: L("B2 ga yaqinlashmoqda (B1+)", "Approaching B2 (B1+)"), below: L("Bu mockda B2 dan pastroq", "Below B2 on this mock") }[r.readiness];
  return (
    <Card className="pop-in grid gap-3">
      <Pill tone="sun">{L("Mock-imtihon natijasi (rasmiy emas)", "Mock-exam result (unofficial)")}</Pill>
      <h2 className="text-2xl font-extrabold">{label}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li><div className="flex justify-between text-sm"><strong>Reading</strong><span>{Math.round(r.readingPct * 100)}%</span></div><Bar value={r.readingPct} label="Reading" /></li>
        <li><div className="flex justify-between text-sm"><strong>Listening</strong><span>{Math.round(r.listeningPct * 100)}%</span></div><Bar value={r.listeningPct} label="Listening" /></li>
        {r.writingPct !== null && <li><div className="flex justify-between text-sm"><strong>Writing (rule-based)</strong><span>{Math.round(r.writingPct * 100)}%</span></div><Bar value={r.writingPct} label="Writing" tone="sun" /></li>}
      </ul>
      <Notice>{L(
        `Ishonch: ${r.confidence === "low" ? "past (bitta mock yetarli emas — B2 darajasini bir necha marta barqaror ko'rsatish kerak)" : "o'rtacha"}. Bu natija o'rganish progressi va taxminiy CEFR darajasidan ham, rasmiy imtihon natijasidan ham alohida.`,
        `Confidence: ${r.confidence === "low" ? "low (one mock isn't enough — show B2-level performance consistently, several times)" : "medium"}. This is separate from learning progress, estimated CEFR level, and any official result.`,
      )}</Notice>
      <div><Button onClick={onBack}>{L("Orqaga", "Back")}</Button></div>
    </Card>
  );
}

function Timer({ left, label }: { left: number; label: string }) {
  return (
    <div className="sticky top-16 z-10 flex items-center justify-between rounded-xl bg-night px-4 py-2 text-white lg:top-2">
      <strong>{label}</strong>
      <span role="timer" aria-live="off" className={`font-mono text-lg ${left < 60 ? "text-sun" : ""}`}>{mmss(left)}</span>
    </div>
  );
}

function QuestionList({ questions, answers, onChange }: { questions: McqQuestion[]; answers: Record<string, string>; onChange: (id: string, c: string) => void }) {
  return (
    <ol className="mt-4 grid gap-4">
      {questions.map((q, i) => (
        <li key={q.id}>
          <fieldset>
            <legend className="text-sm font-semibold">{i + 1}. {q.prompt}</legend>
            <div className="mt-2 grid gap-1.5">
              {q.choices.map((c) => (
                <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 text-sm ${answers[q.id] === c.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <input type="radio" name={q.id} className="h-4 w-4" checked={answers[q.id] === c.id} onChange={() => onChange(q.id, c.id)} />
                  {c.text}
                </label>
              ))}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}
