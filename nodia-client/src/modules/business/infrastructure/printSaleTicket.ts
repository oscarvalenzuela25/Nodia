import type { SaleTicketModel } from "./saleTicket";

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

/** No remote resources, executable markup or application styles enter the print document. */
export function buildSaleTicketHtml(ticket: SaleTicketModel): string {
  const text = escapeHtml;
  const rows = ticket.lines.map((line) => `<article class="line"><p class="name">${text(line.name)}</p><div class="amounts"><div class="quantity-price"><span>${text(line.quantity)}</span><span>×</span><span>${text(line.unitPrice)}</span></div><strong>${text(line.subtotal)}</strong></div></article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${text(ticket.title)}</title><style>
@page { size: auto; margin: 0; }
* { box-sizing: border-box; }
html { margin: 0; padding: 0; background: #fff; color: #000; }
body { margin: 0; width: 80mm; max-width: 100%; padding: 4mm; color: #000; background: #fff; font-family: monospace; font-size: 11px; line-height: 1.45; }
h1 { margin: 0 0 3mm; font-size: 15px; text-align: center; }
p { margin: 0; }
header { padding-bottom: 3mm; border-bottom: 1px dashed #000; text-align: center; }
header p + p { margin-top: 1mm; }
.line { padding: 3mm 0; border-bottom: 1px dashed #000; break-inside: avoid; }
.name { font-weight: 700; }
.amounts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5mm; margin-top: 1mm; font-size: 16px; font-weight: 700; line-height: 1.4; font-variant-numeric: tabular-nums; }
.amounts > * { min-width: 0; max-width: 100%; }
.quantity-price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1mm; }
.quantity-price > span { max-width: 100%; }
.amounts strong { text-align: right; font-weight: 800; }
.total { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2mm; margin: 4mm 0 3mm; font-size: 17px; font-weight: 700; }
.total strong { text-align: right; }
footer { margin-top: 4mm; padding-top: 3mm; border-top: 1px dashed #000; text-align: center; }
h1, p, span, strong { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
</style></head><body data-sale-ticket="true"><header><h1>${text(ticket.title)}</h1>${ticket.businessName === null ? "" : `<p>${text(ticket.businessName)}</p>`}${ticket.saleId === null ? "" : `<p>${text(ticket.saleId)}</p>`}${ticket.issuedAt === null ? "" : `<p>${text(ticket.issuedAt)}</p>`}</header><main>${rows}<div class="total"><span>${text(ticket.totalLabel)}</span><strong>${text(ticket.total)}</strong></div><p>${text(ticket.paymentLabel)}: ${text(ticket.paymentMethod)}</p></main><footer><p>${text(ticket.footer)}</p></footer></body></html>`;
}

let activeFrame: HTMLIFrameElement | null = null;
const abortError = () => new DOMException("Print preparation aborted", "AbortError");

/** Resolves after requesting the native dialog, never as confirmation of a physical print. */
export function printSaleTicket(ticket: SaleTicketModel, options: { signal?: AbortSignal } = {}): Promise<void> {
  if (options.signal?.aborted) return Promise.reject(abortError());
  if (activeFrame !== null) return Promise.reject(new Error("print_busy"));
  return new Promise<void>((resolve, reject) => {
    let frame: HTMLIFrameElement | null = null;
    let printWindow: Window | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let dispatched = false;
    let settled = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(loadTimer);
      options.signal?.removeEventListener("abort", onAbort);
      printWindow?.removeEventListener("afterprint", cleanup);
      frame?.removeEventListener("load", onLoad);
      frame?.removeEventListener("error", onError);
      frame?.remove();
      if (activeFrame === frame) activeFrame = null;
    };
    const fail = (error: unknown) => {
      cleanup();
      if (!settled) { settled = true; reject(error); }
    };
    const requested = () => { if (!settled) { settled = true; resolve(); } };
    function onAbort() {
      // Retiring this local DOM cannot retract a preview/spool already owned by the browser or OS.
      if (dispatched) { cleanup(); requested(); }
      else fail(abortError());
    }
    function onError() { fail(new Error("print_load_failed")); }
    function onLoad() {
      if (cleaned || dispatched) return;
      try {
        if (frame?.contentDocument?.body?.dataset.saleTicket !== "true") return;
        if (options.signal?.aborted) { onAbort(); return; }
        printWindow = frame.contentWindow;
        if (!printWindow || typeof printWindow.print !== "function") throw new Error("print_unavailable");
        clearTimeout(loadTimer);
        printWindow.addEventListener("afterprint", cleanup, { once: true });
        dispatched = true;
        printWindow.print();
        requested();
      } catch (error) { fail(error); }
    }
    try {
      const html = buildSaleTicketHtml(ticket);
      frame = document.createElement("iframe");
      activeFrame = frame;
      frame.title = ticket.title;
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.setAttribute("sandbox", "allow-same-origin allow-modals");
      Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "80mm", height: "1px", border: "0", pointerEvents: "none" });
      frame.addEventListener("load", onLoad);
      frame.addEventListener("error", onError);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) { onAbort(); return; }
      frame.srcdoc = html;
      loadTimer = setTimeout(() => fail(new Error("print_load_timeout")), 10000);
      document.body.appendChild(frame);
    } catch (error) { fail(error); }
  });
}
