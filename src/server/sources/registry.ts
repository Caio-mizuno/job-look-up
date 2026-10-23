import { arbeitnowSource } from "./arbeitnow";
import { bneSource } from "./bne";
import { cathoSource } from "./catho";
import { coodeshSource } from "./coodesh";
import { empregosSource } from "./empregos";
import { geekhunterSource } from "./geekhunter";
import { glassdoorSource } from "./glassdoor";
import { gupySource } from "./gupy";
import { himalayasSource } from "./himalayas";
import { indeedSource } from "./indeed";
import { infojobsSource } from "./infojobs";
import { jobicySource } from "./jobicy";
import { linkedinSource } from "./linkedin";
import { linkedinPostsSource } from "./linkedin-posts";
import { netvagasSource } from "./netvagas";
import { programathorSource } from "./programathor";
import { remotarSource } from "./remotar";
import { remoteokSource } from "./remoteok";
import { remotiveSource } from "./remotive";
import { solidesSource } from "./solides";
import { tramposSource } from "./trampos";
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
  netvagasSource,
  cathoSource,
  bneSource,
  empregosSource,
  solidesSource,
  geekhunterSource,
  tramposSource,
  remotarSource,
  remotiveSource,
  remoteokSource,
  himalayasSource,
  weworkremotelySource,
  workingnomadsSource,
  jobicySource,
  arbeitnowSource,
  coodeshSource,
  linkedinSource,
  indeedSource,
  glassdoorSource,
  linkedinPostsSource,
];

export function getSource(id: SourceId | string): JobSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
