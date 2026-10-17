"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ResultPanel } from "@/components/ResultPanel";
import { Button, Card, Notice, Pill, SourceBadge, Spinner } from "@/components/ui";
import { demoTutorTurn, type Intensity, type TutorTurn } from "@/lib/assessment/feedback";
import { VOCAB_BY_ID } from "@/content/vocabulary";
import { activityHref, rankActivities } from "@/lib/learning-engine/recommend";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { STT_MESSAGES, useDictation, useSpeaker } from "@/lib/speech-client";
import { RECORDER_MESSAGES, TRANSCRIBE_MESSAGES, transcribeBlob, useRecorder, type TranscribeFailure } from "@/lib/audio-client";
import { useServerStatus } from "@/lib/server-status";
import { AudioConsentDialog } from "@/components/AudioConsentDialog";
import { levelToNumber } from "@/lib/learning-engine/levels";
import type { SpeakingActivity } from "@/types/domain";

interface Msg {
  role: "tutor" | "learner";
  text: string;
  turn?: TutorTurn;
}

export function SpeakingPlayer({ activity }: { activity: SpeakingActivity }) {
  const { lang, state, recordAttempt, update, now } = useApp();
  const [startedAtInit] = useState(() => Date.now());
  const startedAt = useRef(startedAtInit);
  const endRef = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "tutor", text: activity.opening }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<Intensity>(state.profile.correctionIntensity);
  const [englishOnly, setEnglishOnly] = useState(levelToNumber(activity.level) >= 3);
  const [result, setResult] = useState<{ res: ApplyResult; pct: number; next?: string } | null>(null);
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const { speak, supported: ttsOk } = useSpeaker();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  const onDictated = useCallback((text: string) => setInput((cur) => (cur ? `${cur} ${text}` : text)), []);
  const dictation = useDictation(onDictated);

  // Server-side recording + transcription (only offered when the server has a speech provider configured).
  const status = useServerStatus();
  const serverStt = status?.speechServer === true;
  const [consentOpen, setConsentOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sttFail, setSttFail] = useState<TranscribeFailure | null>(null);
  const onRecorded = useCallback(
    async (blob: Blob) => {
      setTranscribing(true);
      setSttFail(null);
      const r = await transcribeBlob(blob);
      setTranscribing(false);
      if (r.ok && r.text) onDictated(r.text);
      else setSttFail(r.ok ? "too-short" : r.reason);
    },
    [onDictated],
  );
  const recorder = useRecorder(onRecorded);
  const consent = state.profile.audioConsent;
  function pressRecord() {
    if (recorder.state === "recording") return recorder.stop();
    if (consent === "granted") return void recorder.start();
    setConsentOpen(true);
  }
  function setConsent(v: "granted" | "denied") {
    update((s) => ({ ...s, profile: { ...s.profile, audioConsent: v } }));
    setConsentOpen(false);
    if (v === "granted") void recorder.start();
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setNotice(null);
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "learner", text }]);
    const turnIndex = turns.length;
    let turn: TutorTurn;
    try {
      const r = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityId: activity.id, learnerText: text, history, turnIndex, intensity, explanationLanguage: lang }),
      });
      if (!r.ok) throw new Error(r.status === 429 ? "rate" : "server");
      turn = (await r.json()) as TutorTurn;
    } catch (e) {
      turn = { ...demoTutorTurn({ activity, learnerText: text, turnIndex, intensity, explanationLanguage: lang }), fallbackReason: e instanceof Error ? e.message : "network" };
      setNotice(L("Server bilan aloqa yo'q — mahalliy demo murabbiy javob berdi. Suhbatingiz saqlanmoqda.", "Couldn't reach the server — the local demo tutor replied. Your conversation is kept."));
    }
    setTurns((t) => [...t, turn]);
    setMsgs((m) => [...m, { role: "tutor", text: `${turn.reply} ${turn.followUp}`, turn }]);
    setBusy(false);
  }

  async function finish() {
    const learnerTurns = turns;
    const avg = learnerTurns.reduce((s, t) => s + t.score, 0) / learnerTurns.length;
    const tags = learnerTurns.flatMap((t) => t.errorTags);
    const used = Array.from(new Set(learnerTurns.flatMap((t) => t.trackedVocabIds))).filter((id) => !activity.opening.toLowerCase().includes((VOCAB_BY_ID[id]?.lemma ?? "").toLowerCase()));
    const source = learnerTurns.every((t) => t.source === "ai") ? "ai" : "rule-based";
    const res = recordAttempt({
      activityId: activity.id,
      kind: "speaking",
      skill: "speaking",
      level: activity.level,
      score: avg,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      source,
      note: `${learnerTurns.length} turns (text-based; pronunciation not assessed)`,
      encounteredVocab: activity.vocab,
      independentVocab: used,
      errorTags: tags,
      units: learnerTurns.length,
    });
    update((s) => ({
      ...s,
      conversations: [...s.conversations, { id: `c-${Date.now()}`, activityId: activity.id, startedAt: new Date(startedAt.current).toISOString(), turns: msgs.map((m) => ({ role: m.role, text: m.text, source: m.turn?.source })) }].slice(-20),
    }));
    const next = rankActivities(res.state, now, state.profile.minutesPerDay).find((c) => c.activity.id !== activity.id);
    setResult({ res, pct: Math.round(avg * 100), next: next ? activityHref(next.activity) : undefined });
  }

  if (result) {
    return <ResultPanel result={result.res} scorePct={result.pct} lang={lang} vocabIds={activity.vocab} nextHref={result.next}>
      <p className="mt-3 text-sm text-muted">{L("Bu ball so'zlar va gaplarga (matnga) asoslangan. Talaffuz baholanmadi.", "This score reflects your words and sentences (text). Pronunciation was not assessed.")}</p>
    </ResultPanel>;
  }

  return (
    <div className="grid gap-4">
      <header>
        <div className="flex flex-wrap gap-2"><Pill>{activity.level}</Pill><Pill tone="neutral">{activity.topic}</Pill></div>
        <h1 className="mt-2 text-2xl font-extrabold">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted">{L("Maqsad", "Goal")}: {activity.objectives[lang]}</p>
      </header>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex min-h-11 items-center gap-2">{L("Tuzatish darajasi", "Correction level")}
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)} className="rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="gentle">{L("Yumshoq", "Gentle")}</option>
              <option value="balanced">{L("Muvozanatli", "Balanced")}</option>
              <option value="detailed">{L("Batafsil", "Detailed")}</option>
            </select>
          </label>
          {lang === "uz" && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={englishOnly} onChange={(e) => setEnglishOnly(e.target.checked)} /> {L("Faqat inglizcha", "English only")}
            </label>
          )}
        </div>
        <Notice tone="info">{L("Murabbiy hozir matnni tahlil qiladi. Talaffuz ballari berilmaydi, chunki audio tahlil qilinmaydi.", "The tutor analyses your text. No pronunciation score is given because audio is not analysed.")}</Notice>

        <ol aria-label="Conversation" className="grid max-h-[28rem] gap-3 overflow-y-auto rounded-xl bg-canvas p-3" aria-live="polite">
          {msgs.map((m, i) => (
            <li key={i} className={`max-w-[92%] rounded-2xl p-3 text-sm leading-relaxed ${m.role === "tutor" ? "self-start bg-surface" : "self-end bg-brand text-white"}`}>
              <p>{m.text}</p>
              {i === 0 && lang === "uz" && !englishOnly && <p className="mt-1 text-xs text-muted">{activity.openingUz}</p>}
              {m.role === "tutor" && ttsOk && <button type="button" onClick={() => void speak([{ text: m.text, voice: "female" }])} className="mt-1 text-xs font-semibold text-brand">🔊 {L("Tinglash", "Listen")}</button>}
              {m.turn && <TurnFeedback turn={m.turn} lang={lang} />}
            </li>
          ))}
          {busy && <li className="self-start"><Spinner label={L("Murabbiy javob yozmoqda…", "Tutor is replying…")} /></li>}
          <div ref={endRef} />
        </ol>

        {notice && <Notice tone="warn">{notice}</Notice>}
        {dictation.error && <Notice tone="warn">{STT_MESSAGES[dictation.error][lang]}</Notice>}
        {recorder.error && <Notice tone="warn">{RECORDER_MESSAGES[recorder.error][lang]}</Notice>}
        {sttFail && <Notice tone="warn">{TRANSCRIBE_MESSAGES[sttFail][lang]}</Notice>}
        {transcribing && <Spinner label={L("Ovoz matnga aylantirilmoqda…", "Transcribing your recording…")} />}

        {lang === "uz" && !englishOnly && <p className="text-xs text-muted">{L("Boshlash uchun", "Starters")}: {activity.starters.join("  ·  ")}</p>}
        <label htmlFor="speak-input" className="sr-only">Your answer</label>
        <textarea id="speak-input" value={input} onChange={(e) => setInput(e.target.value)} rows={3} maxLength={1200} disabled={busy} placeholder={activity.starters[0]} className="w-full rounded-xl border-2 border-line bg-surface p-3 text-base focus:border-brand" />
        <div className="flex flex-wrap items-center gap-2">
          {serverStt && recorder.supported && consent !== "denied" ? (
            <Button variant="secondary" onClick={pressRecord} disabled={transcribing || recorder.state === "requesting"} aria-pressed={recorder.state === "recording"}>
              {recorder.state === "recording" ? L(`⏹ To'xtatish (${recorder.seconds}s)`, `⏹ Stop (${recorder.seconds}s)`) : L("🎙 Yozib olish", "🎙 Record")}
            </Button>
          ) : dictation.supported ? (
            <Button variant="secondary" onClick={() => (dictation.listening ? dictation.stop() : dictation.start())} aria-pressed={dictation.listening}>
              {dictation.listening ? L("⏹ To'xtatish", "⏹ Stop") : L("🎙 Ovoz bilan (brauzer diktovkasi)", "🎙 Speak (browser dictation)")}
            </Button>
          ) : (
            <span className="text-xs text-muted">{L("Bu brauzerda ovoz kiritish yo'q — yozib javob bering.", "Voice input isn't available in this browser — type your answer.")}</span>
          )}
          <Button onClick={send} disabled={busy || !input.trim()}>{L("Yuborish", "Send")}</Button>
          <Button variant="ghost" onClick={finish} disabled={turns.length < 2 || busy} title={turns.length < 2 ? L("Kamida 2 ta javob bering", "Give at least 2 answers first") : undefined}>
            {L("Suhbatni yakunlash", "Finish conversation")} ({turns.length}/2)
          </Button>
        </div>
        <AudioConsentDialog open={consentOpen} lang={lang} onAllow={() => setConsent("granted")} onDeny={() => setConsent("denied")} />
        {serverStt && consent === "denied" && <p className="text-xs text-muted">{L("Ovoz yozish o'chirilgan (rozilik berilmagan). Sozlamalarda yoqishingiz mumkin.", "Voice recording is off (no consent). You can enable it in Settings.")}</p>}
        <p className="text-xs text-muted">{L("Diktovka brauzer xizmati orqali ishlaydi (audio brauzer provayderiga yuborilishi mumkin). Mikrofon faqat tugmani bosganda yoqiladi.", "Dictation uses your browser's speech service (audio may be sent to the browser vendor). The microphone only turns on when you press the button.")}</p>
      </Card>
    </div>
  );
}

function TurnFeedback({ turn, lang }: { turn: TutorTurn; lang: "uz" | "en" }) {
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  return (
    <div className="mt-3 grid gap-2 border-t border-line pt-2 text-xs text-ink">
      <div className="flex flex-wrap items-center gap-2"><SourceBadge source={turn.source} lang={lang} />{turn.fallbackReason && <Pill tone="berry">{L("AI mavjud emas", "AI unavailable")}</Pill>}</div>
      {turn.praise.length > 0 && <p>👍 {turn.praise.join(" ")}</p>}
      {turn.corrections.map((c, i) => (
        <p key={i} className="rounded-lg bg-canvas p-2">
          <span className="line-through">{c.original}</span> → <strong>{c.suggestion}</strong>
          <br />
          <span className="text-muted">{c.why_en}{lang === "uz" && ` — ${c.why_uz}`}</span>
        </p>
      ))}
      {turn.naturalVersion && <p><strong>{L("Tabiiyroq", "More natural")}:</strong> {turn.naturalVersion}</p>}
      {lang === "uz" && turn.hintUz && <p className="text-muted">{turn.hintUz}</p>}
    </div>
  );
}
