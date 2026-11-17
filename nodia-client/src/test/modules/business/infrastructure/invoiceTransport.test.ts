import { afterEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { createInvoiceWithFile, getInvoiceEditSource } from "../../../../modules/business/infrastructure/services";

afterEach(() => vi.restoreAllMocks());

describe("optional invoice folio transport", () => {
  it.each([undefined, null, "", "   "])("omits an absent folio from multipart without serializing null/undefined: %s", async code => {
    const post = vi.spyOn(mainInstance, "post").mockResolvedValue({ data: { id: "synthetic-invoice", code: null } });
    await createInvoiceWithFile({ business_id: "synthetic-business", code, is_active: false });
    const body = post.mock.calls[0][1] as FormData;
    expect(body.has("code")).toBe(false);
    expect(body.get("business_id")).toBe("synthetic-business");
    expect(body.get("is_active")).toBe("false");
    expect(body.get("total_amount")).toBe("0");
  });

  it("preserves an explicit trimmed folio and existing upload fields", async () => {
    const post = vi.spyOn(mainInstance, "post").mockResolvedValue({ data: { id: "synthetic-invoice", code: "F-1445" } });
    const file = new File(["synthetic"], "invoice.pdf", { type: "application/pdf" });
    await createInvoiceWithFile({ business_id: "synthetic-business", file, code: "  F-1445  ", total_amount: 1445 });
    const body = post.mock.calls[0][1] as FormData;
    expect(body.get("code")).toBe("F-1445");
    expect(body.get("total_amount")).toBe("1445");
    expect(body.get("file")).toBe(file);
  });
});

describe("Caja linked invoice transport", () => {
  const source = {
    id: "133",
    business_id: "synthetic-business",
    code: null,
    provider_id: null,
    total_amount: 230,
    path_storage: "",
    data: { issue_date: "2026-11-17", reviewed_items: [1, 2] },
    is_active: false,
  };

  it("fetches the exact invoice and retains its accounting metadata", async () => {
    const abort = new AbortController();
    const get = vi.spyOn(mainInstance, "get").mockResolvedValue({ data: source });
    await expect(getInvoiceEditSource(source.business_id, source.id, abort.signal)).resolves.toEqual(source);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/invoices\/133$/), { signal: abort.signal });
  });

  it.each([
    { ...source, business_id: "different-business" },
    { ...source, id: "132" },
    { ...source, total_amount: "230" },
  ])("rejects a mismatched or malformed source invoice", async (data) => {
    vi.spyOn(mainInstance, "get").mockResolvedValue({ data });
    await expect(getInvoiceEditSource(source.business_id, source.id)).rejects.toBeInstanceOf(Error);
  });
});
