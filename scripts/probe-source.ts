// Utilitário de desenvolvimento: npx tsx scripts/probe-source.ts <fonte> "<palavras-chave>"
import { createBrowserRunner } from "../bridge/browser.mjs";
import { createHttp } from "@/server/sources/http";
import { SOURCES } from "@/server/sources/registry";
import type { SourceContext } from "@/server/sources/types";

const [id, keywords = "desenvolvedor"] = process.argv.slice(2);
const source = SOURCES.find((s) => s.id === id);
if (!source) {
  console.error(`fonte desconhecida: ${id}. Opções: ${SOURCES.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

async function main(src: NonNullable<typeof source>) {
  const http = createHttp();
  // Indeed e Glassdoor: abre o Chrome direto, como o ajudante faria (perfil à parte para não brigar com ele).
  const runner = createBrowserRunner({ profileDir: "data/chrome-profile-probe" });
  const ctx: SourceContext = {
    browser: {
      async getHtml(url, { waitFor }) {
        const page = await runner.run({ url, waitFor });
        if (page.blocked || !page.html) throw new Error(page.blocked ? "bloqueada pela verificação anti-robô" : `HTTP ${page.status}`);
        return page.html;
      },
    },
  };
  const t0 = Date.now();
  try {
    const jobs = await src.search({ keywords, location: null }, 1, http, ctx);
    console.log(`${src.label}: ${jobs.length} vagas em ${Date.now() - t0} ms`);
    for (const j of jobs.slice(0, 3)) console.log(` - ${j.title} · ${j.company ?? "?"} · ${j.location ?? "?"}`);
  } catch (err) {
    console.error(`${src.label}: ${err instanceof Error ? `${err.constructor.name}: ${err.message}` : err}`);
    process.exitCode = 2;
  } finally {
    await runner.close();
  }
}

void main(source);
