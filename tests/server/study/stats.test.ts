import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { setSourceEnabled } from "@/server/sources/settings";
import { techStats } from "@/server/study/stats";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

const NOW = Date.UTC(2026, 9, 21, 12);

let seq = 0;
function job(db: Db, title: string, description: string, over: Record<string, unknown> = {}) {
  seq += 1;
  const row = {
    source: "gupy",
    url: `https://g.example/${seq}`,
    dedupe_key: `k${seq}`,
    title,
    description_text: description,
    local_score: 0,
    status: "new",
    first_seen_at: NOW,
    last_seen_at: NOW,
    ...over,
  };
  const cols = Object.keys(row);
  db.$client.prepare(`insert into jobs (${cols.join(",")}) values (${cols.map(() => "?").join(",")})`).run(...Object.values(row));
}

const techs = (s: ReturnType<typeof techStats>, theme: string) =>
  s.themes.find((t) => t.id === theme)?.techs.map((t) => [t.name, t.jobs]) ?? [];

describe("techStats", () => {
  it("counts in how many listed jobs each technology and theme appear", () => {
    const db = memDb();
    job(db, "Dev Front-end React", "Experiência com Redux e TypeScript.");
    job(db, "Dev React", "Zustand ou Context API. Jotai é diferencial.");
    job(db, "Dev PHP", "Laravel e MySQL.");

    const s = techStats(db, null);

    expect(s.totalJobs).toBe(3);
    const state = s.themes.find((t) => t.id === "state")!;
    expect(state).toMatchObject({ label: "Controle de estado", jobs: 2 });
    expect(techs(s, "state")).toEqual([
      ["Redux", 1],
      ["Zustand", 1],
      ["Jotai", 1],
      ["Context API", 1],
    ]);
    expect(techs(s, "frontend")).toEqual([["React", 2]]);
    expect(s.themes.map((t) => t.jobs)).toEqual([...s.themes.map((t) => t.jobs)].sort((a, b) => b - a));
  });

  it("leaves out discarded jobs and jobs from disabled sources", () => {
    const db = memDb();
    job(db, "Dev React", "React");
    job(db, "Dev React", "React", { status: "discarded" });
    job(db, "Dev React", "React", { source: "himalayas" });
    setSourceEnabled(db, "himalayas", false);

    const s = techStats(db, null);

    expect(s.totalJobs).toBe(1);
    expect(techs(s, "frontend")).toEqual([["React", 1]]);
  });

  it("matches whole names only", () => {
    const db = memDb();
    job(db, "Dev JavaScript", "Let's go! The rest of the team is good and we love reactive minds.");
    job(db, "Dev Back-end", "APIs REST em Go (Golang), C# com .NET e Node.js.");

    const s = techStats(db, null);

    expect(techs(s, "languages")).toEqual([
      ["JavaScript", 1],
      ["C#", 1],
      ["Go", 1],
    ]);
    expect(techs(s, "apis")).toEqual([["REST", 1]]);
    expect(techs(s, "frontend")).toEqual([]);
    expect(techs(s, "backend")).toEqual([
      ["Node.js", 1],
      [".NET", 1],
    ]);
  });

  it("marks what the profile already has and puts themes with gaps first in line", () => {
    const db = memDb();
    job(db, "Dev PHP", "Laravel, PostgreSQL e Docker.");
    job(db, "Dev PHP", "Laravel, Docker e Kubernetes.");

    const s = techStats(db, sampleProfile());

    const backend = s.themes.find((t) => t.id === "backend")!;
    expect(backend.techs).toEqual([{ name: "Laravel", jobs: 2, inProfile: true }]);
    expect(backend.priority).toBe("revisao");
    const devops = s.themes.find((t) => t.id === "devops")!;
    expect(devops.techs).toEqual([
      { name: "Docker", jobs: 2, inProfile: true },
      { name: "Kubernetes", jobs: 1, inProfile: false },
    ]);
    expect(devops.priority).toBe("lacuna");
    expect(s.themes.find((t) => t.id === "databases")!.priority).toBe("revisao");
  });

  it("counts a base technology as known when the profile has one built on it", () => {
    const db = memDb();
    job(db, "Dev", "JavaScript, HTML, CSS e SQL.");

    const s = techStats(db, sampleProfile({ skills: [{ name: "TypeScript", years: 3, level: "avancado" }, { name: "MySQL", years: 5, level: "avancado" }], experiences: [] }));

    const known = s.themes.flatMap((t) => t.techs).map((t) => [t.name, t.inProfile]);
    expect(known).toEqual(expect.arrayContaining([["JavaScript", true], ["SQL", true], ["HTML", false], ["CSS", false]]));
  });

  it("treats every theme as a gap when there is no profile", () => {
    const db = memDb();
    job(db, "Dev", "Laravel");
    expect(techStats(db, null).themes[0]).toMatchObject({ id: "backend", priority: "lacuna" });
  });
});
