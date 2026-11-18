import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../../../../store/authStore";
import { useListEditor } from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/useListEditor";
import * as transport from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services";

vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services", async importOriginal => ({
  ...await importOriginal<typeof transport>(),
  createList: vi.fn(),
  readListReceipt: vi.fn(),
}));

vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));

const detail: transport.ShoppingListDetail = {
  id: "f607e746-cbaa-4d2c-8c92-1ad9b0035ee6",
  name: "Reposición",
  is_active: true,
  version: 1,
  item_count: 1,
  items: [{
    id: "2613534b-b3a5-48e5-821b-215d27b7cbd0", product_id: "9223372036854775807", name: "Arroz",
    available: true, quantity: "2.5", checked: false, check_version: 1, position: 0,
  }],
};
const draft = { name: detail.name, items: [{ product_id: detail.items[0].product_id, quantity: "2.5" }] };

function renderEditor() {
  const client = new QueryClient();
  const close = vi.fn();
  const scope = {
    actorId: "actor",
    sessionVersion: useAuthStore.getState().sessionVersion,
    businessId: "1d210151-95db-4011-a2d5-2f048576c237",
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useListEditor(scope, close), { wrapper }), close, scope };
}

describe("shopping list save reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.getState().login({ token: "synthetic-test-token", expiresAt: Date.now() + 60_000, user: { id: "actor", name: "Actor" } });
  });

  it("recovers a committed create by receipt without sending another POST", async () => {
    vi.mocked(transport.createList).mockRejectedValueOnce(new Error("Response lost"));
    vi.mocked(transport.readListReceipt).mockResolvedValueOnce(detail);
    const { result, close, scope } = renderEditor();

    act(() => result.current.save(draft));
    await waitFor(() => expect(result.current.pendingCreate).toBe(true));
    expect(close).not.toHaveBeenCalled();
    const original = vi.mocked(transport.createList).mock.calls[0][1];

    act(() => result.current.verify());
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(transport.readListReceipt).toHaveBeenCalledWith(scope.businessId, original.request_key);
    expect(transport.createList).toHaveBeenCalledOnce();
  });

  it("keeps the original draft and key for a user retry after a missing receipt", async () => {
    vi.mocked(transport.createList).mockRejectedValueOnce(new Error("Timeout")).mockResolvedValueOnce(detail);
    vi.mocked(transport.readListReceipt).mockResolvedValueOnce(null);
    const { result, close, scope } = renderEditor();

    act(() => result.current.save(draft));
    await waitFor(() => expect(result.current.pendingCreate).toBe(true));
    const original = vi.mocked(transport.createList).mock.calls[0][1];

    act(() => {
      result.current.save({ ...draft, name: "Nombre distinto" });
      result.current.retryCreate();
      result.current.verify();
    });
    await waitFor(() => expect(result.current.receiptMissing).toBe(true));
    expect(close).not.toHaveBeenCalled();
    expect(transport.createList).toHaveBeenCalledOnce();

    act(() => result.current.retryCreate());
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(transport.createList).toHaveBeenLastCalledWith(scope.businessId, original);
  });
});
