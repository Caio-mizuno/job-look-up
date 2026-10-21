"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { APPLY_COPY as C } from "./copy";

export type UnansweredAnswer = { question: string; answer: string; saveAsReady: boolean };

export function UnansweredForm({
  questions,
  onSubmit,
}: {
  questions: string[];
  onSubmit: (answers: UnansweredAnswer[]) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, { answer: string; save: boolean }>>({});
  const [pending, setPending] = useState(false);
  const get = (q: string) => values[q] ?? { answer: "", save: false };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onSubmit(
            questions
              .map((q) => ({ question: q, answer: get(q).answer.trim(), saveAsReady: get(q).save }))
              .filter((a) => a.answer),
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm font-medium">{C.unanswered.title}</p>
      {questions.map((q, i) => (
        <Field key={q}>
          <FieldLabel htmlFor={`unans-${i}`}>{q}</FieldLabel>
          <Input
            id={`unans-${i}`}
            aria-label={q}
            value={get(q).answer}
            onChange={(e) => setValues({ ...values, [q]: { ...get(q), answer: e.target.value } })}
          />
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Checkbox
              aria-label={`${C.unanswered.save}: ${q}`}
              checked={get(q).save}
              onCheckedChange={(v) => setValues({ ...values, [q]: { ...get(q), save: v === true } })}
            />
            {C.unanswered.save}
          </label>
        </Field>
      ))}
      <Button type="submit" className="self-start" disabled={pending}>
        {C.unanswered.submit}
      </Button>
    </form>
  );
}
