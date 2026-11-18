import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { apiPath } from "../../../../config/apiPath";
import type { InvoiceSelectableModelsParams } from "../../../../modules/business/infrastructure/types";
import { useInvoiceSelectableModels } from "../../../../modules/business/infrastructure/useServices";

vi.mock("../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true, sessionVersion: 1 }) }));
vi.mock("../../../../config/api", () => ({ mainInstance: { get: vi.fn() } }));

describe("invoice selectable models", () => {
  it("reads the business endpoint only for the explicitly selected instance and mode", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const provider_id = "9007199254740993";
    const params = { provider_id, mode: "agentic" } as const;
    const observation = [{ providerId: provider_id, mode: "agentic", models_source: "provider", models: [{ id: "synthetic-model" }] }];
    vi.mocked(mainInstance.get).mockResolvedValue({ data: observation });
    const { result, rerender } = renderHook((selection: InvoiceSelectableModelsParams | null) => useInvoiceSelectableModels(selection), {
      wrapper, initialProps: null as InvoiceSelectableModelsParams | null,
    });
    expect(mainInstance.get).not.toHaveBeenCalled();

    rerender(params);

    await waitFor(() => expect(result.current.data).toEqual(observation));
    expect(mainInstance.get).toHaveBeenCalledExactlyOnceWith(apiPath("/invoices/selectable-models"), {
      params, signal: expect.any(AbortSignal),
    });
    client.clear();
  });
});
