import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../../../../../../../store/authStore";
import { useDeferredProductSave } from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/useDeferredProductSave";
import { emptyJournal, fieldsFingerprint, productSaveKey } from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/productSaveRecovery";
import type { ProductFormData } from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal";
import type { ProductEntity } from "../../../../../../../../../../modules/business/infrastructure/types";

const { http, getProduct, feedback } = vi.hoisted(() => ({
  http: { post: vi.fn(), put: vi.fn(), get: vi.fn(), delete: vi.fn() },
  getProduct: vi.fn(), feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("../../../../../../../../../../config/api", () => ({ mainInstance: http }));
vi.mock("../../../../../../../../../../modules/business/infrastructure/salesServices", () => ({ getProduct }));
vi.mock("sileo", () => ({ sileo: feedback }));

const product: ProductEntity = { id: "17", business_id: "business-a", version: 4, code: "SUP-1", barcode: "001234", name: "Synthetic product",
  cost_price: 100, cost_price_tax: 119, sale_price: 149, offer_price: 200, is_offer_enabled: false,
  has_stock: true, stock: 0, is_active: true, provider_id: null };
const form: ProductFormData = { measurement_unit: "unit", code: product.code, barcode: product.barcode!, name: product.name, cost_price: 100, cost_price_tax: 119,
  sale_price: 149, offer_price: 200, is_offer_enabled: false, has_stock: true, is_active: true, provider_id: null };
const createFile = () => new File(["synthetic image"], "product.png", { type: "image/png", lastModified: 1 });
const key = productSaveKey("actor-a", "business-a", null);
const errorWithStatus = (status: number) => Object.assign(new AxiosError("Synthetic rejection"), { response: { status, data: { message: "Synthetic server error" } } });
const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
const receipt = (id: string, version = 5) => ({ id, status: "ready", is_current: true, product_id: product.id, product_version: version });
const installImageSuccess = () => {
  http.post.mockImplementation(async (url: string, body: Record<string, unknown>) => ({ data: url.endsWith("/complete")
    ? receipt(url.split("/").at(-2)!, Number(body.expected_product_version) + 1)
    : { id: body.request_key, product_id: body.product_id, status: "pending", is_current: false } }));
  http.put.mockImplementation(async (url: string) => ({ data: { id: url.split("/").at(-2), status: "ready", is_current: false, product_id: product.id } }));
};
const saveAttempt = async (operation: () => Promise<unknown>) => { let error: unknown; await act(async () => { try { await operation(); } catch (value) { error = value; } }); return error; };

describe("deferred product and image save", () => {
  beforeEach(() => {
    vi.resetAllMocks(); sessionStorage.clear();
    useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 });
    installImageSuccess();
  });

  it.each([false, true])("preserves confirmed fields and the unknown-outcome gate when reopening a journal with the retired auxiliary slot (unknown=%s)", async (fieldsUnknown) => {
    const earlierFields: unknown[] = JSON.parse(fieldsFingerprint(form));
    earlierFields.splice(6, 0, 30);
    sessionStorage.setItem(key, JSON.stringify({ ...emptyJournal("actor-a", "business-a", null), product,
      fieldsFingerprint: JSON.stringify(earlierFields), fieldsUnknown }));
    const persist = vi.fn();
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    const error = await saveAttempt(() => result.current.save(form, { kind: "keep" }));
    expect(Boolean(error)).toBe(fieldsUnknown);
    expect(persist).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
    if (fieldsUnknown) {
      expect(result.current.phase).toBe("fields_unknown");
      expect(JSON.parse(sessionStorage.getItem(key)!).fieldsUnknown).toBe(true);
    } else expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("does not mutate on file selection/cancel, then creates once before reserving, sending and attaching the image", async () => {
    const file = createFile();
    const persist = vi.fn(async () => { expect(http.post).not.toHaveBeenCalled(); expect(JSON.parse(sessionStorage.getItem(key)!).fieldsUnknown).toBe(true); return product; });
    const first = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    act(() => first.result.current.cancel());
    expect(persist).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled(); expect(http.delete).not.toHaveBeenCalled();
    let saved: ProductEntity | undefined;
    await act(async () => { saved = await first.result.current.save(form, { kind: "replace", file }); });
    expect(saved).toMatchObject({ id: product.id, version: 5 }); expect(persist).toHaveBeenCalledExactlyOnceWith(form, undefined);
    const reservation = http.post.mock.calls[0];
    expect(reservation[1]).toMatchObject({ product_id: product.id, expected_product_version: 4 });
    expect(reservation[1].request_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(http.put).toHaveBeenCalledTimes(1); expect((http.put.mock.calls[0][1] as FormData).get("file")).toBe(file);
    expect(http.post.mock.calls[1][1]).toEqual({ expected_product_version: 4 });
    expect(sessionStorage.getItem(key)).toBeNull(); expect(first.result.current.pendingIntent).toBeNull();
    expect(feedback.success).toHaveBeenCalledTimes(1);
  });

  it.each(["SUP-1", null])("leaves a known 400 rejection editable and retryable with code %s", async (code) => {
    const draft = { ...form, code };
    const persist = vi.fn().mockRejectedValueOnce(errorWithStatus(400)).mockResolvedValue({ ...product, code });
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    expect(await saveAttempt(() => result.current.save(draft, { kind: "replace", file: createFile() }))).toBeTruthy();
    expect(result.current.phase).toBe("idle"); expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled(); // Field mutation owns the toast.
    await act(async () => { await result.current.save({ ...draft, name: "Corrected" }, { kind: "keep" }); });
    expect(persist).toHaveBeenCalledTimes(2); expect(result.current.savedProduct?.id).toBe(product.id);
  });

  it.each(["503", "lost-response"] as const)("retains a code-less uncertain create after %s across reopen without guessing or replay", async (failure) => {
    const draft = { ...form, code: null };
    const persist = vi.fn().mockRejectedValue(failure === "503" ? errorWithStatus(503) : new AxiosError("lost create response"));
    const first = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => first.result.current.save(draft, { kind: "replace", file: createFile() }));
    expect(first.result.current.phase).toBe("fields_unknown"); act(() => first.result.current.cancel()); first.unmount();
    const reopened = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => reopened.result.current.save(draft, { kind: "keep" }));
    await saveAttempt(() => reopened.result.current.reconcile());
    expect(persist).toHaveBeenCalledTimes(1); expect(http.post).not.toHaveBeenCalled(); expect(getProduct).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(key)!).fieldsUnknown).toBe(true);
  });

  it("recovers a lost PUT response with GET and complete, then saves without creating or uploading again", async () => {
    const file = createFile(); const persist = vi.fn().mockResolvedValue(product);
    http.put.mockRejectedValueOnce(new AxiosError("lost content response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    const id = result.current.pendingIntent!.id;
    http.get.mockResolvedValue({ data: { id, status: "ready", is_current: false, product_id: product.id } });
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.savedProduct?.version).toBe(5); expect(result.current.pendingIntent).toBeNull();
    await act(async () => { await result.current.save(form, { kind: "replace", file }); });
    expect(persist).toHaveBeenCalledTimes(1); expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("never repeats a content attempt whose GET still says pending, including when another File has identical metadata", async () => {
    const file = createFile(); const persist = vi.fn().mockResolvedValue(product);
    http.put.mockRejectedValue(new AxiosError("lost content response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    http.get.mockResolvedValue({ data: { id: result.current.pendingIntent!.id, status: "pending", is_current: false, product_id: product.id } });
    await saveAttempt(() => result.current.reconcile()); await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    const reads = http.get.mock.calls.length;
    await saveAttempt(() => result.current.save(form, { kind: "replace", file: createFile() }));
    expect(http.get).toHaveBeenCalledTimes(reads); expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("image_pending");
  });

  it("recovers an uncertain reservation through GET and sends content for the first time without reserving a second intent", async () => {
    const file = createFile(); const persist = vi.fn().mockResolvedValue(product);
    http.post.mockRejectedValueOnce(new AxiosError("lost reserve response"));
    const first = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => first.result.current.save(form, { kind: "replace", file }));
    const id = first.result.current.pendingIntent!.id;
    first.unmount();
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    http.get.mockResolvedValue({ data: { id, status: "pending", is_current: false, product_id: product.id } });
    await act(async () => { await result.current.save(form, { kind: "replace", file: createFile() }); });
    expect(http.post).toHaveBeenCalledTimes(2); expect(http.post.mock.calls[1][0]).toContain(`/${id}/complete`); expect(http.put).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(1);
  });

  it("recognizes a committed complete receipt without another complete, even after the editor was closed", async () => {
    const persist = vi.fn().mockResolvedValue(product); const file = createFile();
    const normalPost = http.post.getMockImplementation()!;
    http.post.mockImplementation(async (url, body) => { if (String(url).endsWith("/complete")) throw new AxiosError("lost complete response"); return normalPost(url, body); });
    const first = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => first.result.current.save(form, { kind: "replace", file }));
    const id = first.result.current.pendingIntent!.id; first.unmount();
    http.get.mockResolvedValue({ data: receipt(id) });
    const reopened = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    expect(reopened.result.current.savedProduct?.id).toBe(product.id);
    await act(async () => { await reopened.result.current.reconcile(); await reopened.result.current.save(form, { kind: "keep" }); });
    expect(http.post).toHaveBeenCalledTimes(2); expect(http.put).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(1);
    expect(reopened.result.current.savedProduct?.version).toBe(5);
  });

  it("preserves the original expected version until an uncertain attach is reconciled, even when a newer product is reviewed", async () => {
    const persist = vi.fn().mockResolvedValue(product);
    const normalPost = http.post.getMockImplementation()!;
    http.post.mockImplementation(async (url, body) => { if (String(url).endsWith("/complete")) throw new AxiosError("lost complete response"); return normalPost(url, body); });
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file: createFile() }));
    const originalIntent = result.current.pendingIntent!;
    expect(() => result.current.adoptReviewed({ ...product, version: 5 })).toThrow();
    expect(result.current.pendingIntent?.expectedVersion).toBe(4);
    expect(result.current.savedProduct?.version).toBe(4);
    http.get.mockResolvedValue({ data: receipt(originalIntent.id) });
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.savedProduct?.version).toBe(5); expect(result.current.pendingIntent).toBeNull();
    expect(http.post).toHaveBeenCalledTimes(2); expect(http.put).toHaveBeenCalledTimes(1);
  });

  it("requires explicit review after attach CAS conflict and applies the ready image on the reviewed version without another PUT", async () => {
    const persist = vi.fn().mockResolvedValue(product); const file = createFile();
    const normalPost = http.post.getMockImplementation()!;
    http.post.mockImplementation(async (url, body) => { if (String(url).endsWith("/complete")) throw errorWithStatus(409); return normalPost(url, body); });
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    const id = result.current.pendingIntent!.id;
    http.get.mockResolvedValue({ data: { id, status: "ready", is_current: false, product_id: product.id } });
    await saveAttempt(() => result.current.reconcile());
    expect(result.current.phase).toBe("image_conflict"); expect(http.post).toHaveBeenCalledTimes(2);
    act(() => result.current.adoptReviewed({ ...product, version: 8, name: "Other session" }));
    installImageSuccess();
    await act(async () => { await result.current.reconcile(); });
    expect(http.post.mock.calls.at(-1)?.[1]).toEqual({ expected_product_version: 8 });
    expect(result.current.savedProduct?.version).toBe(9); expect(http.put).toHaveBeenCalledTimes(1);
  });

  it("updates the persisted product ID on changed fields after image failure instead of creating another product", async () => {
    const file = createFile(); const persist = vi.fn().mockResolvedValueOnce(product).mockResolvedValueOnce({ ...product, name: "Edited after error", version: 6 });
    http.put.mockRejectedValueOnce(new AxiosError("lost content response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    http.get.mockResolvedValue({ data: receipt(result.current.pendingIntent!.id) });
    await act(async () => { await result.current.save({ ...form, name: "Edited after error" }, { kind: "replace", file }); });
    expect(persist.mock.calls[1]).toEqual([{ ...form, name: "Edited after error" }, { id: product.id, version: 5 }]);
    expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(1);
  });

  it("persists a changed measurement after recovering the original image attempt without creating another product", async () => {
    const file = createFile();
    const persist = vi.fn().mockResolvedValueOnce(product).mockResolvedValueOnce({ ...product, measurement_unit: "kg", version: 6 });
    http.put.mockRejectedValueOnce(new AxiosError("lost content response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file }));
    http.get.mockResolvedValue({ data: receipt(result.current.pendingIntent!.id) });
    await act(async () => { await result.current.save({ ...form, measurement_unit: "kg" }, { kind: "replace", file }); });
    expect(persist.mock.calls[1]).toEqual([{ ...form, measurement_unit: "kg" }, { id: product.id, version: 5 }]);
    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it("defers deletion to Save and reconciles a lost delete response with reads rather than another DELETE", async () => {
    const persist = vi.fn().mockResolvedValue(product);
    http.delete.mockRejectedValueOnce(new AxiosError("lost delete response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    expect(http.delete).not.toHaveBeenCalled();
    await saveAttempt(() => result.current.save(form, { kind: "remove" }));
    expect(http.delete.mock.calls[0][1]).toEqual({ data: { expected_product_version: 4 } });
    http.get.mockResolvedValue({ data: null }); getProduct.mockResolvedValue({ ...product, version: 5 });
    await act(async () => { await result.current.reconcile(); await result.current.save(form, { kind: "remove" }); });
    expect(http.delete).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(1); expect(result.current.savedProduct?.version).toBe(5);
  });

  it("locks double submits and does not continue to the image after the actor changes during field save", async () => {
    const fields = deferred<ProductEntity>(); const persist = vi.fn().mockReturnValue(fields.promise);
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    let first!: Promise<unknown>;
    act(() => { first = result.current.save(form, { kind: "replace", file: createFile() }).catch((error: unknown) => error); });
    await saveAttempt(() => result.current.save(form, { kind: "keep" }));
    act(() => { useAuthStore.setState({ user: { id: "actor-b", name: "Other synthetic actor" } }); });
    await act(async () => { fields.resolve(product); await first; });
    expect(persist).toHaveBeenCalledTimes(1); expect(http.post).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(key)!).fieldsUnknown).toBe(true);
    expect(sessionStorage.getItem(productSaveKey("actor-b", "business-a", null))).toBeNull();
  });

  it("keeps signed preview URLs out of recovery storage and retains an existing legacy intent without repeating PUT", async () => {
    const existingKey = productSaveKey("actor-a", "business-a", product.id);
    sessionStorage.setItem(existingKey, JSON.stringify({ id: "legacy-intent", status: "pending", reserved_product_version: 4 }));
    const persist = vi.fn();
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: { ...product, image: { id: "old", url: "https://private.invalid/?signature=synthetic", mime_type: "image/jpeg", width: 1, height: 1, byte_size: 1 } }, persistFields: persist }), { wrapper });
    http.get.mockResolvedValue({ data: { id: "legacy-intent", status: "pending", is_current: false, product_id: product.id } });
    await saveAttempt(() => result.current.reconcile());
    expect(http.put).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(existingKey)).not.toContain("signature");
  });

  it("permits a corrected file after the server rejects normalization before any content claim, without saving fields twice", async () => {
    const persist = vi.fn().mockResolvedValue(product);
    http.put.mockRejectedValueOnce(Object.assign(errorWithStatus(400), { response: { status: 400, data: { message: "product:image_invalid" } } }));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file: createFile() }));
    expect(result.current.pendingIntent).toBeNull();
    await act(async () => { await result.current.save(form, { kind: "replace", file: createFile() }); });
    expect(persist).toHaveBeenCalledTimes(1); expect(http.put).toHaveBeenCalledTimes(2);
    expect(http.post.mock.calls[0][1].request_key).not.toBe(http.post.mock.calls[1][1].request_key);
  });

  it("does not send fields or an image when its durable intention cannot be stored", async () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", persistFields: persist }), { wrapper });
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Synthetic storage unavailable"); });
    try {
      await saveAttempt(() => result.current.save(form, { kind: "replace", file: createFile() }));
      await saveAttempt(() => result.current.save(form, { kind: "keep" }));
      expect(persist).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("fields_unknown");
    } finally { storage.mockRestore(); }
  });

  it("preserves an uncertain DELETE when current reads do not prove the expected result and never rebases it silently", async () => {
    const persist = vi.fn().mockResolvedValue(product);
    http.delete.mockRejectedValueOnce(new AxiosError("lost delete response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "remove" }));
    http.get.mockResolvedValue({ data: { id: "still-current" } }); getProduct.mockResolvedValue({ ...product, version: 4 });
    await saveAttempt(() => result.current.reconcile());
    expect(() => result.current.adoptReviewed({ ...product, version: 8 })).toThrow();
    await saveAttempt(() => result.current.save(form, { kind: "remove" }));
    expect(http.delete).toHaveBeenCalledTimes(1); expect(result.current.phase).toBe("image_pending");
    expect(result.current.savedProduct?.version).toBe(4);
  });

  it("saves only an image against the fresh initial product version and never persists product fields", async () => {
    const persist = vi.fn(); const file = createFile(); const fresh = { ...product, version: 20 };
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: fresh, persistFields: persist }), { wrapper });
    let saved: ProductEntity | undefined;
    await act(async () => { saved = await result.current.saveImage({ kind: "replace", file }); });
    expect(saved).toMatchObject({ id: product.id, version: 21 }); expect(persist).not.toHaveBeenCalled();
    expect(http.post.mock.calls[0][1]).toMatchObject({ product_id: product.id, expected_product_version: 20 });
    expect(http.post.mock.calls[1][1]).toEqual({ expected_product_version: 20 });
    expect(http.post.mock.calls.every(([url]) => String(url).includes("/product-image-uploads"))).toBe(true);
    expect(http.put.mock.calls.every(([url]) => String(url).endsWith("/content"))).toBe(true);
    expect(http.put).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/content"), expect.any(FormData));
    expect(http.delete).not.toHaveBeenCalled();
  });

  it.each(["keep", "remove"] as const)("handles image-only %s without any product-field persistence", async (kind) => {
    const persist = vi.fn();
    http.delete.mockResolvedValue({ data: { removed: true, product_version: 5 } });
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    let saved: ProductEntity | undefined;
    await act(async () => { saved = await result.current.saveImage({ kind }); });
    expect(saved).toMatchObject({ id: product.id, version: kind === "keep" ? 4 : 5 });
    expect(persist).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
    expect(http.delete).toHaveBeenCalledTimes(kind === "keep" ? 0 : 1);
    if (kind === "remove") expect(http.delete.mock.calls[0][1]).toEqual({ data: { expected_product_version: 4 } });
    expect(sessionStorage.getItem(productSaveKey("actor-a", "business-a", product.id))).toBeNull();
  });

  it("recovers image-only lost content through GET and complete while keeping the original version and never replaying PUT", async () => {
    const file = createFile(); const persist = vi.fn();
    http.put.mockRejectedValueOnce(new AxiosError("lost content response"));
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product, persistFields: persist }), { wrapper });
    await saveAttempt(() => result.current.saveImage({ kind: "replace", file }));
    const id = result.current.pendingIntent!.id;
    expect(() => result.current.adoptReviewed({ ...product, version: 9 })).toThrow();
    http.get.mockResolvedValue({ data: { id, status: "ready", is_current: false, product_id: product.id } });
    await act(async () => { await result.current.saveImage({ kind: "replace", file }); });
    expect(persist).not.toHaveBeenCalled(); expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post.mock.calls[1][1]).toEqual({ expected_product_version: 4 }); expect(result.current.savedProduct?.version).toBe(5);
    expect(result.current.pendingIntent).toBeNull();
  });

  it("allows the image-only hook without a field callback but rejects full save before any field or image intention is written", async () => {
    const { result } = renderHook(() => useDeferredProductSave({ businessId: "business-a", initialProduct: product }), { wrapper });
    await saveAttempt(() => result.current.save(form, { kind: "replace", file: createFile() }));
    expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled(); expect(http.delete).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(productSaveKey("actor-a", "business-a", product.id))).toBeNull();
    expect(result.current.phase).toBe("idle");
    await act(async () => { await result.current.saveImage({ kind: "keep" }); });
    expect(result.current.savedProduct).toEqual(product);
  });
});
