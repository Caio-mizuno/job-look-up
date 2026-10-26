import type { Db } from "@/server/db/client";
import type { Profile } from "@/server/profile/schema";
import { enabledSourceIdsJson } from "@/server/sources/settings";
import { THEMES, type Tech } from "./catalog";

export type TechStat = { name: string; jobs: number; inProfile: boolean };
/** lacuna = alguma das 3 tecnologias mais pedidas do tema não está no perfil. */
export type ThemeStat = { id: string; label: string; jobs: number; priority: "lacuna" | "revisao"; techs: TechStat[] };
export type TechStats = { totalJobs: number; themes: ThemeStat[] };

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Nome inteiro: "java" não conta dentro de "javascript" nem "react" dentro de "reactive". */
function hasWord(lower: string, word: string): boolean {
  for (let i = lower.indexOf(word); i !== -1; i = lower.indexOf(word, i + 1)) {
    const before = lower[i - 1];
    const after = lower[i + word.length];
    if ((!before || !WORD_CHAR.test(before)) && (!after || !WORD_CHAR.test(after))) return true;
  }
  return false;
}

function mentions(tech: Tech, text: string, lower: string): boolean {
  return tech.match.some((m) => (typeof m === "string" ? hasWord(lower, m) : m.test(text)));
}

const BY_NAME = new Map(THEMES.flatMap((theme) => theme.techs).map((tech) => [tech.name, tech] as const));

function known(tech: Tech, text: string, lower: string): boolean {
  if (mentions(tech, text, lower)) return true;
  return (tech.knownWith ?? []).some((name) => {
    const base = BY_NAME.get(name);
    return base ? mentions(base, text, lower) : false;
  });
}

function profileText(p: Profile): string {
  return [...p.skills.map((s) => s.name), ...p.experiences.flatMap((e) => e.technologies)].join(" · ");
}

/** Em quantas vagas da listagem (fontes ligadas, sem descartadas) cada tecnologia e cada tema aparecem. */
export function techStats(db: Db, profile: Profile | null): TechStats {
  const rows = db.$client
    .prepare(
      "select title, coalesce(description_text, '') as description from jobs where status != 'discarded' and source in (select value from json_each(?))",
    )
    .all(enabledSourceIdsJson(db)) as { title: string; description: string }[];
  const texts = rows.map((r) => {
    const text = `${r.title}\n${r.description}`;
    return { text, lower: text.toLowerCase() };
  });
  const mine = profile ? profileText(profile) : "";
  const mineLower = mine.toLowerCase();

  const themes: ThemeStat[] = [];
  for (const theme of THEMES) {
    const hits = theme.techs.map((tech) => texts.map((x) => mentions(tech, x.text, x.lower)));
    const jobs = texts.filter((_, i) => hits.some((h) => h[i])).length;
    if (!jobs) continue;
    const techs = theme.techs
      .map((tech, k) => ({ name: tech.name, jobs: hits[k].filter(Boolean).length, inProfile: known(tech, mine, mineLower) }))
      .filter((x) => x.jobs > 0)
      .sort((a, b) => b.jobs - a.jobs);
    const priority = techs.slice(0, 3).some((x) => !x.inProfile) ? "lacuna" : "revisao";
    themes.push({ id: theme.id, label: theme.label, jobs, priority, techs });
  }
  themes.sort((a, b) => b.jobs - a.jobs);
  return { totalJobs: rows.length, themes };
}
