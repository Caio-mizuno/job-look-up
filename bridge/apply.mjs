// Executor de candidatura: Claude in Chrome preenche o formulário e envia quando está completo.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApplyArgs, spawnClaude } from "./claude.mjs";

export const APPLY_TIMEOUT_MS = 600_000;
const TEMPLATE = readFileSync(new URL("./apply-prompt.md", import.meta.url), "utf8");
const STATUSES = new Set(["submitted", "needs_review", "login_required", "blocked", "error"]);

/** Mesma regra do app, repetida aqui por defesa: LinkedIn e URLs não http(s) nunca vão para o Chrome. */
export function isAutoApplyAllowed(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && !/(^|\.)linkedin\.com$|^lnkd\.in$/i.test(u.hostname);
  } catch {
    return false;
  }
}

const safeName = (name) => (name || "curriculo.pdf").replace(/[^\w.-]+/g, "_").slice(0, 80);

export function renderApplyPrompt(template, payload, cvPath) {
  const { cv: _cv, ...rest } = payload;
  return template
    .replaceAll("{{JOB_URL}}", payload.jobUrl)
    .replaceAll("{{CV_PATH}}", cvPath ?? "(sem currículo: deixe o campo de anexo em branco e liste em unanswered)")
    .replaceAll("{{PAYLOAD_JSON}}", JSON.stringify(rest, null, 2));
}

/** Pega o último bloco ```json; sem bloco, o último objeto {…} balanceado do texto. */
export function extractReport(text) {
  const blocks = [...String(text ?? "").matchAll(/```json\s*([\s\S]*?)```/g)];
  for (const m of blocks.reverse()) {
    try {
      return JSON.parse(m[1]);
    } catch {
      // tenta o anterior
    }
  }
  const s = String(text ?? "");
  for (let end = s.lastIndexOf("}"); end >= 0; end = s.lastIndexOf("}", end - 1)) {
    let depth = 0;
    for (let i = end; i >= 0; i--) {
      if (s[i] === "}") depth++;
      else if (s[i] === "{" && --depth === 0) {
        try {
          return JSON.parse(s.slice(i, end + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

const errorReport = (notes) => ({ status: "error", filled: [], drafted: [], unanswered: [], notes });

function normalizeReport(raw) {
  if (!raw || !STATUSES.has(raw.status)) return null;
  const list = (v) => (Array.isArray(v) ? v.map(String) : []);
  return {
    status: raw.status,
    filled: list(raw.filled),
    drafted: list(raw.drafted),
    unanswered: list(raw.unanswered),
    notes: String(raw.notes ?? ""),
  };
}

/**
 * @param {object} payload ApplyPayload vindo do app
 * @param {{ spawn?: typeof spawnClaude, onEvent?: (e: {at:number, kind:string, text:string}) => void, tmpRoot?: string }} [deps]
 */
export async function runApply(payload, { spawn = spawnClaude, onEvent = () => {}, tmpRoot = tmpdir() } = {}) {
  if (!isAutoApplyAllowed(payload.jobUrl)) return { ...errorReport("linkedin"), status: "blocked" };

  const cwd = await mkdtemp(join(tmpRoot, "jl-apply-"));
  try {
    const cvDir = join(cwd, "cv");
    await mkdir(cvDir);
    let cvPath = null;
    if (payload.cv?.base64) {
      cvPath = join(cvDir, safeName(payload.cv.filename));
      await writeFile(cvPath, Buffer.from(payload.cv.base64, "base64"), { mode: 0o600 });
    }

    let resultText = "";
    let resultError = null;
    const onLine = (line) => {
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (ev.type === "result") {
        resultText = String(ev.result ?? "");
        if (ev.is_error) resultError = resultText.trim().slice(0, 300) || "erro do Claude Code";
      }
      if (ev.type !== "assistant") return;
      for (const c of ev.message?.content ?? []) {
        if (c.type === "text" && c.text?.trim()) onEvent({ at: Date.now(), kind: "text", text: c.text.trim().slice(0, 300) });
        if (c.type === "tool_use") onEvent({ at: Date.now(), kind: "tool", text: String(c.name).replace("mcp__claude-in-chrome__", "") });
      }
    };

    try {
      await spawn(buildApplyArgs(cvDir), {
        stdin: renderApplyPrompt(TEMPLATE, payload, cvPath),
        timeoutMs: APPLY_TIMEOUT_MS,
        cwd,
        onLine,
      });
    } catch (err) {
      return errorReport(err instanceof Error && err.message === "timeout" ? "timeout" : String(err?.message ?? err));
    }
    // Limite do plano, login expirado etc.: o motivo real chega à tela de Candidaturas.
    if (resultError) return errorReport(resultError);
    return normalizeReport(extractReport(resultText)) ?? errorReport("o Claude terminou sem relatório");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
