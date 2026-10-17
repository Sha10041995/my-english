"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Browser Web Speech API wrappers. Everything degrades to text input; nothing here fabricates scores. */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export type SttError = "unsupported" | "permission-denied" | "no-speech" | "service-unavailable" | "audio-capture" | "unknown";

const ERROR_MAP: Record<string, SttError> = {
  "not-allowed": "permission-denied",
  "service-not-allowed": "permission-denied",
  "no-speech": "no-speech",
  network: "service-unavailable",
  "audio-capture": "audio-capture",
};

export const STT_MESSAGES: Record<SttError, { uz: string; en: string }> = {
  unsupported: { uz: "Brauzeringiz ovoz tanishni qo'llamaydi. Javobingizni yozing.", en: "Your browser doesn't support speech recognition. Please type your answer." },
  "permission-denied": { uz: "Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering yoki yozib javob bering.", en: "Microphone permission was denied. Allow it in your browser settings, or type your answer." },
  "no-speech": { uz: "Ovoz eshitilmadi. Yana urinib ko'ring (bu sizning xatoingiz emas).", en: "No speech was heard. Please try again." },
  "service-unavailable": { uz: "Ovoz tanish xizmati hozir mavjud emas (tarmoq). Yozib javob bering.", en: "The speech service is unavailable right now (network). Please type your answer." },
  "audio-capture": { uz: "Mikrofon topilmadi.", en: "No microphone was found." },
  unknown: { uz: "Ovoz tanishda xatolik. Yozib javob bering.", en: "Speech recognition failed. Please type your answer." },
};

/** Dictation hook: returns transcript text only. No pronunciation analysis is performed. */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SttError | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => setError(ERROR_MAP[e.error] ?? "unknown");
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("unknown");
    }
  }, [onText]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);
  return { listening, error, start, stop, supported: typeof window !== "undefined" && sttSupported() };
}

/** Speak lines in sequence with browser TTS. Voices are synthetic – the UI must say so. */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const cancelled = useRef(false);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (ttsSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (lines: { text: string; voice?: "female" | "male"; rate?: number }[]) => {
      if (!ttsSupported()) return false;
      cancelled.current = false;
      window.speechSynthesis.cancel();
      setSpeaking(true);
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      const pick = (g?: "female" | "male") => {
        const hints = g === "male" ? /(male|david|daniel|alex|george|mark|guy)/i : /(female|zira|samantha|susan|karen|aria|jenny)/i;
        return voices.find((v) => hints.test(v.name)) ?? voices[0];
      };
      for (const line of lines) {
        if (cancelled.current) break;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(line.text);
          u.lang = "en-US";
          u.rate = line.rate ?? 0.95;
          const v = pick(line.voice);
          if (v) u.voice = v;
          u.pitch = line.voice === "male" ? 0.85 : 1.1;
          // Safety net: some browsers never fire onend (no voices installed, headless mode).
          const guard = setTimeout(resolve, line.text.split(/\s+/).length * 700 + 2500);
          const done = () => {
            clearTimeout(guard);
            resolve();
          };
          u.onend = done;
          u.onerror = done;
          window.speechSynthesis.speak(u);
        });
      }
      setSpeaking(false);
      return true;
    },
    [],
  );

  useEffect(() => () => {
    if (ttsSupported()) window.speechSynthesis.cancel();
  }, []);
  return { speaking, speak, cancel, supported: typeof window !== "undefined" && ttsSupported() };
}
