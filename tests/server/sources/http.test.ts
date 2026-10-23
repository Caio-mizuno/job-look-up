import { describe, expect, it } from "vitest";
import { createHttp, HttpError, RateLimitedError } from "@/server/sources/http";

function scripted(responses: (() => Promise<Response>)[]) {
  let calls = 0;
  const fetchImpl = (async () => {
    const r = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return r();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("createHttp", () => {
  it("429 → RateLimitedError without retry", async () => {
    const s = scripted([async () => new Response("", { status: 429 })]);
    const http = createHttp({ fetchImpl: s.fetchImpl, retryDelayMs: 1 });
    await expect(http.getText("https://x/a")).rejects.toBeInstanceOf(RateLimitedError);
    expect(s.calls()).toBe(1);
  });

  it("503 then 200 → ok after retry", async () => {
    const s = scripted([async () => new Response("", { status: 503 }), async () => new Response("ok")]);
    const http = createHttp({ fetchImpl: s.fetchImpl, retryDelayMs: 1 });
    await expect(http.getText("https://x/a")).resolves.toBe("ok");
    expect(s.calls()).toBe(2);
  });

  it("404 → HttpError without retry", async () => {
    const s = scripted([async () => new Response("", { status: 404 })]);
    const http = createHttp({ fetchImpl: s.fetchImpl, retryDelayMs: 1 });
    await expect(http.getText("https://x/a")).rejects.toBeInstanceOf(HttpError);
    expect(s.calls()).toBe(1);
  });

  it("timeout → HttpError after 2 attempts", async () => {
    const s = scripted([() => new Promise<Response>(() => {})]);
    const http = createHttp({ fetchImpl: s.fetchImpl, timeoutMs: 30, retryDelayMs: 1 });
    await expect(http.getText("https://x/a")).rejects.toThrow(/timeout/);
    expect(s.calls()).toBe(2);
  });

  it("cacheTtlMs serves second call from cache", async () => {
    const s = scripted([async () => new Response('{"a":1}')]);
    const http = createHttp({ fetchImpl: s.fetchImpl });
    expect(await http.getJson("https://x/j", { cacheTtlMs: 60_000 })).toEqual({ a: 1 });
    expect(await http.getJson("https://x/j", { cacheTtlMs: 60_000 })).toEqual({ a: 1 });
    expect(s.calls()).toBe(1);
  });

  it("cacheTtlMs shares one download between concurrent calls", async () => {
    const s = scripted([async () => new Response("big")]);
    const http = createHttp({ fetchImpl: s.fetchImpl });
    const both = await Promise.all([
      http.getText("https://x/s", { cacheTtlMs: 60_000 }),
      http.getText("https://x/s", { cacheTtlMs: 60_000 }),
    ]);
    expect(both).toEqual(["big", "big"]);
    expect(s.calls()).toBe(1);
  });

  it("sends the user agent", async () => {
    let ua = "";
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      ua = new Headers(init.headers).get("user-agent") ?? "";
      return new Response("ok");
    }) as unknown as typeof fetch;
    await createHttp({ fetchImpl }).getText("https://x", { userAgent: "Teste/1.0" });
    expect(ua).toBe("Teste/1.0");
  });
});
