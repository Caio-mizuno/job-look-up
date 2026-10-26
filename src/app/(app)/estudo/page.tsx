import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudyView } from "@/components/study/study-view";
import { pageDb } from "@/server/page-db";
import { getProfile } from "@/server/profile/repo";
import { getStudyPlan } from "@/server/study/generate";
import { techStats } from "@/server/study/stats";

export const metadata: Metadata = { title: "Estudo" };

export default async function EstudoPage() {
  const db = await pageDb();
  const profile = getProfile(db);
  if (!profile) redirect("/onboarding/0");
  return <StudyView stats={techStats(db, profile.data)} initial={getStudyPlan(db)} />;
}
