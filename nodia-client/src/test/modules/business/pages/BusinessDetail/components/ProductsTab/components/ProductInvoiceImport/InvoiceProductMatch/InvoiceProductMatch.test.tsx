import { useState, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvoiceProductMatch from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceProductMatch";
import { getProducts } from "../../../../../../../../../../modules/business/infrastructure/services";
import type { GetProductsResponse } from "../../../../../../../../../../modules/business/infrastructure/types";
import { notifyHttpError } from "../../../../../../../../../../config/httpFeedback";
import useAuthStore from "../../../../../../../../../../store/authStore";
import { deferred, invoiceRow, page, product } from "./fixtures";

vi.mock("../../../../../../../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
vi.mock("../../../../../../../../../../config/httpFeedback", () => ({ notifyHttpError: vi.fn() }));
const read = vi.mocked(getProducts);
const clients = new Set<QueryClient>();
const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const Wrapper = ({ children }: PropsWithChildren) => {
  const [client] = useState(createClient);
  clients.add(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const choose = async () => {
  const user = userEvent.setup();
  const selector = await screen.findByRole("button", { name: "Producto existente" });
  await waitFor(() => expect(selector).toBeEnabled());
  await user.click(selector);
  await user.click(await screen.findByRole("option", { name: /Synthetic listed item/ }));
};
const applyButton = () => screen.getByRole("button", { name: "Preparar actualización" });
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 60000 });
  read.mockImplementation(async params => page([params?.q?.id_in ? product() : { ...product("17", "business-a", 1), name: "Synthetic listed item" }]));
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.clear(); });

