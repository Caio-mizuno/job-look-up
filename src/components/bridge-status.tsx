"use client";

import { SHELL_COPY } from "@/components/shell/copy";
import { cn } from "@/lib/utils";
import { useAppStatus } from "@/lib/use-app-status";

export function BridgeStatus({ className }: { className?: string }) {
  const status = useAppStatus();
  const online = status?.bridgeOnline ?? false;

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
        online ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      <span className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {status === null ? "…" : online ? SHELL_COPY.bridge.online : SHELL_COPY.bridge.offline}
    </span>
  );
}
