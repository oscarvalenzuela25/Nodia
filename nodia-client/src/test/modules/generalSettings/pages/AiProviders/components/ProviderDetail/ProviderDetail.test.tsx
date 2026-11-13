import i18n from "../../../../../../../translate";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  AiConnectionMode,
  type AiProviderEntity,
  type GeminiAgenticStatus,
} from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import ProviderDetail from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import * as codexServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession";
import { sileo } from "sileo";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession", async (importOriginal) => ({
  ...await importOriginal<typeof codexServices>(),
  getCurrentCodexLogin: vi.fn(),
  getCodexSession: vi.fn(),
}));

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getGeminiEngines: vi.fn(),
    getCurrentGeminiAgenticLogin: vi.fn(),
    startGeminiAgenticLogin: vi.fn(),
    getGeminiAgenticLoginStatus: vi.fn(),
    submitGeminiAgenticCode: vi.fn(),
    cancelGeminiAgenticLogin: vi.fn(),
    getAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    getAiProvidersHealth: vi.fn(),
    disconnectGeminiWeb: vi.fn(),
    getAiProviderEvents: vi.fn(),
    getSelectableModels: vi.fn(),
    getSupportedAiProviders: vi.fn(),
    syncAiProviderModels: vi.fn(),
    getAiApiKeys: vi.fn(),
    createAiApiKey: vi.fn(),
    updateAiApiKey: vi.fn(),
    deleteAiApiKey: vi.fn(),
  }),
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const mockProviders: AiProviderEntity[] = [
  {
    id: "prov-1",
    key: "gemini",
    use_agentic: true,
    default_mode: "agentic",
    mode: AiConnectionMode.AGENTIC,
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
  engines: {
    active_engine: "agentic",
    agentic: { engine: "agentic", available: true, authenticated: true },
  } as GeminiAgenticStatus,
  timestamp: "2026-09-26T12:00:00Z",
  overallStatus: "healthy" as const,
  alerts: [],
  providers: [
    {
      id: "prov-1",
      key: "gemini",
      name: "Google Gemini",
      isActive: true,
      mode: "agentic" as const,
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
  it("opens the requested enabled mode even when a different mode is the default", async () => {
    renderWithClient(
      <ProviderDetail
        providerId="prov-1"
        initialMode="agentic"
        onBack={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("tab", { name: /Agentic/ }),
    ).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(aiServices.getSelectableModels).toHaveBeenCalledWith({
        provider_id: "prov-1",
        mode: "agentic",
      }),
    );
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(
      mockHealthData,
    );
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue(
      mockSupported,
    );
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({
      data: [],
      meta: { total_items: 0, total_pages: 1, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([]);
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: { engine: "agentic", available: true, authenticated: true },
      },
    });
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue(mockProviders[0]);
    vi.mocked(aiServices.syncAiProviderModels).mockResolvedValue({
      models: [],
    });
    vi.mocked(aiServices.getCurrentGeminiAgenticLogin).mockResolvedValue(null);
  });
  it("opens the independent Agentic authentication modal from the Gemini Agentic tab", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/ }),
    );
    const button = await screen.findByRole("button", {
      name: "Autenticar sesión Agentic",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByRole("dialog", {
        name: "Iniciar sesión Gemini Agentic",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Conectar cuenta Google" }),
      ).toBeEnabled(),
    );
    expect(aiServices.getCurrentGeminiAgenticLogin).toHaveBeenCalled();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
    expect(aiServices.startGeminiAgenticLogin).not.toHaveBeenCalled();
  });
  it.each(["gemini", "openai"])(
    "saves API reasoning per model for %s without modifying subscription settings",
    async (key) => {
      const fields = {
        api_key: {
          selected_model: "api-model",
          available_models: [{ id: "api-model", name: "Account model" }],
          thinking_levels: { "api-model": "low", "other-model": "medium" },
        },
        agentic: { thinking_level: "high" },
      };
      vi.mocked(aiServices.getAiProviders).mockResolvedValue({
        data: [
          {
            ...mockProviders[0],
            key,
            use_api_key: true,
            default_mode: "api_key",
            fields,
          },
        ],
        meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
      });
      vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({
        data: [],
        meta: { total_items: 0, total_pages: 0, page: 1, limit: 10 },
      });
      const user = userEvent.setup();
      renderWithClient(
        <ProviderDetail providerId="prov-1" onBack={() => {}} />,
      );
      const high = await screen.findByTestId("thinking-level-high-api-model");
      await waitFor(() => expect(high).toBeEnabled());
      expect(
        screen.getByTestId("thinking-level-low-api-model"),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByTestId("thinking-level-medium-api-model"),
      ).toHaveAttribute("aria-pressed", "false");
      await user.click(high);
      await waitFor(() =>
        expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
          "prov-1",
          expect.objectContaining({
            fields: expect.objectContaining({
              agentic: fields.agentic,
              api_key: expect.objectContaining({
                thinking_levels: {
                  "api-model": "high",
                  "other-model": "medium",
                },
                thinking_level: "high",
              }),
            }),
          }),
        ),
      );
    },
  );
  it("keeps the saved API reasoning choice when updating it fails", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          key: "openai",
          use_api_key: true,
          default_mode: "api_key",
          fields: {
            api_key: {
              selected_model: "api-model",
              available_models: [{ id: "api-model" }],
              thinking_levels: { "api-model": "low" },
            },
          },
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({
      data: [],
      meta: { total_items: 0, total_pages: 0, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.updateAiProvider).mockRejectedValue(
      new Error("Synthetic failure"),
    );
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    const high = await screen.findByTestId("thinking-level-high-api-model");
    await waitFor(() => expect(high).toBeEnabled());
    await user.click(high);
    await waitFor(() =>
      expect(aiServices.updateAiProvider).toHaveBeenCalledOnce(),
    );
    expect(screen.getByTestId("thinking-level-low-api-model")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(high).toHaveAttribute("aria-pressed", "false");
  });
  it("renders breadcrumb and returns to the provider list", async () => {
    const back = vi.fn(),
      user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={back} />);
    await user.click(
      await screen.findByRole("button", { name: /Volver a Proveedores/i }),
    );
    expect(back).toHaveBeenCalledOnce();
  });
  it("renders models from the selected instance and uses displayName", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          fields: {
            selected_model: "discovered-id",
            available_models: [
              {
                id: "discovered-id",
                name: "Internal",
                displayName: "Discovered display name",
                capabilities: ["text"],
              },
            ],
          },
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByText("Discovered display name"),
    ).toBeInTheDocument();
  });
  it("renders only subscription tabs and switches to agentic mode", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    expect(
      screen.queryByRole("tab", { name: /API Key/i }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Entorno Agentic")).toBeInTheDocument();
    expect(
      screen.queryByText("Historial de Incidentes, Rotaciones y Auditoría"),
    ).not.toBeInTheDocument();
  });
  it("sets the active subscription as default on the correct instance", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: [{ ...mockProviders[0], use_api_key: true, default_mode: "api_key" }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 } });
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="agentic" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Modo Predeterminado/i }),
    );
    await waitFor(() =>
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({ default_mode: "agentic" }),
      ),
    );
  });
  it("does not advertise a stored auto reconnect preference without an implemented consumer", async () => {
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await screen.findByText("Gemini 3.8 Flash");
    expect(
      screen.queryByRole("switch", { name: /Auto-reconexión/i }),
    ).not.toBeInTheDocument();
  });
  it("hides the header status on API and retains it on token plan tabs", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{...mockProviders[0], use_api_key:true, default_mode:"api_key"}],
      meta:{total_items:1,total_pages:1,page:1,limit:100},
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({data:[],meta:{total_items:0,total_pages:0,page:1,limit:10}});
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({...mockHealthData,
      providers:[{...mockHealthData.providers[0],mode:"api_key",status:"degraded",statusBadge:"API STATUS"}]});
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="api_key" onBack={() => {}} />);
    const api = await screen.findByRole("tab", {name:/API key/});
    await waitFor(() => expect(api).toHaveAttribute("aria-selected","true"));
    expect(screen.queryByText("Disponible",{exact:true})).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", {name:/Agentic/}));
    expect(await screen.findByText("Disponible",{exact:true})).toBeInTheDocument();
    await user.click(api);
    expect(screen.queryByText("Disponible",{exact:true})).not.toBeInTheDocument();
  });
  it("keeps synchronization disabled when engine status is unknown", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: null,
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByRole("button", { name: "Actualizar modelos" }),
    ).toBeDisabled();
  });
  it("updates the header, alerts and Agentic panel from one health response with one verification request", async () => {
    const down = {
      ...mockHealthData,
      engines: {
        ...mockHealthData.engines!,
        agentic: {
          engine: "agentic" as const,
          available: false,
          authenticated: false,
        },
      },
      providers: [
        { ...mockHealthData.providers[0], status: "degraded" as const },
      ],
      alerts: [
        {
          id: "synthetic-agentic-down",
          provider: "gemini",
          providerName: "Google Gemini",
          reason: "agentic_adapter_unavailable" as const,
          type: "incident" as const,
          severity: "error" as const,
          title: "Synthetic outage",
          message: "Synthetic outage",
          actionType: "check_status" as const,
          actionLabel: "synthetic",
        },
      ],
    };
    vi.mocked(aiServices.getAiProvidersHealth)
      .mockResolvedValueOnce(down)
      .mockResolvedValue(mockHealthData);
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    expect(screen.getByText("Degradado")).toBeInTheDocument();
    expect(
      screen.getAllByText("SESIÓN AGÉNTICA NO DISPONIBLE").length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: "Volver a comprobar" }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText("SESIÓN AGÉNTICA CONECTADA").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Degradado")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Agentic de Google Gemini no disponible"),
    ).not.toBeInTheDocument();
    expect(aiServices.getAiProvidersHealth).toHaveBeenCalledTimes(2);
    expect(aiServices.getGeminiEngines).not.toHaveBeenCalled();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });
  it("marks missing engine data unverified without inventing a failed session", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: null,
    });
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    expect(
      screen.getAllByText("ESTADO AGÉNTICO SIN VERIFICAR").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("SESIÓN AGÉNTICA NO DISPONIBLE"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Sesión Agentic de .* no disponible/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizar modelos" }),
    ).toBeDisabled();
    expect(aiServices.getGeminiEngines).not.toHaveBeenCalled();
  });
  it("does not show an available adapter without authentication as a connected session", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: { engine: "agentic", available: true, authenticated: false },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    expect(
      screen.queryByText("SESIÓN AGÉNTICA CONECTADA"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("SESIÓN AGÉNTICA NO DISPONIBLE").length,
    ).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", {
      name: "Actualizar modelos",
    })) {
      expect(button).toBeDisabled();
    }
    expect(aiServices.syncAiProviderModels).not.toHaveBeenCalled();
  });
  it("shows empty models and permits discovery with an authenticated engine", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{ ...mockProviders[0], fields: {} }],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      providers: [
        {
          ...mockHealthData.providers[0],
          availableModels: [],
          selectedModel: undefined,
        },
      ],
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByText("Sin modelos asignados"),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", {
      name: "Actualizar modelos",
    });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    await user.click(buttons[0]);
    expect(
      await screen.findByText("Sincronizar y configurar modelos"),
    ).toBeInTheDocument();
  });
  it("disables discovery and shows the inactive Agentic session", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: { engine: "agentic", available: true, authenticated: false },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByRole("button", { name: "Actualizar modelos" }),
    ).toBeDisabled();
    expect(
      await screen.findAllByText(i18n.t("ai_providers:detail.agentic_status_inactive_badge")),
    ).toBeTruthy();
  });
  it("shows unknown quotas while allowing saved Agentic reasoning preferences", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByRole("tab", { name: /Agentic/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2[.,]399|2[.,]400/)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("tab", { name: /Agentic/i }),
    );
    expect(
      await screen.findByTestId("thinking-level-high-gemini-flash"),
    ).toBeInTheDocument();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });

  it("saves Agentic reasoning per model without claiming operational availability", async () => {
    vi.mocked(aiServices.getSelectableModels).mockImplementation(
      async (params) => [
        {
          providerId: "prov-1",
          provider: "gemini",
          mode: params?.mode ?? "agentic",
          models_source: "provider",
          models_observed_at: new Date().toISOString(),
          planType: "agentic",
          isSelected: true,
          isActive: true,
          selectedModel: "gemini-flash",
          models: [
            {
              id: "gemini-flash",
              name: "Observed",
              displayName: "Observed",
              description: "",
              contextWindow: null,
              capabilities: ["reasoning"],
            },
          ],
        },
      ],
    );
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await user.click(
      await screen.findByRole("tab", { name: /Agentic/i }),
    );
    const high = await screen.findByTestId("thinking-level-high-gemini-flash");
    await waitFor(() => expect(high).toBeEnabled());
    expect(
      screen.getByTestId("thinking-level-medium-gemini-flash"),
    ).toHaveAttribute("aria-pressed", "false");
    await user.click(high);
    await waitFor(() =>
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            agentic: expect.objectContaining({
              thinking_levels: { "gemini-flash": "high" },
            }),
          }),
        }),
      ),
    );
  });
  it("keeps the default provider switch interactive without allowing it to turn off", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        { ...mockProviders[0], is_default: true },
        { ...mockProviders[0], id: "prov-2", is_default: false },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    const input = (
      await screen.findByTestId("detail-default-provider-switch")
    ).querySelector("input")!;
    await waitFor(() => expect(input).toBeChecked());
    await user.click(input);
    expect(input).toBeChecked();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });
  it("hides context and capability claims saved by previous versions", async () => {
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Gemini 3.8 Flash")).toBeInTheDocument();
    expect(screen.queryByText("128K Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("1M Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Texto/Audio/Video")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Ultra rápido y multimodal"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Modelo Primario de Razonamiento Complejo"),
    ).not.toBeInTheDocument();
  });
  it("uses observed metadata from the selected instance and mode without inferring extra modalities", async () => {
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([
      {
        providerId: "prov-1",
        provider: "gemini",
        mode: "agentic",
        models_source: "provider",
        models_observed_at: new Date().toISOString(),
        planType: "agentic",
        isSelected: true,
        isActive: true,
        selectedModel: "gemini-flash",
        models: [
          {
            id: "gemini-flash",
            name: "Gemini 3.8 Flash",
            displayName: "Gemini 3.8 Flash",
            description: "Reported metadata",
            contextWindow: 32000,
            capabilities: ["vision"],
          },
        ],
      },
    ]);
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Reported metadata")).toBeInTheDocument();
    expect(screen.getByText(/32[.,]000 tokens/)).toBeInTheDocument();
    expect(screen.getByText("vision")).toBeInTheDocument();
    expect(screen.queryByText("Texto/Audio/Video")).not.toBeInTheDocument();
    expect(aiServices.getSelectableModels).toHaveBeenCalledWith({
      provider_id: "prov-1",
      mode: "agentic",
    });
  });
  it("never renders numeric quotas without observation provenance", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: {
          engine: "agentic",
          available: true,
          authenticated: true,
          quota: {
            flash: { usage_percentage: 20, remaining: 2400, total: 3000 },
          },
        },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByRole("tab", { name: /Agentic/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
  });
  it("does not present root reasoning preferences as the configuration of a scoped mode", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          fields: {
            enable_extended_thinking: true,
            agentic: {
              selected_model: "gemini-flash",
              available_models: [{ id: "gemini-flash", name: "Observed" }],
            },
          },
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([
      {
        providerId: "prov-1",
        provider: "gemini",
        mode: "agentic",
        models_source: "provider",
        planType: "agentic",
        isSelected: true,
        isActive: true,
        selectedModel: "gemini-flash",
        models: [
          {
            id: "gemini-flash",
            name: "Observed",
            displayName: "Observed",
            description: "",
            contextWindow: null,
            capabilities: ["reasoning"],
          },
        ],
      },
    ]);
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: {
          engine: "agentic",
          available: true,
          authenticated: true,
          supported_options: { extended_thinking: true },
        },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    const control = await screen.findByTestId("thinking-level-low-gemini-flash");
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("switch", { name: /Razonamiento Extendido/i })).not.toBeInTheDocument();
  });

  it.each(["api_key", "agentic"] as const)("shows the Codex account only on Agentic with %s as default", async (defaultMode) => {
    const user = userEvent.setup();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{...mockProviders[0], key:"openai",use_api_key:true,use_agentic:true,default_mode:defaultMode,fields:{},api_keys:[]}],
      meta:{total_items:1,total_pages:1,page:1,limit:10},
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({data:[],meta:{total_items:0,total_pages:0,page:1,limit:10}});
    vi.mocked(codexServices.getCodexSession).mockResolvedValue({available:true,authenticated:false,planType:null,checkedAt:null,reason:"codex_session_required",quotas:null,lastInferenceAt:null,usageAllowed:null});
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="api_key" onBack={() => {}} />);
    const api = await screen.findByRole("tab", {name:/API key/});
    await waitFor(() => expect(api).toHaveAttribute("aria-selected","true"));
    expect(screen.queryByText("Cuenta Codex")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", {name:"API keys"})).toBeInTheDocument();
    expect(codexServices.getCodexSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", {name:/Agentic/}));
    expect(await screen.findByText("Cuenta Codex")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button",{name:"Gestionar cuenta Codex"})).toBeEnabled());
    expect(codexServices.getCodexSession).toHaveBeenCalledOnce();
    await user.click(api);
    expect(screen.queryByText("Cuenta Codex")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", {name:"API keys"})).toBeInTheDocument();
    expect(codexServices.getCodexSession).toHaveBeenCalledOnce();
  });
  it("opens Codex management from an alert after switching out of API", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data:[{...mockProviders[0],key:"openai",use_api_key:true,use_agentic:true,default_mode:"api_key",fields:{},api_keys:[]}],
      meta:{total_items:1,total_pages:1,page:1,limit:10},
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({...mockHealthData,
      alerts:[{id:"synthetic-codex",provider:"openai",providerId:"prov-1",type:"warning",severity:"warning",title:"Synthetic Codex alert",message:"Synthetic session needed",actionType:"authenticate_agentic",actionLabel:"Synthetic manage"}],
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({data:[],meta:{total_items:0,total_pages:0,page:1,limit:10}});
    vi.mocked(codexServices.getCurrentCodexLogin).mockResolvedValue(null);
    vi.mocked(codexServices.getCodexSession).mockResolvedValue({available:true,authenticated:false,planType:null,checkedAt:null,reason:"codex_session_required",quotas:null,lastInferenceAt:null,usageAllowed:null});
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="api_key" onBack={() => {}} />);
    const agenticTab = await screen.findByRole("tab",{name:/Agentic/});
    await userEvent.click(await screen.findByRole("button",{name:"Gestionar cuenta Codex"}));
    await waitFor(() => expect(agenticTab).toHaveAttribute("aria-selected","true"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(codexServices.getCodexSession).toHaveBeenCalledWith("prov-1", expect.objectContaining({ aborted: false }));
  });
  it("keeps an API-only OpenAI connection free of Codex and ChatGPT Web controls", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          key: "openai",
          name: "OpenAI connection",
          use_api_key: true,
          use_agentic: false,
          default_mode: "api_key",
          mode: AiConnectionMode.API_KEY,
          fields: {},
          api_keys: [],
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({
      data: [],
      meta: { total_items: 0, total_pages: 0, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([]);
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Agregar API key" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("tab", { name: /API key/ })).toBeInTheDocument();
    expect(screen.queryByText("Cuenta Codex")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gestionar cuenta Codex" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sesión ChatGPT Web")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar ChatGPT" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /Web|Agentic|Antigravity/ }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/No hay claves registradas/),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText(/^Modelos \(/)
        .compareDocumentPosition(
          screen.getByRole("heading", { name: "API keys" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(aiServices.getAiApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({ q: { provider_id_eq: "prov-1" } }),
    );
  });
  it("hides Gemini reasoning controls when no model is assigned and keeps synchronization disabled", async () => {
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          default_mode: "agentic",
          fields: { agentic: {} },
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: { engine: "agentic", available: false, authenticated: false },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(await screen.findByText("Sin modelos asignados")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^(Low|Medium|High)$/ })).not.toBeInTheDocument();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
    screen
      .getAllByRole("button", { name: "Actualizar modelos" })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it("groups Gemini variants into one card and saves the exact effort ID atomically without changing OCR or API settings", async () => {
    const variants = ["high", "medium", "low"].map(effort => ({
      id: `fixture-family-${effort}`, displayName: `Fixture Family (${effort})`,
    }));
    const fields = {
      selected_model: variants[0].id,
      api_key: { selected_model: "fixture-api", thinking_levels: { "fixture-api": "low" } },
      agentic: {
        selected_model: variants[0].id,
        ocr_focus_model: variants[0].id,
        ocr_model: variants[0].id,
        thinking_level: "high",
        thinking_levels: { [variants[0].id]: "high", "fixture-other": "low" },
        available_models: variants,
      },
    };
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{ ...mockProviders[0], use_api_key: true, fields }],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="agentic" onBack={() => {}} />);
    expect(await screen.findByText("Fixture Family")).toBeVisible();
    expect(screen.queryByText("Fixture Family (medium)")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Medium" })).toHaveLength(1);
    const medium = screen.getByTestId("thinking-level-medium-fixture-family-high");
    await waitFor(() => expect(medium).toBeEnabled());
    await user.click(medium);
    await waitFor(() => expect(aiServices.updateAiProvider).toHaveBeenCalledOnce());
    expect(aiServices.updateAiProvider).toHaveBeenCalledWith("prov-1", {
      fields: {
        ...fields,
        selected_model: variants[1].id,
        thinking_level: "medium",
        agentic: {
          ...fields.agentic,
          selected_model: variants[1].id,
          thinking_level: "medium",
          thinking_levels: { ...fields.agentic.thinking_levels, [variants[1].id]: "medium" },
        },
      },
    });
  });

  it("keeps the selected Gemini variant and OCR focus when the grouped effort update fails", async () => {
    const fields = {
      agentic: {
        selected_model: "fixture-family-high",
        ocr_focus_model: "fixture-family-high",
        ocr_model: "fixture-family-high",
        thinking_level: "high",
        available_models: ["high", "medium", "low"].map(effort => ({
          id: `fixture-family-${effort}`, displayName: `Fixture Family (${effort})`,
        })),
      },
    };
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{ ...mockProviders[0], fields }],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.updateAiProvider).mockRejectedValue(new Error("Synthetic update failure"));
    const original = structuredClone(fields);
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="agentic" onBack={() => {}} />);
    const medium = await screen.findByTestId("thinking-level-medium-fixture-family-high");
    await waitFor(() => expect(medium).toBeEnabled());
    await user.click(medium);
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    expect(aiServices.updateAiProvider).toHaveBeenCalledOnce();
    expect(screen.getByTestId("thinking-level-high-fixture-family-high")).toHaveAttribute("aria-pressed", "true");
    expect(medium).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("thinking-level-medium-fixture-family-medium")).not.toBeInTheDocument();
    screen.getAllByRole("switch", { name: "Predeterminado" }).forEach(control => expect(control).toBeChecked());
    expect(fields).toEqual(original);
  });

  it("changes an unselected Gemini family's effort and displayed variant without selecting it or moving OCR", async () => {
    const fields = {
      selected_model: "fixture-current",
      agentic: {
        selected_model: "fixture-current",
        ocr_focus_model: "fixture-current",
        ocr_model: "fixture-current",
        thinking_level: "high",
        thinking_levels: { "fixture-current": "high" },
        available_models: [
          { id: "fixture-current", displayName: "Fixture Current" },
          ...["high", "medium", "low"].map(effort => ({
            id: `fixture-other-${effort}`, displayName: `Fixture Other (${effort})`,
          })),
        ],
      },
      api_key: { selected_model: "fixture-api" },
    };
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{ ...mockProviders[0], fields }],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="agentic" onBack={() => {}} />);
    const medium = await screen.findByTestId("thinking-level-medium-fixture-other-high");
    await waitFor(() => expect(medium).toBeEnabled());
    await user.click(medium);
    const updated = await screen.findByTestId("thinking-level-medium-fixture-other-medium");
    expect(updated).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("fixture-other-high", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText("fixture-current", { exact: true })).toBeVisible();
    expect(aiServices.updateAiProvider).toHaveBeenCalledExactlyOnceWith("prov-1", {
      fields: { ...fields, agentic: { ...fields.agentic,
        thinking_levels: { ...fields.agentic.thinking_levels, "fixture-other-medium": "medium" } } },
    });
  });

  it.each(["xhigh", "max"])("saves OpenAI API %s exactly while keeping Ultra disabled and the Agentic configuration unchanged", async effort => {
    const fields = {
      api_key: {
        selected_model: "fixture-api-model",
        available_models: [{ id: "fixture-api-model", name: "Fixture API model" }],
        thinking_levels: { "fixture-api-model": "low", "fixture-other": "medium" },
      },
      agentic: { selected_model: "fixture-agentic", thinking_level: "high" },
    };
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [{ ...mockProviders[0], key: "openai", use_api_key: true, default_mode: "api_key", fields }],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({ data: [], meta: { total_items: 0, total_pages: 0, page: 1, limit: 10 } });
    const user = userEvent.setup();
    renderWithClient(<ProviderDetail providerId="prov-1" initialMode="api_key" onBack={() => {}} />);
    const choice = await screen.findByTestId(`thinking-level-${effort}-fixture-api-model`);
    await waitFor(() => expect(choice).toBeEnabled());
    const ultra = screen.getByRole("button", { name: "Ultra" });
    expect(ultra).toBeDisabled();
    await user.hover(ultra.parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(i18n.t("ai_providers:detail.api_effort_unsupported"));
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
    await user.click(choice);
    await waitFor(() => expect(aiServices.updateAiProvider).toHaveBeenCalledOnce());
    expect(aiServices.updateAiProvider).toHaveBeenCalledWith("prov-1", {
      fields: {
        ...fields,
        thinking_level: effort,
        api_key: { ...fields.api_key, thinking_level: effort,
          thinking_levels: { ...fields.api_key.thinking_levels, "fixture-api-model": effort } },
      },
    });
  });
  it("does not block authenticated Agentic when the default API channel is unconfigured", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      providers: [{ ...mockHealthData.providers[0], status: "unconfigured" }],
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      engines: {
        active_engine: "agentic",
        agentic: { engine: "agentic", available: true, authenticated: true },
      },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Actualizar modelos" }),
      ).toBeEnabled(),
    );
    expect(screen.getAllByText(i18n.t("ai_providers:detail.agentic_status_active_badge")).length).toBeGreaterThan(0);
  });

  it("renders discovered Codex efforts and keeps incompatible historical preferences visible and removable", async () => {
    vi.mocked(codexServices.getCodexSession).mockResolvedValue({ available: true, authenticated: true,
      planType: null, checkedAt: "2026-11-01T18:00:00Z", reason: null, quotas: null, lastInferenceAt: null, usageAllowed: null });
    const fields = {
      api_key: { selected_model: "api-unchanged" },
      agentic: {
        selected_model: "synthetic-codex",
        thinking_level: "obsolete",
        available_models: [{ id: "synthetic-codex", name: "Synthetic" }],
      },
    };
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: [
        {
          ...mockProviders[0],
          key: "openai",
          use_api_key: true,
          use_agentic: true,
          default_mode: "agentic",
          fields,
        },
      ],
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([
      {
        providerId: "prov-1",
        provider: "openai",
        mode: "agentic",
        planType: "agentic",
        isActive: true,
        isSelected: false,
        selectedModel: "synthetic-codex",
        models_source: "provider",
        models_observed_at: "2026-10-08T12:00:00Z",
        models: [
          {
            id: "synthetic-codex",
            name: "Synthetic",
            displayName: "Synthetic",
            description: "",
            contextWindow: null,
            capabilities: ["vision", "reasoning"],
            inputModalities: ["text", "image"],
            supportedReasoningEfforts: ["new_effort"],
          },
        ],
      },
    ]);
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({
      data: [],
      meta: { total_items: 0, total_pages: 0, page: 1, limit: 10 },
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={() => {}} />);
    expect(
      await screen.findByTestId("thinking-level-new_effort-synthetic-codex"),
    ).toBeVisible();
    expect(
      screen.queryByTestId("thinking-level-low-synthetic-codex"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/obsolete.*no está disponible/),
    ).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Quitar preferencia" }));
    await waitFor(() =>
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            api_key: fields.api_key,
            agentic: expect.objectContaining({
              thinking_level: null,
              thinking_levels: { "synthetic-codex": null },
            }),
          }),
        }),
      ),
    );
  });

  it("exposes vertical mobile tabs navigable by keyboard without saving or switching the configured default", async () => {
    const media = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query.includes("599.95"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    try {
      const user = userEvent.setup();
      renderWithClient(<ProviderDetail providerId="prov-1" onBack={vi.fn()} />);
      const web = await screen.findByRole("tab", {
        name: /Agentic/,
      });
      await waitFor(() => expect(web).toBeEnabled());
      expect(screen.getByRole("tablist")).toHaveAttribute(
        "aria-orientation",
        "vertical",
      );
      await user.click(web);
      await user.keyboard("{ArrowDown}{Enter}");
      await waitFor(() =>
        expect(
          screen.getByRole("tab", { name: /Agentic/ }),
        ).toHaveAttribute("aria-selected", "true"),
      );
      expect(aiServices.getSelectableModels).toHaveBeenLastCalledWith({
        provider_id: "prov-1",
        mode: "agentic",
      });
      expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
    } finally {
      media.mockRestore();
    }
  });
  it("presents an unverified connection neutrally rather than labeling it unconfigured", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({
      ...mockHealthData,
      providers: [{ ...mockHealthData.providers[0], status: "unverified" }],
    });
    renderWithClient(<ProviderDetail providerId="prov-1" onBack={vi.fn()} />);
    expect(await screen.findByText("Sin verificar")).toBeInTheDocument();
    expect(screen.queryByText("Sin Configurar")).not.toBeInTheDocument();
  });
});
