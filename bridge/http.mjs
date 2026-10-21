export class AuthError extends Error {}

/**
 * Cliente do app. O ajudante só faz requisições de saída: não abre porta nenhuma.
 * @param {{ baseUrl: string, token: string, fetchImpl?: typeof fetch }} opts
 */
export function createAppClient({ baseUrl, token, fetchImpl = fetch }) {
  const headers = { authorization: `Bearer ${token}` };

  const check = (res) => {
    if (res.status === 401) throw new AuthError("BRIDGE_TOKEN não confere com o .env do app");
    if (!res.ok && res.status !== 204) throw new Error(`app respondeu ${res.status}`);
    return res;
  };

  const post = async (path, body) =>
    check(
      await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  return {
    /** @param {string[]} accept */
    async next(accept) {
      const res = check(await fetchImpl(`${baseUrl}/api/bridge/next?accept=${accept.join(",")}`, { headers }));
      if (res.status === 204) return null;
      return res.json();
    },
    postResult: (id, body) => post(`/api/bridge/tasks/${id}/result`, body),
    postEvents: (id, events) => post(`/api/bridge/tasks/${id}/events`, { events }),
  };
}
