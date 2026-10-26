import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoverLetterEditor } from "@/components/cover-letter/cover-letter-editor";
import { getCoverLetter } from "@/server/cover-letter/generate";
import { pageDb } from "@/server/page-db";
import { getProfile } from "@/server/profile/repo";

export const metadata: Metadata = { title: "Carta de apresentação" };

export default async function CartaPage() {
  const db = await pageDb();
  if (!getProfile(db)) redirect("/onboarding/0");
  return <CoverLetterEditor initial={getCoverLetter(db)} />;
}
