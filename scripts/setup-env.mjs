#!/usr/bin/env node
// Cria/completa o .env a partir do .env.example, gerando segredos aleatórios.
// Idempotente: nunca troca um valor que já existe.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SECRETS = new Set(["APP_KEY", "BRIDGE_TOKEN"]);

function parse(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    entries.push([trimmed.slice(0, i), trimmed.slice(i + 1)]);
  }
  return entries;
}

const secret = () => randomBytes(32).toString("hex");

export function setupEnv({ examplePath, envPath }) {
  const example = parse(readFileSync(examplePath, "utf8"));
  const created = !existsSync(envPath);
  const current = created ? [] : parse(readFileSync(envPath, "utf8"));
  const values = new Map(current);
  const added = [];

  for (const [key, exampleValue] of example) {
    const has = values.has(key) && values.get(key) !== "";
    if (has) continue;
    values.set(key, SECRETS.has(key) ? secret() : exampleValue);
    if (!created) added.push(key);
  }

  const body = [...values.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  if (created || added.length > 0) writeFileSync(envPath, body, { mode: 0o600 });
  return { created, added };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const res = setupEnv({ examplePath: resolve(root, ".env.example"), envPath: resolve(root, ".env") });
  if (res.created) console.log("[setup] .env criado com segredos novos");
  else if (res.added.length) console.log(`[setup] .env completado: ${res.added.join(", ")}`);
  else console.log("[setup] .env já está completo");
}
