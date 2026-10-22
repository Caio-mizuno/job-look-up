import { unlinkSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { getMailConfig } from "@/server/outreach/config";
import { buildOutreachEmail } from "@/server/outreach/message";
import {
  getOutreachDraft,
  sendOutreachEmail,
  sendTestEmail,
  type MailMessage,
  type MailTransport,
} from "@/server/outreach/send";
import { saveProfile } from "@/server/profile/repo";
import { memDb, tmpFile } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 22, 12);
const config = { host: "smtp.gmail.com", port: 465, user: "eu@gmail.com", pass: "segredo" };

function fakeTransport(fail?: Error): MailTransport & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    async sendMail(msg) {
      if (fail) throw fail;
      sent.push(msg);
      return { messageId: "x" };
    },
  };
}

function setup(opts: { cv?: boolean } = {}) {
  const db = memDb();
  const cvPath = tmpFile("Ana_CV.pdf");
  if (opts.cv !== false) writeFileSync(cvPath, "%PDF-1.4");
  const base = sampleProfile();
  saveProfile(
    db,
    {
      ...base,
      personal: { ...base.personal, name: "Ana Dev", email: "ana@pessoal.com", phone: "+55 11 90000-0000", linkedin: "linkedin.com/in/ana", portfolio: "mizunotech.com.br" },
      headline: "Desenvolvedora Full Stack | PHP",
      cvPath: opts.cv === false ? null : cvPath,
    },
    NOW,
  );
  const r = db.$client
    .prepare(
      `insert into jobs (source, url, dedupe_key, title, company, contact_email, status, first_seen_at, last_seen_at)
       values ('linkedin_posts', 'https://www.linkedin.com/feed/update/urn:li:activity:1/', 'k1', 'Desenvolvedor PHP', 'Pessoa Recrutadora A', 'vagas@exemplo.com.br', 'new', 0, 0)`,
    )
    .run();
  return { db, jobId: Number(r.lastInsertRowid), cvPath };
}

const draftFor = (db: Db, jobId: number) => getOutreachDraft(db, jobId)!.draft;
const rows = (db: Db) => db.$client.prepare("select to_email, status, error from outreach_emails order by id").all();
const jobStatus = (db: Db, id: number) => (db.$client.prepare("select status from jobs where id = ?").get(id) as { status: string }).status;

describe("getOutreachDraft", () => {
  it("prefills to, subject and body from the post and the profile", () => {
    const { db, jobId } = setup();
    const res = getOutreachDraft(db, jobId)!;
    const p = sampleProfile();
    const expected = buildOutreachEmail({
      name: "Ana Dev",
      headline: "Desenvolvedora Full Stack | PHP",
      skills: p.skills.map((s) => s.name),
      phone: "+55 11 90000-0000",
      linkedin: "linkedin.com/in/ana",
      portfolio: "mizunotech.com.br",
      recipientName: "Pessoa Recrutadora A",
    });
    expect(res).toEqual({ draft: { to: "vagas@exemplo.com.br", ...expected }, cvFilename: "Ana_CV.pdf", sentAt: null });
    expect(getOutreachDraft(db, 999)).toBeNull();
  });
});

