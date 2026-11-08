import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVerifyIaProviders } from "../../../../modules/business/infrastructure/useServices";
import { verifyIaProviders } from "../../../../modules/business/infrastructure/services";
import type { InvoiceAiConnectionMode, VerifyIaProviderItem } from "../../../../modules/business/infrastructure/types";
import { resolveInvoiceAiConfiguration } from "../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection";

vi.mock("../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true }) }));
vi.mock("../../../../modules/business/infrastructure/services");

// Independent synthetic observations, without accounts, keys or provider calls.
const observed = (mode: InvoiceAiConnectionMode): VerifyIaProviderItem => ({
  id: "9007199254740993", key: "gemini", name: "Synthetic connection", mode, active_mode: mode,
  default_mode: "agentic", is_active: true, can_use_model: true, use_agentic: true, use_api_key: true,
  fields: { agentic: { selected_model: "synthetic-agentic" }, api_key: { selected_model: "synthetic-api" } },
});

beforeEach(() => vi.resetAllMocks());

describe("mode-specific invoice AI verification", () => {
  it("keeps distinct caches and blocks another mode until its own observation arrives", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    let finishApi: ((value: VerifyIaProviderItem[]) => void) | undefined;
    vi.mocked(verifyIaProviders).mockImplementation(mode => mode === "api_key"
      ? new Promise(resolve => { finishApi = resolve; }) : Promise.resolve([observed("agentic")]));
    const { result, rerender } = renderHook(({ mode }: { mode: InvoiceAiConnectionMode }) => useVerifyIaProviders({ mode }), {
      wrapper, initialProps: { mode: "agentic" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(verifyIaProviders).toHaveBeenLastCalledWith("agentic");
    expect(resolveInvoiceAiConfiguration(observed("agentic"), "api_key").canAnalyze).toBe(false);

    rerender({ mode: "api_key" });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data).toEqual([observed("agentic")]);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(verifyIaProviders).toHaveBeenLastCalledWith("api_key");
    await act(async () => { finishApi?.([observed("api_key")]); });
    await waitFor(() => expect(result.current.data).toEqual([observed("api_key")]));
    expect(resolveInvoiceAiConfiguration(observed("api_key"), "api_key")).toMatchObject({ model: "synthetic-api", canAnalyze: true });
    expect(client.getQueryData(["invoice", "verify-ia-providers", "agentic"])).toEqual([observed("agentic")]);
    expect(client.getQueryData(["invoice", "verify-ia-providers", "api_key"])).toEqual([observed("api_key")]);
    client.clear();
  });
});
