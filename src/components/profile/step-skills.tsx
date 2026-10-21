"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Skill } from "@/server/profile/schema";
import { PROFILE_COPY } from "./copy";
import { SectionHeader } from "./inputs";
import type { StepProps } from "./step-personal";

const C = PROFILE_COPY.skills;
const NONE = "none";

/** Tecnologias citadas nas experiências que ainda não viraram habilidade. */
export function skillSuggestions(profile: StepProps["profile"]): string[] {
  const have = new Set(profile.skills.map((s) => s.name.trim().toLowerCase()));
  const out: string[] = [];
  for (const exp of profile.experiences) {
    for (const tech of exp.technologies) {
      const key = tech.trim().toLowerCase();
      if (key && !have.has(key)) {
        have.add(key);
        out.push(tech.trim());
      }
    }
  }
  return out;
}

export function StepSkills({ profile, onChange }: StepProps) {
  const items = profile.skills;
  const update = (i: number, patch: Partial<Skill>) =>
    onChange({ ...profile, skills: items.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const add = (name = "") => onChange({ ...profile, skills: [...items, { name, years: null, level: null }] });
  const suggestions = skillSuggestions(profile);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={C.title} description={C.description} />

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{C.suggestions}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="hover:bg-muted inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs"
              >
                <Plus className="size-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-muted-foreground text-sm">{C.empty}</p>}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground hidden grid-cols-[1fr_6rem_10rem_2rem] gap-2 text-xs sm:grid">
            <span>{C.name}</span>
            <span>{C.years}</span>
            <span>{C.level}</span>
          </div>
          {items.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_2rem] gap-2 sm:grid-cols-[1fr_6rem_10rem_2rem]">
              <Input aria-label={C.name} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input
                aria-label={C.years}
                type="number"
                min={0}
                max={50}
                value={s.years ?? ""}
                onChange={(e) => update(i, { years: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <div className="hidden sm:block">
                <Select
                  value={s.level ?? NONE}
                  onValueChange={(v) => update(i, { level: v === NONE ? null : (v as Skill["level"]) })}
                >
                  <SelectTrigger className="w-full" aria-label={C.level}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{PROFILE_COPY.enums.none}</SelectItem>
                    {Object.entries(PROFILE_COPY.enums.skillLevel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover"
                onClick={() => onChange({ ...profile, skills: items.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="self-start" onClick={() => add()}>
        <Plus />
        {C.add}
      </Button>
    </div>
  );
}
