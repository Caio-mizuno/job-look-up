// Utilitário de desenvolvimento: npx tsx scripts/probe-source.ts <fonte> "<palavras-chave>"
import { createHttp } from "@/server/sources/http";
import { SOURCES } from "@/server/sources/registry";

const [id, keywords = "desenvolvedor"] = process.argv.slice(2);
const source = SOURCES.find((s) => s.id === id);
if (!source) {
  console.error(`fonte desconhecida: ${id}. Opções: ${SOURCES.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

async function main(src: NonNullable<typeof source>) {
  const http = createHttp();
  const t0 = Date.now();
  try {
    const jobs = await src.search({ keywords, location: null }, 1, http);
    console.log(`${src.label}: ${jobs.length} vagas em ${Date.now() - t0} ms`);
    for (const j of jobs.slice(0, 3)) console.log(` - ${j.title} · ${j.company ?? "?"} · ${j.location ?? "?"}`);
  } catch (err) {
    console.error(`${src.label}: ${err instanceof Error ? `${err.constructor.name}: ${err.message}` : err}`);
    process.exitCode = 2;
  }
}

void main(source);
