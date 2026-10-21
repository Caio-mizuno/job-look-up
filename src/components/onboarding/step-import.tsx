"use client";

import { CircleCheck, CircleX, FileUp, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { loadProfile, recordImport, uploadCv } from "@/app/onboarding/actions";
import { ONBOARDING_COPY } from "@/app/onboarding/copy";
import { SectionHeader } from "@/components/profile/inputs";
import type { StepProps } from "@/components/profile/step-personal";
import { IMPORT_ERRORS, useProfileImport } from "@/components/profile/use-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppStatus } from "@/lib/use-app-status";
import { cn } from "@/lib/utils";
import type { Profile } from "@/server/profile/schema";
import type { LastImport } from "@/server/settings";

const C = ONBOARDING_COPY.import;
const ACCEPT = ".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain";
const SUPPORTED = /\.(pdf|md|markdown|txt)$/i;
// Mesmo limite do servidor (MAX_IMPORT_BYTES): recusa antes de enviar.
const MAX_BYTES = 5 * 1024 * 1024;

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; source: string; startedAt: number }
  | { kind: "done"; source: string; cvFailed: boolean }
  /** `retry`: o que reenviar em "Tentar de novo"; null quando o próprio arquivo é o problema. */
  | { kind: "error"; source: string; message: string; retry: File | string | null };

const isPdf = (input: File | string): input is File => typeof input !== "string" && /\.pdf$/i.test(input.name);

