import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductImage from "../../../../../modules/business/components/ProductImage";
import { mainInstance } from "../../../../../config/api";
vi.mock("../../../../../config/api", () => ({ mainInstance: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../../../hooks/useAuth", () => ({ default: () => ({ user: { id: "synthetic-actor" }, isSessionActive: true }) }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const renderImage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ProductImage businessId="business" productId="product" version={1} editable /></QueryClientProvider>);
describe("product image recovery", () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.mocked(mainInstance.get).mockResolvedValue({ data: null }); });
  it("reserves a durable client identity before upload and recovers an uncertain PUT without sending the bytes twice", async () => {
    let key = "";
    vi.mocked(mainInstance.post).mockImplementation(async (url, body) => {
      if (String(url).endsWith("/complete")) return { data: { id: key, status: "ready", product_version: 2 } };
      key = (body as { request_key: string }).request_key;
      expect(sessionStorage.getItem("nodia:product-image-recovery:synthetic-actor:business:product")).toContain(key);
      return { data: { id: key, status: "pending" } };
    });
    vi.mocked(mainInstance.put).mockRejectedValueOnce(new AxiosError("Lost upload response"));
    const { container } = renderImage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled());
    await userEvent.setup().upload(container.querySelector('input[type="file"]')!, new File(["synthetic bytes"], "fixture.png", { type: "image/png" }));
    expect(await screen.findByText(/La carga necesita conciliación/)).toBeInTheDocument();
    vi.mocked(mainInstance.get).mockImplementation(async (url) => ({ data: String(url).endsWith(key) ? { id: key, status: "ready" } : null }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Consultar resultado" }));
    await waitFor(() => expect(screen.queryByText(/La carga necesita conciliación/)).not.toBeInTheDocument());
    expect(mainInstance.put).toHaveBeenCalledTimes(1);
    expect(mainInstance.post).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("nodia:product-image-recovery:synthetic-actor:business:product")).toBeNull();
  });
  it("shows a recoverable error for a failed image resource instead of a broken image", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { id: "image", url: "https://example.test/synthetic.png", product_version: 1 } });
    renderImage();
    fireEvent.error(await screen.findByRole("img", { name: "Imagen del producto" }));
    expect(screen.getByText("No se pudo cargar la imagen.")).toBeInTheDocument();
    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
});
