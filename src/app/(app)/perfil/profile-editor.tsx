"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StepAnswers } from "@/components/profile/step-answers";
import { StepEducation } from "@/components/profile/step-education";
import { StepExperiences } from "@/components/profile/step-experiences";
import { StepPersonal } from "@/components/profile/step-personal";
import { StepPreferences } from "@/components/profile/step-preferences";
import { StepSkills } from "@/components/profile/step-skills";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Profile } from "@/server/profile/schema";
import { saveFullProfile } from "./actions";

const TABS = [
  ["dados", "Seus dados"],
  ["experiencias", "Experiências"],
  ["habilidades", "Habilidades"],
  ["formacao", "Formação"],
  ["procura", "O que procura"],
  ["respostas", "Respostas e CV"],
] as const;

export function ProfileEditor({ initial, queriesSlot }: { initial: Profile; queriesSlot?: React.ReactNode }) {
  const [profile, setProfile] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const onChange = (next: Profile) => {
    setProfile(next);
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveFullProfile(profile);
      if (!res.ok) {
        toast.error(`Confira: ${res.errors.map((e) => e.path).join(", ")}`);
        return;
      }
      setDirty(false);
      toast.success(res.changed ? "Perfil salvo. As notas das vagas serão recalculadas." : "Perfil salvo.");
    });

  const props = { profile, onChange };

  return (
    <Tabs defaultValue="dados" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button className="ml-auto" disabled={!dirty || saving} onClick={save}>
          {saving ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
      <Card>
        <CardContent>
          <TabsContent value="dados">
            <StepPersonal {...props} />
          </TabsContent>
          <TabsContent value="experiencias">
            <StepExperiences {...props} />
          </TabsContent>
          <TabsContent value="habilidades">
            <StepSkills {...props} />
          </TabsContent>
          <TabsContent value="formacao">
            <StepEducation {...props} />
          </TabsContent>
          <TabsContent value="procura">
            <StepPreferences {...props}>{queriesSlot}</StepPreferences>
          </TabsContent>
          <TabsContent value="respostas">
            <StepAnswers {...props} />
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
