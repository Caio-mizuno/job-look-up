"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { uploadCv } from "@/app/onboarding/actions";
import { ONBOARDING_COPY } from "@/app/onboarding/copy";
import { SectionHeader } from "@/components/profile/inputs";
import type { StepProps } from "@/components/profile/step-personal";
import { useProfileImport } from "@/components/profile/use-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppStatus } from "@/lib/use-app-status";

const C = ONBOARDING_COPY.import;

export function StepImport({ profile, onChange, needsBridge }: StepProps & { needsBridge: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [useAsCv, setUseAsCv] = useState(true);
  const { importing, run } = useProfileImport(onChange);
  const status = useAppStatus();
  const blocked = needsBridge && status !== null && !status.bridgeOnline;
  const isPdf = file?.name.toLowerCase().endsWith(".pdf") ?? false;

  const submit = async () => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    else fd.set("text", text);
    const ok = await run(fd);
    if (ok && file && isPdf && useAsCv) {
      const cv = new FormData();
      cv.set("cv", file);
      const res = await uploadCv(cv);
      if (res.ok) onChange({ ...profile, cvPath: profile.cvPath ?? "cv.pdf" });
      else toast.error("O PDF não pôde ser salvo como currículo.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />
      <p className="bg-primary/10 rounded-lg px-3 py-2.5 text-sm">{C.linkedinTip}</p>

      <Field>
        <FieldLabel htmlFor="import-file">{C.file}</FieldLabel>
        <Input
          id="import-file"
          type="file"
          accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      {isPdf && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={useAsCv} onCheckedChange={(v) => setUseAsCv(v === true)} />
          {C.useAsCv}
        </label>
      )}

      <Field>
        <FieldLabel htmlFor="import-text">{C.or}</FieldLabel>
        <Textarea
          id="import-text"
          rows={8}
          disabled={file !== null}
          value={text}
          placeholder={C.textPlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>

      {blocked && <p className="text-muted-foreground text-sm">{C.needsBridge}</p>}
      <Button
        className="self-start"
        disabled={importing || blocked || (!file && text.trim().length === 0)}
        onClick={submit}
      >
        <Sparkles />
        {importing ? C.running : C.run}
      </Button>
    </div>
  );
}
