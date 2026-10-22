"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JOBS_COPY } from "./copy";

const C = JOBS_COPY.discardedCache;

/** Descartadas ficam fora das buscas até a pessoa limpar o cache; pede confirmação porque traz tudo de volta. */
export function DiscardedCache({ count, onConfirm }: { count: number; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          {C.button(count)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{C.title}</DialogTitle>
          <DialogDescription>{C.body(count)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{C.cancel}</Button>
          </DialogClose>
          <Button onClick={() => void confirm()} disabled={busy}>
            {C.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
