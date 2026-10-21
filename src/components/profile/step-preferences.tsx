"use client";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Contract, Seniority, WorkModel } from "@/server/domain/enums";
import type { Preferences } from "@/server/profile/schema";
import { PROFILE_COPY } from "./copy";
import { ChipToggle, SectionHeader, TagInput } from "./inputs";
import type { StepProps } from "./step-personal";

const C = PROFILE_COPY.preferences;
const E = PROFILE_COPY.enums;
const opts = <T extends string>(map: Record<T, string>) =>
  (Object.entries(map) as [T, string][]).map(([value, label]) => ({ value, label }));

export function StepPreferences({ profile, onChange, children }: StepProps & { children?: React.ReactNode }) {
  const p = profile.preferences;
  const set = (patch: Partial<Preferences>) => onChange({ ...profile, preferences: { ...p, ...patch } });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pref-roles">{C.roles}</FieldLabel>
          <TagInput id="pref-roles" value={p.roles} onChange={(roles) => set({ roles })} placeholder={C.rolesPlaceholder} />
        </Field>
        <Field>
          <FieldLabel>{C.seniorities}</FieldLabel>
          <ChipToggle<Seniority> options={opts(E.seniority)} value={p.seniorities} onChange={(seniorities) => set({ seniorities })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>{C.workModels}</FieldLabel>
            <ChipToggle<WorkModel> options={opts(E.workModel)} value={p.workModels} onChange={(workModels) => set({ workModels })} />
          </Field>
          <Field>
            <FieldLabel>{C.contracts}</FieldLabel>
            <ChipToggle<Contract> options={opts(E.contract)} value={p.contracts} onChange={(contracts) => set({ contracts })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
          <Field>
            <FieldLabel htmlFor="pref-salary">{C.salaryMin}</FieldLabel>
            <Input
              id="pref-salary"
              type="number"
              min={0}
              step={500}
              value={p.salaryMin ?? ""}
              onChange={(e) => set({ salaryMin: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel>{C.currency}</FieldLabel>
            <Select value={p.currency} onValueChange={(v) => set({ currency: v as Preferences["currency"] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["BRL", "USD", "EUR"] as const).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pref-availability">{C.availability}</FieldLabel>
            <Input
              id="pref-availability"
              value={p.availability}
              placeholder={C.availabilityPlaceholder}
              onChange={(e) => set({ availability: e.target.value })}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pref-locations">{C.locations}</FieldLabel>
          <TagInput
            id="pref-locations"
            value={p.locations}
            onChange={(locations) => set({ locations })}
            placeholder={C.locationsPlaceholder}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={p.willingToRelocate} onCheckedChange={(v) => set({ willingToRelocate: v })} />
          {C.relocate}
        </label>
      </FieldGroup>
      {children}
    </div>
  );
}
