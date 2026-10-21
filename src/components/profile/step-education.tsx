"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile } from "@/server/profile/schema";
import { PROFILE_COPY } from "./copy";
import { SectionHeader } from "./inputs";
import type { StepProps } from "./step-personal";

const C = PROFILE_COPY.education;
type Edu = Profile["education"][number];
type Lang = Profile["languages"][number];

export function StepEducation({ profile, onChange }: StepProps) {
  const edu = profile.education;
  const langs = profile.languages;
  const setEdu = (i: number, patch: Partial<Edu>) =>
    onChange({ ...profile, education: edu.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const setLang = (i: number, patch: Partial<Lang>) =>
    onChange({ ...profile, languages: langs.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title={C.title} description={C.description} />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{C.educationTitle}</h3>
        {edu.map((e, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1.2fr_8rem_8rem_2rem]">
            <Input aria-label={C.course} placeholder={C.course} value={e.course} onChange={(ev) => setEdu(i, { course: ev.target.value })} />
            <Input
              aria-label={C.institution}
              placeholder={C.institution}
              value={e.institution}
              onChange={(ev) => setEdu(i, { institution: ev.target.value })}
            />
            <Input aria-label={C.start} type="month" value={e.start} onChange={(ev) => setEdu(i, { start: ev.target.value })} />
            <Input aria-label={C.end} type="month" value={e.end} onChange={(ev) => setEdu(i, { end: ev.target.value })} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover"
              onClick={() => onChange({ ...profile, education: edu.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          className="self-start"
          onClick={() => onChange({ ...profile, education: [...edu, { course: "", institution: "", start: "", end: "" }] })}
        >
          <Plus />
          {C.addEducation}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{C.languagesTitle}</h3>
        {langs.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_10rem_2rem] gap-2">
            <Input
              aria-label={C.language}
              placeholder={C.language}
              value={l.language}
              onChange={(ev) => setLang(i, { language: ev.target.value })}
            />
            <Select value={l.level || undefined} onValueChange={(v) => setLang(i, { level: v })}>
              <SelectTrigger className="w-full" aria-label={C.level}>
                <SelectValue placeholder={C.level} />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_COPY.languageLevels.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {lvl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover"
              onClick={() => onChange({ ...profile, languages: langs.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          className="self-start"
          onClick={() => onChange({ ...profile, languages: [...langs, { language: "", level: "" }] })}
        >
          <Plus />
          {C.addLanguage}
        </Button>
      </section>
    </div>
  );
}
