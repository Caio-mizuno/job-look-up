"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db/client";
import { setSetting } from "@/server/settings";

export async function acceptBridgePrivacy(): Promise<void> {
  setSetting(getDb(), "bridge.privacyAcceptedAt", Date.now());
  refresh();
}
