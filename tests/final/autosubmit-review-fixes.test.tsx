// @vitest-environment jsdom
// Correções da revisão final da branch feat/lote-posts-email (envio automático, lote, e-mail, posts).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationRow } from "@/components/applications/application-row";
import { APPLY_COPY } from "@/components/applications/copy";
import { BulkApplyBar } from "@/components/jobs/bulk-apply-bar";
import { canBulkApply } from "@/lib/bulk-apply";
import { applyReport, cancelApplication, createApplication, getApplication } from "@/server/applications/repo";
import type { ApplicationListItem } from "@/server/applications/list";
import { sendOutreachEmail, type MailMessage } from "@/server/outreach/send";
import { saveProfile } from "@/server/profile/repo";
import { HttpError } from "@/server/sources/http";
import { linkedinPostsSource } from "@/server/sources/linkedin-posts";
import { createHttp } from "@/server/sources/http";
import { fixtureBrowser } from "../helpers/http";
import { memDb, tmpFile } from "../helpers/db";
import { sampleProfile } from "../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 22, 12);

describe("I1: apply toast tells the truth about submitting", () => {
  it("no longer promises that nothing is sent", () => {
    expect(APPLY_COPY.queuedToast).not.toMatch(/Nada é enviado/);
    expect(APPLY_COPY.queuedToast).toMatch(/envia/);
  });
});

describe("I2: a submission reported after cancel still counts", () => {
  it("records submitted and marks the job applied even if the application was cancelled", () => {
    const db = memDb();
    const jobId = Number(
      db.$client
        .prepare("insert into jobs (source, url, dedupe_key, title, status, first_seen_at, last_seen_at) values ('gupy', 'https://a.gupy.io/job/1', 'k', 'Dev', 'new', 0, 0)")
        .run().lastInsertRowid,
    );
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    cancelApplication(db, id);
    applyReport(db, id, { status: "submitted", filled: [], drafted: [], unanswered: [], notes: "enviada" }, NOW);
    expect(getApplication(db, id)).toMatchObject({ status: "submitted", finishedAt: NOW });
    const job = db.$client.prepare("select status from jobs where id = ?").get(jobId) as { status: string };
    expect(job.status).toBe("applied");
  });

  it("cancel on a running application warns it may not stop the browser", () => {
    const running: ApplicationListItem = {
      id: 7,
      status: "running",
      error: null,
      createdAt: 0,
      finishedAt: null,
      events: [],
      extraAnswers: [],
      report: null,
      job: { id: 1, title: "Dev", company: "X", url: "https://x.gupy.io/job/1", source: "gupy" },
    };
    render(<ApplicationRow application={running} onSubmitted={vi.fn()} onRetry={vi.fn()} onCancel={vi.fn()} onAnswer={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute("title", APPLY_COPY.actions.cancelRunningHint);
  });
});

describe("I3: retries cannot silently re-submit", () => {
  const prompt = readFileSync(join(process.cwd(), "bridge/apply-prompt.md"), "utf8");

  it("prompt forbids applying twice and treats a final 'Candidatar-se' as the submit button", () => {
    expect(prompt).toContain("já se candidatou");
    expect(prompt).toContain("se o botão envia a candidatura, vale a regra de Envio");
  });

  it("failed applications are not swept into 'Selecionar todas'", () => {
    expect(canBulkApply({ url: "https://a.gupy.io/job/1", status: "interested", application: { id: 1, status: "failed" } })).toBe(false);
    expect(canBulkApply({ url: "https://a.gupy.io/job/1", status: "interested", application: { id: 1, status: "login_required" } })).toBe(true);
  });
});

describe("I4: e-mail is sent once even with two requests in flight", () => {
  it("a second concurrent send is refused while the first is still sending", async () => {
    const db = memDb();
    const cvPath = tmpFile("cv.pdf");
    writeFileSync(cvPath, "%PDF");
    saveProfile(db, { ...sampleProfile(), cvPath }, NOW);
    const jobId = Number(
      db.$client
        .prepare("insert into jobs (source, url, dedupe_key, title, contact_email, status, first_seen_at, last_seen_at) values ('linkedin_posts', 'https://www.linkedin.com/feed/update/urn:li:activity:1/', 'k', 'Dev', 'rh@x.com', 'new', 0, 0)")
        .run().lastInsertRowid,
    );
    const sent: MailMessage[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const transport = {
      async sendMail(msg: MailMessage) {
        await gate;
        sent.push(msg);
      },
    };
    const config = { host: "smtp.gmail.com", port: 465, user: "eu@gmail.com", pass: "x" };
    const draft = { to: "rh@x.com", subject: "Oi", body: "Olá" };

    const first = sendOutreachEmail(db, jobId, draft, { config, transport, now: NOW });
    const second = await sendOutreachEmail(db, jobId, draft, { config, transport, now: NOW });
    release();

    expect(second).toEqual({ ok: false, error: "already_sent" });
    await expect(first).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(1);
  });
});

describe("I5: linkedin posts page without posts is an error, not 'ok, 0'", () => {
  const search = (html: string) =>
    linkedinPostsSource.search({ keywords: "x", location: null }, 1, createHttp(), fixtureBrowser([[/linkedin\.com/, html]]));

  it("throws when the page has neither posts nor the empty state", async () => {
    const err = await search("<html><body><main><div class='feed'>algo novo</div></main></body></html>").catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toBe("não achei posts na página: o LinkedIn pode ter mudado o layout");
  });

  it("returns no posts for LinkedIn's explicit empty state", async () => {
    await expect(
      search("<html><body><div class='search-reusable-search-no-results artdeco-empty-state'><h2>Nenhum resultado encontrado</h2></div></body></html>"),
    ).resolves.toEqual([]);
  });
});

describe("I6: bulk submit asks for confirmation", () => {
  it("opens a confirmation with the count before applying", async () => {
    const onApply = vi.fn();
    render(<BulkApplyBar eligibleCount={4} selectedCount={2} onToggleAll={vi.fn()} onApply={onApply} onClear={vi.fn()} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Quero participar (2)" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(await screen.findByText("Enviar 2 candidaturas?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar 2" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  });
});
