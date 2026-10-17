"use client";

import { ModuleShell } from "@/components/ActivityList";
import { ReadingPlayer } from "@/features/reading/ReadingPlayer";
import type { ReadingActivity } from "@/types/domain";

export default function ReadingPage() {
  return <ModuleShell<ReadingActivity> kind="reading" eyebrow="Reading" title="Reading" render={(a) => <ReadingPlayer activity={a} />} />;
}
