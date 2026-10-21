import { describe, expect, it } from "vitest";
import { AuthError, createAppClient } from "./http.mjs";

const client = (status, body) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, c: createAppClient({ baseUrl: "http://app", token: "tok", fetchImpl }) };
};

describe("createAppClient", () => {
  it("next maps 204 to null and sends token + accept", async () => {
    const { c, calls } = client(204);
    expect(await c.next(["llm_call", "apply"])).toBeNull();
    expect(calls[0].url).toBe("http://app/api/bridge/next?accept=llm_call,apply");
    expect(calls[0].init.headers.authorization).toBe("Bearer tok");
  });

  it("next maps 200 to task", async () => {
    const { c } = client(200, { id: 1, type: "llm_call", payload: { a: 1 } });
    expect(await c.next(["llm_call"])).toEqual({ id: 1, type: "llm_call", payload: { a: 1 } });
  });

  it("next maps 401 to AuthError", async () => {
    const { c } = client(401);
    await expect(c.next([])).rejects.toBeInstanceOf(AuthError);
    await expect(c.next([])).rejects.toThrow("BRIDGE_TOKEN não confere com o .env do app");
  });

  it("postResult posts JSON", async () => {
    const { c, calls } = client(204);
    await c.postResult(7, { ok: true, result: { x: 1 } });
    expect(calls[0].url).toBe("http://app/api/bridge/tasks/7/result");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body)).toEqual({ ok: true, result: { x: 1 } });
  });
});
