import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useState, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import ProductImageDraft from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductImageDraft";
import { mainInstance } from "../../../../../../../../../../config/api";

vi.mock("../../../../../../../../../../config/api", () => ({
  mainInstance: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("sileo", () => ({ sileo: { error: vi.fn() } }));

type ImageChange = ComponentProps<typeof ProductImageDraft>["value"];
type FixtureProps = Omit<ComponentProps<typeof ProductImageDraft>, "businessId" | "value" | "onChange"> & {
  initialValue?: ImageChange;
};
const changes = vi.fn<(value: ImageChange) => void>();
const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
const OriginalURL = URL;
const clients = new Set<QueryClient>();
const savedUrl = "https://storage.example.test/synthetic-product-image.jpg?signature=fixture-only";
const imageFile = (name = "synthetic.png") => new File(["synthetic image bytes"], name, { type: "image/png" });

function DraftFixture({ initialValue = { kind: "keep" }, ...props }: FixtureProps) {
  const [value, setValue] = useState<ImageChange>(initialValue);
  return <ProductImageDraft businessId="synthetic-business" {...props} value={value} onChange={next => {
    changes(next);
    setValue(next);
  }} />;
}

function renderDraft(props: FixtureProps = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.add(client);
  return {
    ...render(<DraftFixture {...props} />, {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    }),
    client,
  };
}

const fileInput = () => screen.getByLabelText("Agregar imagen", { selector: "input" });
const mutations = () => [mainInstance.post, mainInstance.put, mainInstance.patch, mainInstance.delete];

beforeEach(() => {
  vi.clearAllMocks();
  let nextUrl = 0;
  createObjectURL.mockImplementation(() => `blob:synthetic-product-preview-${++nextUrl}`);
  vi.stubGlobal("URL", class extends OriginalURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  vi.mocked(mainInstance.get).mockResolvedValue({ data: null });
});

afterEach(() => {
  try {
    for (const mutation of mutations()) expect(mutation).not.toHaveBeenCalled();
  } finally {
    cleanup();
    for (const client of clients) client.clear();
    clients.clear();
    vi.unstubAllGlobals();
  }
});

describe("ProductImageDraft with synthetic read-only image metadata", () => {
  it("offers a keyboard-accessible picker and keeps a new file and its removal local", async () => {
    const user = userEvent.setup();
    renderDraft();
    const picker = screen.getByRole("button", { name: "Agregar imagen" });
    await user.tab();
    expect(picker).toHaveFocus();
    expect(fileInput()).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar imagen" })).not.toBeInTheDocument();

    const file = imageFile();
    await user.upload(fileInput(), file);
    expect(changes).toHaveBeenLastCalledWith({ kind: "replace", file });
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(await screen.findByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", "blob:synthetic-product-preview-1");
    const remove = screen.getByRole("button", { name: "Retirar imagen" });
    await user.hover(remove);
    expect(await screen.findByRole("tooltip", { name: "Retirar imagen" })).toBeInTheDocument();
    await user.click(remove);
    expect(changes).toHaveBeenLastCalledWith({ kind: "keep" });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-product-preview-1");
    expect(mainInstance.get).not.toHaveBeenCalled();
  });

  it("keeps the saved image unchanged and treats replacement and X as pending local intentions", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { url: savedUrl } });
    const user = userEvent.setup();
    const { unmount } = renderDraft({ productId: "23" });
    expect(await screen.findByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", savedUrl);
    expect(mainInstance.get).toHaveBeenCalledWith(expect.stringContaining("/businesses/synthetic-business/products/23/image"));
    expect(changes).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();

    const replacement = imageFile("replacement.png");
    await user.upload(fileInput(), replacement);
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", "blob:synthetic-product-preview-1");
    await user.click(screen.getByRole("button", { name: "Retirar imagen" }));
    expect(changes).toHaveBeenLastCalledWith({ kind: "remove" });
    expect(screen.getByText("La imagen se quitará al guardar. Cancelar conserva la imagen guardada.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(mainInstance.get).toHaveBeenCalledTimes(1);
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-product-preview-1");
    expect(revokeObjectURL).not.toHaveBeenCalledWith(savedUrl);
  });

  it("revokes each local preview when replaced and releases the last one when the editor is cancelled or unmounted", async () => {
    const first = imageFile("first.png");
    const second = imageFile("second.png");
    const { unmount } = renderDraft({ initialValue: { kind: "replace", file: first } });
    expect(await screen.findByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", "blob:synthetic-product-preview-1");
    await userEvent.setup().upload(fileInput(), second);
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", "blob:synthetic-product-preview-2");
    expect(createObjectURL.mock.calls.map(([file]) => file)).toEqual([first, second]);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:synthetic-product-preview-1");
    unmount();
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual([
      "blob:synthetic-product-preview-1", "blob:synthetic-product-preview-2",
    ]);
    expect(mainInstance.get).not.toHaveBeenCalled();
  });

  it("preserves the local preview when a newly saved product gains an id and its image metadata is still loading", async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = renderDraft();
    const file = imageFile();
    await user.upload(fileInput(), file);
    const image = await screen.findByRole("img", { name: "Imagen del producto" });
    const previewUrl = image.getAttribute("src");
    expect(previewUrl).toBe("blob:synthetic-product-preview-1");
    expect(mainInstance.get).not.toHaveBeenCalled();

    let completeRead: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { completeRead = resolve; });
    vi.mocked(mainInstance.get).mockImplementationOnce(async () => {
      await pending;
      return { data: null };
    });
    rerender(<DraftFixture productId="23" />);
    await waitFor(() => expect(mainInstance.get).toHaveBeenCalledTimes(1));
    expect(fileInput()).toBeDisabled();
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(image);
    expect(image).toHaveAttribute("src", previewUrl);
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(file);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await act(async () => { completeRead?.(); });
    await waitFor(() => expect(fileInput()).toBeEnabled());
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(image);
    expect(image).toHaveAttribute("src", previewUrl);
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(file);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(changes).toHaveBeenCalledExactlyOnceWith({ kind: "replace", file });
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(previewUrl);
  });

  it("shows an empty saved-image state when the metadata is absent", async () => {
    renderDraft({ productId: "23" });
    await waitFor(() => expect(mainInstance.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fileInput()).toBeEnabled());
    expect(screen.getByRole("button", { name: "Agregar imagen" })).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar imagen" })).not.toBeInTheDocument();
    expect(changes).not.toHaveBeenCalled();
  });

  it("reports a metadata read failure and retries only that read without changing the image intent", async () => {
    vi.mocked(mainInstance.get).mockRejectedValueOnce(new AxiosError("Synthetic metadata unavailable"))
      .mockResolvedValueOnce({ data: { url: savedUrl } });
    renderDraft({ productId: "23" });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la imagen.");
    await waitFor(() => expect(sileo.error).toHaveBeenCalledTimes(1));
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", savedUrl);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mainInstance.get).toHaveBeenCalledTimes(2);
    expect(changes).not.toHaveBeenCalled();
  });

  it("replaces a failed image resource with an actionable error and recovers through fresh metadata", async () => {
    const freshUrl = "https://storage.example.test/synthetic-product-image.jpg?signature=refreshed-fixture";
    vi.mocked(mainInstance.get).mockResolvedValueOnce({ data: { url: savedUrl } })
      .mockResolvedValueOnce({ data: { url: freshUrl } });
    renderDraft({ productId: "23" });
    fireEvent.error(await screen.findByRole("img", { name: "Imagen del producto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la imagen.");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", freshUrl));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mainInstance.get).toHaveBeenCalledTimes(2);
    expect(changes).not.toHaveBeenCalled();
  });

  it("blocks selection and removal while externally disabled", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { url: savedUrl } });
    const user = userEvent.setup();
    renderDraft({ productId: "23", disabled: true });
    await screen.findByRole("img", { name: "Imagen del producto" });
    expect(fileInput()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cambiar imagen" })).toHaveAttribute("aria-disabled", "true");
    const remove = screen.getByRole("button", { name: "Retirar imagen" });
    expect(remove).toBeDisabled();
    await user.upload(fileInput(), imageFile());
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toHaveAttribute("src", savedUrl);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps the saved preview mounted during metadata refresh while locking controls and reporting busy", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { url: savedUrl } });
    const onBusyChange = vi.fn<(busy: boolean) => void>();
    const { client } = renderDraft({ productId: "23", onBusyChange });
    const image = await screen.findByRole("img", { name: "Imagen del producto" });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    let completeRead: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { completeRead = resolve; });
    vi.mocked(mainInstance.get).mockImplementationOnce(async () => {
      await pending;
      return { data: { url: savedUrl } };
    });
    act(() => { void client.invalidateQueries({ queryKey: ["product-image"] }); });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(image);
    expect(fileInput()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cambiar imagen" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Retirar imagen" })).toBeDisabled();
    await act(async () => { completeRead?.(); });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(fileInput()).toBeEnabled();
    expect(screen.getByRole("img", { name: "Imagen del producto" })).toBe(image);
    expect(mainInstance.get).toHaveBeenCalledTimes(2);
    expect(changes).not.toHaveBeenCalled();
  });
});
