import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductImageModal from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageModal";
import type { ProductEntity } from "../../../../../../../../../modules/business/infrastructure/types";
import useAuthStore from "../../../../../../../../../store/authStore";
import { productSaveKey } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/productSaveRecovery";

const { http, feedback } = vi.hoisted(() => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("../../../../../../../../../config/api", () => ({ mainInstance: http }));
vi.mock("sileo", () => ({ sileo: feedback }));

// Components, salesServices.getProduct and useDeferredProductSave are real.
// Only the Axios boundary and browser Blob URL allocation are synthetic.
const product: ProductEntity = { id: "17", business_id: "business-a", version: 3, code: "SUP-1", barcode: "001234", name: "Stale catalogue name",
  cost_price: 100, cost_price_tax: 119, sale_price: 149, offer_price: null, is_offer_enabled: false,
  has_stock: true, stock: 0, is_active: true, provider_id: null };
const fresh: ProductEntity = { ...product, version: 37, name: "Fresh product from GET" };
const previewUrl = "https://storage.example.test/synthetic-image.jpg?signature=fixture-only";
const OriginalURL = URL;
const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
const clients = new Set<QueryClient>();
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const file = () => new File(["synthetic image bytes"], "synthetic.png", { type: "image/png" });
const fileInput = () => screen.getByLabelText("Agregar imagen", { selector: "input" });
const saveButton = () => screen.getByRole("button", { name: "Guardar imagen" });
const productReads = () => http.get.mock.calls.filter(([url]) => String(url).endsWith("/products/17"));
const imageReads = () => http.get.mock.calls.filter(([url]) => String(url).endsWith("/products/17/image"));
const noWrites = () => { for (const mutation of [http.post, http.put, http.patch, http.delete]) expect(mutation).not.toHaveBeenCalled(); };
const imageWritesOnly = () => {
  expect(http.post.mock.calls.every(([url]) => String(url).includes("/product-image-uploads"))).toBe(true);
  expect(http.put.mock.calls.every(([url]) => String(url).endsWith("/content"))).toBe(true);
  expect(http.patch).not.toHaveBeenCalled(); expect(http.delete).not.toHaveBeenCalled();
};

function renderModal(initial = product) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.add(client);
  const onClose = vi.fn();
  return { ...render(<QueryClientProvider client={client}><ProductImageModal open businessId="business-a" product={initial} onClose={onClose} /></QueryClientProvider>), onClose, client };
}

beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 });
  let nextUrl = 0;
  createObjectURL.mockImplementation(() => `blob:synthetic-image-modal-${++nextUrl}`);
  vi.stubGlobal("URL", class extends OriginalURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  http.get.mockImplementation(async (url: string) => {
    if (url.endsWith("/products/17")) return { data: fresh };
    if (url.endsWith("/products/17/image")) return { data: null };
    throw new Error(`Unexpected synthetic read: ${url}`);
  });
  http.post.mockImplementation(async (url: string, body: Record<string, unknown>) => ({ data: url.endsWith("/complete")
    ? { id: url.split("/").at(-2), status: "ready", is_current: true, product_id: product.id, product_version: Number(body.expected_product_version) + 1 }
    : { id: body.request_key, status: "pending", is_current: false, product_id: body.product_id } }));
  http.put.mockImplementation(async (url: string) => ({ data: { id: url.split("/").at(-2), status: "ready", is_current: false, product_id: product.id } }));
});

afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.clear(); vi.unstubAllGlobals();
});

