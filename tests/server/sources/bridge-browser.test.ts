import { beforeEach, describe, expect, it } from "vitest";
import { touchBridge } from "@/server/bridge/presence";
import { createBridgeBrowser } from "@/server/sources/browser";
import { HttpError, RateLimitedError } from "@/server/sources/http";
import { claimNext, completeTask, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
});

const URL_ = "https://br.indeed.com/jobs?q=php";

/** Ajudante falso: pega a próxima browser_fetch e devolve `result`. */
async function answer(db: ReturnType<typeof memDb>, result: unknown) {
  await new Promise((r) => setTimeout(r, 20));
  const task = claimNext(db, { runner: "bridge", types: ["browser_fetch"] })!;
  completeTask(db, task.id, result);
  return task;
}

describe("bridge browser", () => {
  it("offline → HttpError, nothing enqueued", async () => {
    const db = memDb();
    const browser = createBridgeBrowser(db, () => Date.now());
    await expect(browser.getHtml(URL_, { waitFor: "[data-jk]" })).rejects.toThrow(/ajudante desligado/);
    expect((db.$client.prepare("select count(*) c from tasks").get() as { c: number }).c).toBe(0);
  });

  it("enqueues browser_fetch, returns the html and drops it from the task row", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const browser = createBridgeBrowser(db, () => Date.now(), { pollMs: 10 });
    const pending = browser.getHtml(URL_, { waitFor: "[data-jk]" });
    const task = await answer(db, { status: 200, html: "<html>vagas</html>", blocked: false });
    await expect(pending).resolves.toBe("<html>vagas</html>");
    expect(task.payload).toEqual({ url: URL_, waitFor: "[data-jk]" });
    expect(getTask(db, task.id)).toMatchObject({ status: "done", result: null });
  });

  it("anti-bot verification → RateLimitedError (the source stops this run)", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const browser = createBridgeBrowser(db, () => Date.now(), { pollMs: 10 });
    const pending = browser.getHtml(URL_, { waitFor: "[data-jk]" }).catch((e) => e);
    await answer(db, { status: 403, html: null, blocked: true });
    expect(await pending).toBeInstanceOf(RateLimitedError);
  });

  it("HTTP error status → HttpError with the status", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const browser = createBridgeBrowser(db, () => Date.now(), { pollMs: 10 });
    const pending = browser.getHtml(URL_, { waitFor: "[data-jk]" }).catch((e) => e);
    await answer(db, { status: 404, html: "<html>não achei</html>", blocked: false });
    const err = await pending;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
  });

  it("bridge going offline before claiming → HttpError and the task is dropped", async () => {
    const db = memDb();
    let now = Date.now();
    touchBridge(db, now);
    const browser = createBridgeBrowser(db, () => now, { pollMs: 10 });
    const pending = browser.getHtml(URL_, { waitFor: "[data-jk]" }).catch((e) => e);
    now += 60_000;
    const err = await pending;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toMatch(/ajudante desligado/);
    expect((db.$client.prepare("select status from tasks").get() as { status: string }).status).toBe("failed");
  });
});
