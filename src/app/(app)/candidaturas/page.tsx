import type { Metadata } from "next";
import { listApplications } from "@/server/applications/list";
import { pageDb } from "@/server/page-db";
import { ApplicationsView } from "./applications-view";

export const metadata: Metadata = { title: "Candidaturas" };

export default async function CandidaturasPage() {
  return <ApplicationsView initial={listApplications(await pageDb())} />;
}
