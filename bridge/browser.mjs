import { mkdirSync } from "node:fs";

export const NAV_TIMEOUT_MS = 30_000;
export const WAIT_TIMEOUT_MS = 20_000;
const IDLE_CLOSE_MS = 60_000;
// Posts do LinkedIn carregam conforme rola: poucas rolagens bastam para as últimas 24 h e não parecem robô.
export const MAX_SCROLLS = 3;
export const SCROLL_WAIT_MS = 1500;

/** Só abre sites de vaga conhecidos: o app não consegue mandar o Chrome para qualquer lugar. */
const ALLOWED_HOSTS = /(^|\.)(indeed\.com|glassdoor\.com(\.br)?|linkedin\.com)$/i;
const LINKEDIN = /(^|\.)linkedin\.com$/i;
// Sessão ausente ou expirada no perfil do ajudante: o LinkedIn manda para uma destas páginas em vez da busca.
const LOGIN_WALL = /^\/(login|authwall|checkpoint|uas\/login|signup)/;
// Tela de verificação anti-robô (Cloudflare e afins). Se continuar nela depois da espera, a página está bloqueada.
const CHALLENGE = /just a moment|um momento|attention required|additional verification|blocked/i;

/**
 * Roda dentro da página do LinkedIn (via page.evaluate): o HTML da busca não traz o URN do post, só as props
 * React do nó. Copia o primeiro `urn:li:activity:<id>` delas para `data-urn`, de onde o app tira id, data e link.
 * Autocontida de propósito: o Playwright serializa a função e ela não enxerga nada deste módulo.
 * @param {ParentNode} [root]
 */
export function tagActivityUrns(root = document) {
  // Pula o que leva a ciclos ou a nós do DOM: o fiber dono (_owner) e elementos HTML.
  const skip = (key, value) => (key === "_owner" || (value && typeof value === "object" && value.nodeType) ? undefined : value);
  for (const el of root.querySelectorAll('[role="listitem"]')) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    if (!key) continue;
    let json = "";
    try {
      json = JSON.stringify(el[key], skip) ?? "";
    } catch {
      continue;
    }
    const urn = /urn:li:activity:\d+/.exec(json)?.[0];
    if (urn) el.setAttribute("data-urn", urn);
  }
}

/**
 * Minimiza a janela assim que o Chrome abre: a busca roda em segundo plano. Sem janela (headless) os sites
 * bloqueiam, e o macOS ignora `--start-minimized`, então a janela pisca só na abertura.
 * @param {import("playwright-core").BrowserContext} ctx
 */
export async function minimizeWindow(ctx) {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const cdp = await ctx.newCDPSession(page);
  try {
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * Chrome instalado na máquina com um perfil só do app, minimizado.
 * O perfil guarda os cookies do próprio app entre buscas (inclusive o login do LinkedIn, se a pessoa fez).
 * @param {string} profileDir
 * @param {{ minimized?: boolean }} [opts]
 */
export async function launchChrome(profileDir, { minimized = true } = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error("falta o playwright-core no ajudante: rode `npm --prefix bridge install`");
  }
  mkdirSync(profileDir, { recursive: true });
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, { channel: "chrome", headless: false, locale: "pt-BR" });
  } catch (err) {
    throw new Error(`não consegui abrir o Google Chrome: ${String(err?.message ?? err).split("\n")[0]}`);
  }
  // Se não der para minimizar, a busca segue com a janela visível.
  if (minimized) await minimizeWindow(ctx).catch(() => {});
  return ctx;
}

/**
 * Executor das tarefas `browser_fetch`: uma página por vez, no mesmo Chrome, fechado depois de um tempo parado.
 * @param {{ profileDir: string, launch?: typeof launchChrome, idleMs?: number }} opts
 */
export function createBrowserRunner({ profileDir, launch = launchChrome, idleMs = IDLE_CLOSE_MS }) {
  let context = null;
  let idleTimer = null;

  const open = () => {
    if (!context) {
      const launching = launch(profileDir).then(
        (ctx) => {
          // Se a pessoa fechar a janela, a próxima página abre outro Chrome.
          ctx.on("close", () => {
            if (context === launching) context = null;
          });
          return ctx;
        },
        (err) => {
          if (context === launching) context = null;
          throw err;
        },
      );
      context = launching;
    }
    return context;
  };

  const close = async () => {
    clearTimeout(idleTimer);
    const pending = context;
    context = null;
    const ctx = await pending?.catch(() => null);
    await ctx?.close().catch(() => {});
  };

  return {
    /** @param {{ url: string, waitFor: string, scrolls?: number }} payload */
    async run(payload) {
      const url = new URL(payload.url);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.test(url.hostname)) {
        throw new Error(`site não permitido para o navegador do ajudante: ${url.hostname}`);
      }
      clearTimeout(idleTimer);
      try {
        const ctx = await open();
        const page = ctx.pages()[0] ?? (await ctx.newPage());
        // A verificação do Cloudflare troca de documento: vale o status da última navegação.
        let status = 0;
        const onResponse = (res) => {
          if (res.request().isNavigationRequest() && res.frame() === page.mainFrame()) status = res.status();
        };
        page.on("response", onResponse);
        try {
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
          if (LINKEDIN.test(url.hostname) && LOGIN_WALL.test(new URL(page.url()).pathname)) {
            return { status, html: null, blocked: false, loginRequired: true };
          }
          const found = await page.waitForSelector(payload.waitFor, { timeout: WAIT_TIMEOUT_MS }).then(
            () => true,
            () => false,
          );
          if (!found && CHALLENGE.test(await page.title().catch(() => ""))) return { status, html: null, blocked: true };
          for (let i = 0; i < Math.min(payload.scrolls ?? 0, MAX_SCROLLS); i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(SCROLL_WAIT_MS);
          }
          if (LINKEDIN.test(url.hostname)) await page.evaluate(tagActivityUrns);
          return { status, html: await page.content(), blocked: false };
        } finally {
          page.off("response", onResponse);
        }
      } finally {
        idleTimer = setTimeout(() => void close(), idleMs);
      }
    },
    close,
  };
}
