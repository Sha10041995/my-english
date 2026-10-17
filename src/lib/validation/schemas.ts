import { z } from "zod";

export const tutorRequestSchema = z.object({
  activityId: z.string().min(1).max(80),
  learnerText: z.string().trim().min(1).max(1200),
  history: z
    .array(z.object({ role: z.enum(["tutor", "learner"]), text: z.string().max(1200) }))
    .max(12)
    .default([]),
  turnIndex: z.number().int().min(0).max(50).default(0),
  intensity: z.enum(["gentle", "balanced", "detailed"]).default("balanced"),
  explanationLanguage: z.enum(["uz", "en"]).default("uz"),
  trackedPhrases: z.array(z.string().max(60)).max(20).default([]),
});
export type TutorRequest = z.infer<typeof tutorRequestSchema>;

export const writingRequestSchema = z.object({
  activityId: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(4000),
  explanationLanguage: z.enum(["uz", "en"]).default("uz"),
});
export type WritingRequest = z.infer<typeof writingRequestSchema>;

export const syncRequestSchema = z.object({ state: z.unknown() });
