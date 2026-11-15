import { act, renderHook } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { getProductByBarcode } from "../../../../modules/business/infrastructure/salesServices";
import { usePosBarcodeLookup } from "../../../../modules/business/infrastructure/usePosBarcodeLookup";
import type { ProductEntity } from "../../../../modules/business/infrastructure/types";
import { createAxiosInstance } from "../../../../config/axiosInstance";
import i18n from "../../../../translate";

vi.mock("../../../../modules/business/infrastructure/salesServices", () => ({ getProductByBarcode: vi.fn() }));
const product = { id: "7", business_id: "business-a", barcode: "0000123" } as ProductEntity;
const callbacks = { onProduct: vi.fn(), onMissing: vi.fn(), onError: vi.fn(), onFinished: vi.fn() };
const responseError = (status: number, message: string) => Object.assign(new AxiosError("Synthetic lookup failure"), { response: { status, data: { message } } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const options = (businessId = "business-a", context = "sale-a", enabled = true) => ({ businessId, context, enabled, ...callbacks });

beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(getProductByBarcode).mockReset();
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", expiresAt: Date.now() + 60000, sessionStatus: "authenticated" });
});

describe("Exact POS barcode lookup", () => {
  it("keeps leading zeroes and accepts only one request while a scan is pending", async () => {
    const next = deferred<ProductEntity>(); vi.mocked(getProductByBarcode).mockReturnValue(next.promise);
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    let scan!: Promise<void>;
    act(() => { scan = result.current.scan("0000123\r\n"); void result.current.scan("0000123"); });
    expect(getProductByBarcode).toHaveBeenCalledExactlyOnceWith("business-a", "0000123");
    expect(result.current.busy).toBe(true);
    await act(async () => { next.resolve(product); await scan; });
    expect(callbacks.onProduct).toHaveBeenCalledExactlyOnceWith(product);
    expect(callbacks.onMissing).not.toHaveBeenCalled(); expect(result.current.busy).toBe(false);
  });
  it("offers registration only for the backend's explicit missing-product contract", async () => {
    vi.mocked(getProductByBarcode).mockRejectedValue(responseError(404, "product:not_found"));
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    await act(async () => { await result.current.scan("0000123"); });
    expect(callbacks.onMissing).toHaveBeenCalledExactlyOnceWith("0000123", result.current.scope);
    expect(callbacks.onError).not.toHaveBeenCalled(); expect(callbacks.onProduct).not.toHaveBeenCalled();
  });
  it.each(["es", "en"])("keeps the original missing-product code after the real HTTP interceptor translates %s feedback", async language => {
    await i18n.changeLanguage(language);
    const error = await createAxiosInstance({ adapter: async config => {
      throw new AxiosError("Synthetic missing product", "ERR_BAD_RESPONSE", config, undefined, { config, status: 404, statusText: "Not Found", headers: {}, data: { message: "product:not_found" } });
    } }).get("/products/by-barcode").catch((error: unknown) => error);
    expect((error as AxiosError<{ message: string }>).response?.data.message).not.toBe("product:not_found");
    vi.mocked(getProductByBarcode).mockRejectedValue(error);
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    await act(async () => { await result.current.scan("0000123"); });
    expect(callbacks.onMissing).toHaveBeenCalledExactlyOnceWith("0000123", result.current.scope);
    await i18n.changeLanguage("es");
  });
  it("suspends another scan synchronously after a miss until the person closes the registration flow", async () => {
    vi.mocked(getProductByBarcode).mockRejectedValue(responseError(404, "product:not_found"));
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    await act(async () => { const scan = result.current.scan; await scan("0000123"); await scan("0000123"); });
    expect(getProductByBarcode).toHaveBeenCalledTimes(1);
    act(() => result.current.resume());
    await act(async () => { await result.current.scan("0000123"); });
    expect(getProductByBarcode).toHaveBeenCalledTimes(2);
  });
  it.each([[404, "Route not found"], [403, "Forbidden"], [500, "Unavailable"]])("does not confuse HTTP %i with an unknown product", async (status, message) => {
    const error = responseError(status, message); vi.mocked(getProductByBarcode).mockRejectedValue(error);
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    await act(async () => { await result.current.scan("0000123"); });
    expect(callbacks.onMissing).not.toHaveBeenCalled(); expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith(error);
  });
  it.each([{ ...product, business_id: "business-b" }, { ...product, barcode: "123" }, null])("rejects a mismatched or invalid successful response %j", async value => {
    vi.mocked(getProductByBarcode).mockResolvedValue(value as ProductEntity);
    const { result } = renderHook(() => usePosBarcodeLookup(options()));
    await act(async () => { await result.current.scan("0000123"); });
    expect(callbacks.onMissing).not.toHaveBeenCalled(); expect(callbacks.onProduct).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "invalid_barcode_response" }));
  });
  it.each(["business", "sale", "session", "actor"])("drops late results after a %s context change", async change => {
    const next = deferred<ProductEntity>(); vi.mocked(getProductByBarcode).mockReturnValue(next.promise);
    const { result, rerender } = renderHook(({ businessId, context }) => usePosBarcodeLookup(options(businessId, context)), { initialProps: { businessId: "business-a", context: "sale-a" } });
    let scan!: Promise<void>; act(() => { scan = result.current.scan("0000123"); });
    if (change === "business") rerender({ businessId: "business-b", context: "sale-a" });
    else if (change === "sale") rerender({ businessId: "business-a", context: "sale-b" });
    else act(() => useAuthStore.setState(change === "actor" ? { user: { id: "actor-b", name: "Other" } } : { sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    await act(async () => { next.resolve(product); await scan; });
    expect(callbacks.onProduct).not.toHaveBeenCalled(); expect(callbacks.onMissing).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled(); expect(result.current.busy).toBe(false);
  });
  it("does not revive old ownership or loading after leaving and returning to the same cart", async () => {
    const next = deferred<ProductEntity>(); vi.mocked(getProductByBarcode).mockReturnValue(next.promise);
    const { result, rerender } = renderHook(({ context }) => usePosBarcodeLookup(options("business-a", context)), { initialProps: { context: "sale-a" } });
    let scan!: Promise<void>; act(() => { scan = result.current.scan("0000123"); });
    const previousScope = result.current.scope;
    rerender({ context: "sale-b" }); rerender({ context: "sale-a" });
    expect(result.current.scope).not.toBe(previousScope); expect(result.current.busy).toBe(false);
    await act(async () => { next.resolve(product); await scan; });
    expect(callbacks.onProduct).not.toHaveBeenCalled();
  });
  it("rejects invalid codes locally and blocks lookup while controls are disabled", async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePosBarcodeLookup(options("business-a", "sale-a", enabled)), { initialProps: { enabled: true } });
    await act(async () => { await result.current.scan("   "); });
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "invalid_barcode" }));
    rerender({ enabled: false });
    await act(async () => { await result.current.scan("0000123"); });
    expect(getProductByBarcode).not.toHaveBeenCalled(); expect(callbacks.onMissing).not.toHaveBeenCalled();
  });
});
