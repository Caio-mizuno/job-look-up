import { describe, expect, it } from "vitest";
import { BULK_APPLY_MAX, canBulkApply } from "@/lib/bulk-apply";
import type { ApplicationStatus, JobStatus } from "@/server/db/schema";

const job = (
  application: ApplicationStatus | null,
  over: { url?: string; status?: JobStatus } = {},
) => ({
  url: over.url ?? "https://empresa.gupy.io/job/1",
  status: over.status ?? ("new" as JobStatus),
  application: application ? { id: 1, status: application } : null,
});

describe("canBulkApply", () => {
  it("accepts jobs without an active application", () => {
    expect(canBulkApply(job(null))).toBe(true);
    expect(canBulkApply(job("login_required"))).toBe(true);
  });

  it("rejects active, done, applied and linkedin jobs", () => {
    for (const s of ["queued", "running", "needs_review", "submitted", "failed"] as const) expect(canBulkApply(job(s))).toBe(false);
    expect(canBulkApply(job(null, { status: "applied" }))).toBe(false);
    expect(canBulkApply(job(null, { url: "https://www.linkedin.com/feed/update/urn:li:activity:1/" }))).toBe(false);
  });

  it("caps batches at 50", () => {
    expect(BULK_APPLY_MAX).toBe(50);
  });
});
