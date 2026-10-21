// Execução do Claude Code CLI no host. Sem dependências: só módulos do Node.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Args para uma chamada de IA estruturada.
 * - Sem `--bare`: ele força ANTHROPIC_API_KEY e quebra o uso da assinatura.
 * - `--setting-sources project` num cwd vazio isola hooks/plugins do usuário.
 * - A entrada vai por stdin (não aparece em `ps` e não esbarra no limite de argv).
 * @param {{ model: "haiku" | "sonnet", system: string, jsonSchema: object }} opts
 * @returns {string[]}
 */
export function buildLlmArgs({ model, system, jsonSchema }) {
  return [
    "-p",
    "--tools", "",
    "--setting-sources", "project",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--model", model,
    "--system-prompt", system,
    "--output-format", "json",
    "--json-schema", JSON.stringify(jsonSchema),
  ];
}

/**
 * @param {string[]} args
 * @param {{ stdin: string, timeoutMs: number, onLine?: (line: string) => void, cwd?: string, command?: string }} opts
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export async function spawnClaude(args, opts) {
  const ownCwd = opts.cwd ? null : await mkdtemp(join(tmpdir(), "jl-claude-"));
  const cwd = opts.cwd ?? ownCwd;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(opts.command ?? "claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let pending = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      }, opts.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (!opts.onLine) return;
        pending += chunk;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) opts.onLine(line);
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (opts.onLine && pending.trim()) opts.onLine(pending);
        if (timedOut) reject(new Error("timeout"));
        else resolve({ code: code ?? 1, stdout, stderr });
      });

      child.stdin.end(opts.stdin);
    });
  } finally {
    if (ownCwd) await rm(ownCwd, { recursive: true, force: true });
  }
}
