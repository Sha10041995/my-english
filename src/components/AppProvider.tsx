"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyAttempt, applyPlacement, ensureMissions, type ApplyResult, type AttemptInput } from "@/lib/learning-engine/apply";
import type { PlacementOutcome } from "@/lib/assessment/placement";
import { createInitialState, parseState, type LearnerState } from "@/lib/learning-engine/state";
import { clearState, loadState, saveState } from "@/lib/storage";
import type { Lang } from "@/lib/i18n";

interface Toast {
  id: number;
  text: string;
}

interface AppContextValue {
  state: LearnerState;
  ready: boolean;
  lang: Lang;
  now: Date;
  recovered: boolean;
  saveFailed: boolean;
  update: (fn: (s: LearnerState) => LearnerState) => void;
  recordAttempt: (input: AttemptInput) => ApplyResult;
  recordPlacement: (outcome: PlacementOutcome) => void;
  setMiniMode: (mini: boolean) => void;
  importState: (raw: unknown) => boolean;
  resetAll: () => void;
  toasts: Toast[];
  toast: (text: string) => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LearnerState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => new Date());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const { state: loaded, recovered: rec } = loadState();
    setState(ensureMissions(loaded, new Date()));
    setRecovered(rec);
    setReady(true);
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveFailed(!saveState(state));
  }, [state, ready]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const update = useCallback((fn: (s: LearnerState) => LearnerState) => setState((s) => fn(s)), []);

  const recordAttempt = useCallback((input: AttemptInput): ApplyResult => {
    const res = applyAttempt(stateRef.current, input, new Date());
    stateRef.current = res.state;
    setState(res.state);
    return res;
  }, []);

  const recordPlacement = useCallback((outcome: PlacementOutcome) => {
    setState((s) => applyPlacement(s, outcome, new Date()));
  }, []);

  const setMiniMode = useCallback((mini: boolean) => setState((s) => ensureMissions(s, new Date(), mini)), []);

  const importState = useCallback((raw: unknown) => {
    const parsed = parseState(raw);
    if (!parsed) return false;
    setState(parsed);
    return true;
  }, []);

  const resetAll = useCallback(() => {
    clearState();
    setState(ensureMissions(createInitialState(), new Date()));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      ready,
      lang: state.profile.explanationLanguage,
      now,
      recovered,
      saveFailed,
      update,
      recordAttempt,
      recordPlacement,
      setMiniMode,
      importState,
      resetAll,
      toasts,
      toast,
    }),
    [state, ready, now, recovered, saveFailed, update, recordAttempt, recordPlacement, setMiniMode, importState, resetAll, toasts, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
