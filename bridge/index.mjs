#!/usr/bin/env node
// Ajudante do job-look-up: roda no host, busca tarefas no app e executa o Claude Code.
import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AuthError, createAppClient } from "./http.mjs";
import { runLlmCall } from "./llm.mjs";

const POLL_MS = 2000;
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Executores por tipo de tarefa e quantas rodam ao mesmo tempo. */
const EXECUTORS = {
  // 4 em paralelo: a análise das top 40 (8 lotes) fica perto de 1 minuto.
  llm_call: { slots: 4, run: (payload) => runLlmCall(payload) },
};

const log = (msg) => console.log(`[bridge] ${msg}`);

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 12)) {
    console.error(`[bridge] Node ${process.versions.node} é antigo demais: precisa de ≥ 20.12.`);
    process.exit(1);
  }
}

function loadEnv() {
  try {
    process.loadEnvFile(join(ROOT, ".env"));
  } catch {
    console.error("[bridge] .env não encontrado. Rode `make setup` (ou `make up`) primeiro.");
    process.exit(1);
  }
  if (!process.env.BRIDGE_TOKEN) {
    console.error("[bridge] BRIDGE_TOKEN vazio no .env. Rode `make setup`.");
    process.exit(1);
  }
}

async function checkClaude() {
  try {
    const { stdout } = await promisify(execFile)("claude", ["--version"]);
    log(`Claude Code ${stdout.trim()}`);
  } catch {
    console.error("[bridge] Comando `claude` não encontrado. Instale e faça login no Claude Code.");
    process.exit(1);
  }
}

export async function main() {
  checkNode();
  loadEnv();
  await checkClaude();

  const baseUrl = process.env.APP_URL || "http://127.0.0.1:3000";
  const client = createAppClient({ baseUrl, token: process.env.BRIDGE_TOKEN });
  const busy = Object.fromEntries(Object.keys(EXECUTORS).map((t) => [t, 0]));
  const inFlight = new Set();
  let stopped = false;
  let appDown = false;

  const start = (task) => {
    busy[task.type]++;
    const t0 = Date.now();
    const p = EXECUTORS[task.type]
      .run(task.payload, task)
      .then((result) => client.postResult(task.id, { ok: true, result }).then(() => "ok"))
      .catch((err) => {
        const error = err instanceof Error ? err.message : String(err);
        return client.postResult(task.id, { ok: false, error }).then(() => `erro: ${error}`);
      })
      .then((status) => log(`${task.type} #${task.id} ${status} ${((Date.now() - t0) / 1000).toFixed(1)}s`))
      .catch((err) => log(`${task.type} #${task.id} não consegui reportar: ${err.message}`))
      .finally(() => {
        busy[task.type]--;
        inFlight.delete(p);
      });
    inFlight.add(p);
  };

  const tick = async () => {
    try {
      // Pede tarefas até encher as vagas livres; sem vagas, o poll vazio serve de heartbeat.
      for (;;) {
        const accept = Object.keys(EXECUTORS).filter((t) => busy[t] < EXECUTORS[t].slots);
        const task = await client.next(accept);
        if (appDown) {
          appDown = false;
          log(`conectado ao app em ${baseUrl}`);
        }
        if (!task) break;
        start(task);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        console.error(`[bridge] ${err.message}`);
        process.exit(1);
      }
      if (!appDown) log(`app fora do ar em ${baseUrl} (${err.message}); tentando de novo…`);
      appDown = true;
    }
  };

  const shutdown = async (signal) => {
    if (stopped) return;
    stopped = true;
    log(`${signal}: esperando ${inFlight.size} tarefa(s) em andamento…`);
    await Promise.allSettled([...inFlight]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  log(`ajudante ligado, falando com ${baseUrl}. Ctrl+C para parar.`);
  while (!stopped) {
    await tick();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
