"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Bar, Button, Card, LinkButton, Notice, PageHeader, Pill } from "@/components/ui";
import { PLACEMENT_BANK, SPEAKING_PLACEMENT_PROMPT, WRITING_PLACEMENT_PROMPT } from "@/content/placement";
import { placementTextScore } from "@/lib/assessment/feedback";
import {
  nextPlacementItem,
  PLACEMENT_LENGTH,
  scorePlacement,
  type EntryPoint,
  type PlacementOutcome,
  type PlacementResponse,
  type ProductiveSample,
} from "@/lib/assessment/placement";
import { useSpeaker } from "@/lib/speech-client";

type Phase = "intro" | "quiz" | "writing" | "speaking" | "result";

export default function PlacementPage() {
  const { lang, recordPlacement, state } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const [phase, setPhase] = useState<Phase>("intro");
  const [entry, setEntry] = useState<EntryPoint>("standard");
  const [responses, setResponses] = useState<PlacementResponse[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [writing, setWriting] = useState("");
  const [speaking, setSpeaking] = useState("");
  const [outcome, setOutcome] = useState<PlacementOutcome | null>(null);
  const { speak, speaking: playing, supported: ttsOk } = useSpeaker();

  const item = useMemo(() => (phase === "quiz" ? nextPlacementItem(responses, entry, excluded) : null), [phase, responses, entry, excluded]);
  const last = state.assessments.filter((a) => a.type === "placement").at(-1);

  function begin(e: EntryPoint) {
    setEntry(e);
    setResponses([]);
    setExcluded([]);
    setPhase("quiz");
  }

  function answer(choice: string | null) {
    if (!item) return;
    setResponses((r) => [...r, { itemId: item.id, choice, correct: choice === item.answer, skill: item.skill, level: item.level }]);
    setSelected(null);
  }

  // quiz finished when nextPlacementItem returns null
  useEffect(() => {
    if (phase === "quiz" && item === null) setPhase("writing");
  }, [phase, item]);

  function finish(skipProductive: { w: boolean; s: boolean }) {
    const samples: ProductiveSample[] = [];
    if (!skipProductive.w && writing.trim().split(/\s+/).length >= 6) {
      const r = placementTextScore(writing);
      samples.push({ skill: "writing", level: r.level, score: r.score });
    }
    if (!skipProductive.s && speaking.trim().split(/\s+/).length >= 6) {
      const r = placementTextScore(speaking);
      samples.push({ skill: "speaking", level: r.level, score: r.score });
    }
    const o = scorePlacement(responses, entry, samples);
    setOutcome(o);
    recordPlacement(o);
    setPhase("result");
  }

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={L("Diagnostika", "Diagnostic")} title={L("Daraja aniqlash", "Placement check")}>
        {last && <Pill tone="neutral">{L("Oxirgi marta", "Last taken")}: {new Date(last.at).toLocaleDateString()}</Pill>}
      </PageHeader>

      {phase === "intro" && (
        <Card className="grid gap-4">
          <p className="leading-relaxed">{L(
            "Bu qisqa (taxminan 10 daqiqa) moslashuvchan test: javoblaringizga qarab savollar osonlashadi yoki qiyinlashadi. Natija — taxminiy, rasmiy CEFR darajasi emas. Har bir ko'nikma alohida baholanadi va yetarli dalil bo'lmasa, “aniq emas” deb ko'rsatiladi.",
            "This is a short (about 10 minutes) adaptive check: questions get easier or harder depending on your answers. The result is provisional and not an official CEFR level. Each skill is estimated separately, and if there isn't enough evidence it will say so.",
          )}</p>
          <ul className="list-disc pl-5 text-sm text-muted">
            <li>{L("Lug'at, grammatika, o'qish va tinglash savollari", "Vocabulary, grammar, reading and listening questions")}</li>
            <li>{L("Qisqa yozma va (ixtiyoriy) gapirish namunasi — qoidaga asoslangan, past ishonchli baho", "A short writing sample and an optional speaking sample — rule-based, low-confidence estimates")}</li>
            <li>{L("Istalgan vaqtda qayta topshirishingiz mumkin", "You can retake it any time")}</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => begin("standard")}>{L("Boshlash", "Start")}</Button>
            <Button variant="secondary" onClick={() => begin("beginner")}>{L("Men deyarli ingliz tilini bilmayman", "I know almost no English")}</Button>
          </div>
        </Card>
      )}

      {phase === "quiz" && item && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <Pill>{responses.length + 1} / {PLACEMENT_LENGTH}</Pill>
            <Bar value={responses.length / PLACEMENT_LENGTH} label="Placement progress" />
          </div>
          {item.passage && <blockquote className="mb-3 rounded-xl bg-canvas p-3 text-base leading-relaxed">{item.passage}</blockquote>}
          {item.audioText && (
            <div className="mb-3 grid gap-2 rounded-xl bg-canvas p-3">
              {ttsOk ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => void speak([{ text: item.audioText!, rate: 0.85 }])} disabled={playing}>▶ {L("Tinglash (qayta ham mumkin)", "Play (replay allowed)")}</Button>
                  <span className="text-xs text-muted">{L("Sintezlangan ovoz", "Synthetic voice")}</span>
                </div>
              ) : (
                <Notice tone="warn">{L("Bu brauzerda audio ishlamaydi. Bu savolni o'tkazib yuboring — tinglash baholanmaydi.", "Audio isn't available in this browser. Skip — listening won't be assessed.")}</Notice>
              )}
              <Button variant="ghost" onClick={() => { setExcluded((e) => [...e, ...PLACEMENT_BANK.filter((p) => p.skill === "listening").map((p) => p.id)]); }}>
                {L("Tinglashni o'tkazib yuborish (baholanmaydi)", "Skip listening (it won't be assessed)")}
              </Button>
            </div>
          )}
          <h2 id="pq" className="text-lg font-bold">{item.stem}</h2>
          <div role="radiogroup" aria-labelledby="pq" className="mt-3 grid gap-2">
            {item.choices.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={selected === c.id} onClick={() => setSelected(c.id)}
                className={`min-h-12 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium ${selected === c.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"}`}>
                {c.text}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => answer(null)}>{L("Bilmayman", "I don't know")}</Button>
            <Button onClick={() => answer(selected)} disabled={!selected}>{L("Keyingi", "Next")}</Button>
          </div>
          <p className="mt-3 text-xs text-muted">{L("Bu yerda to'g'ri/noto'g'ri ko'rsatilmaydi — test tugagach tushuntirishlar chiqadi.", "Answers aren't revealed during the check; explanations come after.")}</p>
        </Card>
      )}

      {phase === "writing" && (
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">{L("Yozish namunasi", "Writing sample")}</h2>
          <p>{WRITING_PLACEMENT_PROMPT[lang]}</p>
          <label htmlFor="pw" className="sr-only">Writing</label>
          <textarea id="pw" rows={5} value={writing} onChange={(e) => setWriting(e.target.value)} maxLength={1200} className="w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" />
          <p className="text-xs text-muted">{L("Qoidaga asoslangan tahlil: past ishonchli taxmin. Matn qurilmangizda qoladi.", "Rule-based analysis: a low-confidence estimate. The text stays on your device.")}</p>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => { setWriting(""); setPhase("speaking"); }}>{L("O'tkazib yuborish", "Skip")}</Button>
            <Button onClick={() => setPhase("speaking")} disabled={writing.trim().split(/\s+/).length < 6}>{L("Keyingi", "Next")}</Button>
          </div>
        </Card>
      )}

      {phase === "speaking" && (
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">{L("Gapirish namunasi (ixtiyoriy)", "Speaking sample (optional)")}</h2>
          <p>{SPEAKING_PLACEMENT_PROMPT[lang]}</p>
          <label htmlFor="ps" className="sr-only">Speaking answer</label>
          <textarea id="ps" rows={4} value={speaking} onChange={(e) => setSpeaking(e.target.value)} maxLength={1200} className="w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" />
          <p className="text-xs text-muted">{L("Hozircha javobingiz matn sifatida baholanadi (talaffuz tahlil qilinmaydi). Gapirish ko'nikmasi AI Suhbat bo'limida aniqlashadi.", "Your answer is judged as text only (pronunciation is not analysed). Your speaking estimate improves in AI Speaking.")}</p>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => finish({ w: !writing.trim(), s: true })}>{L("O'tkazib yuborib, natijani ko'rish", "Skip and see results")}</Button>
            <Button onClick={() => finish({ w: !writing.trim(), s: false })} disabled={speaking.trim().split(/\s+/).length < 6}>{L("Natijani ko'rish", "See results")}</Button>
          </div>
        </Card>
      )}

      {phase === "result" && outcome && <Result outcome={outcome} lang={lang} responses={responses} onRetake={() => { setWriting(""); setSpeaking(""); setOutcome(null); setPhase("intro"); }} />}
    </div>
  );
}

