import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageDb } from "@/server/page-db";
import { getProfile } from "@/server/profile/repo";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const profile = getProfile(await pageDb());
  if (!profile) redirect("/onboarding/0");
  return <ProfileEditor initial={profile.data} />;
}