describe("ProductImageModal with real image save hook and synthetic HTTP", () => {
  it("waits for the fresh product and image reads, blocks closing while loading, and renders a null image without inventing a version", async () => {
    const productRead = deferred<{ data: ProductEntity }>();
    const imageRead = deferred<{ data: null }>();
    http.get.mockImplementation((url: string) => url.endsWith("/products/17") ? productRead.promise : imageRead.promise);
    const { onClose } = renderModal({ ...product, version: undefined });
    await waitFor(() => expect(productReads()).toHaveLength(1));
    expect(imageReads()).toHaveLength(0); expect(screen.queryByRole("button", { name: "Guardar imagen" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Cerrar" })[0]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled(); noWrites();
    await act(async () => { productRead.resolve({ data: fresh }); });
    await waitFor(() => expect(imageReads()).toHaveLength(1));
    expect(fileInput()).toBeDisabled(); expect(saveButton()).toBeDisabled();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Cerrar" })[0]);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { imageRead.resolve({ data: null }); });
    await waitFor(() => expect(fileInput()).toBeEnabled());
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled(); expect(screen.getByText(fresh.name)).toBeInTheDocument();
    noWrites();
  });

  it("shows a failed product GET and retries that read before displaying the actual saved preview", async () => {
    http.get.mockRejectedValueOnce(new AxiosError("Synthetic product GET unavailable"));
    const { onClose } = renderModal();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el producto para visualizar su imagen.");
    expect(screen.queryByLabelText("Agregar imagen", { selector: "input" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar imagen" })).not.toBeInTheDocument();
    expect(imageReads()).toHaveLength(0); noWrites();
    expect(feedback.error).toHaveBeenCalledTimes(1);
    http.get.mockImplementation(async (url: string) => ({ data: url.endsWith("/products/17") ? fresh : { url: previewUrl } }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", previewUrl);
    expect(productReads()).toHaveLength(2); expect(imageReads()).toHaveLength(1);
    expect(createObjectURL).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); noWrites();
  });

  it.each([
    ["another product identity", { ...fresh, id: "99" }],
    ["another business", { ...fresh, business_id: "business-b" }],
    ["a missing version", { ...fresh, version: undefined }],
  ])("rejects %s from the fresh GET without using the stale catalogue record as a fallback", async (_label, invalid) => {
    http.get.mockResolvedValue({ data: invalid });
    renderModal();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el producto para visualizar su imagen.");
    expect(imageReads()).toHaveLength(0); expect(screen.queryByLabelText("Agregar imagen", { selector: "input" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar imagen" })).not.toBeInTheDocument(); noWrites();
  });

  it("keeps selection and preview local, and Cancel closes without saving fields or an image", async () => {
    const user = userEvent.setup(); const { onClose, unmount } = renderModal();
    await waitFor(() => expect(fileInput()).toBeEnabled());
    const selected = file(); await user.upload(fileInput(), selected);
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(selected);
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", "blob:synthetic-image-modal-1");
    expect(saveButton()).toBeEnabled(); noWrites();
    await user.click(screen.getAllByRole("button", { name: "Cerrar" }).at(-1)!);
    expect(onClose).toHaveBeenCalledTimes(1); noWrites();
    unmount(); expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:synthetic-image-modal-1");
  });

  it("saves the image against the fresh version without product-field writes and blocks close/selection while content is in flight", async () => {
    const user = userEvent.setup(); const content = deferred<{ data: { id: string; status: string; is_current: boolean; product_id: string } }>();
    let intentId = "";
    http.put.mockImplementation((url: string) => { intentId = url.split("/").at(-2)!; return content.promise; });
    const { onClose } = renderModal({ ...product, version: 1 });
    await waitFor(() => expect(fileInput()).toBeEnabled());
    const selected = file(); await user.upload(fileInput(), selected); await user.click(saveButton());
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
    expect(http.post.mock.calls[0][1]).toMatchObject({ product_id: product.id, expected_product_version: 37 });
    expect((http.put.mock.calls[0][1] as FormData).get("file")).toBe(selected);
    expect(fileInput()).toBeDisabled(); expect(saveButton()).toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: "Cerrar" })[0]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { content.resolve({ data: { id: intentId, status: "ready", is_current: false, product_id: product.id } }); });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(http.post.mock.calls[1][1]).toEqual({ expected_product_version: 37 });
    expect(http.post).toHaveBeenCalledTimes(2); expect(http.put).toHaveBeenCalledTimes(1); imageWritesOnly();
    expect(productReads()).toHaveLength(1);
    expect(sessionStorage.getItem(productSaveKey("actor-a", "business-a", product.id))).toBeNull();
  });

  it("keeps a failed PUT draft visible and recovers it without another upload or automatic close", async () => {
    const user = userEvent.setup(); const { onClose } = renderModal();
    await waitFor(() => expect(fileInput()).toBeEnabled());
    await user.upload(fileInput(), file());
    const preview = screen.getByRole("img", { name: "Imagen del producto" });
    http.put.mockRejectedValueOnce(new AxiosError("Synthetic lost content response"));
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("La carga necesita conciliación.");
    expect(onClose).not.toHaveBeenCalled(); expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(preview);
    const journal = JSON.parse(sessionStorage.getItem(productSaveKey("actor-a", "business-a", product.id))!);
    const id: string = journal.image.id;
    expect(journal.image).toMatchObject({ contentAttempted: true, expectedVersion: 37 });
    expect(journal.fieldsUnknown).toBe(false);
    const read = http.get.getMockImplementation()!;
    http.get.mockImplementation(async (url: string) => url.endsWith(`/product-image-uploads/${id}`)
      ? { data: { id, status: "pending", is_current: false, product_id: product.id } } : read(url));
    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
    http.get.mockImplementation(async (url: string) => url.endsWith(`/product-image-uploads/${id}`)
      ? { data: { id, status: "ready", is_current: false, product_id: product.id } } : read(url));
    await user.click(screen.getByRole("button", { name: "Consultar resultado" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled(); expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(preview);
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(2); imageWritesOnly();
  });

  it("reviews a known attach conflict with current image and draft, then completes the same upload on the explicitly reviewed version", async () => {
    const user = userEvent.setup(); const { onClose } = renderModal();
    await waitFor(() => expect(fileInput()).toBeEnabled()); await user.upload(fileInput(), file());
    const post = http.post.getMockImplementation()!;
    let rejectAttach = true;
    http.post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith("/complete") && rejectAttach) { rejectAttach = false; throw Object.assign(new AxiosError("Synthetic CAS conflict"), { response: { status: 409, data: { message: "product:version_conflict" } } }); }
      return post(url, body);
    });
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("El producto cambió mientras se cargaba la imagen.");
    const id = http.post.mock.calls[0][1].request_key;
    http.get.mockImplementation(async (url: string) => {
      if (url.endsWith("/products/17")) return { data: { ...fresh, version: 40, name: "Explicitly reviewed current product" } };
      if (url.endsWith("/products/17/image")) return { data: { url: previewUrl } };
      return { data: { id, status: "ready", is_current: false, product_id: product.id } };
    });
    await user.click(screen.getByRole("button", { name: "Comprobar cambios recientes del producto" }));
    const review = await screen.findByRole("dialog", { name: "Aplicar la imagen cargada" });
    expect(within(review).getByText("Explicitly reviewed current product")).toBeInTheDocument();
    expect(within(review).getByRole("img", { name: "Imagen actual del producto" })).toHaveAttribute("src", previewUrl);
    expect(within(review).getByRole("img", { name: "Imagen del producto" }).getAttribute("src")).toMatch(/^blob:/);
    expect(http.put).toHaveBeenCalledTimes(1); expect(http.post).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(within(review).getByRole("button", { name: "Confirmar" })).toBeEnabled());
    await user.click(within(review).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Aplicar la imagen cargada" })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(http.post.mock.calls.at(-1)?.[1]).toEqual({ expected_product_version: 40 });
    expect(http.put).toHaveBeenCalledTimes(1); imageWritesOnly();
  });
});
