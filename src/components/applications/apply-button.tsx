"use client";

import { Briefcase, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isAutoApplyAllowed } from "@/lib/apply-url";
import type { ApplicationStatus } from "@/server/db/schema";
import { APPLY_COPY as C } from "./copy";

export function ApplyButton({
  url,
  application,
  onApply,
  onOpenKit,
}: {
  url: string;
  application: { id: number; status: ApplicationStatus } | null;
  onApply: () => void;
  onOpenKit: () => void;
}) {
  if (!isAutoApplyAllowed(url)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" onClick={onOpenKit}>
            <Package />
            {C.button.openKit}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{C.button.linkedinTip}</TooltipContent>
      </Tooltip>
    );
  }

  const status = application?.status;
  const busy = status === "queued" || status === "running";
  const done = status === "submitted";
  const label =
    !status || status === "cancelled"
      ? C.button.apply
      : (C.button[status as keyof typeof C.button] as string | undefined) ?? C.button.apply;

  return (
    <>
      <Button
        size="sm"
        variant={done || status === "needs_review" ? "outline" : "default"}
        disabled={busy || done || status === "needs_review"}
        onClick={onApply}
        aria-live="polite"
      >
        {done ? <Check /> : <Briefcase />}
        {label}
      </Button>
      <Button size="sm" variant="ghost" onClick={onOpenKit}>
        <Package />
        {C.button.kit}
      </Button>
    </>
  );
}
