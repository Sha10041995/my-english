"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ResultPanel } from "@/components/ResultPanel";
import { Bar, Button, Card, EmptyState, Notice, PageHeader, Pill } from "@/components/ui";
import { VOCAB_BY_ID, VOCABULARY } from "@/content/vocabulary";
import type { ApplyResult } from "@/lib/learning-engine/apply";
import { t } from "@/lib/i18n";
import { estimateVocabulary, needsReview, stageOf, type VocabStage } from "@/lib/vocabulary/srs";
import { buildReviewQueue, distractors, matchesItem, newWordBudget, pickNewWords, seededShuffle, type ReviewCard } from "@/lib/vocabulary/selection";
import type { VocabItem } from "@/types/domain";

const STAGE_TONE: Record<VocabStage, "neutral" | "sun" | "brand" | "leaf"> = {
  unseen: "neutral",
  encountered: "neutral",
  recognized: "sun",
  recalled_assisted: "brand",
  used_independently: "leaf",
  used_multi_context: "leaf",
};

export default function VocabularyView() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { state, lang, now, update } = useApp();
  const params = useSearchParams();
  const [reviewing, setReviewing] = useState(params.get("review") === "1");
  const [filter, setFilter] = useState<"all" | VocabStage | "review">("all");
  const [open, setOpen] = useState<string | null>(null);
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);

  const entries = Object.values(state.vocab);
  const est = estimateVocabulary(entries);
  const budget = newWordBudget(state);
  const queue = useMemo(() => buildReviewQueue(state, now, 8), [state, now]);

  function learnNew() {
    const items = pickNewWords(state, Math.max(1, budget));
    update((s) => {
      const vocab = { ...s.vocab };
      const t0 = new Date();
      for (const it of items) {
        const base = vocab[it.id];
        vocab[it.id] = base ?? {
          itemId: it.id, recognition: "encountered", productive: "none", exposureCount: 1, successCount: 0, failureCount: 0, independentUses: 0,
          contexts: [], encounterContexts: ["vocab-intro"], intervalDays: 0, ease: 2.3, lapses: 0, firstSeenAt: t0.toISOString(),
          lastSeenAt: t0.toISOString(), lastSuccessAt: null, nextReviewAt: new Date(t0.getTime() + 43_200_000).toISOString(),
        };
      }
      return { ...s, vocab };
    });
  }

  if (reviewing) return <ReviewSession onExit={() => setReviewing(false)} />;

  const shown = entries
    .filter((v) => (filter === "all" ? true : filter === "review" ? needsReview(v, now) : stageOf(v) === filter))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  const newCandidates = pickNewWords(state, Math.max(1, budget));

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={L("Kontekstli lug'at", "Contextual vocabulary")} title={t("nav.vocabulary", lang)} />
      <Card>
        <h2 className="text-lg font-bold">{L("Lug'at o'sishi (halol hisob)", "Vocabulary growth (honest count)")}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">{L("Retseptiv (tanish/tushunish)", "Receptive (recognise/understand)")}</p>
            <p className="mt-1 text-3xl font-extrabold">{est.receptiveConfirmed}<span className="text-base font-semibold text-muted"> {L("tasdiqlangan", "confirmed")}</span></p>
            <p className="text-sm text-muted">+ {est.receptiveEmerging} {L("shakllanmoqda", "emerging")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{L("Produktiv (o'zingiz ishlatgan)", "Productive (used by you)")}</p>
            <p className="mt-1 text-3xl font-extrabold">{est.productiveConfirmed}<span className="text-base font-semibold text-muted"> {L("tasdiqlangan", "confirmed")}</span></p>
            <p className="text-sm text-muted">+ {est.productiveEmerging} {L("shakllanmoqda", "emerging")}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {L(
            "“Tasdiqlangan” — kamida 3 kun o'tib ham eslangan (retseptiv) yoki bir necha marta/kontekstda mustaqil ishlatilgan (produktiv). Faqat ko'rilgan so'zlar (" + est.exposedOnly + " ta) hisobga olinmaydi. Bu faqat kuzatilayotgan " + VOCABULARY.length + " ta birlikka tegishli — umumiy lug'at hajmi emas.",
            `“Confirmed” = recalled again after ≥3 days (receptive) or used independently several times/contexts (productive). Items only seen (${est.exposedOnly}) are not counted. This covers only the ${VOCABULARY.length} tracked items, not your total vocabulary size.`,
          )}
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{L("Takrorlash", "Retrieval practice")}</h2>
          <p className="text-sm text-muted">{queue.length === 0 ? L("Hozircha takrorlash kerak emas.", "Nothing to review yet.") : L(`${queue.length} ta birlik navbatda (${queue.filter((q) => !q.early).length} ta muddati kelgan).`, `${queue.length} item(s) queued (${queue.filter((q) => !q.early).length} due).`)}</p>
        </div>
        <Button onClick={() => setReviewing(true)} disabled={queue.length === 0}>{L("Takrorlashni boshlash", "Start review")}</Button>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{L("Yangi iboralar", "New phrases")}</h2>
            <p className="text-sm text-muted">{budget === 0 ? L("Avval mavjud iboralarni mustahkamlang — yangi birliklar vaqtincha to'xtatildi.", "Consolidate your current items first — new items are paused to keep the load manageable.") : L(`Bugun ${budget} tagacha yangi birlik tavsiya etiladi.`, `Up to ${budget} new item(s) suggested now.`)}</p>
          </div>
          <Button variant="secondary" onClick={learnNew} disabled={budget === 0 || newCandidates.length === 0}>{L("Yangilarini qo'shish", "Add new items")}</Button>
        </div>
        <p className="mt-2 text-xs text-muted">{L("Ko'proq iboralar O'qish, Tinglash, Suhbat va Yozish mashqlarida kontekstda uchraydi.", "More items appear in context inside Reading, Listening, Speaking and Writing.")}</p>
      </Card>

      <section aria-labelledby="my-words">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="my-words" className="text-lg font-bold">{L("Mening birliklarim", "My items")} ({entries.length})</h2>
          <label className="flex items-center gap-2 text-sm">{L("Filtr", "Filter")}
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="all">{L("Hammasi", "All")}</option>
              <option value="review">{t("vocab.needsReview", lang)}</option>
              {(["encountered", "recognized", "recalled_assisted", "used_independently", "used_multi_context"] as VocabStage[]).map((s) => (
                <option key={s} value={s}>{t(`vocab.${s}` as const, lang)}</option>
              ))}
            </select>
          </label>
        </div>
        {entries.length === 0 ? (
          <EmptyState title={L("Hali birliklar yo'q", "No items yet")} body={L("Bir mashq bajaring — uchragan iboralar shu yerda paydo bo'ladi, yoki yangilarini qo'shing.", "Finish an activity and the phrases you meet will appear here — or add some above.")} />
        ) : (
          <ul className="grid gap-2">
            {shown.map((v) => {
              const item = VOCAB_BY_ID[v.itemId];
              if (!item) return null;
              const stage = stageOf(v);
              const isOpen = open === v.itemId;
              return (
                <li key={v.itemId}>
                  <Card as="div" className="p-4">
                    <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.itemId)}>
                      <span><strong className="text-base">{item.phrase ?? item.lemma}</strong> <span className="text-sm text-muted">{item.level} · {item.pos}</span></span>
                      <span className="flex flex-wrap gap-1.5">
                        {needsReview(v, now) && <Pill tone="berry">{t("vocab.needsReview", lang)}</Pill>}
                        <Pill tone={STAGE_TONE[stage]}>{t(`vocab.${stage}` as const, lang)}</Pill>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-3 grid gap-1 border-t border-line pt-3 text-sm">
                        <p><strong>Uz:</strong> {item.meaningUz} · <strong>En:</strong> {item.meaningEn}</p>
                        <p className="italic">“{item.example}”</p>
                        <p><strong>{L("Birikmalar", "Collocations")}:</strong> {item.collocations.join(" · ")}</p>
                        <p className="text-muted">
                          {L("Ko'rilgan", "Seen")}: {v.exposureCount}× · {L("To'g'ri eslangan", "Recalled")}: {v.successCount}× · {L("Mustaqil ishlatilgan", "Used")}: {v.independentUses}× ({v.contexts.length} {L("kontekst", "context(s)")})
                        </p>
                        <p className="text-muted">{L("Keyingi takrorlash", "Next review")}: {v.nextReviewAt ? new Date(v.nextReviewAt).toLocaleString() : "—"} · {L("interval", "interval")} {v.intervalDays} {L("kun", "d")}</p>
                        <div className="mt-1"><Bar value={Math.min(1, v.successCount / 6)} label="Retrieval strength" tone="leaf" /></div>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ review
function ReviewSession({ onExit }: { onExit: () => void }) {
  const { state, lang, now, recordAttempt } = useApp();
  const L = (uz: string, en: string) => (lang === "uz" ? uz : en);
  const queue = useMemo<ReviewCard[]>(() => buildReviewQueue(state, now, 8), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [log, setLog] = useState<{ itemId: string; mode: ReviewCard["mode"]; success: boolean }[]>([]);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [startedAtInit] = useState(() => Date.now());
  const startedAt = useRef(startedAtInit);
  const options = useOptions(queue[i]);

  if (queue.length === 0) return <EmptyState title={L("Takrorlash uchun hech narsa yo'q", "Nothing to review")} body="" action={<Button onClick={onExit}>{L("Orqaga", "Back")}</Button>} />;

  if (result) {
    const ok = log.filter((l) => l.success).length;
    return <ResultPanel result={result} scorePct={Math.round((ok / log.length) * 100)} lang={lang} vocabIds={log.map((l) => l.itemId)} />;
  }

  const card = queue[i];
  const item = card.item;

  function check() {
    let ok = false;
    if (card.mode === "recognition") ok = picked === item.id;
    else if (card.mode === "assisted") ok = matchesItem(answer, item);
    else {
      // independent: a full sentence of our own that contains the item
      const words = answer.trim().split(/\s+/).length;
      const lower = ` ${answer.toLowerCase().replace(/[^a-z'\s-]/g, " ").replace(/\s+/g, " ")} `;
      const contains = item.forms.some((f) => lower.includes(` ${f.toLowerCase()} `));
      const copied = answer.trim().toLowerCase() === item.example.toLowerCase();
      ok = contains && words >= 4 && !copied;
    }
    setChecked(ok);
  }

  function next() {
    const entry = { itemId: item.id, mode: card.mode, success: !!checked };
    const nextLog = [...log, entry];
    setLog(nextLog);
    setAnswer("");
    setPicked(null);
    setChecked(null);
    if (i + 1 < queue.length) {
      setI(i + 1);
      return;
    }
    const ok = nextLog.filter((l) => l.success).length;
    const res = recordAttempt({
      activityId: "vocab-review",
      kind: "review",
      skill: "vocabulary",
      level: "A2",
      score: ok / nextLog.length,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      source: "auto-graded",
      note: `${ok}/${nextLog.length} retrieved`,
      retrievals: nextLog.map((l) => ({ itemId: l.itemId, mode: l.mode, success: l.success })),
      units: nextLog.length,
      skipSkillUpdate: true,
    });
    setResult(res);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <Pill>{i + 1} / {queue.length}</Pill>
        <Button variant="ghost" onClick={onExit}>{L("Chiqish", "Exit")}</Button>
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          {card.mode === "recognition" ? L("Tanish", "Recognise") : card.mode === "assisted" ? L("Eslab yozing (yordam bilan)", "Recall (with a cue)") : L("O'z gapingizda ishlating", "Use it in your own sentence")}
          {card.early && ` · ${L("erta mashq", "early practice")}`}
        </p>
        {card.mode === "recognition" && (
          <>
            <h2 className="mt-2 text-2xl font-extrabold">{item.phrase ?? item.lemma}</h2>
            <p className="mt-1 text-sm italic text-muted">“{item.example}”</p>
            <div role="radiogroup" aria-label="Meaning" className="mt-4 grid gap-2">
              {options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={picked === o.id} disabled={checked !== null} onClick={() => setPicked(o.id)}
                  className={`min-h-12 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium ${checked !== null && o.id === item.id ? "border-leaf bg-leaf-soft" : picked === o.id ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
                  {lang === "uz" ? o.meaningUz : o.meaningEn}
                </button>
              ))}
            </div>
          </>
        )}
        {card.mode === "assisted" && (
          <>
            <h2 className="mt-2 text-xl font-extrabold">{item.meaningUz}</h2>
            <p className="text-sm text-muted">{item.meaningEn} · {item.pos}</p>
            <label htmlFor="recall" className="mt-4 block text-sm font-semibold">{L("Inglizcha so'z yoki ibora", "English word or phrase")}</label>
            <input id="recall" autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={checked !== null} className="mt-1 w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" />
          </>
        )}
        {card.mode === "independent" && (
          <>
            <h2 className="mt-2 text-2xl font-extrabold">{item.phrase ?? item.lemma}</h2>
            <p className="text-sm text-muted">{item.meaningEn}</p>
            <label htmlFor="usage" className="mt-4 block text-sm font-semibold">{L("Bu iborani ishlatib, o'zingiz haqingizda gap yozing (namunani ko'chirmang)", "Write a sentence about your own life using it (don't copy an example)")}</label>
            <textarea id="usage" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={checked !== null} className="mt-1 w-full rounded-xl border-2 border-line bg-surface p-3 focus:border-brand" />
          </>
        )}

        {checked !== null && (
          <div role="status" className="mt-4">
            <Notice tone={checked ? "ok" : "warn"}>
              {checked ? L("To'g'ri!", "Correct!") : L("Hali emas.", "Not yet.")} <strong>{item.phrase ?? item.lemma}</strong> = {item.meaningEn} · “{item.example}”
              {!checked && <> {L("Tez orada yana ko'rasiz.", "You'll see it again soon.")}</>}
            </Notice>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          {checked === null ? (
            <Button onClick={check} disabled={card.mode === "recognition" ? !picked : !answer.trim()}>{L("Tekshirish", "Check")}</Button>
          ) : (
            <Button onClick={next}>{i + 1 < queue.length ? L("Keyingi", "Next") : L("Yakunlash", "Finish")}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function useOptions(card: ReviewCard | undefined): VocabItem[] {
  return useMemo(() => (card ? seededShuffle([card.item, ...distractors(card.item)], card.item.id + "opts") : []), [card]);
}
