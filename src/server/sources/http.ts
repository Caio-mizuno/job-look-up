export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
  }
}
/** 429 ou bloqueio: a fonte para nesta rodada, sem insistir. */
export class RateLimitedError extends HttpError {}

export const DEFAULT_UA = "Mozilla/5.0 (compatible; job-look-up/0.1; +https://github.com/caio-mizuno/job-look-up)";

type RequestOpts = { userAgent?: string; cacheTtlMs?: number; headers?: Record<string, string> };

export type Http = {
  getText(url: string, opts?: RequestOpts): Promise<string>;
  getJson<T = unknown>(url: string, opts?: RequestOpts): Promise<T>;
};

export function createHttp({
  timeoutMs = 15_000,
  retries = 1,
  retryDelayMs = 1000,
  userAgent = DEFAULT_UA,
  fetchImpl = fetch,
}: {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
} = {}): Http {
  const cache = new Map<string, { at: number; body: string }>();

  const once = async (url: string, opts: RequestOpts): Promise<string> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new HttpError(`timeout após ${timeoutMs} ms`));
      }, timeoutMs);
    });
    try {
      const res = await Promise.race([
        fetchImpl(url, {
          signal: controller.signal,
          headers: { "user-agent": opts.userAgent ?? userAgent, "accept-language": "pt-BR,pt;q=0.9,en;q=0.8", ...opts.headers },
        }),
        timeout,
      ]);
      if (res.status === 429) throw new RateLimitedError("limite de requisições (429)", 429);
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status);
      return await res.text();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  };

  const retryable = (err: unknown) =>
    err instanceof HttpError && !(err instanceof RateLimitedError) && (err.status === null || err.status >= 500);

  const withRetry = async (url: string, opts: RequestOpts): Promise<string> => {
    let attempt = 0;
    for (;;) {
      try {
        return await once(url, opts);
      } catch (err) {
        if (attempt >= retries || !retryable(err)) throw err;
        attempt++;
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  };

  // Consultas em paralelo pedindo o mesmo arquivo grande (feed, sitemap) esperam o mesmo download.
  const inflight = new Map<string, Promise<string>>();

  const getText = async (url: string, opts: RequestOpts = {}): Promise<string> => {
    if (!opts.cacheTtlMs) return withRetry(url, opts);
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < opts.cacheTtlMs) return hit.body;
    let pending = inflight.get(url);
    if (!pending) {
      pending = withRetry(url, opts)
        .then((body) => {
          cache.set(url, { at: Date.now(), body });
          return body;
        })
        .finally(() => inflight.delete(url));
      inflight.set(url, pending);
    }
    return pending;
  };

  return {
    getText,
    async getJson<T>(url: string, opts: RequestOpts = {}) {
      const body = await getText(url, { ...opts, headers: { accept: "application/json", ...opts.headers } });
      try {
        return JSON.parse(body) as T;
      } catch {
        throw new HttpError("resposta não é JSON");
      }
    },
  };
}
