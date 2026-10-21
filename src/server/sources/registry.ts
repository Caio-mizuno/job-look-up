import { arbeitnowSource } from "./arbeitnow";
import { glassdoorSource } from "./glassdoor";
import { gupySource } from "./gupy";
import { himalayasSource } from "./himalayas";
import { indeedSource } from "./indeed";
import { infojobsSource } from "./infojobs";
import { jobicySource } from "./jobicy";
import { linkedinSource } from "./linkedin";
import { programathorSource } from "./programathor";
import { remoteokSource } from "./remoteok";
import { remotiveSource } from "./remotive";
import type { JobSource, SourceId } from "./types";
import { vagascomSource } from "./vagascom";
import { weworkremotelySource } from "./weworkremotely";
import { workingnomadsSource } from "./workingnomads";

/** Brasileiras primeiro, depois as remotas internacionais; as desligadas por padrão no fim. */
export const SOURCES: JobSource[] = [
  gupySource,
  programathorSource,
  vagascomSource,
  infojobsSource,
  remotiveSource,
  remoteokSource,
  himalayasSource,
  weworkremotelySource,
  workingnomadsSource,
  jobicySource,
  arbeitnowSource,
  linkedinSource,
  indeedSource,
  glassdoorSource,
];

export function getSource(id: SourceId | string): JobSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
