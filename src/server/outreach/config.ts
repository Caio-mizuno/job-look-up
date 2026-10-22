export type MailConfig = { host: string; port: number; user: string; pass: string };

/** SMTP só vem do .env (nunca do banco nem da tela). Sem usuário e senha, o envio fica desligado. */
export function getMailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  const port = Number(env.SMTP_PORT);
  return { host: env.SMTP_HOST?.trim() || "smtp.gmail.com", port: Number.isInteger(port) && port > 0 ? port : 465, user, pass };
}
