"use client";

import { Briefcase } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [confirming, setConfirming] = useState(false);
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
        <Button size="sm" disabled={selectedCount === 0 || busy} onClick={() => setConfirming(true)}>
          <Briefcase />
          {C.apply(selectedCount)}
        </Button>
      </div>
      {/* Cada candidatura é enviada de verdade: um clique errado no "Selecionar todas" não pode disparar o lote. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{C.confirmTitle(selectedCount)}</DialogTitle>
            <DialogDescription>{C.confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{C.cancel}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirming(false);
                onApply();
              }}
            >
              {C.confirm(selectedCount)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
