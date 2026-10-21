"use client";

import { Loader2 } from "lucide-react";
import { SOURCE_LABELS } from "@/server/sources/labels";
import type { AppStatus } from "@/server/status";
import { JOBS_COPY as C } from "./copy";

export function SearchProgress({ run }: { run: AppStatus["run"] }) {
  if (!run || run.status !== "running") return null;
  const entries = Object.entries(run.perSource);
  return (
    <div className="bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs shadow-[0_0_0_1px] shadow-foreground/10">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Loader2 className="size-3.5 animate-spin" />
        {C.searching}
      </span>
      {entries.map(([id, s]) => (
        <span key={id} className="text-muted-foreground tabular-nums">
          {SOURCE_LABELS[id as keyof typeof SOURCE_LABELS] ?? id} {s.status === "running" || s.status === "ok" ? `${s.count} ` : ""}
          {C.progressSource[s.status]}
        </span>
      ))}
    </div>
  );
}

export function AnalysisBanner({ status }: { status: AppStatus | null }) {
  if (!status || status.pendingAnalysis === 0) return null;
  if (status.capReached) return <p className="bg-muted rounded-lg px-3 py-2 text-sm">{C.cap}</p>;
  if (status.bridgeOnline) return null;
  return <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{C.banner}</p>;
}
