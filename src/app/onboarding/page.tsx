"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, Pill } from "@/components/ui";
import { EXAM_TARGETS, GOALS, INTERESTS, type Lang } from "@/lib/i18n";
import type { LearnerState } from "@/lib/learning-engine/state";

type Profile = LearnerState["profile"];

const STEPS = 5;

export default function OnboardingPage() {
  const { state, update } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>(state.profile.explanationLanguage);
  const [goal, setGoal] = useState<Profile["goal"]>(state.profile.goal);
  const [minutes, setMinutes] = useState(state.profile.minutesPerDay);
  const [interests, setInterests] = useState<string[]>(state.profile.interests);
  const [exam, setExam] = useState<Profile["examTarget"]>(state.profile.examTarget);
  const [name, setName] = useState(state.profile.displayName);
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  function finish(then: string) {
    update((s) => ({
      ...s,
      profile: { ...s.profile, explanationLanguage: lang, goal, minutesPerDay: minutes, interests, examTarget: exam, displayName: name.trim().slice(0, 60), onboarded: true },
      missions: { ...s.missions, day: null },
    }));
    router.push(then);
  }

  const toggle = (id: string) => setInterests((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const choiceCls = (on: boolean) => `min-h-12 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"}`;

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-black text-white">LQ</span>
        <div>
          <h1 className="text-2xl font-extrabold">LinguaQuest AI</h1>
          <p className="text-sm text-muted">{L("Ingliz tili: noldan B2 sari — kichik, aniq qadamlar bilan", "English from zero toward B2 — in small, measurable steps")}</p>
        </div>
      </div>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Pill>{step + 1} / {STEPS}</Pill>
          <span className="text-xs text-muted">{L("Faqat kerakli ma'lumotlar so'raladi", "Only information that helps your plan")}</span>
        </div>

        {step === 0 && (
          <fieldset>
            <legend className="text-xl font-bold">Tushuntirish tili / Explanation language</legend>
            <p className="mt-1 text-sm text-muted">Keyinroq Sozlamalarda o&apos;zgartirishingiz mumkin. / You can change this later in Settings.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" className={choiceCls(lang === "uz")} aria-pressed={lang === "uz"} onClick={() => setLang("uz")}>O‘zbekcha (boshlovchilar uchun tavsiya)</button>
              <button type="button" className={choiceCls(lang === "en")} aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="text-xl font-bold">{L("Asosiy maqsadingiz?", "What is your main goal?")}</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {GOALS.map((g) => <button key={g.id} type="button" aria-pressed={goal === g.id} className={choiceCls(goal === g.id)} onClick={() => setGoal(g.id as Profile["goal"])}>{g[lang]}</button>)}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className="text-xl font-bold">{L("Kuniga necha daqiqa ajrata olasiz?", "How many minutes can you study on a typical day?")}</legend>
            <p className="mt-1 text-sm text-muted">{L("Band kunlar uchun 3–5 daqiqalik rejim doim mavjud.", "A 3–5 minute busy-day mode is always available.")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[5, 10, 20, 30].map((m) => <button key={m} type="button" aria-pressed={minutes === m} className={choiceCls(minutes === m)} onClick={() => setMinutes(m)}>{m} {L("daqiqa", "min")}</button>)}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend className="text-xl font-bold">{L("Qaysi mavzular qiziq?", "Which topics interest you?")}</legend>
            <p className="mt-1 text-sm text-muted">{L("Ixtiyoriy. Mashqlar shu mavzularga ustuvorlik beradi.", "Optional. Activities on these topics are preferred.")}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {INTERESTS.map((i) => <button key={i.id} type="button" aria-pressed={interests.includes(i.id)} className={choiceCls(interests.includes(i.id))} onClick={() => toggle(i.id)}>{i[lang]}</button>)}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            <fieldset>
              <legend className="text-xl font-bold">{L("Imtihon rejangiz bormi?", "Planning an exam?")}</legend>
              <p className="mt-1 text-sm text-muted">{L("Imtihon formatlari farq qiladi. Amaldagi mashqlar umumiy B2 format, rasmiy imtihon emas.", "Exam formats differ. Practice here uses a generic B2 format, not an official exam.")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {EXAM_TARGETS.map((e) => <button key={e.id} type="button" aria-pressed={exam === e.id} className={choiceCls(exam === e.id)} onClick={() => setExam(e.id as Profile["examTarget"])}>{e[lang]}</button>)}
              </div>
            </fieldset>
            <div>
              <label htmlFor="name" className="text-sm font-semibold">{L("Ismingiz (ixtiyoriy)", "Your name (optional)")}</label>
              <input id="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" autoComplete="given-name" />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>{L("Orqaga", "Back")}</Button>
          {step < STEPS - 1 ? (
            <Button onClick={() => setStep(step + 1)}>{L("Davom etish", "Continue")}</Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => finish("/")}>{L("Testni keyinroq topshiraman", "Skip placement for now")}</Button>
              <Button onClick={() => finish("/placement")}>{L("Daraja aniqlashni boshlash", "Start placement check")}</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