function Result({ outcome, lang, responses, onRetake }: { outcome: PlacementOutcome; lang: "uz" | "en"; responses: PlacementResponse[]; onRetake: () => void }) {
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const perSkill = Object.entries(outcome.record.perSkill);
  const wrong = responses.filter((r) => !r.correct).slice(0, 5).map((r) => PLACEMENT_BANK.find((p) => p.id === r.itemId)).filter(Boolean);
  const thin = outcome.overallConfidence < 0.6;
  return (
    <div className="grid gap-4">
      <Card className="pop-in">
        <Pill tone="sun">{L("Taxminiy natija", "Provisional result")}</Pill>
        <h2 className="mt-2 text-3xl font-extrabold">{L("Taxminiy daraja", "Estimated level")}: {outcome.overall}</h2>
        <p className="mt-1 text-sm text-muted">{L("Ishonch", "Confidence")}: {Math.round(outcome.overallConfidence * 100)}% — {thin ? L("past: bu test qisqa. Mashq qilgan sari aniqlashadi.", "low: the check is short. It sharpens as you practise.") : L("o'rtacha.", "moderate.")}</p>
        <div className="mt-3"><Notice>{L("Bu rasmiy CEFR natijasi emas va B2 sertifikatini kafolatlamaydi. Rasmiy imtihon natijalari alohida.", "This is not an official CEFR result and does not guarantee any certificate. Official exam results are separate.")}</Notice></div>
      </Card>

      <Card>
        <h3 className="font-bold">{L("Ko'nikmalar bo'yicha", "By skill")}</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {perSkill.map(([skill, v]) => (
            <li key={skill}>
              <div className="flex items-baseline justify-between text-sm"><strong className="capitalize">{skill}</strong><span>{v.total === 0 && v.confidence === 0 ? L("baholanmadi", "not assessed") : v.confidence < 0.4 ? `${v.level} · ${L("dalil kam", "little evidence")}` : v.level}</span></div>
              <Bar value={v.confidence} label={`${skill} confidence`} tone="sun" />
              <p className="text-xs text-muted">{L("Ishonch", "Confidence")} {Math.round(v.confidence * 100)}%{v.total > 0 && ` · ${v.correct}/${v.total}`}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          {outcome.strengths.length > 0 && <>💪 {L("Kuchli tomon", "Strength")}: <strong>{outcome.strengths.join(", ")}</strong>. </>}
          {outcome.weaknesses.length > 0 && <>🎯 {L("Birinchi diqqat", "Focus first")}: <strong>{outcome.weaknesses.join(", ")}</strong>.</>}
        </p>
      </Card>

      {wrong.length > 0 && (
        <Card>
          <h3 className="font-bold">{L("Xatolar tahlili", "What to review")}</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {wrong.map((p) => <li key={p!.id} className="rounded-lg bg-canvas p-3"><strong>{p!.stem}</strong><br />{p!.explanation.en}{lang === "uz" && <><br /><span className="text-muted">{p!.explanation.uz}</span></>}</li>)}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/">{L("Shaxsiy rejani ko'rish", "See my plan")}</LinkButton>
        <Button variant="secondary" onClick={onRetake}>{L("Qayta topshirish", "Retake")}</Button>
      </div>
    </div>
  );
}
