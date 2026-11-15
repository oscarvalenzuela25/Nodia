import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PosProductRegistration from "../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductRegistration";
import useAuthStore from "../../../../../../../store/authStore";
import { emptyJournal, productSaveKey } from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/productSaveRecovery";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("../../../../../../../modules/business/infrastructure/useServices", () => ({
  useCreateProduct: () => ({ isPending: false, mutateAsync: mocks.create }), useUpdateProduct: () => ({ isPending: false, mutateAsync: mocks.update }),
}));
vi.mock("../../../../../../../modules/business/infrastructure/usePagedOptions", () => ({ usePagedProviderOptions: () => ({ providers: [], isFetching: false, hasNextPage: false, setSearch: vi.fn(), fetchNextPage: vi.fn() }) }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductImageDraft", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  useAuthStore.setState({ user: { id: "qa-actor", name: "QA" }, token: "synthetic-session", expiresAt: Date.now() + 60000, sessionStatus: "authenticated" });
});
const renderRegistration = (onClose = vi.fn(), onRegistered = vi.fn()) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PosProductRegistration businessId="business-a" barcode="00000123" onClose={onClose} onRegistered={onRegistered} /></QueryClientProvider>);

describe("POS product registration", () => {
  it("keeps the real product form and exact barcode after a rejected create, then closes only after confirmed retry", async () => {
    const onClose = vi.fn(); const onRegistered = vi.fn();
    mocks.create.mockRejectedValueOnce(Object.assign(new AxiosError("Synthetic validation failure"), { response: { status: 400 } }))
      .mockImplementationOnce(async payload => ({ ...payload, id: "7", version: 1, stock: 0 }));
    renderRegistration(onClose, onRegistered);
    const name = screen.getByRole("textbox", { name: /^Nombre del Producto/ });
    const barcode = screen.getByRole("textbox", { name: "Código de barras" });
    expect(barcode).toHaveValue("00000123"); await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "New synthetic product");
    await userEvent.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled(); expect(onRegistered).not.toHaveBeenCalled(); expect(name).toHaveValue("New synthetic product"); expect(barcode).toHaveValue("00000123");
    await waitFor(() => expect(screen.getByTestId("save-product-btn")).toBeEnabled());
    await userEvent.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ business_id: "business-a", barcode: "00000123", name: "New synthetic product" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onRegistered).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "7", version: 1, business_id: "business-a", barcode: "00000123" }));
  });
  it("does not repeat a confirmed creation while its success callback is pending or when that consumer fails", async () => {
    mocks.create.mockImplementation(async payload => ({ ...payload, id: "8", version: 1, stock: 0 }));
    let rejectCompletion!: (error: Error) => void;
    const onRegistered = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectCompletion = reject; }));
    const onClose = vi.fn(); renderRegistration(onClose, onRegistered);
    await userEvent.type(screen.getByRole("textbox", { name: /^Nombre del Producto/ }), "Saved product");
    await userEvent.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    fireEvent.submit(document.querySelector('#product-form')!);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await act(async () => rejectCompletion(new Error("Synthetic post-save consumer failed")));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    fireEvent.submit(document.querySelector('#product-form')!);
    expect(mocks.create).toHaveBeenCalledTimes(1); expect(onRegistered).toHaveBeenCalledTimes(1);
  });
  it("prioritizes a persisted unknown creation journal over a new scanned prefill without replaying it", async () => {
    const product = { id: "7", business_id: "business-a", barcode: "00000999", name: "Previously saved", code: null, version: 3,
      cost_price: 0, cost_price_tax: 0, sale_price: 0, has_stock: true, is_offer_enabled: false, offer_price: 0, is_active: true, stock: 0 };
    sessionStorage.setItem(productSaveKey("qa-actor", "business-a", null), JSON.stringify({ ...emptyJournal("qa-actor", "business-a", null), product, fieldsUnknown: true }));
    renderRegistration();
    expect(screen.getByRole("textbox", { name: "Código de barras" })).toHaveValue("00000999");
    expect(screen.getByRole("textbox", { name: /^Nombre del Producto/ })).toHaveValue("Previously saved");
    expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
