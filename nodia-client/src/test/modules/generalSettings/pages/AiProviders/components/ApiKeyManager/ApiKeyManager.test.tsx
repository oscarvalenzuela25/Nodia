import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { sileo } from "sileo";
import ApiKeyManager from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ApiKeyManager";
import * as services from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import type { AiApiKeyEntity } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", () => ({
  getAiApiKeys: vi.fn(), createAiApiKey: vi.fn(), updateAiApiKey: vi.fn(), deleteAiApiKey: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const key: AiApiKeyEntity = { id: "key-7", provider_id: "instance-42", label: "Work API", display_hint: "...test", is_selected: true,
  is_active: true, sort_order: 0, health_state: "untested", created_at: "", updated_at: "" };
let rows: AiApiKeyEntity[];
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ApiKeyManager providerId="instance-42" /></QueryClientProvider>);
describe("API key management", () => {
  beforeEach(() => {
    vi.resetAllMocks(); rows = [];
    vi.mocked(services.getAiApiKeys).mockImplementation(async () => ({ data: rows, meta: { page: 1, limit: 10, total_items: rows.length, total_pages: 1 } }));
    vi.mocked(services.createAiApiKey).mockImplementation(async () => { rows = [key]; return key; });
    vi.mocked(services.updateAiApiKey).mockResolvedValue(key);
    vi.mocked(services.deleteAiApiKey).mockImplementation(async () => { rows = []; });
  });
  it("creates an encrypted-server credential by instance and clears its input after success", async () => {
    const user = userEvent.setup(); mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar API key" })).toBeEnabled());
    expect(services.getAiApiKeys).toHaveBeenCalledWith(expect.objectContaining({ includes: false, q: { provider_id_eq: "instance-42" } }));
    await user.click(screen.getByRole("button", { name: "Agregar API key" }));
    await user.type(screen.getByRole("textbox", { name: /Etiqueta/ }), "Work API");
    await user.type(screen.getByLabelText(/^API key/), "synthetic-only-test-secret");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(services.createAiApiKey).toHaveBeenCalledWith(expect.objectContaining({ provider_id: "instance-42", secret: "synthetic-only-test-secret", is_selected: true }));
    expect(screen.queryByText("synthetic-only-test-secret")).not.toBeInTheDocument();
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("keeps modal, label and secret intact when the server rejects saving", async () => {
    const user = userEvent.setup(); vi.mocked(services.createAiApiKey).mockRejectedValue(new AxiosError("Network error")); mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar API key" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Agregar API key" }));
    await user.type(screen.getByRole("textbox", { name: /Etiqueta/ }), "Retry API");
    await user.type(screen.getByLabelText(/^API key/), "synthetic-retry-secret");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Etiqueta/ })).toHaveValue("Retry API");
    expect(screen.getByLabelText(/^API key/)).toHaveValue("synthetic-retry-secret");
  });
  it("requires confirmation for deletion, updates the list and shows the empty state", async () => {
    rows = [key]; const user = userEvent.setup(); mount();
    await screen.findByText("Work API");
    await user.click(screen.getByRole("button", { name: "Eliminar clave" }));
    expect(services.deleteAiApiKey).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Confirmar/ }));
    await waitFor(() => expect(services.deleteAiApiKey).toHaveBeenCalledWith("key-7"));
    await waitFor(() => expect(screen.getByText(/No hay claves registradas/)).toBeInTheDocument());
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("keeps a sole selected key on and disabled and uses an icon deletion action", async () => {
    rows = [key]; mount();
    const selection = await screen.findByRole("switch", { name: "Seleccionar clave: Work API" });
    expect(selection).toBeChecked(); expect(selection).toBeDisabled();
    const deletion = screen.getByRole("button", { name: "Eliminar clave" });
    expect(within(deletion).getByTestId("DeleteOutlinedIcon")).toBeInTheDocument();
  });
  it("selects another key with a switch and reflects exclusive selection from the server", async () => {
    rows = [key, { ...key, id: "key-8", label: "Second API", is_selected: false }];
    vi.mocked(services.updateAiApiKey).mockImplementation(async (id, payload) => {
      rows = rows.map((row) => ({ ...row, is_selected: payload.is_selected === true && row.id === id }));
      return rows.find((row) => row.id === id)!;
    });
    const user = userEvent.setup(); mount();
    await user.click(await screen.findByRole("switch", { name: "Seleccionar clave: Second API" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Seleccionar clave: Second API" })).toBeChecked());
    expect(screen.getByRole("switch", { name: "Seleccionar clave: Work API" })).not.toBeChecked();
    expect(services.updateAiApiKey).toHaveBeenCalledWith("key-8", { is_selected: true });
    expect(sileo.success).toHaveBeenCalledOnce();
  });
});
