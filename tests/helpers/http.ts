import { readFileSync } from "node:fs";
import { createHttp, type Http } from "@/server/sources/http";
import type { PageBrowser, SourceContext } from "@/server/sources/types";

export const sourceFixture = (name: string) =>
  readFileSync(new URL(`../fixtures/sources/${name}`, import.meta.url), "utf8");

/** Http que responde por padrão de URL com o conteúdo de uma fixture; registra as URLs pedidas. */
export function fixtureHttp(routes: [RegExp, string][]): Http & { urls: string[] } {
  const urls: string[] = [];
  const http = createHttp({
    retries: 0,
    fetchImpl: (async (url: string) => {
      urls.push(String(url));
      const hit = routes.find(([re]) => re.test(String(url)));
      return hit ? new Response(hit[1], { status: 200 }) : new Response("not found", { status: 404 });
    }) as unknown as typeof fetch,
  });
  return Object.assign(http, { urls });
}

/** Navegador do ajudante falso: responde por padrão de URL; registra as páginas pedidas. */
export function fixtureBrowser(routes: [RegExp, string][]): SourceContext & { calls: { url: string; waitFor: string }[] } {
  const calls: { url: string; waitFor: string }[] = [];
  const browser: PageBrowser = {
    async getHtml(url, { waitFor }) {
      calls.push({ url, waitFor });
      const hit = routes.find(([re]) => re.test(url));
      if (!hit) throw new Error(`sem fixture para ${url}`);
      return hit[1];
    },
  };
  return { browser, calls };
}
