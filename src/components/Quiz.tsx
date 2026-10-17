"use client";

import { useRef, useState } from "react";
import type { McqQuestion } from "@/types/domain";
import type { Lang } from "@/lib/i18n";
import { Button, Card, Pill } from "./ui";

export interface QuizAnswer {
  questionId: string;
  choice: string;
  correct: boolean;
}

/**
 * One-attempt-per-question multiple choice. Feedback is shown immediately (practice) or withheld until
 * the end (`deferFeedback`, used by timed exams). Single attempts keep XP from rewarding guessing.
 */
export function Quiz({
  questions,
  lang,
  deferFeedback = false,
  onFinish,
  finishLabel,
}: {
  questions: McqQuestion[];
  lang: Lang;
  deferFeedback?: boolean;
  onFinish: (answers: QuizAnswer[]) => void;
  finishLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const finished = useRef(false);

  const q = questions[index];
  const last = index === questions.length - 1;

  function commit(sel: string) {
    const a: QuizAnswer = { questionId: q.id, choice: sel, correct: sel === q.answer };
    const all = [...answers, a];
    setAnswers(all);
    return all;
  }

  function check() {
    if (!selected) return;
    commit(selected);
    setChecked(true);
  }

  function next() {
    let all = answers;
    if (deferFeedback && selected && !checked) all = commit(selected);
    if (last) {
      if (!finished.current) {
        finished.current = true;
        onFinish(all);
      }
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setChecked(false);
  }

  const correct = checked && selected === q.answer;
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Pill>{L(`Savol ${index + 1} / ${questions.length}`, `Question ${index + 1} of ${questions.length}`)}</Pill>
        <Pill tone="neutral">{q.type}</Pill>
      </div>
      <h3 id={`q-${q.id}`} className="text-lg font-bold leading-snug">{q.prompt}</h3>
      <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-4 grid gap-2.5">
        {q.choices.map((c) => {
          const isSel = selected === c.id;
          const showResult = checked && !deferFeedback;
          const isAnswer = q.answer === c.id;
          let cls = "border-line bg-surface hover:border-brand";
          if (isSel && !showResult) cls = "border-brand bg-brand-soft";
          if (showResult && isAnswer) cls = "border-leaf bg-leaf-soft";
          if (showResult && isSel && !isAnswer) cls = "border-berry bg-berry-soft";
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={checked}
              onClick={() => setSelected(c.id)}
              className={`min-h-12 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${cls}`}
            >
              {c.text}
            </button>
          );
        })}
      </div>

      {checked && !deferFeedback && (
        <div role="status" className={`pop-in mt-4 rounded-xl p-4 text-sm leading-relaxed ${correct ? "bg-leaf-soft" : "bg-berry-soft"}`}>
          <p className="font-bold">{correct ? L("To'g'ri!", "Correct!") : L("Hali emas — mana nima uchun:", "Not quite — here's why:")}</p>
          <p className="mt-1">{q.explanation.en}</p>
          {lang === "uz" && <p className="mt-1 text-muted">{q.explanation.uz}</p>}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        {!checked && !deferFeedback && <Button onClick={check} disabled={!selected}>{L("Tekshirish", "Check")}</Button>}
        {(checked || deferFeedback) && (
          <Button onClick={next} disabled={deferFeedback && !selected}>
            {last ? finishLabel ?? L("Yakunlash", "Finish") : L("Keyingi", "Next")}
          </Button>
        )}
      </div>
    </Card>
  );
}
