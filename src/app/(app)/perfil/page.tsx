import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchQueriesEditor } from "@/components/profile/search-queries-editor";
import { pageDb } from "@/server/page-db";
import { listQueries } from "@/server/pipeline/queries";
import { getProfile } from "@/server/profile/repo";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const db = await pageDb();
  const profile = getProfile(db);
  if (!profile) redirect("/onboarding/0");
  return <ProfileEditor initial={profile.data} queriesSlot={<SearchQueriesEditor initial={listQueries(db)} />} />;
}
