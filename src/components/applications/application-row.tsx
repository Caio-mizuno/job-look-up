"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { safeHttpUrl } from "@/lib/safe-url";
import type { ApplicationListItem } from "@/server/applications/list";
import { APPLY_COPY as C } from "./copy";
import { UnansweredForm, type UnansweredAnswer } from "./unanswered-form";

function List({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">{title}</h4>
      <ul className={`list-disc space-y-0.5 pl-4 text-[13px] ${muted ? "text-muted-foreground" : ""}`}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function ApplicationRow({
  application: a,
  onSubmitted,
  onRetry,
  onCancel,
  onAnswer,
}: {
  application: ApplicationListItem;
  onSubmitted: (id: number) => void;
  onRetry: (id: number) => void;
  onCancel: (id: number) => void;
  onAnswer: (id: number, answers: UnansweredAnswer[]) => Promise<void>;
}) {
  const href = safeHttpUrl(a.job.url);
  const r = a.report;
  const canRetry = a.status === "failed" || a.status === "login_required" || a.status === "needs_review";
  const variant = a.status === "failed" ? "destructive" : a.status === "submitted" ? "secondary" : "default";

  return (
    <Card className="gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{a.job.title}</p>
          <p className="text-muted-foreground text-xs">{a.job.company ?? "—"}</p>
        </div>
        <Badge variant={variant}>{C.status[a.status]}</Badge>
      </div>

      {a.error && <p className="text-destructive text-sm">{a.error}</p>}
      {r?.notes && <p className="text-muted-foreground text-sm">{r.notes}</p>}

      {r && (
        <div className="grid gap-4 sm:grid-cols-3">
          <List title={C.lists.filled} items={r.filled} />
          <List title={C.lists.drafted} items={r.drafted} />
          <List title={C.lists.unanswered} items={r.unanswered} muted />
        </div>
      )}

      {r && r.unanswered.length > 0 && a.status !== "submitted" && (
        <div className="bg-muted/50 rounded-lg p-3">
          <UnansweredForm questions={r.unanswered} onSubmit={(answers) => onAnswer(a.id, answers)} />
        </div>
      )}

      {a.events.length > 0 && (a.status === "running" || a.status === "queued") && (
        <div>
          <h4 className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">{C.page.log}</h4>
          <ol className="text-muted-foreground space-y-0.5 text-xs">
            {a.events.map((e, i) => (
              <li key={i}>{e.text}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        {href && (
          <Button size="sm" variant="outline" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {C.actions.open}
              <ExternalLink />
            </a>
          </Button>
        )}
        {a.status === "needs_review" && (
          <Button size="sm" onClick={() => onSubmitted(a.id)}>
            {C.actions.submitted}
          </Button>
        )}
        {canRetry && (
          <Button size="sm" variant="ghost" onClick={() => onRetry(a.id)}>
            {C.actions.retry}
          </Button>
        )}
        {a.status !== "submitted" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(a.id)}
            title={a.status === "running" ? C.actions.cancelRunningHint : undefined}
          >
            {C.actions.cancel}
          </Button>
        )}
      </div>
    </Card>
  );
}
