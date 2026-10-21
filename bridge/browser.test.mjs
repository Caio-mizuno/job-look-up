import { describe, expect, it } from "vitest";
import { createBrowserRunner, minimizeWindow } from "./browser.mjs";

/** Chrome falso com a mesma forma do contexto do Playwright usada pelo executor. */
function fakeChrome({ title = "Vagas | Indeed", found = true, html = "<html>vagas</html>", statuses = [200] } = {}) {
  const frame = {};
  const listeners = new Map();
  const page = {
    visited: [],
    on: (ev, fn) => listeners.set(ev, fn),
    off: (ev) => listeners.delete(ev),
    mainFrame: () => frame,
    async goto(url) {
      this.visited.push(url);
      // Verificação que passa sozinha: 403 da tela de espera, depois 200 da página de verdade.
      for (const status of statuses) {
        listeners.get("response")?.({ status: () => status, request: () => ({ isNavigationRequest: () => true }), frame: () => frame });
      }
    },
    async waitForSelector() {
      if (!found) throw new Error("timeout");
    },
    title: async () => title,
    content: async () => html,
  };
  const chrome = { launches: 0, closed: 0, page };
  const closeHandlers = [];
  const ctx = {
    pages: () => [page],
    on: (ev, fn) => ev === "close" && closeHandlers.push(fn),
    async close() {
      chrome.closed++;
      closeHandlers.splice(0).forEach((fn) => fn());
    },
  };
  chrome.ctx = ctx;
  chrome.launch = async () => {
    chrome.launches++;
    return ctx;
  };
  return chrome;
}

const payload = { url: "https://br.indeed.com/jobs?q=php", waitFor: "[data-jk]" };

describe("browser runner", () => {
  it("returns the rendered html with the last navigation status", async () => {
    const chrome = fakeChrome({ statuses: [403, 200] });
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch });
    await expect(runner.run(payload)).resolves.toEqual({ status: 200, html: "<html>vagas</html>", blocked: false });
    expect(chrome.page.visited).toEqual([payload.url]);
    await runner.close();
  });

  it("reports blocked when the anti-bot page stays up", async () => {
    const chrome = fakeChrome({ title: "Um momento…", found: false, statuses: [403] });
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch });
    await expect(runner.run(payload)).resolves.toEqual({ status: 403, html: null, blocked: true });
    await runner.close();
  });

  it("returns the page when the selector is missing but there is no verification (no results)", async () => {
    const chrome = fakeChrome({ found: false, html: "<html>nenhuma vaga</html>" });
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch });
    await expect(runner.run(payload)).resolves.toMatchObject({ html: "<html>nenhuma vaga</html>", blocked: false });
    await runner.close();
  });

  it("reuses one Chrome and opens another after it is closed", async () => {
    const chrome = fakeChrome();
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch });
    await runner.run(payload);
    await runner.run(payload);
    expect(chrome.launches).toBe(1);
    await chrome.ctx.close();
    await runner.run(payload);
    expect(chrome.launches).toBe(2);
    await runner.close();
  });

  it("refuses sites outside the allowlist and plain http, without opening Chrome", async () => {
    const chrome = fakeChrome();
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch });
    await expect(runner.run({ ...payload, url: "https://example.com/" })).rejects.toThrow(/não permitido/);
    await expect(runner.run({ ...payload, url: "http://br.indeed.com/jobs" })).rejects.toThrow(/não permitido/);
    await expect(runner.run({ ...payload, url: "https://indeed.com.evil.io/" })).rejects.toThrow(/não permitido/);
    expect(chrome.launches).toBe(0);
    await runner.close();
  });

  it("closes Chrome after being idle", async () => {
    const chrome = fakeChrome();
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch: chrome.launch, idleMs: 10 });
    await runner.run(payload);
    await new Promise((r) => setTimeout(r, 40));
    expect(chrome.closed).toBe(1);
  });

  it("a failed launch surfaces the error and the next page tries again", async () => {
    const chrome = fakeChrome();
    let fail = true;
    const launch = async () => {
      if (fail) throw new Error("não consegui abrir o Google Chrome: not found");
      return chrome.launch();
    };
    const runner = createBrowserRunner({ profileDir: "/tmp/x", launch });
    await expect(runner.run(payload)).rejects.toThrow(/Google Chrome/);
    fail = false;
    await expect(runner.run(payload)).resolves.toMatchObject({ blocked: false });
    await runner.close();
  });
});

describe("minimizeWindow", () => {
  it("minimizes the window of the first page through CDP and detaches", async () => {
    const sent = [];
    let detached = false;
    const page = {};
    const ctx = {
      pages: () => [page],
      newCDPSession: async (p) => {
        expect(p).toBe(page);
        return {
          send: async (method, params) => {
            sent.push([method, params]);
            return method === "Browser.getWindowForTarget" ? { windowId: 7 } : {};
          },
          detach: async () => {
            detached = true;
          },
        };
      },
    };
    await minimizeWindow(ctx);
    expect(sent).toEqual([
      ["Browser.getWindowForTarget", undefined],
      ["Browser.setWindowBounds", { windowId: 7, bounds: { windowState: "minimized" } }],
    ]);
    expect(detached).toBe(true);
  });
});
