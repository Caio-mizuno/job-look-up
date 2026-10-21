"use client";

import { Briefcase, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { finishOnboarding, saveStep } from "@/app/onboarding/actions";
import { ONBOARDING_COPY } from "@/app/onboarding/copy";
import { BridgeSetup } from "@/components/bridge-setup/bridge-setup";
import { StepAnswers } from "@/components/profile/step-answers";
import { StepEducation } from "@/components/profile/step-education";
import { StepExperiences } from "@/components/profile/step-experiences";
import { StepPersonal } from "@/components/profile/step-personal";
import { StepPreferences } from "@/components/profile/step-preferences";
import { StepSkills } from "@/components/profile/step-skills";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/server/profile/schema";
import { sectionOf, type SectionStep } from "@/server/profile/sections";
import { StepImport } from "./step-import";
import { nextStep, prevStep, STEPS, type StepIndex } from "./steps";

const C = ONBOARDING_COPY;
const AUTOSAVE_MS = 800;

export function Wizard({
  step,
  initialProfile,
  completed,
  privacyAccepted,
  needsBridge,
}: {
  step: StepIndex;
  initialProfile: Profile;
  completed: number[];
  privacyAccepted: boolean;
  needsBridge: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const hasSection = step >= 2;

  const persist = async (): Promise<boolean> => {
    if (!hasSection) {
      await saveStep(step, {});
      return true;
    }
    setSaveState("saving");
    const res = await saveStep(step, sectionOf(profile, step as SectionStep));
    if (res.ok) {
      dirty.current = false;
      setSaveState("saved");
      return true;
    }
    setSaveState("error");
    toast.error(`${C.saveError}: ${res.errors.map((e) => e.path || e.message).join(", ")}`);
    return false;
  };

  // Autosave com debounce a cada edição da etapa atual.
  useEffect(() => {
    if (!dirty.current || !hasSection) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // persist depende de profile, que é o gatilho aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const onChange = (next: Profile) => {
    dirty.current = true;
    setProfile(next);
  };

  const go = async (target: StepIndex | "done", save: boolean) => {
    setBusy(true);
    try {
      if (save && !(await persist())) return;
      if (target !== "done") {
        router.push(`/onboarding/${target}`);
        return;
      }
      const res = await finishOnboarding();
      if (res.ok) router.push("/vagas");
      else toast.error(`${C.finishMissing} ${res.missing.map((m) => C.missing[m]).join(", ")}`);
    } finally {
      setBusy(false);
    }
  };

  const body = (() => {
    const props = { profile, onChange };
    switch (step) {
      case 0:
        return <BridgeSetup privacyAccepted={privacyAccepted} />;
      case 1:
        return <StepImport {...props} needsBridge={needsBridge} />;
      case 2:
        return <StepPersonal {...props} />;
      case 3:
        return <StepExperiences {...props} />;
      case 4:
        return <StepSkills {...props} />;
      case 5:
        return <StepEducation {...props} />;
      case 6:
        return <StepPreferences {...props} />;
      case 7:
        return <StepAnswers {...props} />;
    }
  })();

  const last = nextStep(step) === "done";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <Briefcase className="size-4" />
          </span>
          <span className="text-sm font-semibold">{C.brand}</span>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {C.progress(step + 1, STEPS.length)}
            {hasSection && saveState !== "idle" && (
              <> · {saveState === "saving" ? C.saving : saveState === "error" ? C.saveError : C.saved}</>
            )}
          </span>
          <ThemeToggle />
        </div>
        <div className="bg-muted h-[3px]">
          <div className="bg-primary h-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 md:grid-cols-[15rem_1fr]">
        <nav className="hidden flex-col gap-0.5 border-r p-4 md:flex" aria-label="Etapas">
          {STEPS.map((s) => {
            const done = completed.includes(s.index) && s.index !== step;
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => void go(s.index, dirty.current)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm",
                  s.index === step ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    done && "border-transparent bg-emerald-500 text-white",
                    s.index === step && "border-primary text-primary",
                    !done && s.index !== step && "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : s.index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{s.label}</span>
                  <span className="text-muted-foreground block truncate text-[11px] font-normal">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <main className="flex min-w-0 flex-col gap-6 p-4 md:p-8">
          {body}
          <footer className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="ghost" disabled={busy || step === 0} onClick={() => void go(prevStep(step), true)}>
              ← {C.back}
            </Button>
            <span className="flex-1" />
            {!last && (
              <Button variant="ghost" disabled={busy} onClick={() => void go(nextStep(step), false)}>
                {C.skip}
              </Button>
            )}
            <Button disabled={busy} onClick={() => void go(nextStep(step), true)}>
              {last ? C.finish : `${C.next} →`}
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}
