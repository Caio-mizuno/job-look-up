"use client";

import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { generateDrafts, getKitData, type KitData } from "@/app/(app)/vagas/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { safeHttpUrl } from "@/lib/safe-url";
import { waitTask } from "@/lib/wait-task";
import { APPLY_COPY } from "./copy";

const C = APPLY_COPY.kit;

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</p>
        <p className="text-sm break-words whitespace-pre-wrap">{value || C.empty}</p>
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={C.copy(label)}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copiado");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      )}
    </div>
  );
}

export function CompanyMessage({ message, hint }: { message: string; hint?: string }) {
  return (
    <section className="bg-muted/50 rounded-lg px-3 py-1">
      <CopyField label={C.message} value={message} />
      {hint && <p className="text-muted-foreground pb-2 text-xs">{hint}</p>}
    </section>
  );
}

export function ApplicationKit({ jobId, open, onOpenChange }: { jobId: number | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [data, setData] = useState<KitData | null>(null);
  const [drafts, setDrafts] = useState<{ pitch: string; whyCompany: string; message?: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || jobId === null) return;
    let alive = true;
    void getKitData(jobId).then((d) => {
      if (alive) {
        setData(d);
        setDrafts(d?.drafts ?? null);
      }
    });
    return () => {
      alive = false;
    };
  }, [open, jobId]);

  const generate = async () => {
    if (jobId === null) return;
    setGenerating(true);
    try {
      const { taskId } = await generateDrafts(jobId);
      const task = await waitTask(taskId, { timeoutMs: 120_000 });
      const result = task.result as { pitch?: string; whyCompany?: string; message?: string; deferred?: boolean } | null;
      if (task.status === "done" && result?.pitch !== undefined)
        setDrafts({ pitch: result.pitch ?? "", whyCompany: result.whyCompany ?? "", message: result.message });
      else toast.error(result?.deferred ? "Ajudante desligado: rode make bridge." : `A IA falhou: ${task.error}`);
    } finally {
      setGenerating(false);
    }
  };

  const href = data ? safeHttpUrl(data.jobUrl) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{C.title}</SheetTitle>
          <SheetDescription>{data?.jobTitle ?? C.description}</SheetDescription>
        </SheetHeader>
        {data && (
          <div className="flex flex-col gap-5 px-4 pb-6">
            {href && (
              <Button variant="outline" size="sm" className="self-start" asChild>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {C.openJob}
                  <ExternalLink />
                </a>
              </Button>
            )}
            <CompanyMessage
              message={drafts?.message?.trim() ? drafts.message : data.message}
              hint={drafts?.message?.trim() ? undefined : C.messageHint}
            />
            <section>
              <h3 className="mb-1 text-sm font-medium">{C.personal}</h3>
              <div className="divide-y">
                {data.fields.map((f) => (
                  <CopyField key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </section>
            <section>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-sm font-medium">{C.drafts}</h3>
                <Button size="sm" variant="ghost" className="ml-auto" disabled={generating} onClick={() => void generate()}>
                  <Sparkles />
                  {generating ? C.generating : C.generate}
                </Button>
              </div>
              {drafts && (
                <div className="divide-y">
                  <CopyField label={C.pitch} value={drafts.pitch} />
                  <CopyField label={C.whyCompany} value={drafts.whyCompany} />
                </div>
              )}
            </section>
            {data.answers.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-medium">{C.answers}</h3>
                <div className="divide-y">
                  {data.answers.map((a) => (
                    <CopyField key={a.question} label={a.question} value={a.answer} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
