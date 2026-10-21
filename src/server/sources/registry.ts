import { arbeitnowSource } from "./arbeitnow";
import { gupySource } from "./gupy";
import { himalayasSource } from "./himalayas";
import { linkedinSource } from "./linkedin";
import { programathorSource } from "./programathor";
import { remoteokSource } from "./remoteok";
import { remotiveSource } from "./remotive";
import type { JobSource, SourceId } from "./types";

export const SOURCES: JobSource[] = [
  gupySource,
  programathorSource,
  remotiveSource,
  remoteokSource,
  himalayasSource,
  arbeitnowSource,
  linkedinSource,
];

export function getSource(id: SourceId | string): JobSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
