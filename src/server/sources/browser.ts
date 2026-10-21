import type { Db } from "@/server/db/client";
import { isBridgeOnline } from "@/server/bridge/presence";
import { BridgeOfflineError, waitForBridgeTask } from "@/server/bridge/wait";
import { enqueue } from "@/server/tasks/queue";
import { HttpError, RateLimitedError } from "./http";
import type { PageBrowser, SourceContext } from "./types";

// O ajudante abre uma página por vez: esta pode esperar outras na fila.
const PAGE_TIMEOUT_MS = 180_000;
const OFFLINE = "ajudante desligado: rode `make bridge`";

type BrowserFetchResult = { status: number; html: string | null; blocked: boolean };

/** Abre a página no Chrome do computador da pessoa pelo ajudante (ver bridge/browser.mjs). */
export function createBridgeBrowser(
  db: Db,
  now: () => number,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): PageBrowser {
  return {
    async getHtml(url, { waitFor }) {
      if (!isBridgeOnline(db, now())) throw new HttpError(OFFLINE);
      const id = enqueue(db, { type: "browser_fetch", runner: "bridge", payload: { url, waitFor } });
      const timeoutMs = opts.timeoutMs ?? PAGE_TIMEOUT_MS;
      let res: BrowserFetchResult;
      try {
        res = (await waitForBridgeTask(db, id, now, {
          timeoutMs,
          pollMs: opts.pollMs,
          timeoutMessage: `a página não carregou em ${Math.round(timeoutMs / 1000)} s`,
        })) as BrowserFetchResult;
      } catch (err) {
        if (err instanceof BridgeOfflineError) throw new HttpError(OFFLINE);
        throw err;
      } finally {
        // O HTML só serve para esta leitura: não fica no histórico de tarefas.
        db.$client.prepare("update tasks set result = null where id = ?").run(id);
      }
      // Sem resolver captcha: se o site pede verificação, a fonte para nesta rodada.
      if (res.blocked) throw new RateLimitedError("bloqueada pela verificação anti-robô do site");
      if (res.status >= 400 || !res.html) throw new HttpError(`HTTP ${res.status}`, res.status);
      return res.html;
    },
  };
}

export function requireBrowser(ctx: SourceContext | undefined): PageBrowser {
  if (!ctx) throw new HttpError("esta fonte precisa do navegador do ajudante");
  return ctx.browser;
}
