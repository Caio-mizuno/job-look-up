"use client";

import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OUTREACH_COPY as C } from "./copy";

export function EmailButton({
  contactEmail,
  sentAt,
  onOpen,
}: {
  contactEmail: string | null;
  sentAt: number | null;
  onOpen: () => void;
}) {
  if (sentAt !== null) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Check />
        {C.button.sent}
      </Button>
    );
  }
  if (!contactEmail) {
    // Botão desabilitado não dispara eventos: o span segura a dica.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button size="sm" disabled>
              <Mail />
              {C.button.send}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{C.button.noEmail}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button size="sm" onClick={onOpen}>
      <Mail />
      {C.button.send}
    </Button>
  );
}