describe("invoice product match dialog", () => {
  it("previews a fresh snapshot, applies only checked fields and preserves the modal when the parent rejects the draft", async () => {
    const onClose = vi.fn();
    const onApply = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const row = invoiceRow({ sale_price: 4500 });
    render(<InvoiceProductMatch businessId="business-a" row={row} disabled={false} onClose={onClose} onApply={onApply} />, { wrapper: Wrapper });
    await choose();
    expect((await screen.findAllByText("Synthetic snapshot 17")).length).toBeGreaterThan(0);
    expect(screen.getByText("CAT-17")).toBeInTheDocument();
    expect(screen.getByText("INV-17")).toBeInTheDocument();
    const user = userEvent.setup();
    expect(screen.getByRole("checkbox", { name: "Código de factura / proveedor" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Costo Base sin Impuesto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Costo Base con Impuestos" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Código de factura / proveedor" }));
    await user.click(screen.getByRole("checkbox", { name: "Nombre del Producto" }));
    await user.click(screen.getByRole("checkbox", { name: "Precio Venta" }));
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({ id: "17", version: 8, name: "Synthetic snapshot 17" });
    expect(onApply.mock.calls[0][1]).toEqual(expect.arrayContaining(["name", "cost_price", "cost_price_tax", "sale_price"]));
    expect(onApply.mock.calls[0][1]).toHaveLength(4);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Precio Venta" })).toBeChecked();
    await user.click(applyButton());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ code: "INV-17", sale_price: 4500, isUpdate: false });
  });

  it("keeps an unknown invoice sale price unchecked and allows cancelling without applying anything", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<InvoiceProductMatch businessId="business-a" row={invoiceRow()} disabled={false} onClose={onClose} onApply={onApply} />, { wrapper: Wrapper });
    await choose();
    await screen.findAllByText("Synthetic snapshot 17");
    const sale = screen.getByRole("checkbox", { name: "Precio Venta" });
    expect(sale).toBeDisabled();
    expect(sale).not.toBeChecked();
    expect(applyButton()).toBeEnabled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("blocks selection while reading the fresh revision, keeps a failed read visible and recovers only through GET retry", async () => {
    const pending = deferred<GetProductsResponse>();
    let snapshots = 0;
    read.mockImplementation(params => {
      if (!params?.q?.id_in) return Promise.resolve(page([{ ...product("17", "business-a", 1), name: "Synthetic listed item" }]));
      snapshots++;
      return snapshots === 1 ? pending.promise : Promise.resolve(page([product("17", "business-a", 9)]));
    });
    const onApply = vi.fn();
    render(<InvoiceProductMatch businessId="business-a" row={invoiceRow()} disabled={false} onClose={vi.fn()} onApply={onApply} />, { wrapper: Wrapper });
    await choose();
    await waitFor(() => expect(snapshots).toBe(1));
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Producto existente" })).toHaveAttribute("aria-disabled", "true");
    await act(async () => { pending.reject(new Error("Synthetic snapshot read failed")); });
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    expect(applyButton()).toBeDisabled();
    expect(notifyHttpError).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(retry);
    await screen.findAllByText("Synthetic snapshot 17");
    await waitFor(() => expect(applyButton()).toBeEnabled());
    fireEvent.click(applyButton());
    expect(onApply.mock.calls[0][0]).toMatchObject({ id: "17", version: 9 });
    expect(snapshots).toBe(2);
  });

  it("disables the prepared snapshot when its owner becomes busy or the same session is temporarily inactive", async () => {
    const props = { businessId: "business-a", row: invoiceRow(), onClose: vi.fn(), onApply: vi.fn() };
    const { rerender } = render(<InvoiceProductMatch {...props} disabled={false} />, { wrapper: Wrapper });
    await choose();
    await screen.findAllByText("Synthetic snapshot 17");
    await waitFor(() => expect(applyButton()).toBeEnabled());
    rerender(<InvoiceProductMatch {...props} disabled />);
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Costo Base sin Impuesto" })).toBeDisabled();
    rerender(<InvoiceProductMatch {...props} disabled={false} />);
    act(() => useAuthStore.setState({ isRefreshing: true }));
    expect(applyButton()).toBeDisabled();
    fireEvent.click(applyButton());
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("waits for a changed product ID and resets the field choices instead of applying the previous target", async () => {
    const pending = deferred<GetProductsResponse>();
    read.mockImplementation(params => {
      if (params?.q?.id_in?.[0] === "19") return pending.promise;
      return Promise.resolve(params?.q?.id_in ? page([product()]) : page([
        { ...product("17", "business-a", 1), name: "Synthetic listed item" }, product("19", "business-a", 1),
      ]));
    });
    const onApply = vi.fn();
    render(<InvoiceProductMatch businessId="business-a" row={invoiceRow()} disabled={false} onClose={vi.fn()} onApply={onApply} />, { wrapper: Wrapper });
    await choose();
    await screen.findAllByText("Synthetic snapshot 17");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Código de factura / proveedor" }));
    await user.click(screen.getByRole("checkbox", { name: "Nombre del Producto" }));
    await user.click(screen.getByRole("button", { name: "Producto existente" }));
    await user.click(await screen.findByRole("option", { name: /Synthetic snapshot 19/ }));
    expect(applyButton()).toBeDisabled();
    fireEvent.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(page([product("19", "business-a", 11)])); });
    await waitFor(() => expect(applyButton()).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: "Código de factura / proveedor" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Nombre del Producto" })).not.toBeChecked();
    fireEvent.click(applyButton());
    expect(onApply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "19", version: 11 }), ["code", "cost_price", "cost_price_tax"]);
  });

  it("requires reopening after a new session scope even when fresh GETs for that session complete", async () => {
    const onApply = vi.fn();
    render(<InvoiceProductMatch businessId="business-a" row={invoiceRow()} disabled={false} onClose={vi.fn()} onApply={onApply} />, { wrapper: Wrapper });
    await choose();
    await screen.findAllByText("Synthetic snapshot 17");
    await waitFor(() => expect(applyButton()).toBeEnabled());
    const before = read.mock.calls.length;
    act(() => useAuthStore.setState({ sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    expect(applyButton()).toBeDisabled();
    await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(before));
    await screen.findAllByText("Synthetic snapshot 17");
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Producto existente" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();
  });
});
