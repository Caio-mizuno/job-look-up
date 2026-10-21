"use client";

export type TaskView = { status: "queued" | "running" | "done" | "failed"; result: unknown; error: string | null };

/** Acompanha uma tarefa visível (/api/tasks/:id) até terminar ou estourar o tempo. */
export async function waitTask(taskId: number, { timeoutMs = 120_000, intervalMs = 1000 } = {}): Promise<TaskView> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
    if (res.ok) {
      const task = (await res.json()) as TaskView;
      if (task.status === "done" || task.status === "failed") return task;
    }
    if (Date.now() > deadline) return { status: "failed", result: null, error: "tempo esgotado" };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
