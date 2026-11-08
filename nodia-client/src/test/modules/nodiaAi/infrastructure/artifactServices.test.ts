import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { ARTIFACT_MAX_BYTES, artifactResponseMetadata, isNodiaAiArtifactTool } from "../../../../modules/nodiaAi/infrastructure/artifactSchemas";
import { downloadNodiaAiArtifact } from "../../../../modules/nodiaAi/infrastructure/artifactServices";

vi.mock("../../../../config/api", () => ({ mainInstance: { get: vi.fn() } }));
const reference = { tool_call_id: "77777777-7777-4777-8777-777777777777", tool_name: "nodia_products_export_csv" as const, contract_hash: "a".repeat(64) };
const response = () => ({ data: new Blob(["header\nrow"], { type: "text/csv" }), headers: { "content-disposition": 'attachment; filename="products.csv"', "content-type": "text/csv; charset=utf-8" } });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(mainInstance.get).mockResolvedValue(response()); });
describe("authorized artifact transport", () => {
  it("uses the exact receipt UUID, the shared authenticated client and server filename", async () => {
    const result = await downloadNodiaAiArtifact(reference, new AbortController().signal);
    expect(result.filename).toBe("products.csv");
    expect(result.blob.size).toBe(10);
    expect(mainInstance.get).toHaveBeenCalledWith(`/nodia-ai/artifacts/${reference.tool_call_id}`, expect.objectContaining({ responseType: "blob", signal: expect.any(AbortSignal) }));
  });
  it("rejects arbitrary tools, paths and invalid contract references before HTTP", async () => {
    for (const value of [{ ...reference, tool_name: "nodia_users_list" }, { ...reference, tool_call_id: "https://example.invalid/private" }, { ...reference, tool_call_id: "77777777-7777-1777-8777-777777777777" }, { ...reference, contract_hash: "unknown" }])
      await expect(downloadNodiaAiArtifact(value as typeof reference, new AbortController().signal)).rejects.toThrow();
    expect(mainInstance.get).not.toHaveBeenCalled();
    expect(isNodiaAiArtifactTool("nodia_products_export_csv")).toBe(true);
    expect(isNodiaAiArtifactTool("nodia_reports_run")).toBe(false);
  });
  it.each([
    ['attachment; filename="../private.csv"', "text/csv; charset=utf-8"],
    ['attachment; filename="other.csv"', "text/csv; charset=utf-8"],
    ['attachment; filename="products.csv"', "text/html"],
    [undefined, "text/csv; charset=utf-8"],
  ])("rejects missing or substituted filename/MIME without inventing metadata", (disposition, mime) => {
    expect(() => artifactResponseMetadata(reference.tool_name, disposition, mime)).toThrow("nodia_ai:invalid_response");
  });
  it("binds invoice extension to MIME and keeps only attachment filenames", () => {
    expect(artifactResponseMetadata("nodia_invoices_file", 'attachment; filename="invoice-9.pdf"', "application/pdf")).toEqual({ filename: "invoice-9.pdf", mime: "application/pdf" });
    expect(() => artifactResponseMetadata("nodia_invoices_file", 'attachment; filename="invoice-9.pdf"', "image/png")).toThrow();
    expect(() => artifactResponseMetadata("nodia_invoices_file", 'inline; filename="invoice-9.pdf"', "application/pdf")).toThrow();
  });
  it("rejects nonblobs, empty content and a completed response above the client safeguard", async () => {
    for (const data of ["synthetic", new Blob(), new Blob([new Uint8Array(ARTIFACT_MAX_BYTES + 1)])]) {
      vi.mocked(mainInstance.get).mockResolvedValueOnce({ ...response(), data });
      await expect(downloadNodiaAiArtifact(reference, new AbortController().signal)).rejects.toThrow();
    }
  });
  it("aborts on an observed oversized progress total, without claiming a hard XHR memory cap", async () => {
    vi.mocked(mainInstance.get).mockImplementationOnce(async (_path, config) => {
      config?.onDownloadProgress?.({ loaded: 10, total: ARTIFACT_MAX_BYTES + 1, bytes: 10, lengthComputable: true });
      expect(config?.signal?.aborted).toBe(true);
      return response();
    });
    await expect(downloadNodiaAiArtifact(reference, new AbortController().signal)).rejects.toThrow("nodia_ai:artifact_limit");
  });
  it("preserves bounded server JSON failures returned as Blob for the existing toast helper", async () => {
    const blob = new Blob(['{"message":"nodia_ai:conversation_expired"}'], { type: "application/json" });
    Object.defineProperty(blob, "text", { value: async () => '{"message":"nodia_ai:conversation_expired"}' });
    const error = new AxiosError("Synthetic failure", "ERR_BAD_REQUEST", undefined, undefined, { data: blob, status: 410, statusText: "Gone", headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() } });
    vi.mocked(mainInstance.get).mockRejectedValueOnce(error);
    await expect(downloadNodiaAiArtifact(reference, new AbortController().signal)).rejects.toMatchObject({ response: { data: { message: "nodia_ai:conversation_expired" } } });
  });
  it("honors caller cancellation before HTTP and after a late response", async () => {
    const initial = new AbortController(); initial.abort();
    await expect(downloadNodiaAiArtifact(reference, initial.signal)).rejects.toThrow();
    expect(mainInstance.get).not.toHaveBeenCalled();
    const late = new AbortController();
    vi.mocked(mainInstance.get).mockImplementationOnce(async () => { late.abort(); return response(); });
    await expect(downloadNodiaAiArtifact(reference, late.signal)).rejects.toThrow();
  });
});
