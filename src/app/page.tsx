import { redirect } from "next/navigation";
import { pageDb } from "@/server/page-db";
import { isSearchReady } from "@/server/profile/readiness";
import { getProfile } from "@/server/profile/repo";

export default async function Home() {
  const profile = getProfile(await pageDb());
  redirect(profile && isSearchReady(profile.data).ready ? "/vagas" : "/onboarding/0");
}
