import { cn } from "@/lib/utils";
import { JOBS_COPY } from "./copy";

export function MatchBar({ score, muted = false }: { score: number; muted?: boolean }) {
  const high = score >= 80;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums",
        muted ? "text-muted-foreground" : high ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <span className="bg-muted h-1.5 w-11 overflow-hidden rounded-full" aria-hidden>
        <span
          className={cn("block h-full rounded-full", muted ? "bg-muted-foreground/50" : high ? "bg-emerald-500" : "bg-amber-500")}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </span>
      {JOBS_COPY.match(score)}
    </span>
  );
}
