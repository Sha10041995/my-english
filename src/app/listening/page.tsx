"use client";

import { ModuleShell } from "@/components/ActivityList";
import { ListeningPlayer } from "@/features/listening/ListeningPlayer";
import type { ListeningActivity } from "@/types/domain";

export default function ListeningPage() {
  return <ModuleShell<ListeningActivity> kind="listening" eyebrow="Listening" title="Listening" render={(a) => <ListeningPlayer activity={a} />} />;
}
