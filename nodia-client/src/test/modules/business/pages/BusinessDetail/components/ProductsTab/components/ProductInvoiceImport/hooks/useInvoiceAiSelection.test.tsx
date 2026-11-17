import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifyIaProviderItem } from "../../../../../../../../../../modules/business/infrastructure/types";
import { useInvoiceAiSelection } from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/hooks/useInvoiceAiSelection";

const models = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../../../../../../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true }) }));
vi.mock("../../../../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices", () => ({ useSelectableModels: models.query }));
const provider: VerifyIaProviderItem = { id: "instance-1", key: "openai", name: "Synthetic", mode: "agentic", active_mode: "agentic",
  is_active: true, use_agentic: true, use_api_key: true, can_use_model: true, fields: {
    agentic: { selected_model: "model-a", thinking_level: "high", thinking_levels: { "model-b": "low" } },
    api_key: { selected_model: "api-model", thinking_level: "max" },
  } };
const catalog = [
  { id: "model-a", inputModalities: ["image"], supportedReasoningEfforts: ["low", "medium", "high"] },
  { id: "model-b", inputModalities: ["image"], supportedReasoningEfforts: ["low", "medium"] },
];
const query = { isSuccess: true, isError: false, isFetching: false, refetch: vi.fn(), data: [
  { providerId: "instance-1", mode: "agentic", models_source: "provider", models: catalog },
] };
beforeEach(() => { vi.clearAllMocks(); models.query.mockReturnValue(query); });

describe("useInvoiceAiSelection", () => {
  it("prefills configured model/intensity and keeps explicit local choices through revalidation", () => {
    const { result, rerender } = renderHook(() => useInvoiceAiSelection(provider, "agentic", "business-1"));
    expect(result.current).toMatchObject({ model: "model-a", thinkingLevel: "high", canAnalyze: true });
    act(() => result.current.selectModel("model-b"));
    expect(result.current).toMatchObject({ model: "model-b", thinkingLevel: "low" });
    act(() => result.current.selectThinkingLevel("medium"));
    models.query.mockReturnValue({ ...query, isFetching: true });
    rerender();
    expect(result.current).toMatchObject({ model: "model-b", thinkingLevel: "medium", canAnalyze: false });
    models.query.mockReturnValue(query);
    rerender();
    expect(result.current).toMatchObject({ model: "model-b", thinkingLevel: "medium", canAnalyze: true });
  });
  it("scopes local choices by exact provider, mode and business", () => {
    const { result, rerender } = renderHook(({ selected, mode, business }: { selected: VerifyIaProviderItem; mode: "agentic" | "api_key"; business: string }) =>
      useInvoiceAiSelection(selected, mode, business), { initialProps: { selected: provider, mode: "agentic", business: "business-1" } });
    act(() => result.current.selectModel("model-b"));
    rerender({ selected: { ...provider, id: "instance-2" }, mode: "agentic", business: "business-1" });
    expect(result.current.model).toBe("model-a");
    rerender({ selected: provider, mode: "api_key", business: "business-1" });
    expect(result.current).toMatchObject({ model: "api-model", thinkingLevel: "max" });
    rerender({ selected: provider, mode: "agentic", business: "business-2" });
    expect(result.current.model).toBe("model-a");
  });
  it("keeps the chosen values and exposes a retry after a catalog error", () => {
    const { result, rerender } = renderHook(() => useInvoiceAiSelection(provider, "agentic", "business-1"));
    act(() => result.current.selectModel("model-b"));
    act(() => result.current.selectThinkingLevel("medium"));
    models.query.mockReturnValue({ ...query, isError: true, isSuccess: false });
    rerender();
    expect(result.current).toMatchObject({ model: "model-b", thinkingLevel: "medium", isError: true, canAnalyze: false });
    expect(result.current.refetch).toBe(query.refetch);
  });
  it("rejects stale observations of another instance and vanished models without switching defaults", () => {
    models.query.mockReturnValue({ ...query, data: [{ ...query.data[0], providerId: "other-instance" }] });
    const { result } = renderHook(() => useInvoiceAiSelection(provider, "agentic", "business-1"));
    expect(result.current).toMatchObject({ model: "model-a", modelUnavailable: true, canAnalyze: false });
  });
  it("can discover choices with no assigned default while keeping inference blocked", () => {
    const unassigned = { ...provider, can_use_model: false, fields: { agentic: {} } };
    const { result } = renderHook(() => useInvoiceAiSelection(unassigned, "agentic", "business-1"));
    expect(models.query).toHaveBeenCalledWith({ provider_id: "instance-1", mode: "agentic" }, { enabled: true });
    expect(result.current.modelOptions.map(item => item.value)).toEqual(["model-a", "model-b"]);
    expect(result.current).toMatchObject({ model: "", canAnalyze: false });
  });
  it("treats unavailable or malformed catalogs as unknown, never as executable alternatives", () => {
    models.query.mockReturnValue({ ...query, data: [null, { ...query.data[0], models_source: "unavailable", models: [{ id: "fabricated" }] }] });
    const { result } = renderHook(() => useInvoiceAiSelection(provider, "agentic", "business-1"));
    expect(result.current).toMatchObject({ model: "model-a", modelUnavailable: true, canAnalyze: false });
    expect(result.current.modelOptions.map(item => item.value)).not.toContain("fabricated");
  });
});
