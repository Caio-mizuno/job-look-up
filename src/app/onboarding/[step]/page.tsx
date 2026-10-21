import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isStep } from "@/components/onboarding/steps";
import { Wizard } from "@/components/onboarding/wizard";
import { pageDb } from "@/server/page-db";
import { getProfile } from "@/server/profile/repo";
import { emptyProfile } from "@/server/profile/schema";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Montar perfil" };

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const step = Number((await params).step);
  if (!isStep(step)) notFound();
  const db = await pageDb();

  return (
    <Wizard
      key={step}
      step={step}
      initialProfile={getProfile(db)?.data ?? emptyProfile()}
      completed={getSetting(db, "onboarding.completedSteps")}
      privacyAccepted={getSetting(db, "bridge.privacyAcceptedAt") !== null}
      needsBridge={getSetting(db, "llm.provider") === "claude-code"}
    />
  );
}
