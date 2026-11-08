import { vi } from "vitest";

/** Synthetic matchMedia boundary; jsdom cannot demonstrate real geometry. */
export function mobileViewport(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    media: query,
    get matches() {
      const min = /min-width:\s*([\d.]+)px/.exec(query), max = /max-width:\s*([\d.]+)px/.exec(query);
      return (min !== null || max !== null) && width >= Number(min?.[1] ?? 0) && width <= Number(max?.[1] ?? Infinity);
    },
    addEventListener: (_name: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener), removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => true, onchange: null,
  }) as unknown as MediaQueryList);
  return { resize(next: number) { width = next; for (const listener of listeners) listener(); } };
}
