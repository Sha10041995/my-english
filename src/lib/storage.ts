import { createInitialState, parseState, type LearnerState } from "@/lib/learning-engine/state";

const KEY = "linguaquest:state:v1";
const BACKUP_KEY = "linguaquest:state:invalid-backup";

/** Load persisted state. Corrupt data is backed up (not silently discarded) and replaced by a fresh state. */
export function loadState(): { state: LearnerState; recovered: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { state: createInitialState(), recovered: false };
    const parsed = parseState(JSON.parse(raw));
    if (parsed) return { state: parsed, recovered: false };
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    // fall through to fresh state
  }
  return { state: createInitialState(), recovered: true };
}

export function saveState(state: LearnerState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
}
