"use client";

import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JOBS_COPY } from "./copy";

const C = JOBS_COPY.bulk;

export function BulkApplyBar({
  eligibleCount,
  selectedCount,
  onToggleAll,
  onApply,
  onClear,
  busy,
}: {
  eligibleCount: number;
  selectedCount: number;
  onToggleAll: (all: boolean) => void;
  onApply: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  if (eligibleCount === 0) return null;
  const all = selectedCount > 0 && selectedCount >= eligibleCount;
  const checked = all ? true : selectedCount > 0 ? "indeterminate" : false;

  return (
    <div className="bg-background/95 sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 backdrop-blur">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggleAll(!all)}
          aria-label={C.selectAll(eligibleCount)}
        />
        <span aria-hidden>{C.selectAll(eligibleCount)}</span>
      </label>
      <div className="ml-auto flex items-center gap-2">
        {selectedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {C.clear}
          </Button>
        )}
        <Button size="sm" disabled={selectedCount === 0 || busy} onClick={onApply}>
          <Briefcase />
          {C.apply(selectedCount)}
        </Button>
      </div>
    </div>
  );
}
