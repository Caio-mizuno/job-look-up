import type { Db } from "@/server/db/client";
import { getSetting, setSetting } from "@/server/settings";

export const BRIDGE_OFFLINE_AFTER_MS = 10_000;

export function touchBridge(db: Db, now: number): void {
  setSetting(db, "bridge.lastSeenAt", now);
}

export function isBridgeOnline(db: Db, now: number): boolean {
  return now - getSetting(db, "bridge.lastSeenAt") <= BRIDGE_OFFLINE_AFTER_MS;
}
