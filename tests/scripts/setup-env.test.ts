import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sem tipos
import { setupEnv } from "../../scripts/setup-env.mjs";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "jl-env-"));
  const examplePath = join(dir, ".env.example");
  const envPath = join(dir, ".env");
  writeFileSync(examplePath, "APP_KEY=\nBRIDGE_TOKEN=\nAPP_URL=http://127.0.0.1:3000\n");
  return { examplePath, envPath };
}

function parse(path: string) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

describe("setupEnv", () => {
  it("creates .env with random keys", () => {
    const f = fixture();
    const res = setupEnv(f);
    expect(res.created).toBe(true);
    const env = parse(f.envPath);
    expect(env.APP_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(env.BRIDGE_TOKEN).toMatch(/^[0-9a-f]{64}$/);
    expect(env.APP_KEY).not.toBe(env.BRIDGE_TOKEN);
    expect(env.APP_URL).toBe("http://127.0.0.1:3000");
  });

  it("is idempotent and only fills missing", () => {
    const f = fixture();
    setupEnv(f);
    const before = parse(f.envPath);
    const again = setupEnv(f);
    expect(again.created).toBe(false);
    expect(again.added).toEqual([]);
    expect(parse(f.envPath)).toEqual(before);

    writeFileSync(f.envPath, `APP_KEY=${before.APP_KEY}\nAPP_URL=http://127.0.0.1:3000\n`);
    const fixed = setupEnv(f);
    expect(fixed.added).toEqual(["BRIDGE_TOKEN"]);
    const after = parse(f.envPath);
    expect(after.APP_KEY).toBe(before.APP_KEY);
    expect(after.BRIDGE_TOKEN).toMatch(/^[0-9a-f]{64}$/);
  });
});
