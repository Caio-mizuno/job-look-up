"use client";

import { useEffect, useState } from "react";
import type { AppStatus } from "@/server/status";

/** Faz polling de /api/status; enquanto a aba está aberta o status do ajudante fica ao vivo. */
export function useAppStatus(intervalMs = 2000): AppStatus | null {
  const [status, setStatus] = useState<AppStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok && alive) setStatus((await res.json()) as AppStatus);
      } catch {
        // App reiniciando: mantém o último status e tenta de novo no próximo ciclo.
      }
    };
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return status;
}
