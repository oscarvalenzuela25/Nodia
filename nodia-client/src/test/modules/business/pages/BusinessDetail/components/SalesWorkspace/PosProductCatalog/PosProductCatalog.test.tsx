import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PosProductCatalog, { type PosProductCatalogProps } from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductCatalog";
import { getProducts } from "../../../../../../../../modules/business/infrastructure/services";
import type { GetProductsResponse, ProductEntity } from "../../../../../../../../modules/business/infrastructure/types";
import useAuthStore from "../../../../../../../../store/authStore";
import i18n from "../../../../../../../../translate";

const feedback = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../../../../../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
vi.mock("sileo", () => ({ sileo: feedback }));
const fetchProducts = vi.mocked(getProducts);
const text = (key: string) => String(i18n.t(`business:pos.${key}`));
const clients = new Set<QueryClient>();
const item = (id: string, overrides: Partial<ProductEntity> = {}): ProductEntity => ({
  id, business_id: "business-a", version: 2, name: `Synthetic product ${id}`, code: `SUP-${id}`, barcode: `000${id}`,
  cost_price: 100, cost_price_tax: 119, sale_price: 149, offer_price: null, is_offer_enabled: false,
  effective_price: "149", price_source: "regular", has_stock: true, stock: 0, is_active: true, ...overrides,
});
const page = (data: ProductEntity[], current = 1, total = 1): GetProductsResponse => ({ data, meta: { page: current, limit: 24, total_items: total * 24, total_pages: total } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
function renderCatalog(overrides: Partial<PosProductCatalogProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.add(client);
  const onSelect = vi.fn();
  const props = { businessId: "business-a", disabled: false, onSelect, ...overrides };
  const result = render(<QueryClientProvider client={client}><PosProductCatalog {...props} /></QueryClientProvider>);
  return { ...result, client, onSelect, update: (next: Partial<PosProductCatalogProps>) => result.rerender(<QueryClientProvider client={client}><PosProductCatalog {...props} {...next} /></QueryClientProvider>) };
}
async function readyInput() {
  const input = screen.getByRole("combobox");
  await waitFor(() => { expect(input).toBeEnabled(); expect(input).toHaveAttribute("aria-busy", "false"); });
  return input;
}
async function openPopup(input: HTMLElement) {
  if (input.getAttribute("aria-expanded") !== "true") await userEvent.setup().click(input);
}
function scrollToBottom(listbox: HTMLElement) {
  Object.defineProperties(listbox, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 400 },
    scrollTop: { configurable: true, value: 600, writable: true },
  });
  fireEvent.scroll(listbox);
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage("es");
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 });
});
afterEach(() => { cleanup(); for (const client of clients) client.clear(); clients.clear(); vi.restoreAllMocks(); });

