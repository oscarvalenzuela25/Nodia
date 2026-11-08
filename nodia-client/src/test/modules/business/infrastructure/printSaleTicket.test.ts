import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSaleTicketHtml, printSaleTicket } from "../../../../modules/business/infrastructure/printSaleTicket";
import type { SaleTicketModel } from "../../../../modules/business/infrastructure/saleTicket";

const ticket: SaleTicketModel = {
  title: "Synthetic ticket", businessName: "Synthetic business", saleId: null, issuedAt: null,
  lines: [{ name: "Synthetic product", quantity: "1,125", unitPrice: "$10.000 x kilo", subtotal: "$11.250" }],
  totalLabel: "Total CLP", total: "$11.250", paymentLabel: "Medio de pago", paymentMethod: "Efectivo", footer: "Synthetic footer",
};
const controllers: AbortController[] = [];
function start() {
  const controller = new AbortController(); controllers.push(controller);
  const promise = printSaleTicket(ticket, { signal: controller.signal });
  void promise.catch(() => {});
  const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
  return { controller, promise, frame };
}
function loaded(frame: HTMLIFrameElement, print = vi.fn()) {
  frame.contentDocument!.body.dataset.saleTicket = "true";
  Object.defineProperty(frame.contentWindow, "print", { configurable: true, value: print });
  frame.dispatchEvent(new Event("load"));
  return print;
}
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.abort();
  vi.restoreAllMocks(); vi.useRealTimers();
});

describe("isolated ticket printing", () => {
  it("escapes every value and includes no executable markup or remote resources", () => {
    const payload = `<img src="https://invalid.example/secret" onerror="alert(1)"><script>bad()</script>&'`;
    const value: SaleTicketModel = { title: payload, businessName: payload, saleId: payload, issuedAt: payload,
      lines: [{ name: payload, quantity: payload, unitPrice: payload, subtotal: payload }], totalLabel: payload, total: payload, paymentLabel: payload, paymentMethod: payload, footer: payload };
    const document = new DOMParser().parseFromString(buildSaleTicketHtml(value), "text/html");
    expect(document.querySelector("img,script,link,iframe,object,embed,form")).toBeNull();
    expect(document.body.textContent).toContain(payload);
    expect(document.title).toBe(payload);
    expect(document.querySelector(".name")?.textContent).toBe(payload);
    expect(document.querySelector(".total strong")?.textContent).toBe(payload);
  });

  it("requests one isolated print, keeps a pending native job busy and cleans up after preview closes", async () => {
    const first = start(); const child = first.frame.contentWindow!; const print = loaded(first.frame);
    await expect(first.promise).resolves.toBeUndefined();
    expect(print).toHaveBeenCalledOnce();
    expect(first.frame.getAttribute("sandbox")).toBe("allow-same-origin allow-modals");
    await expect(printSaleTicket(ticket)).rejects.toThrow("print_busy");
    child.dispatchEvent(new Event("afterprint"));
    expect(document.querySelector("iframe")).toBeNull();
    const next = start(); loaded(next.frame); await next.promise;
  });

  it("aborts before dispatch without printing or leaving sensitive DOM", async () => {
    const job = start(); const print = vi.fn();
    Object.defineProperty(job.frame.contentWindow, "print", { configurable: true, value: print });
    job.controller.abort();
    await expect(job.promise).rejects.toMatchObject({ name: "AbortError" });
    job.frame.dispatchEvent(new Event("load"));
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    const aborted = new AbortController(); aborted.abort();
    await expect(printSaleTicket(ticket, { signal: aborted.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("clears local DOM after a scope abort without claiming native cancellation or changing the ticket", async () => {
    const before = structuredClone(ticket); const job = start(); const print = loaded(job.frame);
    await job.promise; job.controller.abort();
    expect(print).toHaveBeenCalledOnce();
    expect(document.querySelector("iframe")).toBeNull();
    expect(ticket).toEqual(before);
  });

  it("rejects loading errors and thrown print failures, releasing the frame for a new attempt", async () => {
    const failed = start(); failed.frame.dispatchEvent(new Event("error"));
    await expect(failed.promise).rejects.toThrow("print_load_failed");
    expect(document.querySelector("iframe")).toBeNull();
    const thrown = start(); loaded(thrown.frame, vi.fn(() => { throw new Error("Synthetic driver failure"); }));
    await expect(thrown.promise).rejects.toThrow("Synthetic driver failure");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("cleans up when accessing the loaded frame or appending it throws", async () => {
    const denied = start();
    vi.spyOn(denied.frame, "contentDocument", "get").mockImplementation(() => { throw new DOMException("Synthetic access failure", "SecurityError"); });
    denied.frame.dispatchEvent(new Event("load"));
    await expect(denied.promise).rejects.toMatchObject({ name: "SecurityError" });
    expect(document.querySelector("iframe")).toBeNull();
    vi.spyOn(document.body, "appendChild").mockImplementationOnce(() => { throw new Error("Synthetic DOM failure"); });
    await expect(printSaleTicket(ticket)).rejects.toThrow("Synthetic DOM failure");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("bounds a missing load event and does not dispatch a late print", async () => {
    vi.useFakeTimers(); const job = start(); const print = vi.fn();
    Object.defineProperty(job.frame.contentWindow, "print", { configurable: true, value: print });
    const rejection = expect(job.promise).rejects.toThrow("print_load_timeout");
    await vi.advanceTimersByTimeAsync(10000); await rejection;
    job.frame.dispatchEvent(new Event("load"));
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
