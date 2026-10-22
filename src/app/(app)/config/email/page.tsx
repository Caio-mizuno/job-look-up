import type { Metadata } from "next";
import { connection } from "next/server";
import { EmailSettings } from "@/components/outreach/email-settings";
import { getMailConfig } from "@/server/outreach/config";

export const metadata: Metadata = { title: "E-mail" };

export default async function EmailPage() {
  // O .env é lido a cada visita (nada de prerender no build); a senha nunca vai para o cliente.
  await connection();
  const cfg = getMailConfig();
  return <EmailSettings config={cfg ? { user: cfg.user, host: cfg.host, port: cfg.port } : null} />;
}
