"use client";

import { ModuleShell } from "@/components/ActivityList";
import { SpeakingPlayer } from "@/features/speaking/SpeakingPlayer";
import type { SpeakingActivity } from "@/types/domain";

export default function SpeakingPage() {
  return <ModuleShell<SpeakingActivity> kind="speaking" eyebrow="AI Speaking" title="AI Speaking" render={(a) => <SpeakingPlayer key={a.id} activity={a} />} />;
}
