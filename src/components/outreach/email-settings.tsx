"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { sendTestEmailAction } from "@/app/(app)/config/email/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OUTREACH_COPY } from "./copy";

const C = OUTREACH_COPY.settings;

export function EmailSettings({ config }: { config: { user: string; host: string; port: number } | null }) {
  const [pending, start] = useTransition();

  const test = () =>
    start(async () => {
      const res = await sendTestEmailAction();
      if (res.ok) toast.success(C.testOk);
      else toast.error(res.error === "smtp" ? (res.message ?? C.notConfigured) : OUTREACH_COPY.errors[res.error]);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{C.title}</CardTitle>
        <CardDescription>{C.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {config ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {C.configured(config.user, config.host, config.port)}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{C.notConfigured}</p>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {C.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div>
          <Button onClick={test} disabled={!config || pending}>
            <Mail />
            {C.test}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
