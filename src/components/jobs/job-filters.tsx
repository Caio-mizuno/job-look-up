"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Contract, Seniority, WorkModel } from "@/server/domain/enums";
import { JOBS_COPY } from "./copy";

export type Filters = {
  workModels: WorkModel[];
  contracts: Contract[];
  seniorities: Seniority[];
  last7: boolean;
  unseenOnly: boolean;
  sort: "match" | "recent";
};

export const EMPTY_FILTERS: Filters = { workModels: [], contracts: [], seniorities: [], last7: false, unseenOnly: false, sort: "match" };

const F = JOBS_COPY.filters;

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-xs transition-colors",
        on ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function JobFilters({ value, onChange }: { value: Filters; onChange: (next: Filters) => void }) {
  const chips: { label: string; on: boolean; flip: () => Filters }[] = [
    { label: F.remote, on: value.workModels.includes("remote"), flip: () => ({ ...value, workModels: toggle(value.workModels, "remote") }) },
    { label: F.hybrid, on: value.workModels.includes("hybrid"), flip: () => ({ ...value, workModels: toggle(value.workModels, "hybrid") }) },
    { label: F.onsite, on: value.workModels.includes("onsite"), flip: () => ({ ...value, workModels: toggle(value.workModels, "onsite") }) },
    { label: F.clt, on: value.contracts.includes("clt"), flip: () => ({ ...value, contracts: toggle(value.contracts, "clt") }) },
    { label: F.pj, on: value.contracts.includes("pj"), flip: () => ({ ...value, contracts: toggle(value.contracts, "pj") }) },
    { label: F.junior, on: value.seniorities.includes("junior"), flip: () => ({ ...value, seniorities: toggle(value.seniorities, "junior") }) },
    { label: F.pleno, on: value.seniorities.includes("pleno"), flip: () => ({ ...value, seniorities: toggle(value.seniorities, "pleno") }) },
    { label: F.senior, on: value.seniorities.includes("senior"), flip: () => ({ ...value, seniorities: toggle(value.seniorities, "senior") }) },
    { label: F.last7, on: value.last7, flip: () => ({ ...value, last7: !value.last7 }) },
    { label: F.unseen, on: value.unseenOnly, flip: () => ({ ...value, unseenOnly: !value.unseenOnly }) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <Chip key={c.label} on={c.on} onClick={() => onChange(c.flip())}>
          {c.label}
        </Chip>
      ))}
      <div className="ml-auto">
        <Select value={value.sort} onValueChange={(v) => onChange({ ...value, sort: v as Filters["sort"] })}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match">{F.sortMatch}</SelectItem>
            <SelectItem value="recent">{F.sortRecent}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
