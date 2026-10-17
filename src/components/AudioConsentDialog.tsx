"use client";

import { useEffect, useRef } from "react";
import type { Lang } from "@/lib/i18n";
import { Button } from "./ui";

/** Modal consent for microphone recording. Uses the native <dialog> element (focus trap, Esc to close). */
export function AudioConsentDialog({ open, lang, onAllow, onDeny }: { open: boolean; lang: Lang; onAllow: () => void; onDeny: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onDeny(); }} aria-labelledby="consent-title" className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/50">
      <h2 id="consent-title" className="text-xl font-extrabold">{L("Ovoz yozishga rozilik", "Allow voice recording?")}</h2>
      <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm leading-relaxed">
        <li>{L("Mikrofon faqat siz “Yozish” tugmasini bosganda yoqiladi va to'xtatganingizda yoki 60 soniyadan keyin o'chadi.", "The microphone turns on only when you press “Record”, and off when you stop or after 60 seconds.")}</li>
        <li>{L("Audio serverimizga va u orqali matnga aylantirish xizmatiga (sozlangan provayder) yuboriladi. Ilova audioni saqlamaydi — faqat matn qoladi.", "The audio is sent to our server and on to the configured speech-to-text provider. The app does not store the audio — only the text transcript is kept.")}</li>
        <li>{L("Talaffuz baholanmaydi: tizim faqat nima deganingizni matnga aylantiradi.", "Pronunciation is not scored: the system only turns what you said into text.")}</li>
        <li>{L("Matnni yuborishdan oldin tahrirlashingiz mumkin. Xohlasangiz, doim yozib javob berishingiz mumkin.", "You can edit the transcript before sending, and you can always type instead.")}</li>
        <li>{L("Rozilikni istalgan vaqtda Sozlamalarda qaytarib olishingiz mumkin.", "You can withdraw consent at any time in Settings.")}</li>
      </ul>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onDeny}>{L("Hozir emas", "Not now")}</Button>
        <Button onClick={onAllow}>{L("Yozishga ruxsat berish", "Allow recording")}</Button>
      </div>
    </dialog>
  );
}
