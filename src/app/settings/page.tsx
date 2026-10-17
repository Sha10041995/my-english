"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, Notice, PageHeader, Pill } from "@/components/ui";
import { EXAM_TARGETS, GOALS, INTERESTS, t } from "@/lib/i18n";
import type { LearnerState } from "@/lib/learning-engine/state";
import { getBrowserSupabase } from "@/lib/supabase-client";

type Profile = LearnerState["profile"];
interface Status {
  llm: string;
  speechServer: boolean;
  accounts: boolean;
}

export default function SettingsPage() {
  const { state, lang, update, importState, resetAll, toast } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  const setProfile = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile, ...patch }, missions: patch.minutesPerDay ? { ...s.missions, day: null } : s.missions }));
  const p = state.profile;
  const field = "mt-1 w-full rounded-xl border-2 border-line bg-surface p-2.5 focus:border-brand";

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linguaquest-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_500_000) return toast(L("Fayl juda katta", "File too large"));
    try {
      const ok = importState(JSON.parse(await file.text()));
      toast(ok ? L("Ma'lumotlar import qilindi", "Data imported") : L("Fayl formati noto'g'ri", "Invalid file format"));
    } catch {
      toast(L("Fayl o'qilmadi", "Could not read file"));
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={L("Profil", "Profile")} title={t("nav.settings", lang)} />

      <Card className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">{L("Ism", "Name")}<input className={field} value={p.displayName} maxLength={60} onChange={(e) => setProfile({ displayName: e.target.value })} /></label>
        <label className="text-sm font-semibold">{L("Tushuntirish tili", "Explanation language")}
          <select className={field} value={p.explanationLanguage} onChange={(e) => setProfile({ explanationLanguage: e.target.value as "uz" | "en" })}>
            <option value="uz">O‘zbekcha</option><option value="en">English</option>
          </select>
        </label>
        <label className="text-sm font-semibold">{L("Maqsad", "Goal")}
          <select className={field} value={p.goal} onChange={(e) => setProfile({ goal: e.target.value as Profile["goal"] })}>
            {GOALS.map((g) => <option key={g.id} value={g.id}>{g[lang]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L("Kunlik vaqt", "Daily time")}
          <select className={field} value={p.minutesPerDay} onChange={(e) => setProfile({ minutesPerDay: Number(e.target.value) })}>
            {[5, 10, 20, 30, 45].map((m) => <option key={m} value={m}>{m} {t("common.minutes", lang)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L("Imtihon maqsadi", "Exam target")}
          <select className={field} value={p.examTarget} onChange={(e) => setProfile({ examTarget: e.target.value as Profile["examTarget"] })}>
            {EXAM_TARGETS.map((x) => <option key={x.id} value={x.id}>{x[lang]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L("Tuzatish intensivligi", "Correction intensity")}
          <select className={field} value={p.correctionIntensity} onChange={(e) => setProfile({ correctionIntensity: e.target.value as Profile["correctionIntensity"] })}>
            <option value="gentle">{L("Yumshoq", "Gentle")}</option><option value="balanced">{L("Muvozanatli", "Balanced")}</option><option value="detailed">{L("Batafsil", "Detailed")}</option>
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold">{L("Qiziqishlar", "Interests")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = p.interests.includes(i.id);
              return <button key={i.id} type="button" aria-pressed={on} onClick={() => setProfile({ interests: on ? p.interests.filter((x) => x !== i.id) : [...p.interests, i.id] })} className={`min-h-11 rounded-full border-2 px-4 text-sm font-medium ${on ? "border-brand bg-brand-soft" : "border-line"}`}>{i[lang]}</button>;
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="grid gap-2">
        <h2 className="text-lg font-bold">{L("AI va ovoz holati", "AI & speech status")}</h2>
        {status === null ? <p className="text-sm text-muted">…</p> : (
          <ul className="grid gap-1 text-sm">
            <li>LLM: {status.llm === "demo" ? <Pill tone="sun">{L("Demo rejim: qoidaga asoslangan, haqiqiy AI emas", "Demo mode: rule-based, not real AI")}</Pill> : <Pill tone="brand">{status.llm}</Pill>}</li>
            <li>{L("Server ovoz xizmati", "Server speech")}: {status.speechServer ? <Pill tone="brand">on</Pill> : <Pill tone="neutral">{L("o'chiq — brauzer diktovkasi/ovozi ishlatiladi", "off — browser dictation/voices are used")}</Pill>}</li>
            <li>{L("Hisoblar va sinxronlash", "Accounts & sync")}: {status.accounts ? <Pill tone="brand">on</Pill> : <Pill tone="neutral">{L("o'chiq — ma'lumotlar faqat shu brauzerda", "off — data stays in this browser")}</Pill>}</li>
          </ul>
        )}
        <p className="text-xs text-muted">{L("AI sozlangan bo'lsa, yozma javoblaringiz tahlil uchun server va AI provayderga yuboriladi. AI fikr-mulohazasi “AI tomonidan yaratilgan” deb belgilanadi va xato bo'lishi mumkin.", "If AI is configured, your written answers are sent to the server and the AI provider for analysis. AI feedback is labelled “AI-generated” and can be wrong.")}</p>
      </Card>

      <Card className="grid gap-2">
        <h2 className="text-lg font-bold">{L("Ovoz yozish roziligi", "Voice recording consent")}</h2>
        <p className="text-sm">
          {L("Holat", "Status")}:{" "}
          <Pill tone={p.audioConsent === "granted" ? "leaf" : "neutral"}>
            {p.audioConsent === "granted" ? L("Rozilik berilgan", "Granted") : p.audioConsent === "denied" ? L("Rad etilgan", "Declined") : L("Hali so'ralmagan", "Not asked yet")}
          </Pill>
        </p>
        <p className="text-xs text-muted">{L("Rozilik berilganda mikrofon faqat “Yozib olish” tugmasi bosilganda ishlaydi. Audio saqlanmaydi; talaffuz baholanmaydi.", "When granted, the microphone only runs while you use the Record button. Audio is not stored and pronunciation is not scored.")}</p>
        <div className="flex flex-wrap gap-2">
          {p.audioConsent === "granted" ? (
            <Button variant="secondary" onClick={() => { setProfile({ audioConsent: "denied" }); toast(L("Rozilik qaytarib olindi", "Consent withdrawn")); }}>{L("Rozilikni qaytarib olish", "Withdraw consent")}</Button>
          ) : (
            <Button variant="secondary" onClick={() => { setProfile({ audioConsent: "unknown" }); toast(L("Keyingi safar yozishda yana so'raladi", "You'll be asked again next time you record")); }} disabled={p.audioConsent === "unknown"}>{L("Qayta so'rashga ruxsat berish", "Allow asking again")}</Button>
          )}
        </div>
      </Card>

      {status?.accounts && <CloudSync lang={lang} />}

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{L("Ma'lumotlaringiz", "Your data")}</h2>
        <p className="text-sm text-muted">{L("Progress shu brauzerda saqlanadi (localStorage). Suhbat tarixi ham shu yerda.", "Progress is stored in this browser (localStorage), including conversation history.")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportData}>{L("Eksport (JSON)", "Export (JSON)")}</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>{L("Import", "Import")}</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="Import file" onChange={(e) => void onImport(e.target.files?.[0])} />
          {!confirmDelete ? (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>{L("Barcha ma'lumotni o'chirish", "Delete all my data")}</Button>
          ) : (
            <>
              <Notice tone="error">{L("Bu qaytarib bo'lmaydi. Avval eksport qilishni tavsiya etamiz.", "This cannot be undone. Consider exporting first.")}</Notice>
              <Button onClick={() => { resetAll(); setConfirmDelete(false); toast(L("Ma'lumotlar o'chirildi", "Data deleted")); }}>{L("Ha, o'chirish", "Yes, delete")}</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{L("Bekor qilish", "Cancel")}</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function CloudSync({ lang }: { lang: "uz" | "en" }) {
  const { state, importState, toast } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const sb = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  async function call(method: "GET" | "PUT" | "DELETE") {
    setBusy(true);
    try {
      const r = await fetch("/api/sync", { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: method === "PUT" ? JSON.stringify({ state }) : undefined });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as { state?: unknown };
    } finally {
      setBusy(false);
    }
  }

  if (!sb) return null;
  return (
    <Card className="grid gap-3">
      <h2 className="text-lg font-bold">{L("Hisob va bulutga saqlash", "Account & cloud backup")}</h2>
      {!token ? (
        <div className="grid gap-2 sm:max-w-md">
          <label className="text-sm font-semibold">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-surface p-2.5" autoComplete="email" /></label>
          <Button disabled={!email.includes("@") || busy} onClick={async () => { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } }); if (error) toast(error.message); else setSent(true); }}>{L("Kirish havolasini yuborish", "Send sign-in link")}</Button>
          {sent && <Notice tone="ok">{L("Emailingizni tekshiring.", "Check your email for the sign-in link.")}</Notice>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={async () => { try { await call("PUT"); toast(L("Bulutga saqlandi", "Saved to cloud")); } catch { toast(L("Saqlab bo'lmadi", "Save failed")); } }}>{L("Bulutga saqlash", "Save to cloud")}</Button>
          <Button variant="secondary" disabled={busy} onClick={async () => { try { const d = await call("GET"); if (d.state && importState(d.state)) toast(L("Buluttan yuklandi", "Loaded from cloud")); else toast(L("Bulutda ma'lumot yo'q", "Nothing saved in cloud")); } catch { toast(L("Yuklab bo'lmadi", "Load failed")); } }}>{L("Buluttan yuklash (bu qurilmadagini almashtiradi)", "Load from cloud (replaces this device)")}</Button>
          <Button variant="ghost" disabled={busy} onClick={async () => { try { await call("DELETE"); toast(L("Bulut ma'lumotlari o'chirildi", "Cloud data deleted")); } catch { toast(L("O'chirib bo'lmadi", "Delete failed")); } }}>{L("Bulut ma'lumotini o'chirish", "Delete cloud data")}</Button>
          <Button variant="ghost" onClick={() => void sb.auth.signOut()}>{L("Chiqish", "Sign out")}</Button>
        </div>
      )}
    </Card>
  );
}