describe("POS autocomplete catalogue", () => {
  it("does not render catalogue data as cart rows and selects the exact keyboard option once with duplicate names", async () => {
    const first = item("1", { name: "Same product", sale_price: 0, effective_price: "0", image: { id: "image-1", url: "https://storage.example.test/synthetic.png", width: 80, height: 80, mime_type: "image/png", byte_size: 1 } });
    const second = item("2", { name: "Same product" });
    fetchProducts.mockResolvedValue(page([first, second]));
    const { onSelect } = renderCatalog();
    const input = await readyInput();
    expect(screen.queryByText("Same product")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(input);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByRole("listbox")).toHaveStyle({ overflowAnchor: "none" });
    expect(within(options[0]).getByText(/\$\s*0/)).toBeInTheDocument();
    expect(options[0].querySelector("img")).toHaveAttribute("src", first.image!.url);
    expect(options[0].querySelector("img")).toHaveAttribute("loading", "lazy");
    for (const option of options) {
      expect(option).not.toHaveTextContent(/SUP-|0001|0002/);
      expect(option.querySelector("button,input,[role=button],[role=group]")).toBeNull();
    }
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(second);
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Same product")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text("catalog_load_more") })).not.toBeInTheDocument();
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it("keeps full search editable during debounce, rejects stale options and clears/closes after selection", async () => {
    fetchProducts.mockResolvedValueOnce(page([item("1", { name: "Old search option" })])).mockResolvedValue(page([item("2", { name: "Coffee" })]));
    const { onSelect } = renderCatalog();
    const input = await readyInput();
    const user = userEvent.setup();
    await user.click(input);
    await screen.findByRole("option", { name: /Old search option/ });
    fireEvent.change(input, { target: { value: "Coff" } });
    expect(input).not.toHaveAttribute("readonly");
    fireEvent.change(input, { target: { value: "Coffee" } });
    expect(input).toHaveValue("Coffee");
    const previous = screen.getByRole("option", { name: /Old search option/ });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(previous);
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchProducts.mock.calls.at(-1)?.[0]?.q?.name_cont).toBe("Coffee"));
    await readyInput();
    await openPopup(input);
    const result = await screen.findByRole("option", { name: /Coffee/ });
    expect(screen.queryByRole("option", { name: /Old search option/ })).not.toBeInTheDocument();
    await user.click(result);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "2", name: "Coffee" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(fetchProducts.mock.calls[1][0]).toEqual(expect.objectContaining({ page: 1, limit: 24, includes: true, q: expect.objectContaining({ business_id_eq: "business-a", name_cont: "Coffee" }) }));
  });

  it("locks duplicate bottom scrolls, keeps options on next-page error and retries only the failed page", async () => {
    const next = deferred<GetProductsResponse>();
    fetchProducts.mockResolvedValueOnce(page([item("1")], 1, 3)).mockReturnValueOnce(next.promise)
      .mockResolvedValueOnce(page([item("2")], 2, 3)).mockResolvedValueOnce(page([item("3")], 3, 3));
    const { onSelect } = renderCatalog();
    const input = await readyInput();
    const user = userEvent.setup();
    await user.click(input);
    const first = await screen.findByRole("option", { name: /Synthetic product 1/ });
    const listbox = screen.getByRole("listbox");
    act(() => { scrollToBottom(listbox); scrollToBottom(listbox); scrollToBottom(listbox); });
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("listbox")).toBe(listbox);
    expect(screen.getByRole("option", { name: /Synthetic product 1/ })).toBe(first);
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(listbox.scrollTop).toBe(600);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => { next.reject(new AxiosError("Synthetic next-page failure")); });
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("core:server_error_alert"));
    await openPopup(input);
    expect(screen.getByRole("option", { name: /Synthetic product 1/ })).toBe(first);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: text("retry") }).focus();
    await user.keyboard("{Enter}");
    await readyInput();
    await openPopup(input);
    expect(await screen.findByRole("option", { name: /Synthetic product 2/ })).toBeInTheDocument();
    act(() => { scrollToBottom(screen.getByRole("listbox")); });
    await screen.findByRole("option", { name: /Synthetic product 3/ });
    await readyInput();
    act(() => { scrollToBottom(screen.getByRole("listbox")); });
    expect(fetchProducts.mock.calls.map(([params]) => params?.page)).toEqual([1, 2, 2, 3]);
  });

  it("distinguishes initial error/retry from an empty popup and never selects an empty result", async () => {
    fetchProducts.mockRejectedValueOnce(new AxiosError("Synthetic initial read failed")).mockResolvedValueOnce(page([], 1, 0));
    const { onSelect } = renderCatalog();
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("core:server_error_alert"));
    expect(feedback.error).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole("button", { name: text("retry") }));
    const input = await readyInput();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.setup().click(input);
    expect(await screen.findByText(text("catalog_empty"))).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it("blocks initial loading and explicit disabled mode without hiding the fetching state", async () => {
    const initial = deferred<GetProductsResponse>();
    fetchProducts.mockReturnValue(initial.promise);
    const onFetchingChange = vi.fn();
    const { onSelect, update } = renderCatalog({ onFetchingChange });
    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(onFetchingChange).toHaveBeenCalledWith(true);
    update({ disabled: true });
    await act(async () => { initial.resolve(page([item("1")])); });
    await waitFor(() => expect(onFetchingChange).toHaveBeenLastCalledWith(false));
    expect(input).toBeDisabled();
    fireEvent.mouseDown(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    update({ disabled: false });
    await userEvent.setup().click(await readyInput());
    expect(await screen.findByRole("option")).toBeInTheDocument();
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it("preserves zero versus missing price and permits only active unavailable products for barcode assignment", async () => {
    const zero = item("1", { sale_price: 0, effective_price: "0" });
    const unavailable = item("2", { has_stock: false, effective_price: null });
    const inactive = item("3", { is_active: false });
    fetchProducts.mockResolvedValue(page([zero, unavailable, inactive]));
    const { onSelect, update } = renderCatalog();
    const user = userEvent.setup();
    const input = await readyInput();
    await user.click(input);
    expect(fetchProducts.mock.calls[0][0]?.q?.has_stock_eq).toBe(true);
    const zeroOption = screen.getByRole("option", { name: /Synthetic product 1/ });
    const unavailableOption = screen.getByRole("option", { name: /Synthetic product 2/ });
    expect(within(zeroOption).getByText(/\$\s*0/)).toBeInTheDocument();
    expect(within(unavailableOption).getByText(text("catalog_price_unavailable"))).toBeInTheDocument();
    expect(within(unavailableOption).queryByText(/\$\s*0/)).not.toBeInTheDocument();
    expect(unavailableOption).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(unavailableOption);
    expect(onSelect).not.toHaveBeenCalled();
    await openPopup(input);
    await user.click(screen.getByRole("option", { name: /Synthetic product 1/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(zero);
    update({ assignmentMode: true });
    await readyInput();
    await openPopup(screen.getByRole("combobox"));
    const assignable = await screen.findByRole("option", { name: /Synthetic product 2/ });
    expect(assignable).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByRole("option", { name: /Synthetic product 3/ })).toHaveAttribute("aria-disabled", "true");
    expect(fetchProducts.mock.calls.at(-1)?.[0]?.q).not.toHaveProperty("has_stock_eq");
    await user.click(assignable);
    expect(onSelect.mock.calls).toEqual([[zero], [unavailable]]);
  });

  it("retains options during refetch, blocks stale selection and resolves the new product version afterwards", async () => {
    const product = item("1");
    const fresh = { ...product, version: 3 };
    const refetch = deferred<GetProductsResponse>();
    fetchProducts.mockResolvedValueOnce(page([product])).mockReturnValueOnce(refetch.promise);
    const { client, onSelect } = renderCatalog();
    const input = await readyInput();
    const user = userEvent.setup();
    await user.click(input);
    const option = await screen.findByRole("option");
    act(() => { void client.invalidateQueries({ queryKey: ["products", "pos-catalog"] }); });
    await waitFor(() => expect(input).toHaveAttribute("readonly"));
    expect(screen.getByRole("option")).toBe(option);
    expect(option).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => { refetch.resolve(page([fresh])); });
    await readyInput();
    expect(screen.getByRole("option")).toBe(option);
    expect(input).not.toHaveAttribute("readonly");
    await openPopup(input);
    await user.click(await screen.findByRole("option"));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(fresh);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("retains the intentional scroll position after appending options without fetching the whole catalogue", async () => {
    const next = deferred<GetProductsResponse>();
    fetchProducts.mockResolvedValueOnce(page([item("1")], 1, 3)).mockReturnValueOnce(next.promise);
    renderCatalog();
    const input = await readyInput();
    await openPopup(input);
    const list = screen.getByRole("listbox");
    scrollToBottom(list);
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
    // Native MUI resets this same UL to zero when options grow; emulate that DOM effect.
    list.scrollTop = 0;
    await act(async () => { next.resolve(page([item("2")], 2, 3)); });
    await screen.findByRole("option", { name: /Synthetic product 2/ });
    await waitFor(() => expect(list.scrollTop).toBe(600));
    expect(screen.getByRole("listbox")).toBe(list);
    expect(fetchProducts.mock.calls.map(([params]) => params?.page)).toEqual([1, 2]);
  });

  it("does not carry a queued append scroll into a different search result", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
    const next = deferred<GetProductsResponse>();
    fetchProducts.mockResolvedValueOnce(page([item("1")], 1, 3)).mockReturnValueOnce(next.promise)
      .mockResolvedValueOnce(page([item("3", { name: "Coffee" })]));
    const { onSelect } = renderCatalog();
    const input = await readyInput();
    await openPopup(input);
    scrollToBottom(screen.getByRole("listbox"));
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
    await act(async () => { next.resolve(page([item("2")], 2, 3)); });
    await screen.findByRole("option", { name: /Synthetic product 2/ });
    await readyInput();
    fireEvent.change(input, { target: { value: "Coffee" } });
    const list = screen.getByRole("listbox");
    list.scrollTop = 0;
    const coffee = await screen.findByRole("option", { name: /Coffee/ });
    await readyInput();
    act(() => { for (const frame of [...frames.values()]) frame(performance.now()); });
    expect(screen.getByRole("listbox").scrollTop).toBe(0);
    await userEvent.setup().click(coffee);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "3", name: "Coffee" }));
  });
});
