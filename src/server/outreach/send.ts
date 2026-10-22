import { existsSync } from "node:fs";
import { basename } from "node:path";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { Db } from "@/server/db/client";
import { getProfile } from "@/server/profile/repo";
import type { MailConfig } from "./config";
import { buildOutreachEmail } from "./message";

export type OutreachDraft = { to: string; subject: string; body: string };

export type MailMessage = {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; path: string }[];
};
export type MailTransport = { sendMail(msg: MailMessage): Promise<unknown> };

export type SendError = "not_found" | "not_configured" | "no_cv" | "invalid_to" | "already_sent" | "smtp";
export type SendResult = { ok: true } | { ok: false; error: SendError; message?: string };

export function createMailTransport(cfg: MailConfig): MailTransport {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

/** Mensagem legível para a tela. Nunca repassa err.message: o servidor SMTP pode ecoar usuário e senha. */
export function friendlySmtpError(err: unknown, cfg: MailConfig): string {
  const e = (err ?? {}) as { code?: string; responseCode?: number };
  if (e.code === "EAUTH" || e.responseCode === 535) {
    return "O Gmail recusou o login: use uma senha de app (myaccount.google.com/apppasswords), não a senha da conta.";
  }
  if (e.code && ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(e.code)) {
    return `Não consegui conectar em ${cfg.host}:${cfg.port}.`;
  }
  return `Falha no envio do e-mail (${e.code ?? "erro"}).`;
}

type JobRow = { id: number; company: string | null; contact_email: string | null };

const sentAtOf = (db: Db, jobId: number) =>
  (
    db.$client
      .prepare("select max(created_at) at from outreach_emails where job_id = ? and status = 'sent'")
      .get(jobId) as { at: number | null }
  ).at;

/** Rascunho do diálogo: destinatário do post, mensagem calorosa a partir do perfil. */
export function getOutreachDraft(
  db: Db,
  jobId: number,
): { draft: OutreachDraft; cvFilename: string | null; sentAt: number | null } | null {
  const job = db.$client.prepare("select id, company, contact_email from jobs where id = ?").get(jobId) as JobRow | undefined;
  if (!job) return null;
  const p = getProfile(db)?.data;
  const { subject, body } = buildOutreachEmail({
    name: p?.personal.name ?? "",
    headline: p?.headline ?? "",
    skills: p?.skills.map((s) => s.name) ?? [],
    phone: p?.personal.phone ?? "",
    linkedin: p?.personal.linkedin ?? "",
    portfolio: p?.personal.portfolio ?? "",
    recipientName: job.company,
  });
  return {
    draft: { to: job.contact_email ?? "", subject, body },
    cvFilename: p?.cvPath && existsSync(p.cvPath) ? basename(p.cvPath) : null,
    sentAt: sentAtOf(db, jobId),
  };
}

/** Envia o e-mail revisado pela pessoa, com o CV anexado. Uma vez por vaga; falha fica no histórico e pode repetir. */
export async function sendOutreachEmail(
  db: Db,
  jobId: number,
  draft: OutreachDraft,
  deps: { config: MailConfig | null; transport?: MailTransport; now: number },
): Promise<SendResult> {
  const job = db.$client.prepare("select id from jobs where id = ?").get(jobId);
  if (!job) return { ok: false, error: "not_found" };
  const cfg = deps.config;
  if (!cfg) return { ok: false, error: "not_configured" };
  const p = getProfile(db)?.data;
  if (!p?.cvPath || !existsSync(p.cvPath)) return { ok: false, error: "no_cv" };
  const to = draft.to.trim();
  if (!z.email().safeParse(to).success) return { ok: false, error: "invalid_to" };
  if (sentAtOf(db, jobId) !== null) return { ok: false, error: "already_sent" };

  const record = db.$client.prepare(
    "insert into outreach_emails (job_id, to_email, subject, body, status, error, created_at) values (?, ?, ?, ?, ?, ?, ?)",
  );
  const name = p.personal.name.replace(/["\\]/g, "").trim();
  try {
    await (deps.transport ?? createMailTransport(cfg)).sendMail({
      from: name ? `"${name}" <${cfg.user}>` : cfg.user,
      ...(p.personal.email.trim() ? { replyTo: p.personal.email.trim() } : {}),
      to,
      subject: draft.subject,
      text: draft.body,
      attachments: [{ filename: basename(p.cvPath), path: p.cvPath }],
    });
  } catch (err) {
    const message = friendlySmtpError(err, cfg);
    record.run(jobId, to, draft.subject, draft.body, "failed", message, deps.now);
    return { ok: false, error: "smtp", message };
  }
  record.run(jobId, to, draft.subject, draft.body, "sent", null, deps.now);
  db.$client.prepare("update jobs set status = 'applied' where id = ?").run(jobId);
  return { ok: true };
}

/** "Enviar e-mail de teste para mim": valida a senha de app sem tocar em vaga nem histórico. */
export async function sendTestEmail(deps: { config: MailConfig | null; transport?: MailTransport }): Promise<SendResult> {
  const cfg = deps.config;
  if (!cfg) return { ok: false, error: "not_configured" };
  try {
    await (deps.transport ?? createMailTransport(cfg)).sendMail({
      from: cfg.user,
      to: cfg.user,
      subject: "job-look-up: teste de e-mail",
      text: "Se você recebeu esta mensagem, o envio de e-mails do job-look-up está funcionando.",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "smtp", message: friendlySmtpError(err, cfg) };
  }
}
