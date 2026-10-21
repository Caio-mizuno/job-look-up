"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkModel } from "@/server/domain/enums";
import type { Experience } from "@/server/profile/schema";
import { PROFILE_COPY } from "./copy";
import { SectionHeader, TagInput } from "./inputs";
import type { StepProps } from "./step-personal";
import { useProfileImport } from "./use-import";

const C = PROFILE_COPY.experiences;
const NONE = "none";

const blank = (): Experience => ({
  title: "",
  company: "",
  start: "",
  end: null,
  workModel: null,
  description: "",
  technologies: [],
});

export function StepExperiences({ profile, onChange }: StepProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const { importing, run } = useProfileImport(onChange);
  const items = profile.experiences;
  const update = (i: number, patch: Partial<Experience>) =>
    onChange({ ...profile, experiences: items.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />

      <div className="bg-primary/10 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
        <Sparkles className="text-primary size-4" />
        <span className="flex-1">{C.pasteHint}</span>
        <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
          {C.paste}
        </Button>
      </div>

      {items.length === 0 && <p className="text-muted-foreground text-sm">{C.empty}</p>}

      {items.map((exp, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{exp.title || C.newItem}</p>
                <p className="text-muted-foreground text-xs">
                  {[exp.company, exp.start && `${exp.start} – ${exp.end ?? "atual"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...profile, experiences: items.filter((_, j) => j !== i) })}
              >
                <Trash2 />
                {C.remove}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`e-title-${i}`}>{C.role}</FieldLabel>
                <Input id={`e-title-${i}`} value={exp.title} onChange={(e) => update(i, { title: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`e-company-${i}`}>{C.company}</FieldLabel>
                <Input
                  id={`e-company-${i}`}
                  value={exp.company}
                  onChange={(e) => update(i, { company: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={`e-start-${i}`}>{C.start}</FieldLabel>
                <Input
                  id={`e-start-${i}`}
                  type="month"
                  value={exp.start}
                  onChange={(e) => update(i, { start: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`e-end-${i}`}>{C.end}</FieldLabel>
                <Input
                  id={`e-end-${i}`}
                  type="month"
                  disabled={exp.end === null}
                  value={exp.end ?? ""}
                  onChange={(e) => update(i, { end: e.target.value })}
                />
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={exp.end === null}
                    onCheckedChange={(v) => update(i, { end: v === true ? null : "" })}
                  />
                  {C.current}
                </label>
              </Field>
              <Field>
                <FieldLabel>{C.workModel}</FieldLabel>
                <Select
                  value={exp.workModel ?? NONE}
                  onValueChange={(v) => update(i, { workModel: v === NONE ? null : (v as WorkModel) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{PROFILE_COPY.enums.none}</SelectItem>
                    {Object.entries(PROFILE_COPY.enums.workModel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`e-desc-${i}`}>{C.descriptionField}</FieldLabel>
              <Textarea
                id={`e-desc-${i}`}
                rows={3}
                value={exp.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{C.technologies}</FieldLabel>
              <TagInput value={exp.technologies} onChange={(technologies) => update(i, { technologies })} />
            </Field>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="outline"
        className="self-start"
        onClick={() => onChange({ ...profile, experiences: [...items, blank()] })}
      >
        <Plus />
        {C.add}
      </Button>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{C.pasteTitle}</DialogTitle>
            <DialogDescription>{C.pasteHint}</DialogDescription>
          </DialogHeader>
          <Textarea rows={10} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={importing || pasted.trim().length === 0}
              onClick={async () => {
                const fd = new FormData();
                fd.set("text", pasted);
                if (await run(fd)) {
                  setPasted("");
                  setPasteOpen(false);
                }
              }}
            >
              {importing ? "Separando…" : C.pasteRun}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