/** "nome e contato · 3 experiências · 12 habilidades" com o que a IA trouxe. */
export function summarizeProfile(p: Profile): string {
  const count = (n: number, [one, many]: readonly [string, string]) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
  const parts = [
    p.personal.name.trim() ? C.count.name : null,
    count(p.experiences.length, C.count.experiences),
    count(p.skills.length, C.count.skills),
    count(p.education.length, C.count.education),
    count(p.languages.length, C.count.languages),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : C.nothingFound;
}

function StatusLine({ state, children }: { state: "ok" | "running" | "error"; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {state === "ok" && <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
      {state === "running" && <Spinner className="text-primary mt-0.5 shrink-0" />}
      {state === "error" && <CircleX className="text-destructive mt-0.5 size-4 shrink-0" />}
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function StepImport({
  profile,
  onChange,
  needsBridge,
  lastImport,
  onReview,
}: StepProps & { needsBridge: boolean; lastImport: LastImport | null; onReview: () => void }) {
  const [phase, setPhase] = useState<Phase>(
    lastImport ? { kind: "done", source: lastImport.source, cvFailed: false } : { kind: "idle" },
  );
  const [text, setText] = useState("");
  const [useAsCv, setUseAsCv] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { run } = useProfileImport(onChange, { notify: false });
  const status = useAppStatus();
  const blocked = needsBridge && status !== null && !status.bridgeOnline;

  // Relógio da leitura: mostra que a IA está trabalhando.
  useEffect(() => {
    if (phase.kind !== "reading") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase.kind]);

  /** A IA começa assim que chega o arquivo (ou o texto): sem passo extra de confirmar. */
  const start = async (input: File | string) => {
    const source = typeof input === "string" ? C.pasted : input.name;
    if (typeof input !== "string") {
      const invalid = !SUPPORTED.test(input.name) ? "unsupported" : input.size > MAX_BYTES ? "too_large" : null;
      if (invalid) return setPhase({ kind: "error", source, message: IMPORT_ERRORS[invalid], retry: null });
    }
    setNow(Date.now());
    setPhase({ kind: "reading", source, startedAt: Date.now() });

    try {
      const form = new FormData();
      if (typeof input === "string") form.set("text", input);
      else form.set("file", input);
      const res = await run(form);
      if (!res.ok) return setPhase({ kind: "error", source, message: res.error, retry: input });

      let cvFailed = false;
      if (isPdf(input) && useAsCv) {
        const cv = new FormData();
        cv.set("cv", input);
        cvFailed = !(await uploadCv(cv)).ok;
        if (!cvFailed) onChange(await loadProfile());
      }
      await recordImport(source);
      if (typeof input === "string") setText("");
      setPhase({ kind: "done", source, cvFailed });
    } catch (err) {
      setPhase({ kind: "error", source, message: err instanceof Error ? err.message : String(err), retry: input });
    }
  };

  const reading = phase.kind === "reading";
  const showPicker = phase.kind === "idle" || phase.kind === "error";

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />
      <p className="bg-primary/10 rounded-lg px-3 py-2.5 text-sm">{C.linkedinTip}</p>

      {phase.kind !== "idle" && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex flex-col gap-4 rounded-xl border p-4",
            phase.kind === "done" && "border-emerald-500/40 bg-emerald-500/5",
            phase.kind === "error" && "border-destructive/40 bg-destructive/5",
          )}
        >
          <ul className="flex flex-col gap-2">
            {phase.kind === "reading" && (
              <>
                <StatusLine state="ok">{C.received(phase.source)}</StatusLine>
                <StatusLine state="running">
                  {C.reading}
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {C.readingHint(Math.max(0, Math.round((now - phase.startedAt) / 1000)))}
                  </span>
                </StatusLine>
              </>
            )}
            {phase.kind === "done" && (
              <>
                <StatusLine state="ok">
                  <span className="font-medium">{C.importedFrom(phase.source)}</span>
                </StatusLine>
                <StatusLine state="ok">{C.filled(summarizeProfile(profile))}</StatusLine>
                {phase.cvFailed ? (
                  <StatusLine state="error">{C.cvFailed}</StatusLine>
                ) : (
                  profile.cvPath && <StatusLine state="ok">{C.cvSaved}</StatusLine>
                )}
              </>
            )}
            {phase.kind === "error" && (
              <StatusLine state="error">
                <span className="font-medium">{C.failed(phase.source)}</span>
                <span className="text-muted-foreground block">{phase.message}</span>
              </StatusLine>
            )}
          </ul>

          {phase.kind === "done" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={onReview}>{C.review} →</Button>
              <Button variant="ghost" onClick={() => setPhase({ kind: "idle" })}>
                <FileUp />
                {C.another}
              </Button>
            </div>
          )}
          {phase.kind === "error" && phase.retry !== null && (
            <Button
              variant="outline"
              className="self-start"
              disabled={blocked}
              onClick={() => void start(phase.retry!)}
            >
              <RotateCcw />
              {C.retry}
            </Button>
          )}
        </div>
      )}

      {showPicker && (
        <>
          <label
            htmlFor="import-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file && !blocked) void start(file);
            }}
            className={cn(
              "focus-within:ring-ring/50 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-[3px]",
              dragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-muted/40",
              blocked && "pointer-events-none opacity-50",
            )}
          >
            <FileUp className="text-muted-foreground size-7" />
            <span className="font-medium">{C.drop}</span>
            <span className="text-muted-foreground text-xs">{C.dropHint}</span>
            <input
              id="import-file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={blocked}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Limpa para que escolher o mesmo arquivo de novo dispare outra vez.
                e.target.value = "";
                if (file) void start(file);
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={useAsCv} onCheckedChange={(v) => setUseAsCv(v === true)} />
            {C.useAsCv}
          </label>

          <Field>
            <FieldLabel htmlFor="import-text">{C.or}</FieldLabel>
            <Textarea
              id="import-text"
              rows={6}
              value={text}
              placeholder={C.textPlaceholder}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {text.trim().length > 0 && (
            <Button className="self-start" disabled={blocked || reading} onClick={() => void start(text)}>
              <Sparkles />
              {C.runText}
            </Button>
          )}
        </>
      )}

      {blocked && showPicker && <p className="text-muted-foreground text-sm">{C.needsBridge}</p>}
    </div>
  );
}
