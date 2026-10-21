import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLlmCall } from "./llm.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const fakeSpawn = (stdout, code = 0) => async (args, opts) => ({ code, stdout, stderr: "", args, opts });
const payload = { model: "haiku", system: "s", input: "Diga ok", jsonSchema: { type: "object" } };

describe("runLlmCall", () => {
  it("returns structured_output and usage", async () => {
    const res = await runLlmCall(payload, { spawn: fakeSpawn(fixture("llm-ok.json")) });
    expect(res.structured).toEqual({ ok: true });
    expect(res.usage.outputTokens).toBeGreaterThan(0);
    expect(res.usage.inputTokens).toBeGreaterThan(0);
    expect(typeof res.usage.costUsd).toBe("number");
  });

  it("sends the input through stdin", async () => {
    let seen;
    await runLlmCall(payload, {
      spawn: async (args, opts) => {
        seen = { args, opts };
        return { code: 0, stdout: fixture("llm-ok.json"), stderr: "" };
      },
    });
    expect(seen.opts.stdin).toBe("Diga ok");
    expect(seen.args).not.toContain("Diga ok");
  });

  it("throws result text on is_error", async () => {
    await expect(runLlmCall(payload, { spawn: fakeSpawn(fixture("llm-error.json")) })).rejects.toThrow(/usage limit/);
  });

  it("throws readable error on non-JSON stdout", async () => {
    await expect(runLlmCall(payload, { spawn: fakeSpawn("Error: something broke badly", 1) })).rejects.toThrow(
      /Error: something broke badly/,
    );
  });

  it("throws when structured_output is missing", async () => {
    const noStruct = JSON.stringify({ type: "result", is_error: false, result: "texto livre", usage: {} });
    await expect(runLlmCall(payload, { spawn: fakeSpawn(noStruct) })).rejects.toThrow(/structured_output/);
  });
});
