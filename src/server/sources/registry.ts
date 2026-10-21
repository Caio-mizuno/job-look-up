import { gupySource } from "./gupy";
import { linkedinSource } from "./linkedin";
import { programathorSource } from "./programathor";
import type { JobSource, SourceId } from "./types";

export const SOURCES: JobSource[] = [gupySource, programathorSource, linkedinSource];

export function getSource(id: SourceId): JobSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
