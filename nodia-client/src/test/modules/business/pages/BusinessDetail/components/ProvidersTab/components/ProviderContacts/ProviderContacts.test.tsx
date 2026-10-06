import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import ProviderContacts from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts";
import * as services from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts/infrastructure/services";
import { notifyHttpError } from "../../../../../../../../../config/httpFeedback";
import { sileo } from "sileo";
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../../../../../hooks/useAuth", () => ({
  default: () => ({ user: { id: "1" }, isSessionActive: true }),
}));
vi.mock(
  "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts/infrastructure/services",
  () => ({
    getContacts: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    toggleContact: vi.fn(),
  }),
);
const contact = {
  id: "1",
  provider_id: "2",
  name: "María",
  phone: [{ number: "+56987654321" }],
  email: "maria@example.test",
  description: null,
  schedule: { monday: [{ from: "09:00", to: "12:00" }] },
  version: 1,
  is_active: true,
  created_at: "2026-10-05T12:00:00Z",
  updated_at: "2026-10-05T12:00:00Z",
};
const response = {
  data: [contact],
  meta: { page: 1, limit: 25, total_items: 1, total_pages: 1 },
};
function mount() {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: notifyHttpError }),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProviderContacts providerId="2" providerName="Acme" onBack={vi.fn()} />
    </QueryClientProvider>,
  );
  return client;
}
describe("ProviderContacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(services.getContacts).mockResolvedValue(response);
  });
  it("loads only the selected provider and renders phone/email links and its schedule", async () => {
    mount();
    await screen.findByText("María");
    expect(services.getContacts).toHaveBeenCalledWith(
      "2",
      { page: 1, limit: 25, search: "" },
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole("link", { name: /Abrir WhatsApp/ }),
    ).toHaveAttribute(
      "href",
      "https://web.whatsapp.com/send?phone=56987654321",
    );
    expect(
      screen.getByRole("link", { name: "Redactar correo" }),
    ).toHaveAttribute("href", "mailto:maria%40example.test");
    expect(screen.getByText("Lunes: 09:00–12:00")).toBeInTheDocument();
  });
  it("shows an empty state with creation action", async () => {
    vi.mocked(services.getContacts).mockResolvedValue({
      data: [],
      meta: { ...response.meta, total_items: 0, total_pages: 0 },
    });
    const user = userEvent.setup();
    mount();
    await screen.findByText("Este proveedor aún no tiene contactos");
    await user.click(
      screen.getAllByRole("button", { name: "Agregar contacto" })[0],
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("keeps cached contacts visible after a failed revalidation and offers retry with one toast", async () => {
    const client = mount();
    await screen.findByText("María");
    const error = new Error("Offline");
    vi.mocked(services.getContacts).mockRejectedValueOnce(error);
    await client.invalidateQueries({ queryKey: ["provider-contacts"] });
    expect(screen.getByText("María")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalledOnce();
  });
  it("preserves the activation dialog after rejection", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("María");
    vi.mocked(services.toggleContact).mockRejectedValue(new Error("Failed"));
    await user.click(
      screen.getByRole("button", { name: "Desactivar contacto" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(services.toggleContact).toHaveBeenCalledWith("2", "1", 1, false),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
