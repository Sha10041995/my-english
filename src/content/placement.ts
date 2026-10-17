import type { Choice, Level, Localized, PlacementItem, Skill } from "@/types/domain";
import { MORE_PLACEMENT } from "./placement-more";

const c = (...texts: string[]): Choice[] => texts.map((text, i) => ({ id: "abcd"[i], text }));
const ex = (en: string, uz: string): Localized => ({ en, uz });

const p = (
  id: string,
  skill: Skill,
  level: Level,
  topic: string,
  stem: string,
  choices: Choice[],
  answer: string,
  explanation: Localized,
  extra: Partial<PlacementItem> = {},
): PlacementItem => ({ id, skill, level, topic, stem, choices, answer, explanation, ...extra });

/**
 * Placement item bank (original items). Metadata: skill, estimated CEFR level, topic, explanation.
 * Levels are the authors' estimates, not statistically calibrated values.
 */
const BASE_PLACEMENT: PlacementItem[] = [
  // ---- vocabulary recognition ----
  p("pv-a0-1", "vocabulary", "A0", "basics", "What does \"water\" mean?", c("suv", "non", "uy", "kitob"), "a", ex("\"Water\" is the clear liquid we drink: suv.", "\"Water\" — ichimlik suvi."), { vocab: ["water"] }),
  p("pv-a0-2", "vocabulary", "A0", "basics", "Choose the word for \"oila\".", c("work", "family", "weekend", "ticket"), "b", ex("\"Family\" = oila.", "\"Family\" — oila."), { vocab: ["family"] }),
  p("pv-a1-1", "vocabulary", "A1", "daily life", "\"I have breakfast at seven.\" What is breakfast?", c("the first meal of the day", "a kind of job", "a day of the week", "a place to sleep"), "a", ex("Breakfast is the first meal of the day.", "Breakfast — kunning birinchi ovqati (nonushta)."), { vocab: ["breakfast"] }),
  p("pv-a2-1", "vocabulary", "A2", "shopping", "This phone is too ___. I only have a little money.", c("expensive", "healthy", "usually", "weekend"), "a", ex("\"Expensive\" means costing a lot of money.", "\"Expensive\" — qimmat."), { vocab: ["expensive"] }),
  p("pv-a2-2", "vocabulary", "A2", "preferences", "I ___ tea to coffee. Tea is my favourite.", c("prefer", "remember", "invite", "travel"), "a", ex("We say \"prefer A to B\".", "\"Prefer A to B\" — A ni B dan afzal ko'rmoq."), { vocab: ["prefer"] }),
  p("pv-b1-1", "vocabulary", "B1", "money", "I can't ___ a new laptop right now. It costs too much.", c("afford", "improve", "depend", "figure"), "a", ex("\"Afford\" = have enough money for something.", "\"Afford\" — pulga qurbi yetmoq."), { vocab: ["afford"] }),
  p("pv-b1-2", "vocabulary", "B1", "learning", "A ___ friend is someone you can trust.", c("reliable", "expensive", "considerable", "healthy"), "a", ex("\"Reliable\" means you can trust it or them.", "\"Reliable\" — ishonchli."), { vocab: ["reliable"] }),
  p("pv-b2-1", "vocabulary", "B2", "society", "The campaign aims to ___ awareness of plastic waste.", c("raise", "rise", "arise", "lift up"), "a", ex("The collocation is \"raise awareness\".", "To'g'ri birikma: \"raise awareness\"."), { vocab: ["raise-awareness"] }),
  p("pv-b2-2", "vocabulary", "B2", "work", "Prices have changed ___ since last year; they are much higher now.", c("significantly", "significance", "signify", "signal"), "a", ex("An adverb is needed to modify \"changed\": significantly.", "\"Changed\" fe'lini aniqlash uchun ravish kerak: significantly."), { vocab: ["significant"] }),

  // ---- grammar in context ----
  p("pg-a0-1", "grammar", "A0", "introductions", "My name ___ Aziz.", c("is", "are", "am", "be"), "a", ex("With a singular noun we use \"is\".", "Birlik ot bilan \"is\" ishlatiladi."), {}),
  p("pg-a1-1", "grammar", "A1", "daily life", "She ___ to school every day.", c("go", "goes", "going", "is go"), "b", ex("Third person singular in the present simple takes -s/-es.", "Present Simple'da 3-shaxs birlikda fe'lga -s/-es qo'shiladi."), {}),
  p("pg-a1-2", "grammar", "A1", "daily life", "___ you like coffee?", c("Do", "Does", "Are", "Is"), "a", ex("Questions with \"you\" in the present simple use \"Do\".", "\"You\" bilan savol \"Do\" bilan tuziladi."), {}),
  p("pg-a2-1", "grammar", "A2", "past", "Yesterday we ___ to the market.", c("go", "goes", "went", "gone"), "c", ex("\"Go\" is irregular: go → went.", "\"Go\" — noto'g'ri fe'l: go → went."), {}),
  p("pg-a2-2", "grammar", "A2", "comparison", "This bag is ___ than that one.", c("more cheap", "cheaper", "cheapest", "most cheap"), "b", ex("Short adjectives take -er in the comparative.", "Qisqa sifatlarda qiyosiy daraja -er bilan yasaladi."), {}),
  p("pg-b1-1", "grammar", "B1", "experience", "I have lived here ___ 2022.", c("for", "since", "during", "from"), "b", ex("\"Since\" + a point in time with the present perfect.", "\"Since\" + vaqt nuqtasi, Present Perfect bilan."), {}),
  p("pg-b1-2", "grammar", "B1", "plans", "If it rains tomorrow, we ___ at home.", c("stay", "will stay", "would stay", "stayed"), "b", ex("First conditional: if + present, will + verb.", "Birinchi shart gap: if + present, will + fe'l."), {}),
  p("pg-b2-1", "grammar", "B2", "hypothetical", "If I had more time, I ___ another language.", c("learn", "will learn", "would learn", "learned"), "c", ex("Second conditional: if + past, would + verb.", "Ikkinchi shart gap: if + past, would + fe'l."), {}),
  p("pg-b2-2", "grammar", "B2", "past regret", "I wish I ___ harder for the exam last year.", c("studied", "had studied", "would study", "have studied"), "b", ex("Regret about the past: wish + past perfect.", "O'tmishdagi afsus: wish + past perfect."), {}),

  // ---- reading comprehension ----
  p("pr-a0-1", "reading", "A0", "introductions", "Who is Anna from?", c("Poland", "Spain", "Italy", "Peru"), "a", ex("The text says Anna is from Poland.", "Matnda Anna Polshadan ekani aytilgan."), { passage: "Hello! I am Anna. I am from Poland. I am a student." }),
  p("pr-a1-1", "reading", "A1", "daily life", "When does Tom start work?", c("At 7:00", "At 8:30", "At 6:00", "At 9:30"), "b", ex("\"He starts work at half past eight.\"", "\"He starts work at half past eight\" — 8:30."), { passage: "Tom gets up at seven o'clock. He has toast and tea. He takes the bus to the office. He starts work at half past eight." }),
  p("pr-a2-1", "reading", "A2", "travel", "Why did Mia change her plan?", c("The weather was bad.", "She lost her ticket.", "She was ill.", "Her friend called."), "a", ex("\"Because of the heavy rain\" tells us the weather was the reason.", "\"Because of the heavy rain\" — sabab ob-havo."), { passage: "Mia wanted to visit the old city on Saturday. But because of the heavy rain, she went to a museum instead. She said it was a better idea than getting wet all day." }),
  p("pr-b1-1", "reading", "B1", "work", "What is the writer's main point?", c("Remote work suits some people better than others.", "Offices will disappear.", "Everyone hates working from home.", "Remote work is cheaper for all."), "a", ex("The text compares two kinds of workers; the main idea is that it depends on the person.", "Matn ikki xil ishchini solishtiradi: asosiy fikr — bu insonga bog'liq."), { passage: "Working from home saves time on the road, and many people enjoy the quiet. However, others miss talking to colleagues and find it hard to switch off after work. It seems that remote work is not good or bad in itself; it depends on the person and the job." }),
  p("pr-b2-1", "reading", "B2", "society", "What can we infer about the city's new policy?", c("It worked despite early doubts.", "It was never introduced.", "Nobody criticised it.", "It failed completely."), "a", ex("\"Initially criticised ... eventually proved effective\" implies early doubts, later success.", "\"Initially criticised ... eventually proved effective\" — avval shubha, keyin muvaffaqiyat."), { passage: "Although the congestion charge was initially criticised by shop owners, traffic fell by a fifth within a year, and several of the same owners later reported that customers found the centre more pleasant." }),
  p("pr-b2-2", "reading", "B2", "technology", "The word \"rely\" in the text is closest in meaning to...", c("depend", "refuse", "borrow", "predict"), "a", ex("\"Rely on\" means depend on.", "\"Rely on\" — tayanmoq, bog'liq bo'lmoq."), { passage: "Many small farms now rely on weather apps to decide when to plant, which has reduced waste, though some farmers worry about trusting the forecasts too much." }),

  // ---- listening comprehension (audioText is spoken with browser TTS; text fallback offered) ----
  p("pl-a0-1", "listening", "A0", "basics", "What is the speaker's name?", c("Ben", "Tom", "Sam", "Dan"), "a", ex("The speaker says: \"My name is Ben.\"", "Spiker: \"My name is Ben.\""), { audioText: "Hello. My name is Ben." }),
  p("pl-a1-1", "listening", "A1", "shopping", "How much is the bag?", c("$12", "$20", "$15", "$50"), "b", ex("The seller says twenty dollars.", "Sotuvchi 20 dollar dedi."), { audioText: "How much is this bag? It is twenty dollars. OK, I will take it." }),
  p("pl-a2-1", "listening", "A2", "plans", "When will they meet?", c("On Friday evening", "On Saturday morning", "On Sunday", "On Thursday"), "a", ex("\"Friday evening\" is the agreed time.", "Kelishilgan vaqt — juma kechqurun."), { audioText: "Are you free on Saturday? No, I have a class. What about Friday evening? Yes, that works. Let's meet at seven." }),
  p("pl-b1-1", "listening", "B1", "travel", "Why is the speaker annoyed?", c("The train was delayed.", "The hotel was full.", "The food was cold.", "The ticket was expensive."), "a", ex("She says the train was forty minutes late.", "U poyezd 40 daqiqa kechikkanini aytadi."), { audioText: "I'm really annoyed. I got to the station early, but the train was forty minutes late, and nobody told us why. I almost missed my meeting." }),
  p("pl-b2-1", "listening", "B2", "work", "What does the speaker suggest?", c("Trying the plan on a small scale first", "Cancelling the project", "Hiring more staff immediately", "Ignoring customer feedback"), "a", ex("\"Pilot it with one team\" = test small before expanding.", "\"Pilot it with one team\" — avval kichik miqyosda sinash."), { audioText: "I understand the enthusiasm, but before we commit the whole budget, I'd suggest we pilot it with one team for a month. If the results are convincing, we can expand with much less risk." }),
];

export const PLACEMENT_BANK: PlacementItem[] = [...BASE_PLACEMENT, ...MORE_PLACEMENT];

export const WRITING_PLACEMENT_PROMPT = {
  uz: "Qisqa yozing: o'zingiz haqingizda va nega ingliz tilini o'rganayotganingiz haqida (2–5 gap).",
  en: "Write 2–5 sentences about yourself and why you are learning English.",
};

export const SPEAKING_PLACEMENT_PROMPT = {
  uz: "Ovoz bilan yoki yozib javob bering: Kundalik tartibingiz qanday?",
  en: "Answer by voice or text: What is your usual day like?",
};
