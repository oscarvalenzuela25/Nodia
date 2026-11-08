import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useAuthStore from "../../../../store/authStore";
import { useSaleTicketPrinting } from "../../../../modules/business/infrastructure/useSaleTicketPrinting";
import { printSaleTicket } from "../../../../modules/business/infrastructure/printSaleTicket";
import { getSale, mutateSale } from "../../../../modules/business/infrastructure/salesServices";
import type { Sale } from "../../../../modules/business/infrastructure/salesTypes";

vi.mock("../../../../modules/business/infrastructure/printSaleTicket", () => ({ printSaleTicket: vi.fn() }));
vi.mock("../../../../modules/business/infrastructure/salesServices", () => ({ getSale: vi.fn(), mutateSale: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { info: vi.fn(), error: vi.fn() } }));
const sale: Sale = { id: "confirmed", business_id: "business-a", status: "completed", currency: "CLP", payment_method: "cash", payment_method_description: null,
  total_amount: "11230", version: 2, created_at: "2026-10-30T20:00:00Z", updated_at: "2026-10-30T20:01:00Z", completed_at: "2026-10-30T20:01:00Z", cancelled_at: null, cancellation_reason: null,
  items: [{ id: "item-a", product_id: "product-a", position: 0, quantity: 1.123, product_code_snapshot: null, product_barcode_snapshot: "00123", product_name_snapshot: "Producto confirmado", measurement_unit_snapshot: "kg",
    regular_unit_price: "10000", offer_price_snapshot: null, is_offer_enabled_snapshot: false, price_source: "regular", unit_price: "10000", line_total: "11230", product_version: 7 }] };

describe("saved ticket printing scope", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(printSaleTicket).mockReset(); vi.mocked(getSale).mockReset().mockResolvedValue(structuredClone(sale)); useAuthStore.setState({ user: { id: "actor-a", name: "QA" }, sessionVersion: 7 }); });
  it("retains an independent confirmed snapshot for explicit reprint after a print failure", async () => {
    vi.mocked(printSaleTicket).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce();
    const value = structuredClone(sale);
    const { result } = renderHook(() => useSaleTicketPrinting("business-a", "Negocio QA"));
    act(() => { result.current.remember(value); });
    value.items[0].product_name_snapshot = "Changed after checkout";
    await act(async () => { await result.current.print(); });
    expect(sileo.error).toHaveBeenCalledTimes(1); expect(result.current.receipt?.id).toBe(sale.id);
    await act(async () => { await result.current.print(); });
    expect(vi.mocked(printSaleTicket).mock.calls[1][0].lines[0].name).toBe("Producto confirmado");
    expect(result.current.printing).toBe(false);
  });
  it("aborts pending print preparation and hides the old receipt when business changes", async () => {
    let resolve!: () => void;
    vi.mocked(printSaleTicket).mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ businessId }) => useSaleTicketPrinting(businessId), { initialProps: { businessId: "business-a" } });
    let request!: Promise<void>;
    act(() => { request = result.current.printJustSaved(sale); });
    const signal = vi.mocked(printSaleTicket).mock.calls[0][1]?.signal;
    expect(result.current.printing).toBe(true);
    rerender({ businessId: "business-b" });
    expect(signal?.aborted).toBe(true); expect(result.current.receipt).toBeNull();
    await act(async () => { resolve(); await request; });
    expect(sileo.info).not.toHaveBeenCalled(); expect(sileo.error).not.toHaveBeenCalled();
  });
  it("does not print a foreign, cancelled or unconfirmed sale", async () => {
    const { result } = renderHook(() => useSaleTicketPrinting("business-a"));
    await act(async () => {
      await result.current.print({ ...sale, business_id: "foreign" });
      await result.current.print({ ...sale, status: "cancelled" });
      await result.current.print({ ...sale, status: "draft", completed_at: null });
    });
    expect(printSaleTicket).not.toHaveBeenCalled(); expect(result.current.receipt).toBeNull();
  });
  it("disposes the last print document on scope change even if the native dialog returned early", async () => {
    vi.mocked(printSaleTicket).mockResolvedValue();
    const { result, rerender } = renderHook(({ businessId }) => useSaleTicketPrinting(businessId), { initialProps: { businessId: "business-a" } });
    await act(async () => { await result.current.printJustSaved(sale); });
    const signal = vi.mocked(printSaleTicket).mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false); expect(result.current.printing).toBe(false);
    rerender({ businessId: "business-b" });
    expect(signal?.aborted).toBe(true); expect(result.current.receipt).toBeNull();
  });
  it("revalidates a saved sale and removes its receipt if another operator cancelled it", async () => {
    vi.mocked(getSale).mockResolvedValue({ ...sale, status: "cancelled" });
    const { result } = renderHook(() => useSaleTicketPrinting("business-a"));
    act(() => { result.current.remember(sale); });
    await act(async () => { await result.current.print(); });
    expect(getSale).toHaveBeenCalledExactlyOnceWith("business-a", sale.id);
    expect(printSaleTicket).not.toHaveBeenCalled(); expect(result.current.receipt).toBeNull();
    expect(sileo.error).toHaveBeenCalledTimes(1);
  });
  it("does not use a late revalidation response after switching business", async () => {
    let resolve!: (value: Sale) => void;
    vi.mocked(getSale).mockImplementation(() => new Promise<Sale>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ businessId }) => useSaleTicketPrinting(businessId), { initialProps: { businessId: "business-a" } });
    let request!: Promise<void>;
    act(() => { request = result.current.print(sale); });
    rerender({ businessId: "business-b" });
    await act(async () => { resolve(sale); await request; });
    expect(printSaleTicket).not.toHaveBeenCalled(); expect(result.current.receipt).toBeNull();
  });
  it("captures voucher detail selection before a slow GET and applies a later selection only to the next print", async () => {
    let resolve!: (value: Sale) => void;
    vi.mocked(getSale).mockImplementationOnce(() => new Promise<Sale>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ showDetails }) => ({ printing: useSaleTicketPrinting("business-a"), showDetails }), { initialProps: { showDetails: false } });
    let request!: Promise<void>;
    act(() => { request = result.current.printing.print(sale, result.current.showDetails); });
    rerender({ showDetails: true });
    await act(async () => { resolve(sale); await request; });
    const voucher = vi.mocked(printSaleTicket).mock.calls[0][0];
    expect(voucher.lines).toEqual([]);
    expect(voucher.total).toBe("$11.230");
    expect(result.current.printing.receipt).toEqual(sale);
    await act(async () => { await result.current.printing.print(undefined, result.current.showDetails); });
    const detailed = vi.mocked(printSaleTicket).mock.calls[1][0];
    expect(detailed.lines).toHaveLength(1);
    expect(voucher).toEqual({ ...detailed, lines: [] });
    expect(getSale).toHaveBeenCalledTimes(2);
    expect(mutateSale).not.toHaveBeenCalled();
  });
  it.each([false, true])("prints the confirmed response with showDetails=%s without another GET or mutation", async (showDetails) => {
    const { result } = renderHook(() => useSaleTicketPrinting("business-a"));
    await act(async () => { await result.current.printJustSaved(sale, showDetails); });
    const ticket = vi.mocked(printSaleTicket).mock.calls[0][0];
    expect(ticket.lines).toHaveLength(showDetails ? 1 : 0);
    expect(ticket.saleId).toBe(sale.id); expect(ticket.total).toBe("$11.230");
    expect(result.current.receipt).toEqual(sale);
    expect(getSale).not.toHaveBeenCalled(); expect(mutateSale).not.toHaveBeenCalled();
  });
});
