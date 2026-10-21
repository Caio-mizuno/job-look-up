"use client";

import { FileCheck2, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadCv } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_COPY } from "./copy";
import { SectionHeader } from "./inputs";
import type { StepProps } from "./step-personal";

const C = PROFILE_COPY.answers;

export function StepAnswers({ profile, onChange }: StepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const items = profile.readyAnswers;
  const update = (i: number, patch: Partial<(typeof items)[number]>) =>
    onChange({ ...profile, readyAnswers: items.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("cv", file);
      const res = await uploadCv(fd);
      if (res.ok) {
        // O caminho real é definido no servidor; aqui só marca que existe.
        onChange({ ...profile, cvPath: profile.cvPath ?? "cv.pdf" });
        toast.success(C.cvSaved);
      } else toast.error(C.cvErrors[res.error]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-muted/50 flex flex-wrap items-center gap-3 rounded-lg p-4">
        <FileCheck2 className={profile.cvPath ? "size-5 text-emerald-600" : "text-muted-foreground size-5"} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{C.cvTitle}</p>
          <p className="text-muted-foreground text-xs">{profile.cvPath ? C.cvSaved : C.cvNone} · {C.cvHint}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload />
          {C.cvUpload}
        </Button>
      </section>

      <SectionHeader title={C.title} description={C.description} />
      <div className="flex flex-col gap-4">
        {items.map((a, i) => (
          <Field key={i}>
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor={`ans-${i}`} className="flex-1">
                {a.question || C.newQuestion}
              </FieldLabel>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remover pergunta"
                onClick={() => onChange({ ...profile, readyAnswers: items.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
            {a.question === "" && (
              <Input
                aria-label={C.newQuestion}
                placeholder={C.newQuestion}
                onBlur={(e) => e.target.value.trim() && update(i, { question: e.target.value.trim() })}
              />
            )}
            <Textarea id={`ans-${i}`} rows={2} value={a.answer} onChange={(e) => update(i, { answer: e.target.value })} />
          </Field>
        ))}
      </div>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => onChange({ ...profile, readyAnswers: [...items, { question: "", answer: "" }] })}
      >
        <Plus />
        {C.addQuestion}
      </Button>
    </div>
  );
}
