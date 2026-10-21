"use client";

import { ExternalLink, RefreshCw, X } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { safeHttpUrl } from "@/lib/safe-url";
import type { JobListItem } from "@/server/jobs/list";
import { JOBS_COPY as C } from "./copy";
import { MatchBar } from "./match-bar";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export type JobCardProps = {
  job: JobListItem;
  bridgeOnline: boolean;
  compact: boolean;
  onOpen: (id: number) => void;
  onDiscard: (id: number) => void;
  onRecalc: (id: number) => void;
  /** Ações extras (candidatura, kit) entram aqui sem o card conhecer o fluxo. */
  actions?: React.ReactNode;
  hint?: React.ReactNode;
};

function Column({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div className="min-w-0">
      <h4 className="text-muted-foreground mb-1.5 text-[11px] font-medium uppercase tracking-wide">{title}</h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{C.empty}</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed marker:text-muted-foreground">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JobCard({ job, bridgeOnline, compact, onOpen, onDiscard, onRecalc, actions, hint }: JobCardProps) {
  const href = safeHttpUrl(job.url);
  const sourceHref = safeHttpUrl(job.sourceHomepage);
  const e = job.enrichment;
  const meta = [
    job.company ?? C.companyUnknown,
    job.location,
    job.workModel ? C.labels.workModel[job.workModel] : null,
    job.contract ? C.labels.contract[job.contract] : null,
    job.salaryText ?? e?.salary ?? C.salaryUnknown,
  ]
    .filter((m): m is string => Boolean(m))
    // Local "Remoto" + modelo "Remoto" viraria "Remoto · Remoto".
    .filter((m, i, all) => all.findIndex((x) => x.toLowerCase() === m.toLowerCase()) === i);

  return (
    <Card className="gap-0 px-4 py-4 transition-shadow hover:shadow-md sm:px-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{job.title}</h3>
            {job.isNew && <Badge>{C.newBadge}</Badge>}
            {e?.stale && <Badge variant="outline">{C.stale}</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-1.5 text-xs">
            {meta.map((m, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden>·</span>}
                <span>{m}</span>
              </Fragment>
            ))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {e ? (
            <MatchBar score={e.matchScore} muted={e.stale} />
          ) : job.analysis === "failed" ? (
            <span className="text-destructive max-w-56 text-right text-xs" title={job.analysisError ?? undefined}>
              {job.analysisError ?? C.failed}
            </span>
          ) : job.analysis === "none" ? (
            <span className="text-muted-foreground text-xs">{C.notAnalyzed}</span>
          ) : (
            <span className="text-muted-foreground text-xs">{bridgeOnline ? C.analyzing : C.waiting}</span>
          )}
          <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
            {sourceHref ? (
              <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                {C.via(job.sourceLabel)}
              </a>
            ) : (
              C.via(job.sourceLabel)
            )}
            {job.postedAt && <span>· {C.posted(dateFmt.format(job.postedAt))}</span>}
          </span>
        </div>
      </div>

      {!compact && e && (
        <>
          <p className="bg-muted text-muted-foreground mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed">
            <strong className="text-foreground font-medium">{C.why}</strong> {e.why}
            {e.gaps.length > 0 && (
              <>
                {" "}
                <strong className="text-foreground font-medium">{C.gaps}</strong> {e.gaps.join("; ")}
              </>
            )}
          </p>
          {e.summary && <p className="mt-3 text-[13px] leading-relaxed">{e.summary}</p>}
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Column title={C.offers} items={e.offers} />
            <Column title={C.responsibilities} items={e.responsibilities} />
            <Column
              title={C.requirements}
              items={e.requirements.map((r, i) =>
                r.mustHave ? (
                  r.text
                ) : (
                  <span key={i} className="text-muted-foreground">{`${C.nice} ${r.text}`}</span>
                ),
              )}
            />
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        {href && (
          <Button variant="outline" size="sm" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(job.id)}>
              {C.open}
              <ExternalLink />
            </a>
          </Button>
        )}
        {actions}
        {job.analysis === "failed" && (
          <Button variant="ghost" size="sm" onClick={() => onRecalc(job.id)}>
            <RefreshCw />
            {C.retry}
          </Button>
        )}
        {job.analysis === "none" && (
          <Button variant="ghost" size="sm" onClick={() => onRecalc(job.id)}>
            <RefreshCw />
            {C.analyze}
          </Button>
        )}
        {e?.stale && job.analysis !== "failed" && (
          <Button variant="ghost" size="sm" onClick={() => onRecalc(job.id)}>
            <RefreshCw />
            {C.recalc}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDiscard(job.id)}>
          <X />
          {C.discard}
        </Button>
        {hint && <span className="text-muted-foreground ml-auto text-[11.5px]">{hint}</span>}
      </div>
    </Card>
  );
}
