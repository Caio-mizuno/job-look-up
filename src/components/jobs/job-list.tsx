"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { applyToJob, discardJob, markSeen, recalcJob, restoreJob } from "@/app/(app)/vagas/actions";
import { startSearch } from "@/app/(app)/vagas/search-actions";
import { ApplicationKit } from "@/components/applications/application-kit";
import { ApplyButton } from "@/components/applications/apply-button";
import { APPLY_COPY } from "@/components/applications/copy";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAppStatus } from "@/lib/use-app-status";
import type { JobListItem } from "@/server/jobs/list";
import { JOBS_COPY as C } from "./copy";
import { JobCard } from "./job-card";
import { EMPTY_FILTERS, JobFilters, type Filters } from "./job-filters";
import { ProfileStrip, type ProfileSummary } from "./profile-strip";
import { AnalysisBanner, SearchProgress } from "./search-status";

const COMPACT_KEY = "jl.compact";
const POLL_MS = 2000;

function readCompact(): boolean {
  try {
    return localStorage.getItem(COMPACT_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

function query(filters: Filters, lastVisitAt: number, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ sort: filters.sort, lastVisitAt: String(lastVisitAt), ...extra });
  if (filters.workModels.length) p.set("workModels", filters.workModels.join(","));
  if (filters.contracts.length) p.set("contracts", filters.contracts.join(","));
  if (filters.seniorities.length) p.set("seniorities", filters.seniorities.join(","));
  if (filters.last7) p.set("lastDays", "7");
  if (filters.unseenOnly) p.set("unseenOnly", "1");
  return p.toString();
}

export function JobList({
  initialItems,
  initialCursor,
  lastVisitAt,
  profile,
}: {
  initialItems: JobListItem[];
  initialCursor: string | null;
  lastVisitAt: number;
  profile: ProfileSummary;
}) {
  const status = useAppStatus(POLL_MS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  // Preferência lida do localStorage sem quebrar a hidratação (servidor = false).
  const storedCompact = useSyncExternalStore(noopSubscribe, readCompact, () => false);
  const [compactOverride, setCompact] = useState<boolean | null>(null);
  const compact = compactOverride ?? storedCompact;
  const [searchRequested, setSearchRequested] = useState(false);
  const [kitJobId, setKitJobId] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadedCount = useRef(initialItems.length);
  useEffect(() => {
    loadedCount.current = items.length;
  }, [items]);

  const reload = useCallback(
    async (f: Filters, keepCount = false) => {
      const limit = keepCount ? Math.min(Math.max(loadedCount.current, 20), 100) : 20;
      const res = await fetch(`/api/jobs?${query(f, lastVisitAt, { limit: String(limit) })}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: JobListItem[]; nextCursor: string | null };
      setItems(data.items);
      setCursor(data.nextCursor);
    },
    [lastVisitAt],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs?${query(filters, lastVisitAt, { cursor })}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: JobListItem[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...data.items.filter((j) => !prev.some((p) => p.id === j.id))]);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, filters, lastVisitAt, loading]);

  // Enquanto há busca ou análise acontecendo, a lista se atualiza sozinha.
  const applying = items.some((j) => j.application?.status === "queued" || j.application?.status === "running");
  const busy = searchRequested || applying || status?.run?.status === "running" || (status?.pendingAnalysis ?? 0) > 0;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void reload(filters, true), POLL_MS);
    return () => clearInterval(timer);
  }, [busy, filters, reload]);

  useEffect(() => {
    if (searchRequested && status?.run?.status && status.run.status !== "running") {
      const t = setTimeout(() => setSearchRequested(false), POLL_MS * 2);
      return () => clearTimeout(t);
    }
  }, [searchRequested, status?.run?.status]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const changeFilters = (next: Filters) => {
    setFilters(next);
    void reload(next);
  };

  const onDiscard = async (id: number) => {
    const removed = items.find((j) => j.id === id);
    setItems((prev) => prev.filter((j) => j.id !== id));
    await discardJob(id);
    toast(C.discarded, {
      action: {
        label: C.undo,
        onClick: async () => {
          await restoreJob(id);
          if (removed) void reload(filters, true);
        },
      },
    });
  };

  const onApply = async (job: JobListItem) => {
    if (!status?.bridgeOnline) {
      toast.warning(APPLY_COPY.bridgeOff);
      setKitJobId(job.id);
      return;
    }
    const res = await applyToJob(job.id);
    if (!res.ok) {
      setKitJobId(job.id);
      return;
    }
    toast.success(APPLY_COPY.queuedToast);
    void reload(filters, true);
  };

  const onSearch = async () => {
    setSearchRequested(true);
    await startSearch();
  };

  const running = status?.run?.status === "running" || searchRequested;
  const filtered =
    filters.workModels.length + filters.contracts.length + filters.seniorities.length > 0 || filters.last7 || filters.unseenOnly;

  return (
    <div className="flex flex-col gap-4">
      <ProfileStrip profile={profile} searching={running} onSearch={() => void onSearch()} />
      <SearchProgress run={status?.run ?? null} />
      <AnalysisBanner status={status} />
      <JobFilters value={filters} onChange={changeFilters} />
      <label className="text-muted-foreground flex items-center gap-2 self-end text-xs">
        <Switch
          checked={compact}
          onCheckedChange={(v) => {
            setCompact(v);
            try {
              localStorage.setItem(COMPACT_KEY, v ? "1" : "0");
            } catch {
              // Sem storage (aba anônima): só não lembra a preferência.
            }
          }}
        />
        {C.compact}
      </label>

      {items.length === 0 && running && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {items.length === 0 && !running && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{filtered ? C.emptyState.filtered : C.emptyState.noJobsTitle}</EmptyTitle>
            {!filtered && <EmptyDescription>{C.emptyState.noJobs}</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      )}

      <div className="flex flex-col gap-3">
        {items.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            bridgeOnline={status?.bridgeOnline ?? false}
            compact={compact}
            onOpen={(id) => void markSeen(id)}
            onDiscard={(id) => void onDiscard(id)}
            onRecalc={(id) => {
              void recalcJob(id).then(() => reload(filters, true));
            }}
            actions={
              <ApplyButton
                url={job.url}
                application={job.application}
                onApply={() => void onApply(job)}
                onOpenKit={() => setKitJobId(job.id)}
              />
            }
          />
        ))}
      </div>
      <div ref={sentinel} aria-hidden />
      <ApplicationKit jobId={kitJobId} open={kitJobId !== null} onOpenChange={(v) => !v && setKitJobId(null)} />
      {loading && <Skeleton className="h-24 w-full" />}
    </div>
  );
}
