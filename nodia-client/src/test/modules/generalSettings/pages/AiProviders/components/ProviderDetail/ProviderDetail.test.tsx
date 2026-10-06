import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { AiConnectionMode, type AiProviderEntity } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import ProviderDetail from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getGeminiEngines: vi.fn(),
    getAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    getAiProvidersHealth: vi.fn(),
    getAiProviderEvents: vi.fn(),
    getSelectableModels: vi.fn(),
    getEnabledWebAiProviders: vi.fn(),
    getSupportedAiProviders: vi.fn(),
    syncAiProviderModels: vi.fn(),
  })
);

vi.mock("sileo", () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

const mockProviders: AiProviderEntity[] = [
  {
    id: "prov-1",
    key: "gemini",
    use_token_plan_web: true, use_token_plan_agentic: true, default_mode: "token_plan_web",
    mode: AiConnectionMode.WEB_SESSION,
    is_active: true,
    fields: {
      selected_model: "gemini-flash",
      auto_reconnect: true,
      available_models: [
        {
          id: "gemini-flash",
          name: "Gemini 3.8 Flash",
          description: "Ultra rápido y multimodal",
          contextWindow: 1000000,
          capabilities: ["text", "vision"],
          isRecommended: true,
        },
        {
          id: "gemini-pro",
          name: "Gemini 3.1 Pro",
          description: "Razonamiento profundo",
          contextWindow: 2000000,
          capabilities: ["text", "vision"],
          isRecommended: false,
        },
      ],
    },
    created_at: "2026-09-20",
    updated_at: "2026-09-20",
  },
];

const mockHealthData = {
  timestamp: "2026-09-26T12:00:00Z",
  overallStatus: "healthy" as const,
  alerts: [],
  providers: [
    {
      id: "prov-1",
      key: "gemini",
      name: "Google Gemini",
      isActive: true,
      mode: "web_session" as const,
      status: "healthy" as const,
      statusBadge: "DISPONIBLE",
      serviceState: "Disponible",
      lastCheck: "Hace 1 min",
      latencyMs: 120,
      containerStatus: "Cluster-04:IDLE",
      hasConnection: true,
      selectedModel: "gemini-flash",
      availableModels: [
        {
          id: "gemini-flash",
          name: "Gemini 3.8 Flash",
          description: "Ultra rápido y multimodal",
          contextWindow: 1000000,
          capabilities: ["text", "vision"],
          isRecommended: true,
        },
        {
          id: "gemini-pro",
          name: "Gemini 3.1 Pro",
          description: "Razonamiento profundo",
          contextWindow: 2000000,
          capabilities: ["text", "vision"],
          isRecommended: false,
        },
      ],
    },
  ],
  summary: {
    totalProviders: 1,
    activeProviders: 1,
    healthyProviders: 1,
    incidentsCount: 0,
  },
};

const mockSupported = [
  {
    id: "cat-1",
    key: "gemini",
    name: "Google Gemini",
    is_active: true,
    created_at: "2026-09-20",
    updated_at: "2026-09-20",
  },
];

describe("ProviderDetail Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: mockProviders, meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(mockHealthData);
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue(mockSupported);
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({ enabled_providers: ["gemini"] });
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({ data: [], meta: { total_items: 0, total_pages: 1, page: 1, limit: 10 } });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([]);
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "agentic", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: true, authenticated: true } });
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue(mockProviders[0]);
    vi.mocked(aiServices.syncAiProviderModels).mockResolvedValue({ models: [] });
  });
  it("renders breadcrumb and returns to the provider list", async () => {
    const back = vi.fn(), user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={back} />);
    await user.click(await screen.findByRole("button", { name: /Volver a Proveedores/i })); expect(back).toHaveBeenCalledOnce();
  });
  it("renders models from the selected instance and uses displayName", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: [{ ...mockProviders[0], fields: { selected_model: "discovered-id", available_models: [{ id: "discovered-id", name: "Internal", displayName: "Discovered display name", capabilities: ["text"] }] } }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Discovered display name")).toBeInTheDocument();
  });
  it("renders only subscription tabs and switches to agentic mode", async () => {
    const user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/i }));
    expect(screen.queryByRole("tab", { name: /API Key/i })).not.toBeInTheDocument();
    expect(await screen.findByText("Entorno Agéntico Antigravity")).toBeInTheDocument();
    expect(screen.queryByText("Historial de Incidentes, Rotaciones y Auditoría")).not.toBeInTheDocument();
  });
  it("sets the active subscription as default on the correct instance", async () => {
    const user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/i }));
    await user.click(screen.getByRole("checkbox", { name: /Modo Predeterminado/i }));
    await waitFor(() => expect(aiServices.updateAiProvider).toHaveBeenCalledWith("prov-1", expect.objectContaining({ default_mode: "token_plan_agentic" })));
  });
  it("does not advertise a stored auto reconnect preference without an implemented consumer", async () => {
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await screen.findByText("Gemini 3.8 Flash");
    expect(screen.queryByRole("switch", { name: /Auto-reconexión/i })).not.toBeInTheDocument();
  });
  it("renews the selected web connection", async () => {
    const renew = vi.fn(), user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} onRenewSession={renew} />);
    await user.click(await screen.findByRole("button", { name: /Iniciar Sesión en Navegador Remoto/i }));
    expect(renew).toHaveBeenCalledOnce();
  });
  it("keeps synchronization disabled when engine status is unknown", async () => {
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue(null);
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByRole("button", { name: "Actualizar modelos" })).toBeDisabled();
  });
  it("does not show an available adapter without authentication as a connected session", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "web", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: true, authenticated: false } });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/i }));
    expect(screen.queryByText("SESIÓN AGÉNTICA CONECTADA")).not.toBeInTheDocument();
    expect(screen.getAllByText("SESIÓN AGÉNTICA NO DISPONIBLE").length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", { name: "Actualizar modelos" })) {
      expect(button).toBeDisabled();
    }
    expect(aiServices.syncAiProviderModels).not.toHaveBeenCalled();
  });
  it("shows empty models and permits discovery with an authenticated engine", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: [{ ...mockProviders[0], fields: {} }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({ ...mockHealthData, providers: [{ ...mockHealthData.providers[0], availableModels: [], selectedModel: undefined }] });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Sin modelos asignados")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Actualizar modelos" });
    await waitFor(() => expect(buttons[0]).toBeEnabled()); await user.click(buttons[0]);
    expect(await screen.findByText("Sincronizar y configurar modelos")).toBeInTheDocument();
  });
  it("disables discovery and shows an alert when the web session expires", async () => {
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "web", web: { engine: "web", available: true, authenticated: false }, agentic: { engine: "agentic", available: false, authenticated: false } });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByRole("button", { name: "Actualizar modelos" })).toBeDisabled();
    expect(await screen.findByText(/Sesión Web de .* no disponible/i)).toBeInTheDocument();
  });
  it("shows unknown quotas and hides reasoning controls without observed capability", async () => {
    const user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("El proveedor no informa cuotas verificables.")).toBeInTheDocument();
    expect(screen.queryByText(/2[.,]399|2[.,]400/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Token Plan \(Agentic\)/i }));
    expect(screen.queryByTestId("thinking-level-high-gemini-flash")).not.toBeInTheDocument();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });

  it("permits reasoning configuration only when the selected engine reports the capability", async () => {
    vi.mocked(aiServices.getSelectableModels).mockImplementation(async (params) => [{
      providerId: "prov-1", provider: "gemini", mode: params?.mode ?? "token_plan_web", models_source: "provider", models_observed_at: new Date().toISOString(),
      planType: "token_plan", isSelected: true, isActive: true, selectedModel: "gemini-flash",
      models: [{ id: "gemini-flash", name: "Observed", displayName: "Observed", description: "", contextWindow: null, capabilities: ["reasoning"] }],
    }]);
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/i }));
    const high = await screen.findByTestId("thinking-level-high-gemini-flash");
    await waitFor(() => expect(high).toBeEnabled());
    expect(screen.getByTestId("thinking-level-medium-gemini-flash")).toHaveAttribute("aria-pressed", "false");
    await user.click(high);
    await waitFor(() => expect(aiServices.updateAiProvider).toHaveBeenCalledWith("prov-1", expect.objectContaining({ fields: expect.objectContaining({ token_plan_agentic: expect.objectContaining({ thinking_levels: { "gemini-flash": "high" } }) }) })));
  });
  it("keeps the default provider switch interactive without allowing it to turn off", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: [{ ...mockProviders[0], is_default: true }, { ...mockProviders[0], id: "prov-2", is_default: false }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    const user = userEvent.setup(); renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    const input = (await screen.findByTestId("detail-default-provider-switch")).querySelector("input")!;
    await waitFor(() => expect(input).toBeChecked()); await user.click(input);
    expect(input).toBeChecked(); expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });
  it("hides context and capability claims saved by previous versions", async () => {
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Gemini 3.8 Flash")).toBeInTheDocument();
    expect(screen.queryByText("128K Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("1M Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Texto/Audio/Video")).not.toBeInTheDocument();
    expect(screen.queryByText("Ultra rápido y multimodal")).not.toBeInTheDocument();
    expect(screen.queryByText("Modelo Primario de Razonamiento Complejo")).not.toBeInTheDocument();
  });
  it("uses observed metadata from the selected instance and mode without inferring extra modalities", async () => {
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([{
      providerId: "prov-1", provider: "gemini", mode: "token_plan_web", models_source: "provider", models_observed_at: new Date().toISOString(),
      planType: "token_plan", isSelected: true, isActive: true, selectedModel: "gemini-flash",
      models: [{ id: "gemini-flash", name: "Gemini 3.8 Flash", displayName: "Gemini 3.8 Flash", description: "Reported metadata", contextWindow: 32000, capabilities: ["vision"] }],
    }]);
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Reported metadata")).toBeInTheDocument();
    expect(screen.getByText(/32[.,]000 tokens/)).toBeInTheDocument();
    expect(screen.getByText("vision")).toBeInTheDocument();
    expect(screen.queryByText("Texto/Audio/Video")).not.toBeInTheDocument();
    expect(aiServices.getSelectableModels).toHaveBeenCalledWith({ provider_id: "prov-1", mode: "token_plan_web" });
  });
  it("never renders numeric quotas without observation provenance", async () => {
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "web", web: { engine: "web", available: true, authenticated: true,
      quota: { flash: { usage_percentage: 20, remaining: 2400, total: 3000 } } }, agentic: { engine: "agentic", available: false, authenticated: false } });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("El proveedor no informa cuotas verificables.")).toBeInTheDocument();
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
  });
  it("does not present root reasoning preferences as the configuration of a scoped mode", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: [{ ...mockProviders[0], fields: {
      enable_extended_thinking: true,
      token_plan_web: { selected_model: "gemini-flash", available_models: [{ id: "gemini-flash", name: "Observed" }] },
    } }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([{
      providerId: "prov-1", provider: "gemini", mode: "token_plan_web", models_source: "provider", planType: "token_plan", isSelected: true, isActive: true, selectedModel: "gemini-flash",
      models: [{ id: "gemini-flash", name: "Observed", displayName: "Observed", description: "", contextWindow: null, capabilities: ["reasoning"] }],
    }]);
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    const control = await screen.findByRole("switch", { name: /Razonamiento Extendido/i });
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).not.toBeChecked();
  });
  it("shows recently observed Web credits using the real bucket without claiming requests", async () => {
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "web", web: { engine: "web", available: true, authenticated: true,
      quota_source: "web", quota_observed_at: Date.now() / 1000,
      quota: { "reported-bucket": { usage_percentage: 20, remaining: 8, total: 10 } } }, agentic: { engine: "agentic", available: false, authenticated: false } });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Uso Web reportado (reported-bucket)")).toBeInTheDocument();
    expect(screen.getByText("8 de 10 unidades reportadas disponibles")).toBeInTheDocument();
    expect(screen.queryByText(/8.*solicitudes/i)).not.toBeInTheDocument();
  });

});
