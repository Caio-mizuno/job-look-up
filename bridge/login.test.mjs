import { describe, expect, it } from "vitest";
import { openLinkedinLogin } from "./login.mjs";

describe("openLinkedinLogin", () => {
  it("opens a visible Chrome on the login page and resolves only when it is closed", async () => {
    const visited = [];
    const closeHandlers = [];
    let launchedWith;
    const page = {
      async goto(url) {
        visited.push(url);
      },
    };
    const ctx = {
      pages: () => [page],
      newPage: async () => page,
      on: (ev, fn) => ev === "close" && closeHandlers.push(fn),
    };
    const launch = async (dir, opts) => {
      launchedWith = { dir, opts };
      return ctx;
    };

    let done = false;
    const pending = openLinkedinLogin({ profileDir: "/tmp/perfil", launch }).then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(launchedWith).toEqual({ dir: "/tmp/perfil", opts: { minimized: false } });
    expect(visited).toEqual(["https://www.linkedin.com/login"]);
    expect(done).toBe(false);

    closeHandlers.forEach((fn) => fn());
    await pending;
    expect(done).toBe(true);
  });
});
