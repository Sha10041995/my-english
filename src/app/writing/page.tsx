"use client";

import { ModuleShell } from "@/components/ActivityList";
import { WritingPlayer } from "@/features/writing/WritingPlayer";
import type { WritingActivity } from "@/types/domain";

export default function WritingPage() {
  return <ModuleShell<WritingActivity> kind="writing" eyebrow="Writing" title="Writing" render={(a) => <WritingPlayer key={a.id} activity={a} />} />;
}
