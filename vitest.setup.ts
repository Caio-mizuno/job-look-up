import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom não implementa ResizeObserver (usado por componentes do Radix).
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(window, { ResizeObserver: ResizeObserverStub });
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}

// Sem `globals: true` o Testing Library não desmonta sozinho entre testes.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
