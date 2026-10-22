"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OutreachDraft, SendResult } from "@/server/outreach/send";
import { OUTREACH_COPY as C } from "./copy";

export type OutreachLoad = (
  jobId: number,
) => Promise<{ draft: OutreachDraft; cvFilename: string | null; sentAt: number | null; configured: boolean } | null>;
export type OutreachSend = (jobId: number, draft: OutreachDraft) => Promise<SendResult>;

type Loaded = NonNullable<Awaited<ReturnType<OutreachLoad>>>;

/** Revisão do e-mail antes do envio: nada sai sem o clique em "Enviar". */
export function OutreachDialog({
  jobId,
  open,
  onOpenChange,
  load,
  send,
  onSent,
}: {
  jobId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: OutreachLoad;
  send: OutreachSend;
  onSent: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<OutreachDraft>({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || jobId === null) return;
    let alive = true;
    void load(jobId).then((res) => {
      if (!alive || !res) return;
      setData(res);
      setDraft(res.draft);
      setError(null);
    });
    return () => {
      alive = false;
      setData(null);
    };
  }, [open, jobId, load]);

  const onSend = async () => {
    if (jobId === null) return;
    setSending(true);
    setError(null);
    try {
      const res = await send(jobId, draft);
      if (res.ok) {
        toast.success(C.toast.sent(draft.to));
        onSent();
        onOpenChange(false);
      } else {
        setError(res.error === "smtp" ? (res.message ?? C.errors.not_configured) : C.errors[res.error]);
      }
    } finally {
      setSending(false);
    }
  };

  const blocked = !data || !data.configured || !data.cvFilename;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{C.dialog.title}</DialogTitle>
          <DialogDescription>{C.dialog.description}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <p className="text-muted-foreground text-sm">{C.dialog.loading}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {!data.configured && (
              <p className="text-destructive text-sm">
                <Link href="/config/email" className="underline">
                  {C.dialog.notConfigured}
                </Link>
              </p>
            )}
            {!data.cvFilename && (
              <p className="text-destructive text-sm">
                <Link href="/perfil" className="underline">
                  {C.dialog.noCv}
                </Link>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="outreach-to">{C.dialog.to}</Label>
              <Input id="outreach-to" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="outreach-subject">{C.dialog.subject}</Label>
              <Input
                id="outreach-subject"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="outreach-body">{C.dialog.body}</Label>
              <Textarea
                id="outreach-body"
                rows={12}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>
            {data.cvFilename && <p className="text-muted-foreground text-xs">{C.dialog.attachment(data.cvFilename)}</p>}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{C.dialog.cancel}</Button>
          </DialogClose>
          <Button onClick={() => void onSend()} disabled={blocked || sending}>
            {sending ? C.dialog.sending : C.dialog.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
