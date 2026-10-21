"use client";

import { ExternalLink } from "lucide-react";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { SourceState } from "@/server/sources/settings";
import { toggleSource } from "./actions";
import { SOURCES_COPY } from "./copy";

export function SourceRow({ source, lastCount }: { source: SourceState; lastCount: number | null }) {
  const [pending, start] = useTransition();
  const warning = SOURCES_COPY.warnings[source.id];
  const variant = source.status === "error" ? "destructive" : source.status === "ok" ? "secondary" : "outline";

  return (
    <div className="flex flex-wrap items-start gap-3 py-4">
      <Switch
        checked={source.enabled}
        disabled={pending}
        aria-label={`Usar ${source.label}`}
        onCheckedChange={(v) => start(() => toggleSource(source.id, v))}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{source.label}</span>
          <Badge variant={variant}>{SOURCES_COPY.status[source.status]}</Badge>
          <a
            href={source.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            {new URL(source.homepage).hostname}
            <ExternalLink className="size-3" />
          </a>
        </div>
        {warning && <p className="text-muted-foreground mt-1 text-xs">{warning}</p>}
        {source.lastError && source.status !== "ok" && (
          <p className="text-destructive mt-1 text-xs">{source.lastError}</p>
        )}
      </div>
      {lastCount !== null && (
        <span className="text-muted-foreground text-xs tabular-nums">{SOURCES_COPY.lastRun(lastCount)}</span>
      )}
    </div>
  );
}
