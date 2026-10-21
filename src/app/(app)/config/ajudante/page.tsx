import type { Metadata } from "next";
import { BridgeSetup } from "@/components/bridge-setup/bridge-setup";
import { pageDb } from "@/server/page-db";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Ajudante" };

export default async function AjudantePage() {
  const db = await pageDb();
  return <BridgeSetup privacyAccepted={getSetting(db, "bridge.privacyAcceptedAt") !== null} />;
}
