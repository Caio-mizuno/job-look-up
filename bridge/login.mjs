#!/usr/bin/env node
// `make linkedin-login`: abre o Chrome do ajudante (perfil separado) no login do LinkedIn, uma vez.
// A busca de posts usa essa sessão depois; o ajudante precisa estar parado porque o perfil não abre duas vezes.
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome } from "./browser.mjs";

const LOGIN_URL = "https://www.linkedin.com/login";

/**
 * @param {{ profileDir: string, launch?: typeof launchChrome }} opts
 * @returns {Promise<void>} resolve quando a pessoa fecha o Chrome
 */
export async function openLinkedinLogin({ profileDir, launch = launchChrome }) {
  const ctx = await launch(profileDir, { minimized: false });
  const closed = new Promise((r) => ctx.on("close", () => r()));
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(LOGIN_URL);
  await closed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  console.log("Faça login no LinkedIn nessa janela e feche o Chrome quando terminar.");
  try {
    await openLinkedinLogin({ profileDir: join(root, "data", "chrome-profile") });
    console.log("Pronto: a busca de posts do LinkedIn vai usar essa sessão.");
  } catch (err) {
    const msg = String(err?.message ?? err);
    console.error(
      /ProcessSingleton|SingletonLock|already in use|user data directory is already/i.test(msg)
        ? "Pare o ajudante (Ctrl+C no make bridge) antes: o perfil do Chrome está em uso."
        : msg.split("\n")[0],
    );
    process.exit(1);
  }
}
