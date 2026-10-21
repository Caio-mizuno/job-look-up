"use client";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/server/profile/schema";
import { PROFILE_COPY } from "./copy";
import { SectionHeader } from "./inputs";

export type StepProps = { profile: Profile; onChange: (next: Profile) => void };

const C = PROFILE_COPY.personal;
const FIELDS = [
  ["name", C.name, "text"],
  ["email", C.email, "email"],
  ["phone", C.phone, "tel"],
  ["city", C.city, "text"],
  ["state", C.state, "text"],
  ["country", C.country, "text"],
  ["linkedin", C.linkedin, "url"],
  ["github", C.github, "url"],
  ["portfolio", C.portfolio, "url"],
] as const;

export function StepPersonal({ profile, onChange }: StepProps) {
  const set = (key: keyof Profile["personal"], value: string) =>
    onChange({ ...profile, personal: { ...profile.personal, [key]: value } });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map(([key, label, type]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`p-${key}`}>{label}</FieldLabel>
              <Input
                id={`p-${key}`}
                type={type}
                value={profile.personal[key]}
                onChange={(e) => set(key, e.target.value)}
                autoComplete="off"
              />
            </Field>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="p-headline">{C.headline}</FieldLabel>
          <Input
            id="p-headline"
            value={profile.headline}
            placeholder={C.headlinePlaceholder}
            onChange={(e) => onChange({ ...profile, headline: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="p-summary">{C.summary}</FieldLabel>
          <Textarea
            id="p-summary"
            rows={4}
            value={profile.summary}
            placeholder={C.summaryPlaceholder}
            onChange={(e) => onChange({ ...profile, summary: e.target.value })}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}
