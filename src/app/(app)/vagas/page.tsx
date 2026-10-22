import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JobList } from "@/components/jobs/job-list";
import { consumeLastVisit, countDiscarded, listJobs } from "@/server/jobs/list";
import { pageDb } from "@/server/page-db";
import { getProfile } from "@/server/profile/repo";

export const metadata: Metadata = { title: "Vagas encontradas" };

export default async function VagasPage() {
  const db = await pageDb();
  const profile = getProfile(db);
  if (!profile) redirect("/onboarding/0");

  // "Nova" = vista pela primeira vez depois da visita anterior.
  const lastVisitAt = consumeLastVisit(db);
  const initial = listJobs(db, { sort: "match" }, { profileVersion: profile.version, lastVisitAt });

  const skills = [
    ...new Set([...profile.data.skills.map((s) => s.name), ...profile.data.experiences.flatMap((e) => e.technologies)]),
  ].slice(0, 6);

  return (
    <JobList
      initialItems={initial.items}
      initialCursor={initial.nextCursor}
      lastVisitAt={lastVisitAt}
      discardedCount={countDiscarded(db)}
      profile={{ name: profile.data.personal.name || "Seu perfil", headline: profile.data.headline, skills }}
    />
  );
}