describe("sendOutreachEmail", () => {
  it("sends with cv, links and reply-to", async () => {
    const { db, jobId, cvPath } = setup();
    const transport = fakeTransport();
    const draft = { ...draftFor(db, jobId), body: "Olá! editado" };

    await expect(sendOutreachEmail(db, jobId, draft, { config, transport, now: NOW })).resolves.toEqual({ ok: true });

    expect(transport.sent).toEqual([
      {
        from: '"Ana Dev" <eu@gmail.com>',
        replyTo: "ana@pessoal.com",
        to: "vagas@exemplo.com.br",
        subject: draft.subject,
        text: "Olá! editado",
        attachments: [{ filename: "Ana_CV.pdf", path: cvPath }],
      },
    ]);
    expect(rows(db)).toEqual([{ to_email: "vagas@exemplo.com.br", status: "sent", error: null }]);
    expect(jobStatus(db, jobId)).toBe("applied");
    expect(getOutreachDraft(db, jobId)!.sentAt).toBe(NOW);
  });

  it("already_sent", async () => {
    const { db, jobId } = setup();
    await sendOutreachEmail(db, jobId, draftFor(db, jobId), { config, transport: fakeTransport(), now: NOW });
    const again = fakeTransport();
    await expect(sendOutreachEmail(db, jobId, draftFor(db, jobId), { config, transport: again, now: NOW + 1 })).resolves.toEqual({
      ok: false,
      error: "already_sent",
    });
    expect(again.sent).toHaveLength(0);
  });

  it("gmail auth failure", async () => {
    const { db, jobId } = setup();
    const err = Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted SENHA123"), {
      code: "EAUTH",
      responseCode: 535,
    });
    const res = await sendOutreachEmail(db, jobId, draftFor(db, jobId), { config, transport: fakeTransport(err), now: NOW });

    expect(res).toMatchObject({ ok: false, error: "smtp" });
    const message = (res as { message: string }).message;
    expect(message).toContain("senha de app");
    expect(message).not.toContain("SENHA123");
    expect(rows(db)).toEqual([{ to_email: "vagas@exemplo.com.br", status: "failed", error: message }]);
    expect(jobStatus(db, jobId)).toBe("new");

    await expect(sendOutreachEmail(db, jobId, draftFor(db, jobId), { config, transport: fakeTransport(), now: NOW + 1 })).resolves.toEqual({
      ok: true,
    });
  });

  it("connection errors name host and port", async () => {
    const { db, jobId } = setup();
    const err = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
    const res = await sendOutreachEmail(db, jobId, draftFor(db, jobId), { config, transport: fakeTransport(err), now: NOW });
    expect(res).toEqual({ ok: false, error: "smtp", message: "Não consegui conectar em smtp.gmail.com:465." });
  });

  it("refuses before sending when something is missing", async () => {
    const t = fakeTransport();
    const a = setup();
    const draft = draftFor(a.db, a.jobId);
    await expect(sendOutreachEmail(a.db, 999, draft, { config, transport: t, now: NOW })).resolves.toEqual({ ok: false, error: "not_found" });
    await expect(sendOutreachEmail(a.db, a.jobId, draft, { config: null, transport: t, now: NOW })).resolves.toEqual({
      ok: false,
      error: "not_configured",
    });
    await expect(sendOutreachEmail(a.db, a.jobId, { ...draft, to: "foo@" }, { config, transport: t, now: NOW })).resolves.toEqual({
      ok: false,
      error: "invalid_to",
    });
    unlinkSync(a.cvPath);
    await expect(sendOutreachEmail(a.db, a.jobId, draft, { config, transport: t, now: NOW })).resolves.toEqual({ ok: false, error: "no_cv" });
    const b = setup({ cv: false });
    await expect(sendOutreachEmail(b.db, b.jobId, draftFor(b.db, b.jobId), { config, transport: t, now: NOW })).resolves.toEqual({
      ok: false,
      error: "no_cv",
    });
    expect(t.sent).toHaveLength(0);
    expect(rows(a.db)).toEqual([]);
  });
});

describe("sendTestEmail", () => {
  it("sends a plain message to the configured account", async () => {
    const t = fakeTransport();
    await expect(sendTestEmail({ config, transport: t })).resolves.toEqual({ ok: true });
    expect(t.sent).toEqual([
      {
        from: "eu@gmail.com",
        to: "eu@gmail.com",
        subject: "job-look-up: teste de e-mail",
        text: "Se você recebeu esta mensagem, o envio de e-mails do job-look-up está funcionando.",
      },
    ]);
    await expect(sendTestEmail({ config: null, transport: t })).resolves.toEqual({ ok: false, error: "not_configured" });
  });
});

describe("getMailConfig", () => {
  it("needs user and password, defaults to gmail", () => {
    expect(getMailConfig({})).toBeNull();
    expect(getMailConfig({ SMTP_USER: "a" })).toBeNull();
    expect(getMailConfig({ SMTP_USER: "a", SMTP_PASS: "b" })).toEqual({ host: "smtp.gmail.com", port: 465, user: "a", pass: "b" });
    expect(getMailConfig({ SMTP_USER: "a", SMTP_PASS: "b", SMTP_HOST: "smtp.x.com", SMTP_PORT: "587" })).toEqual({
      host: "smtp.x.com",
      port: 587,
      user: "a",
      pass: "b",
    });
  });
});
