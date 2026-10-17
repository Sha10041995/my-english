import type { VocabItem } from "@/types/domain";
import { v } from "./vocab-builder";
import { MORE_VOCABULARY } from "./vocabulary-more";

/** Original learning content. Uzbek glosses are draft translations pending native-speaker review. */
const BASE_VOCABULARY: VocabItem[] = [
  v("hello", "hello", "A0", "interjection", "salom", "a greeting", "Hello, my name is Aziz.", ["hello", "hi"], ["say hello"]),
  v("name", "name", "A0", "noun", "ism", "what a person is called", "My name is Dilnoza.", ["name", "names"], ["first name", "last name"]),
  v("family", "family", "A1", "noun", "oila", "parents, children and relatives", "My family is big.", ["family", "families"], ["family member", "big family"]),
  v("water", "water", "A0", "noun", "suv", "a clear liquid we drink", "I drink water every day.", ["water"], ["glass of water", "drink water"]),
  v("breakfast", "breakfast", "A1", "noun", "nonushta", "the first meal of the day", "I have breakfast at seven.", ["breakfast", "breakfasts"], ["have breakfast", "eat breakfast"]),
  v("work", "work", "A1", "verb/noun", "ishlamoq; ish", "to do a job", "I work in a small office.", ["work", "works", "worked", "working"], ["go to work", "work hard"]),
  v("often", "often", "A1", "adverb", "tez-tez", "many times", "We often walk in the park.", ["often"], ["very often", "not often"]),
  v("like", "like", "A1", "verb", "yoqtirmoq", "to enjoy something", "I like tea with lemon.", ["like", "likes", "liked", "liking"], ["like doing", "would like"]),
  v("want", "want", "A1", "verb", "xohlamoq", "to wish to have or do", "I want to learn English.", ["want", "wants", "wanted"], ["want to"]),
  v("buy", "buy", "A1", "verb", "sotib olmoq", "to get something by paying", "She wants to buy a new bag.", ["buy", "buys", "bought", "buying"], ["buy a ticket", "buy online"]),
  v("expensive", "expensive", "A2", "adjective", "qimmat", "costing a lot of money", "This phone is too expensive.", ["expensive"], ["too expensive", "quite expensive"]),
  v("weekend", "weekend", "A1", "noun", "dam olish kunlari", "Saturday and Sunday", "On the weekend we visit my grandmother.", ["weekend", "weekends"], ["at the weekend", "last weekend"]),
  v("travel", "travel", "A2", "verb/noun", "sayohat qilmoq", "to go from one place to another", "I love to travel by train.", ["travel", "travels", "traveled", "travelled", "traveling", "travelling"], ["travel abroad", "travel by train"]),
  v("ticket", "ticket", "A2", "noun", "chipta", "a paper or code that lets you travel or enter", "I need a ticket to Samarkand.", ["ticket", "tickets"], ["buy a ticket", "train ticket"]),
  v("invite", "invite", "A2", "verb", "taklif qilmoq, chaqirmoq", "to ask someone to come to an event", "They invited me to dinner.", ["invite", "invites", "invited", "inviting", "invitation"], ["invite someone to"]),
  v("prefer", "prefer", "A2", "verb", "afzal ko'rmoq", "to like one thing more than another", "I prefer tea to coffee.", ["prefer", "prefers", "preferred"], ["prefer A to B"]),
  v("usually", "usually", "A2", "adverb", "odatda", "most of the time", "I usually wake up at six.", ["usually"], ["usually go"]),
  v("remember", "remember", "A2", "verb", "eslamoq", "to keep in your mind", "I remember my first day at school.", ["remember", "remembers", "remembered"], ["remember to do", "remember doing"]),
  v("practise", "practise", "A2", "verb", "mashq qilmoq", "to do something again to improve", "I practise English every evening.", ["practise", "practice", "practises", "practised", "practising", "practicing"], ["practise speaking", "practice makes perfect"]),
  v("healthy", "healthy", "A2", "adjective", "sog'lom", "good for your body", "Fruit is a healthy snack.", ["healthy"], ["healthy food", "stay healthy"]),
  v("afford", "afford", "B1", "verb", "(pulga) qurbi yetmoq", "to have enough money for something", "I can't afford to buy a new laptop.", ["afford", "affords", "afforded", "affordable"], ["can't afford to", "afford a car"], "can't afford"),
  v("give-it-a-try", "give it a try", "B1", "phrase", "bir sinab ko'rmoq", "to attempt something", "I was nervous, but I decided to give it a try.", ["give it a try", "gave it a try", "giving it a try", "give it a go"], ["decide to give it a try"], "give it a try"),
  v("get-used-to", "get used to", "B1", "phrase", "ko'nikmoq", "to become familiar with something", "I'm getting used to waking up early.", ["get used to", "gets used to", "got used to", "getting used to"], ["get used to + -ing"], "get used to"),
  v("figure-out", "figure out", "B1", "phrasal verb", "tushunib olmoq, yechim topmoq", "to understand or solve", "We need to figure out a better plan.", ["figure out", "figures out", "figured out", "figuring out"], ["figure out how", "figure out why"], "figure out"),
  v("make-progress", "make progress", "B1", "phrase", "oldinga siljimoq, yutuq qilmoq", "to improve over time", "You make progress when you practise regularly.", ["make progress", "makes progress", "made progress", "making progress"], ["make good progress"], "make progress"),
  v("reliable", "reliable", "B1", "adjective", "ishonchli", "able to be trusted", "She is a reliable colleague.", ["reliable", "reliably", "reliability"], ["reliable source", "reliable friend"]),
  v("improve", "improve", "B1", "verb", "yaxshilamoq", "to become or make better", "I want to improve my pronunciation.", ["improve", "improves", "improved", "improving", "improvement"], ["improve your skills"]),
  v("opportunity", "opportunity", "B1", "noun", "imkoniyat", "a chance to do something good", "Studying abroad is a great opportunity.", ["opportunity", "opportunities"], ["a great opportunity", "take the opportunity"]),
  v("on-the-other-hand", "on the other hand", "B1", "linker", "boshqa tomondan", "used to introduce a contrast", "It is cheap. On the other hand, it takes more time.", ["on the other hand"], ["On the one hand ... on the other hand"], "on the other hand"),
  v("in-the-long-run", "in the long run", "B2", "phrase", "uzoq muddatda", "over a long period of time", "Small habits help in the long run.", ["in the long run"], ["pay off in the long run"], "in the long run"),
  v("depend-on", "depend on", "B1", "phrasal verb", "...ga bog'liq bo'lmoq", "to be decided by something", "It depends on the weather.", ["depend on", "depends on", "depended on", "depending on"], ["it depends on"], "depend on"),
  v("manage-to", "manage to", "B1", "phrase", "uddalamoq, eplamoq", "to succeed in doing something difficult", "She managed to finish the report on time.", ["manage to", "manages to", "managed to"], ["manage to do"], "manage to"),
  v("take-advantage-of", "take advantage of", "B2", "phrase", "foydalanmoq (imkoniyatdan)", "to use a situation well", "You should take advantage of free courses.", ["take advantage of", "takes advantage of", "took advantage of", "taking advantage of"], ["take full advantage of"], "take advantage of"),
  v("rely-on", "rely on", "B2", "phrasal verb", "tayanmoq, ishonmoq", "to depend on someone or something", "Many people rely on public transport.", ["rely on", "relies on", "relied on", "relying on"], ["rely heavily on"], "rely on"),
  v("raise-awareness", "raise awareness", "B2", "phrase", "xabardorlikni oshirmoq", "to help people notice an issue", "The campaign aims to raise awareness of recycling.", ["raise awareness", "raises awareness", "raised awareness", "raising awareness"], ["raise awareness of/about"], "raise awareness"),
  v("significant", "significant", "B2", "adjective", "sezilarli, muhim", "large or important enough to notice", "There was a significant increase in prices.", ["significant", "significantly"], ["significant change", "significantly higher"]),
  v("tend-to", "tend to", "B2", "phrase", "moyil bo'lmoq, odatda...", "to usually do something", "Young people tend to prefer online shopping.", ["tend to", "tends to", "tended to", "tending to"], ["tend to be"], "tend to"),
  v("whereas", "whereas", "B2", "linker", "holbuki, esa", "used to compare two different facts", "Some people like cities, whereas others prefer villages.", ["whereas"], ["whereas others"]),
  v("considerable", "considerable", "B2", "adjective", "ancha katta, sezilarli", "fairly large in amount", "She spent a considerable amount of time on it.", ["considerable", "considerably"], ["considerable effort"]),
  v("as-a-result", "as a result", "B1", "linker", "natijada", "because of what was just mentioned", "It rained all day. As a result, we stayed home.", ["as a result"], ["as a result of"], "as a result"),
];

export const VOCABULARY: VocabItem[] = [...BASE_VOCABULARY, ...MORE_VOCABULARY];

export const VOCAB_BY_ID: Record<string, VocabItem> = Object.fromEntries(VOCABULARY.map((x) => [x.id, x]));

/** Find tracked items whose forms occur in `text` (whole-word / whole-phrase, case-insensitive). */
export function detectVocabulary(text: string, items: VocabItem[] = VOCABULARY): VocabItem[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z'\s-]/g, " ").replace(/\s+/g, " ")} `;
  const found: VocabItem[] = [];
  for (const item of items) {
    for (const form of item.forms) {
      if (lower.includes(` ${form.toLowerCase()} `)) {
        found.push(item);
        break;
      }
    }
  }
  return found;
}
