"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApplicationRow } from "@/components/applications/application-row";
import { APPLY_COPY as C } from "@/components/applications/copy";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { ApplicationListItem } from "@/server/applications/list";
import { answerUnansweredAction, cancelAction, fetchApplications, markSubmittedAction, retryAction } from "./actions";

const POLL_MS = 2000;

export function ApplicationsView({ initial }: { initial: ApplicationListItem[] }) {
  const [items, setItems] = useState(initial);
  const active = items.some((a) => a.status === "queued" || a.status === "running");
  const refresh = async () => setItems(await fetchApplications());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{C.page.title}</EmptyTitle>
          <EmptyDescription>{C.page.empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const run = (fn: () => Promise<unknown>, message?: string) => async () => {
    await fn();
    if (message) toast.success(message);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((a) => (
        <ApplicationRow
          key={a.id}
          application={a}
          onSubmitted={(id) => void run(() => markSubmittedAction(id), "Marcada como enviada")()}
          onRetry={(id) => void run(() => retryAction(id), "Na fila de novo")()}
          onCancel={(id) => void run(() => cancelAction(id))()}
          onAnswer={async (id, answers) => {
            const res = await answerUnansweredAction(id, answers);
            if (res.ok) toast.success("Respostas salvas; tentando de novo.");
            else toast.error("Confira as respostas.");
            await refresh();
          }}
        />
      ))}
    </div>
  );
}
