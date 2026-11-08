import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { useAnalyzeInvoice } from "../../../../modules/business/infrastructure/useServices";
import * as services from "../../../../modules/business/infrastructure/services";
import type { AnalyzeInvoiceParams, AnalyzeInvoiceResponse } from "../../../../modules/business/infrastructure/types";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const response: AnalyzeInvoiceResponse = { business_id: "synthetic-business", provider_id: null, code: "synthetic", total_amount: 0, data: { items: [] } };
const params = (signal?: AbortSignal): AnalyzeInvoiceParams => ({ business_id: response.business_id, file: new File(["synthetic"], "invoice.pdf"), signal });
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("invoice analysis feedback ownership", () => {
  it.each(["runtime_busy", "native_proof_missing", "native_proof_mismatch"])("explains %s once, preserves the request and never retries automatically", async code => {
    const error = new AxiosError("synthetic runtime rejection", undefined, undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() },
      data: { upstreamErrorCode: code, message: "synthetic raw status" },
    });
    vi.spyOn(services, "analyzeInvoice").mockRejectedValue(error);
    const input = params();
    const { result } = renderHook(useAnalyzeInvoice, { wrapper: wrapper() });
    await act(async () => { await result.current.mutateAsync(input).catch(() => undefined); });
    expect(services.analyzeInvoice).toHaveBeenCalledOnce();
    expect(services.analyzeInvoice).toHaveBeenCalledWith(input);
    expect(sileo.error).toHaveBeenCalledOnce();
    const description = vi.mocked(sileo.error).mock.calls[0][0]?.description;
    expect(description).toContain("archivo se conserva");
    expect(description).not.toContain("sesión");
    expect(description).not.toContain("synthetic raw status");
  });
  it("keeps feedback for a current successful analysis", async () => {
    vi.spyOn(services, "analyzeInvoice").mockResolvedValue(response);
    const { result } = renderHook(useAnalyzeInvoice, { wrapper: wrapper() });
    await act(async () => { await result.current.mutateAsync(params()); });
    expect(sileo.success).toHaveBeenCalledOnce();
    expect(sileo.error).not.toHaveBeenCalled();
  });
  it("does not announce a late success after cancellation even if a transport ignores abort", async () => {
    let resolve!: (value: AnalyzeInvoiceResponse) => void;
    vi.spyOn(services, "analyzeInvoice").mockImplementation(() => new Promise(done => { resolve = done; }));
    const controller = new AbortController();
    const { result } = renderHook(useAnalyzeInvoice, { wrapper: wrapper() });
    let pending!: Promise<AnalyzeInvoiceResponse>;
    await act(async () => { pending = result.current.mutateAsync(params(controller.signal)); });
    controller.abort();
    await act(async () => { resolve(response); await pending; });
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
  it.each(["aborted", "obsolete"] as const)("does not report a late failure for an %s execution or retry it", async state => {
    const controller = new AbortController();
    if (state === "aborted") controller.abort();
    vi.spyOn(services, "analyzeInvoice").mockRejectedValue(new AxiosError("synthetic late failure"));
    const { result } = renderHook(useAnalyzeInvoice, { wrapper: wrapper() });
    await act(async () => { await result.current.mutateAsync({ ...params(controller.signal), isCurrent: () => state !== "obsolete" }).catch(() => undefined); });
    expect(services.analyzeInvoice).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
});
