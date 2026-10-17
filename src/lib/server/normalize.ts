import { createHash } from "node:crypto";
import { ACHIEVEMENTS, MISSION_DEFS } from "@/lib/gamification/rewards";
import { confidence, reportedLevel } from "@/lib/learning-engine/proficiency";
import type { LearnerState } from "@/lib/learning-engine/state";
import { SKILLS } from "@/types/domain";

/** Deterministic UUID (v5-style, SHA-1) so re-syncing the same attempt upserts instead of duplicating. */
export function stableUuid(...parts: string[]): string {
  const h = createHash("sha1").update(parts.join("\u0000")).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export interface TableWrite {
  table: string;
  onConflict: string;
  rows: Record<string, unknown>[];
}

/**
 * Derive the normalised rows from the validated learner state. This is a pure projection:
 * the snapshot stays the source of truth for the app, the tables serve analytics / future server logic.
 * Raw learner text (writing, conversations) is intentionally NOT projected.
 */
export function projectState(userId: string, s: LearnerState): TableWrite[] {
  const iso = (d: string) => new Date(d).toISOString();

  const profiles: TableWrite = {
    table: "profiles",
    onConflict: "id",
    rows: [
      {
        id: userId,
        display_name: s.profile.displayName.slice(0, 60),
        preferred_language: s.profile.explanationLanguage,
        learning_goal: s.profile.goal,
        available_study_minutes: s.profile.minutesPerDay,
        exam_target: s.profile.examTarget,
        correction_intensity: s.profile.correctionIntensity,
      },
    ],
  };

  const skill_progress: TableWrite = {
    table: "skill_progress",
    onConflict: "user_id,skill",
    rows: SKILLS.filter((k) => s.skills[k]).map((k) => {
      const e = s.skills[k];
      return {
        user_id: userId,
        skill: k,
        estimated_level: reportedLevel(e),
        theta: Math.round(e.theta * 1000) / 1000,
        evidence: e.evidence,
        confidence: Math.round(confidence(e) * 1000) / 1000,
        updated_at: e.updatedAt ? iso(e.updatedAt) : new Date().toISOString(),
      };
    }),
  };

  const user_vocabulary: TableWrite = {
    table: "user_vocabulary",
    onConflict: "user_id,vocabulary_item_id",
    rows: Object.values(s.vocab).map((v) => ({
      user_id: userId,
      vocabulary_item_id: v.itemId,
      recognition_state: v.recognition,
      productive_state: v.productive,
      exposure_count: v.exposureCount,
      successful_retrieval_count: v.successCount,
      independent_use_count: v.independentUses,
      contexts: v.contexts,
      interval_days: v.intervalDays,
      ease: v.ease,
      lapses: v.lapses,
      last_seen_at: iso(v.lastSeenAt),
      last_success_at: v.lastSuccessAt ? iso(v.lastSuccessAt) : null,
      next_review_at: v.nextReviewAt ? iso(v.nextReviewAt) : null,
    })),
  };

  const activity_attempts: TableWrite = {
    table: "activity_attempts",
    onConflict: "id",
    rows: s.attempts.map((a) => ({
      id: stableUuid(userId, "attempt", a.id),
      user_id: userId,
      activity_id: a.activityId,
      response: null,
      feedback: { kind: a.kind, skill: a.skill, level: a.level, source: a.source, xp: a.xp, note: a.note ?? null },
      score: Math.max(0, Math.min(1, a.score)),
      duration_seconds: Math.max(0, Math.round(a.durationSeconds)),
      created_at: iso(a.at),
    })),
  };

  const assessment_attempts: TableWrite = {
    table: "assessment_attempts",
    onConflict: "id",
    rows: s.assessments.map((a) => {
      const total = a.responses.length;
      const correct = a.responses.filter((r) => r.correct).length;
      const score =
        a.type === "placement" && total > 0
          ? correct / total
          : a.sections && a.sections.length
            ? a.sections.reduce((n, x) => n + x.score / Math.max(1, x.total), 0) / a.sections.length
            : null;
      return {
        id: stableUuid(userId, "assessment", a.id),
        user_id: userId,
        assessment_type: a.type,
        responses: a.responses,
        score,
        rubric_version: a.rubricVersion,
        created_at: iso(a.at),
      };
    }),
  };

  const knownAchievements = new Set(ACHIEVEMENTS.map((x) => x.id));
  const user_achievements: TableWrite = {
    table: "user_achievements",
    onConflict: "user_id,achievement_id",
    rows: Object.entries(s.achievements)
      .filter(([id]) => knownAchievements.has(id))
      .map(([id, at]) => ({ user_id: userId, achievement_id: id, unlocked_at: iso(at) })),
  };

  const user_missions: TableWrite = {
    table: "user_missions",
    onConflict: "user_id,mission_id,day",
    rows: s.missions.day
      ? s.missions.items
          .filter((m) => MISSION_DEFS[m.id])
          .map((m) => ({ user_id: userId, mission_id: m.id, day: s.missions.day, completed_at: m.done ? new Date().toISOString() : null }))
      : [],
  };

  // Parents before children where FKs exist; everything is idempotent.
  return [profiles, skill_progress, user_vocabulary, activity_attempts, assessment_attempts, user_achievements, user_missions].filter((t) => t.rows.length > 0);
}

export type RowWriter = (w: TableWrite) => Promise<string | null>;

/** Write all projected tables; returns the first error message (table-qualified) or null. */
export async function writeProjection(writes: TableWrite[], write: RowWriter): Promise<string | null> {
  for (const w of writes) {
    // chunk to keep request bodies small
    for (let i = 0; i < w.rows.length; i += 200) {
      const err = await write({ ...w, rows: w.rows.slice(i, i + 200) });
      if (err) return `${w.table}: ${err}`;
    }
  }
  return null;
}

export const USER_TABLES = ["user_missions", "user_achievements", "assessment_attempts", "activity_attempts", "user_vocabulary", "skill_progress", "learning_sessions", "learner_snapshots"] as const;
