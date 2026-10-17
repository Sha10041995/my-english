/**
 * Centralised UI strings. Content-level translations live next to the content (Localized objects).
 * Uzbek strings are drafts and should be reviewed by a native speaker before launch.
 */
export type Lang = "uz" | "en";

const dict = {
  "nav.dashboard": { uz: "Bosh sahifa", en: "Dashboard" },
  "nav.learn": { uz: "O'rganish", en: "Learn" },
  "nav.speaking": { uz: "AI suhbat", en: "AI Speaking" },
  "nav.reading": { uz: "O'qish", en: "Reading" },
  "nav.listening": { uz: "Tinglash", en: "Listening" },
  "nav.writing": { uz: "Yozish", en: "Writing" },
  "nav.vocabulary": { uz: "Lug'at", en: "Vocabulary" },
  "nav.exam": { uz: "CEFR imtihon", en: "CEFR Exam" },
  "nav.progress": { uz: "Natijalar", en: "Progress" },
  "nav.settings": { uz: "Profil va sozlamalar", en: "Profile & Settings" },
  "common.start": { uz: "Boshlash", en: "Start" },
  "common.continue": { uz: "Davom etish", en: "Continue" },
  "common.next": { uz: "Keyingi", en: "Next" },
  "common.back": { uz: "Orqaga", en: "Back" },
  "common.check": { uz: "Tekshirish", en: "Check" },
  "common.finish": { uz: "Yakunlash", en: "Finish" },
  "common.retry": { uz: "Qayta urinish", en: "Try again" },
  "common.minutes": { uz: "daqiqa", en: "min" },
  "common.loading": { uz: "Yuklanmoqda…", en: "Loading…" },
  "common.demo": { uz: "Demo (qoidaga asoslangan)", en: "Demo (rule-based)" },
  "common.ai": { uz: "AI tomonidan yaratilgan", en: "AI-generated" },
  "common.provisional": { uz: "Taxminiy natija", en: "Provisional result" },
  "common.why": { uz: "Nega bu mashq?", en: "Why this activity?" },
  "dash.hello": { uz: "Salom", en: "Hello" },
  "dash.today": { uz: "Bugungi reja", en: "Today's plan" },
  "dash.missions": { uz: "Kunlik missiyalar", en: "Daily missions" },
  "dash.mini": { uz: "Band kun rejimi (3–5 daqiqa)", en: "Busy-day mode (3–5 min)" },
  "dash.streak": { uz: "Seriya", en: "Streak" },
  "dash.days": { uz: "kun", en: "days" },
  "dash.due": { uz: "Takrorlash kerak", en: "Due for review" },
  "dash.noPlacement": { uz: "Darajangizni aniqlash uchun qisqa testdan o'ting.", en: "Take the short placement check to personalise your plan." },
  "dash.takePlacement": { uz: "Daraja aniqlash", en: "Take placement" },
  "dash.skills": { uz: "Ko'nikmalar (taxminiy)", en: "Skills (estimated)" },
  "dash.week": { uz: "Haftalik faollik", en: "This week" },
  "level.note": { uz: "Bu rasmiy CEFR natijasi emas — mashq qilgan sari aniqlashadi.", en: "This is not an official CEFR result — it becomes more accurate as you practise." },
  "level.noEvidence": { uz: "Dalil yetarli emas", en: "Not enough evidence" },
  "vocab.encountered": { uz: "Uchragan", en: "Encountered" },
  "vocab.recognized": { uz: "Tanildi", en: "Recognised" },
  "vocab.recalled_assisted": { uz: "Yordam bilan eslandi", en: "Recalled with help" },
  "vocab.used_independently": { uz: "Mustaqil ishlatildi", en: "Used independently" },
  "vocab.used_multi_context": { uz: "Turli kontekstda ishlatildi", en: "Used in several contexts" },
  "vocab.unseen": { uz: "Yangi", en: "New" },
  "vocab.needsReview": { uz: "Takrorlash kerak", en: "Needs review" },
} as const;

export type TKey = keyof typeof dict;

export function t(key: TKey, lang: Lang): string {
  return dict[key][lang];
}

export const INTERESTS = [
  { id: "daily life", uz: "Kundalik hayot", en: "Daily life" },
  { id: "travel", uz: "Sayohat", en: "Travel" },
  { id: "work", uz: "Ish va karyera", en: "Work & career" },
  { id: "education", uz: "Ta'lim", en: "Education" },
  { id: "science and technology", uz: "Fan va texnologiya", en: "Science & technology" },
  { id: "society", uz: "Jamiyat va madaniyat", en: "Society & culture" },
  { id: "money", uz: "Pul va xaridlar", en: "Money & shopping" },
  { id: "food", uz: "Ovqat", en: "Food" },
] as const;

export const GOALS = [
  { id: "conversation", uz: "Erkin suhbatlashish", en: "Speak confidently" },
  { id: "work", uz: "Ish uchun", en: "For work" },
  { id: "study", uz: "O'qish / chet elda ta'lim", en: "For study abroad" },
  { id: "exam", uz: "Imtihonga tayyorlanish", en: "Exam preparation" },
  { id: "travel", uz: "Sayohat", en: "Travel" },
  { id: "general", uz: "Umumiy ingliz tili", en: "General English" },
] as const;

export const EXAM_TARGETS = [
  { id: "none", uz: "Imtihon rejam yo'q", en: "No exam planned" },
  { id: "generic-b2", uz: "Umumiy CEFR B2 mashq formati", en: "Generic CEFR B2 practice format" },
  { id: "cambridge-b2", uz: "Cambridge B2 First", en: "Cambridge B2 First" },
  { id: "ielts", uz: "IELTS", en: "IELTS" },
  { id: "other", uz: "Boshqa", en: "Other" },
] as const;
