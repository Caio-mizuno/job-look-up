import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Sem `globals: true` o Testing Library não desmonta sozinho entre testes.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
