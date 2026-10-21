"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { acceptBridgePrivacy } from "@/app/(app)/config/ajudante/actions";
import { BridgeStatus } from "@/components/bridge-status";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRIDGE_COPY } from "./copy";

export function BridgeSetup({ privacyAccepted }: { privacyAccepted: boolean }) {
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{BRIDGE_COPY.title}</CardTitle>
          <BridgeStatus />
        </div>
        <CardDescription>{BRIDGE_COPY.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm">{BRIDGE_COPY.commandLabel}</p>
          <div className="flex items-center gap-2">
            <code className="bg-muted rounded-md px-3 py-1.5 font-mono text-sm">{BRIDGE_COPY.command}</code>
            <CopyButton value={BRIDGE_COPY.command} />
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
            {BRIDGE_COPY.requirementsTitle}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {BRIDGE_COPY.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="bg-muted/60 flex flex-col gap-3 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="size-4" />
            {BRIDGE_COPY.privacyTitle}
          </div>
          <p className="text-sm leading-relaxed">{BRIDGE_COPY.privacy}</p>
          {privacyAccepted ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              {BRIDGE_COPY.accepted}
            </span>
          ) : (
            <Button className="self-start" disabled={pending} onClick={() => start(() => acceptBridgePrivacy())}>
              {BRIDGE_COPY.accept}
            </Button>
          )}
        </div>

        <p className="text-muted-foreground text-sm">
          {BRIDGE_COPY.alternative}{" "}
          <Link href="/config/ia" className="text-primary underline-offset-4 hover:underline">
            {BRIDGE_COPY.alternativeLink}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
