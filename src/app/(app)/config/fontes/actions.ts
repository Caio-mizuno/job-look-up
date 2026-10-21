"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db/client";
import { getSource } from "@/server/sources/registry";
import { setSourceEnabled } from "@/server/sources/settings";
import type { SourceId } from "@/server/sources/types";

export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  if (!getSource(id)) throw new Error("fonte desconhecida");
  setSourceEnabled(getDb(), id as SourceId, enabled);
  refresh();
}
