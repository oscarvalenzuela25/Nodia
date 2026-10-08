import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { sileo } from "sileo";
import ProviderConnectionForm from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderConnectionForm/ProviderConnectionForm";
import * as services from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import type { AiProviderHealthItem } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", () => ({
  getAiProviderCatalog: vi.fn(), createAiProvider: vi.fn(), updateAiProvider: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const catalog = {
  id: "catalog-google", key: "gemini", name: "Google Gemini", is_active: true,
  can_use_api_key: true, can_use_token_plan_web: true, can_use_token_plan_agentic: false,
  created_at: "", updated_at: "",
};
const provider: AiProviderHealthItem = {
  id: "second-connection", key: "gemini", name: "Secondary", catalog_id: catalog.id, catalog,
  isActive: true, status: "healthy", statusBadge: "", serviceState: "", lastCheck: "",
  latencyMs: 0, mode: "web_session", use_token_plan_web: true, use_token_plan_agentic: false,
  default_mode: "token_plan_web", hasConnection: true,
};
const renderForm = (onClose: () => void, editing = false) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <ProviderConnectionForm provider={editing ? provider : undefined} onClose={onClose} totalProviders={2} />
  </QueryClientProvider>,
);

describe("ProviderConnectionForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(services.getAiProviderCatalog).mockResolvedValue([catalog, { ...catalog, id: "api-only", name: "API only", can_use_token_plan_web: false }]);
    vi.mocked(services.createAiProvider).mockResolvedValue({ id: "created", key: "gemini", is_active: true, created_at: "", updated_at: "" });
    vi.mocked(services.updateAiProvider).mockResolvedValue({ id: provider.id, key: "gemini", is_active: true, created_at: "", updated_at: "" });
  });

  it("shows API and subscription connections permitted by the catalog", async () => {
    const user = userEvent.setup(), close = vi.fn();
    renderForm(close);
    await waitFor(() => expect(screen.getByRole("button", { name: "Proveedor" })).toHaveAttribute("aria-disabled", "false"));
    await user.click(screen.getByRole("button", { name: "Proveedor" }));
    expect(screen.getByText("API only")).toBeInTheDocument();
    await user.click(screen.getByText("Google Gemini"));
    expect(screen.getByRole("switch", { name: /Antigravity/i })).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: /Web/i }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(services.createAiProvider).toHaveBeenCalledWith(expect.objectContaining({
      catalog_id: catalog.id, use_api_key: false, auto_rotate_api_keys: false,
      use_token_plan_web: true, use_token_plan_agentic: false, default_mode: "token_plan_web",
    })));
    expect(close).toHaveBeenCalledOnce();
    expect(sileo.success).toHaveBeenCalledOnce();
  });

  it("creates an OpenAI API connection without offering unsupported subscription modes", async () => {
    const user = userEvent.setup(), close = vi.fn();
    vi.mocked(services.getAiProviderCatalog).mockResolvedValue([{ ...catalog, id: "openai-catalog", key: "openai", name: "OpenAI", can_use_token_plan_web: false, can_use_token_plan_agentic: false }]);
    renderForm(close);
    await waitFor(() => expect(screen.getByRole("button", { name: "Proveedor" })).toHaveAttribute("aria-disabled", "false"));
    await user.click(screen.getByRole("button", { name: "Proveedor" })); await user.click(screen.getByText("OpenAI"));
    expect(screen.getByRole("switch", { name: "API key" })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Web/i })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /Antigravity/i })).toBeDisabled();
    const defaultSwitch = screen.getByRole("switch", { name: "Predeterminado" });
    expect(defaultSwitch.compareDocumentPosition(screen.getByRole("switch", { name: "Activo" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(defaultSwitch);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(services.createAiProvider).toHaveBeenCalledWith(expect.objectContaining({ catalog_id: "openai-catalog", use_api_key: true, default_mode: "api_key", use_token_plan_web: false, use_token_plan_agentic: false, is_default: true })));
  });

  it("keeps API enabled and rotation intact when editing a historical connection", async () => {
    const user = userEvent.setup(), close = vi.fn();
    const historical = { ...provider, use_api_key: true, auto_rotate_api_keys: true, default_mode: "api_key" as const };
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProviderConnectionForm provider={historical} onClose={close} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    await user.type(screen.getByRole("textbox"), " edited");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(services.updateAiProvider).toHaveBeenCalledWith(provider.id, expect.objectContaining({ use_api_key: true, auto_rotate_api_keys: true, default_mode: "api_key" })));
  });

  it("updates the selected instance and preserves form data when saving fails", async () => {
    const user = userEvent.setup(), close = vi.fn();
    vi.mocked(services.updateAiProvider).mockRejectedValue(new AxiosError("Network error"));
    renderForm(close, true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Secondary edited");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    expect(services.updateAiProvider).toHaveBeenCalledWith(provider.id, expect.objectContaining({ name: "Secondary edited", use_api_key: false }));
    expect(close).not.toHaveBeenCalled();
    expect(input).toHaveValue("Secondary edited");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});
