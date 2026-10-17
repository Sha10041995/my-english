"use client";

import { useEffect, useState } from "react";

export interface ServerStatus {
  llm: string;
  speechServer: boolean;
  accounts: boolean;
}

/** Public capability report (no secrets). `null` while loading or if the request failed. */
export function useServerStatus(): ServerStatus | null {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setStatus(d))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
