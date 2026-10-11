import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { sileo } from "sileo";
import ApiKeyManager from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ApiKeyManager";
import * as services from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import type { AiApiKeyEntity } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getAiApiKeys: vi.fn(),
    createAiApiKey: vi.fn(),
    updateAiApiKey: vi.fn(),
    deleteAiApiKey: vi.fn(),
  }),
);
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const key: AiApiKeyEntity = {
  id: "key-7",
  provider_id: "instance-42",
  label: "Work API",
  display_hint: "...test",
  is_selected: true,
  is_active: true,
  sort_order: 0,
  health_state: "untested",
  created_at: "",
  updated_at: "",
};
let rows: AiApiKeyEntity[];
const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ApiKeyManager providerId="instance-42" />
    </QueryClientProvider>,
  );
describe("API key management", () => {
  afterEach(() => vi.restoreAllMocks());
  const mobile = () =>
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("599.95"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  beforeEach(() => {
    vi.resetAllMocks();
    rows = [];
    vi.mocked(services.getAiApiKeys).mockImplementation(async () => ({
      data: rows,
      meta: { page: 1, limit: 10, total_items: rows.length, total_pages: 1 },
    }));
    vi.mocked(services.createAiApiKey).mockImplementation(async () => {
      rows = [key];
      return key;
    });
    vi.mocked(services.updateAiApiKey).mockResolvedValue(key);
    vi.mocked(services.deleteAiApiKey).mockImplementation(async () => {
      rows = [];
    });
  });
  it("creates an encrypted-server credential by instance and clears its input after success", async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Agregar API key" }),
      ).toBeEnabled(),
    );
    expect(services.getAiApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        includes: false,
        q: { provider_id_eq: "instance-42" },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Agregar API key" }));
    await user.type(
      screen.getByRole("textbox", { name: /Etiqueta/ }),
      "Work API",
    );
    await user.type(
      screen.getByLabelText(/^API key/),
      "synthetic-only-test-secret",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(services.createAiApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_id: "instance-42",
        secret: "synthetic-only-test-secret",
        is_selected: true,
      }),
    );
    expect(
      screen.queryByText("synthetic-only-test-secret"),
    ).not.toBeInTheDocument();
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("keeps modal, label and secret intact when the server rejects saving", async () => {
    const user = userEvent.setup();
    vi.mocked(services.createAiApiKey).mockRejectedValue(
      new AxiosError("Network error"),
    );
    mount();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Agregar API key" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Agregar API key" }));
    await user.type(
      screen.getByRole("textbox", { name: /Etiqueta/ }),
      "Retry API",
    );
    await user.type(
      screen.getByLabelText(/^API key/),
      "synthetic-retry-secret",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Etiqueta/ })).toHaveValue(
      "Retry API",
    );
    expect(screen.getByLabelText(/^API key/)).toHaveValue(
      "synthetic-retry-secret",
    );
  });
  it("requires confirmation for deletion, updates the list and shows the empty state", async () => {
    rows = [key];
    const user = userEvent.setup();
    mount();
    await screen.findByText("Work API");
    await user.click(screen.getByRole("button", { name: "Eliminar clave" }));
    expect(services.deleteAiApiKey).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Confirmar/,
      }),
    );
    await waitFor(() =>
      expect(services.deleteAiApiKey).toHaveBeenCalledWith("key-7"),
    );
    await waitFor(() =>
      expect(screen.getByText(/No hay claves registradas/)).toBeInTheDocument(),
    );
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("keeps a sole selected key on and disabled and uses an icon deletion action", async () => {
    rows = [key];
    mount();
    const selection = await screen.findByRole("switch", {
      name: "Seleccionar clave: Work API",
    });
    expect(selection).toBeChecked();
    expect(selection).toBeDisabled();
    const deletion = screen.getByRole("button", { name: "Eliminar clave" });
    expect(
      within(deletion).getByTestId("DeleteOutlinedIcon"),
    ).toBeInTheDocument();
  });
  it("selects another key with a switch and reflects exclusive selection from the server", async () => {
    rows = [
      key,
      { ...key, id: "key-8", label: "Second API", is_selected: false },
    ];
    vi.mocked(services.updateAiApiKey).mockImplementation(
      async (id, payload) => {
        rows = rows.map((row) => ({
          ...row,
          is_selected: payload.is_selected === true && row.id === id,
        }));
        return rows.find((row) => row.id === id)!;
      },
    );
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("switch", {
        name: "Seleccionar clave: Second API",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Seleccionar clave: Second API" }),
      ).toBeChecked(),
    );
    expect(
      screen.getByRole("switch", { name: "Seleccionar clave: Work API" }),
    ).not.toBeChecked();
    expect(services.updateAiApiKey).toHaveBeenCalledWith("key-8", {
      is_selected: true,
    });
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("uses mobile cards with masked keys, inactive selection disabled and confirmation retained on delete failure", async () => {
    mobile();
    rows = [
      key,
      {
        ...key,
        id: "key-8",
        label: "Inactive key with a long descriptive label",
        is_active: false,
        is_selected: false,
      },
    ];
    vi.mocked(services.deleteAiApiKey).mockRejectedValueOnce(
      new AxiosError("Network error"),
    );
    const user = userEvent.setup();
    mount();
    const card = await screen.findByRole("article", { name: "Work API" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(card).getByText("...test")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: "Seleccionar clave: Inactive key with a long descriptive label",
      }),
    ).toBeDisabled();
    await user.click(
      within(card).getByRole("button", { name: "Eliminar clave" }),
    );
    expect(services.deleteAiApiKey).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Confirmar/,
      }),
    );
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toHaveTextContent("Work API");
    expect(card).toBeInTheDocument();
    vi.mocked(services.deleteAiApiKey).mockImplementation(async () => {
      rows = rows.filter((row) => row.id !== key.id);
    });
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Confirmar/,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("article", { name: "Work API" }),
    ).not.toBeInTheDocument();
    expect(services.deleteAiApiKey).toHaveBeenLastCalledWith("key-7");
  });
  it("paginates mobile keys on the server without a query for each card", async () => {
    mobile();
    rows = Array.from({ length: 12 }, (_, i) => ({
      ...key,
      id: String(i + 1),
      label: "Key " + (i + 1),
    }));
    vi.mocked(services.getAiApiKeys).mockImplementation(
      async ({ page, limit }) => ({
        data: rows.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total_items: 12, total_pages: 2 },
      }),
    );
    const user = userEvent.setup();
    mount();
    await screen.findByRole("article", { name: "Key 1" });
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(services.getAiApiKeys).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await screen.findByRole("article", { name: "Key 11" });
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(services.getAiApiKeys).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        q: { provider_id_eq: "instance-42" },
      }),
    );
  });
});
