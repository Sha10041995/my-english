"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone recording for server-side transcription.
 * Privacy by design: the mic is opened only after an explicit button press (and prior consent), tracks are
 * always released on stop/unmount, audio is kept in memory only, and nothing is stored by the app.
 */

export type RecorderError = "unsupported" | "permission-denied" | "no-microphone" | "mic-busy" | "too-short" | "unknown";

export const RECORDER_MESSAGES: Record<RecorderError, { uz: string; en: string }> = {
  unsupported: { uz: "Brauzeringiz audio yozishni qo'llamaydi. Javobingizni yozing.", en: "Your browser can't record audio. Please type your answer." },
  "permission-denied": { uz: "Mikrofonga ruxsat berilmadi. Brauzer manzil satridagi qulf belgisidan ruxsat bering yoki yozib javob bering.", en: "Microphone permission was blocked. Allow it from the lock icon in the address bar, or type your answer." },
  "no-microphone": { uz: "Mikrofon topilmadi. Ulang yoki yozib javob bering.", en: "No microphone was found. Connect one or type your answer." },
  "mic-busy": { uz: "Mikrofon boshqa dastur tomonidan band. Uni yoping va qayta urinib ko'ring.", en: "The microphone is in use by another app. Close it and try again." },
  "too-short": { uz: "Yozuv juda qisqa. Tugmani bosib, gapirib, keyin to'xtating (bu sizning xatoingiz emas).", en: "The recording was too short. Press, speak, then stop." },
  unknown: { uz: "Yozishda xatolik yuz berdi. Yozib javob bering.", en: "Recording failed. Please type your answer." },
};

export const MAX_RECORD_SECONDS = 60;
export const MIN_RECORD_MS = 800;

export function recorderSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function mapGetUserMediaError(e: unknown): RecorderError {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "no-microphone";
  if (name === "NotReadableError" || name === "AbortError") return "mic-busy";
  return "unknown";
}

export type RecorderState = "idle" | "requesting" | "recording";

export function useRecorder(onRecorded: (blob: Blob) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cbRef = useRef(onRecorded);
  useEffect(() => {
    cbRef.current = onRecorded;
  });

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!recorderSupported()) return setError("unsupported");
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setState("idle");
      return setError(mapGetUserMediaError(e));
    }
    streamRef.current = stream;
    chunks.current = [];
    try {
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const ms = Date.now() - startedAt.current;
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        release();
        setState("idle");
        setSeconds(0);
        if (ms < MIN_RECORD_MS || blob.size === 0) setError("too-short");
        else cbRef.current(blob);
      };
      startedAt.current = Date.now();
      rec.start();
      setState("recording");
      setSeconds(0);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= MAX_RECORD_SECONDS) stop();
      }, 250);
    } catch {
      release();
      setState("idle");
      setError("unknown");
    }
  }, [release, stop]);

  useEffect(
    () => () => {
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.onstop = null;
        recRef.current.stop();
      }
      release();
    },
    [release],
  );

  return { state, error, seconds, start, stop, supported: typeof window !== "undefined" && recorderSupported() };
}

// ------------------------------------------------------------------ transcription client
export type TranscribeFailure = "unavailable" | "consent" | "too-large" | "bad-type" | "rate-limited" | "timeout" | "provider" | "network" | "too-short";

export const TRANSCRIBE_MESSAGES: Record<TranscribeFailure, { uz: string; en: string }> = {
  unavailable: { uz: "Server ovoz xizmati sozlanmagan yoki mavjud emas. Bu sizning xatoingiz emas — yozib javob bering.", en: "Server speech recognition isn't available. That's not your fault — please type your answer." },
  consent: { uz: "Ovoz yozish uchun rozilik kerak.", en: "Recording consent is required." },
  "too-large": { uz: "Yozuv juda uzun. Qisqaroq gapiring.", en: "The recording is too long. Try a shorter answer." },
  "bad-type": { uz: "Audio formati qo'llab-quvvatlanmaydi. Yozib javob bering.", en: "This audio format isn't supported. Please type your answer." },
  "rate-limited": { uz: "Juda ko'p so'rov. Birozdan so'ng urinib ko'ring.", en: "Too many requests. Please wait a moment." },
  timeout: { uz: "Ovoz xizmati javob bermadi. Yana urinib ko'ring yoki yozing.", en: "The speech service timed out. Try again or type." },
  provider: { uz: "Ovoz xizmatida xatolik. Yozib javob bering.", en: "The speech service had an error. Please type your answer." },
  network: { uz: "Tarmoq xatosi. Yozib javob bering.", en: "Network error. Please type your answer." },
  "too-short": { uz: "Yozuv juda qisqa.", en: "The recording was too short." },
};

export async function transcribeBlob(blob: Blob): Promise<{ ok: true; text: string } | { ok: false; reason: TranscribeFailure }> {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.set("audio", blob, `speech.${ext}`);
  try {
    const r = await fetch("/api/speech/transcribe", { method: "POST", body: form, headers: { "x-audio-consent": "granted" } });
    if (r.ok) {
      const d = (await r.json()) as { text?: string };
      return { ok: true, text: String(d.text ?? "").trim() };
    }
    const map: Record<number, TranscribeFailure> = { 400: "too-short", 403: "consent", 413: "too-large", 415: "bad-type", 429: "rate-limited", 502: "provider", 503: "unavailable", 504: "timeout" };
    return { ok: false, reason: map[r.status] ?? "provider" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
