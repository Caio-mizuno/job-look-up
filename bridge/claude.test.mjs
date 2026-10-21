import { describe, expect, it } from "vitest";
import { buildLlmArgs, spawnClaude } from "./claude.mjs";

describe("buildLlmArgs", () => {
  it("never uses --bare and isolates settings", () => {
    const a = buildLlmArgs({ model: "haiku", system: "s", jsonSchema: { type: "object" } });
    expect(a).not.toContain("--bare");
    for (const f of ["-p", "--tools", "--setting-sources", "--strict-mcp-config", "--no-session-persistence", "--json-schema"]) {
      expect(a).toContain(f);
    }
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(a[a.indexOf("--model") + 1]).toBe("haiku");
    expect(a[a.indexOf("--setting-sources") + 1]).toBe("project");
    expect(JSON.parse(a[a.indexOf("--json-schema") + 1])).toEqual({ type: "object" });
  });

  it("does not put the input in argv", () => {
    const a = buildLlmArgs({ model: "sonnet", system: "s", jsonSchema: {} });
    expect(a.join(" ")).not.toContain("SEGREDO");
  });
});

describe("spawnClaude", () => {
  it("passes stdin and returns stdout", async () => {
    const res = await spawnClaude(["-e", "process.stdin.pipe(process.stdout)"], {
      stdin: "olá",
      timeoutMs: 5000,
      command: process.execPath,
    });
    expect(res.code).toBe(0);
    expect(res.stdout).toBe("olá");
  });

  it("calls onLine per stdout line", async () => {
    const lines = [];
    await spawnClaude(["-e", "console.log('a');console.log('b')"], {
      stdin: "",
      timeoutMs: 5000,
      command: process.execPath,
      onLine: (l) => lines.push(l),
    });
    expect(lines).toEqual(["a", "b"]);
  });

  it("enforces timeout", async () => {
    await expect(
      spawnClaude(["-e", "setTimeout(()=>{}, 10000)"], { stdin: "", timeoutMs: 100, command: process.execPath }),
    ).rejects.toThrow("timeout");
  });
});
