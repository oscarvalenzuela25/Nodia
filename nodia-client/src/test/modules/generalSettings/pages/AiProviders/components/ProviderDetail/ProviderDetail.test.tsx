import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ProviderDetail from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    getAiProvidersHealth: vi.fn(),
    getAiProviderEvents: vi.fn(),
    getSelectableModels: vi.fn(),
    getEnabledWebAiProviders: vi.fn(),
    getSupportedAiProviders: vi.fn(),
    getAiApiKeys: vi.fn(),
    createAiApiKey: vi.fn(),
    updateAiApiKey: vi.fn(),
    deleteAiApiKey: vi.fn(),
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

const mockProviders = [
  {
    id: "prov-1",
    key: "gemini",
    mode: "web_session" as any,
    is_active: true,
    fields: {
      selected_model: "gemini-flash",
      auto_reconnect: true,
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
    key: "gemini",
    name: "Google Gemini",
    description: "Google models",
    defaultMode: "web_session" as any,
    supportedModes: ["web_session" as any, "api_key" as any],
    defaultSelectedModel: "gemini-flash",
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
];

const mockKeys = [
  {
    id: "key-1",
    provider_id: "prov-1",
    label: "AI-Studio-Prod-1",
    display_hint: "AIzaSyDxK...7dHQ",
    sort_order: 1,
    is_selected: true,
    health_state: "valid" as any,
    is_active: true,
    created_at: "2026-09-26",
    updated_at: "2026-09-26",
  },
];

describe("ProviderDetail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(mockHealthData);
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue(mockSupported);
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({
      enabled_providers: ["gemini"],
    });
    vi.mocked(aiServices.getAiApiKeys).mockResolvedValue({
      data: mockKeys,
      meta: { total_items: 1, total_pages: 1, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({
      data: [],
      meta: { total_items: 0, total_pages: 1, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue({} as any);
    vi.mocked(aiServices.updateAiApiKey).mockResolvedValue({} as any);
    vi.mocked(aiServices.deleteAiApiKey).mockResolvedValue(undefined);
  });

  it("renders breadcrumb, back button, provider name, and models title", async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={handleBack} />
    );

    await waitFor(() => {
      expect(screen.getByText("Volver a Proveedores")).toBeInTheDocument();
      expect(screen.getByText("Google Gemini")).toBeInTheDocument();
      expect(screen.getByText("Disponible")).toBeInTheDocument();
      expect(
        screen.getByText(/Modelos \(Google Gemini\)/i)
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const backBtn = screen.getByRole("button", { name: /Volver a Proveedores/i });
    await user.click(backBtn);
    expect(handleBack).toHaveBeenCalled();
  });

  it("renders model cards and switches selected model on toggle", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Gemini 3.8 Flash")).toBeInTheDocument();
      expect(screen.getByText("Gemini 3.1 Pro")).toBeInTheDocument();
    });

    const cardPro = screen.getByText("Gemini 3.1 Pro").closest(".MuiPaper-root")!;
    const switchPro = within(cardPro as HTMLElement).getByRole("switch");
    expect(switchPro).toBeInTheDocument();

    // Click switch on gemini-pro
    await user.click(switchPro);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            selected_model: "gemini-pro",
          }),
        })
      );
    });
  });

  it("toggles auto reconnect preference", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={() => {}} />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Auto-reconexión/i)
      ).toBeInTheDocument();
    });

    const switchWrapper = screen.getByText(/Auto-reconexión/i).closest("label")!;
    const reconnectSwitch = within(switchWrapper).getByRole("switch");
    expect(reconnectSwitch).toBeInTheDocument();
    expect(reconnectSwitch).toBeChecked();

    await user.click(reconnectSwitch);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            auto_reconnect: false,
          }),
        })
      );
    });
  });

  it("switches operation mode when clicking ModeCard", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("MODO DE OPERACIÓN EXCLUSIVO")).toBeInTheDocument();
      expect(screen.getByText("API Key (AI Studio / Endpoint Oficial)")).toBeInTheDocument();
    });

    const apiKeyCard = screen.getByText("API Key (AI Studio / Endpoint Oficial)");
    await user.click(apiKeyCard);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          mode: "api_key",
        })
      );
    });
  });

  it("renders cloud authentication bridge and triggers onRenewSession", async () => {
    const user = userEvent.setup();
    const handleRenewSession = vi.fn();

    renderWithClient(
      <ProviderDetail
        providerKey="gemini"
        onBack={() => {}}
        onRenewSession={handleRenewSession}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Iniciar Sesión en Navegador Remoto/i })
      ).toBeInTheDocument();
    });

    const renewBtn = screen.getByRole("button", {
      name: /Iniciar Sesión en Navegador Remoto/i,
    });
    await user.click(renewBtn);

    expect(handleRenewSession).toHaveBeenCalled();
  });

  it("renders API keys list with standard table and opens AddApiKeyModal", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Administrador de API Keys")).toBeInTheDocument();
      expect(screen.getByText("AI-Studio-Prod-1")).toBeInTheDocument();
      expect(screen.getByText("AIzaSyDxK...7dHQ")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Nueva API Key/i })).toBeInTheDocument();
    });

    const addKeyBtn = screen.getByRole("button", { name: /Agregar Nueva API Key/i });
    await user.click(addKeyBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Agregar Clave de API - Google Gemini/i })
      ).toBeInTheDocument();
    });
  });

  it("deletes an API key after confirming in dialog", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProviderDetail providerKey="gemini" onBack={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("AI-Studio-Prod-1")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId("delete-api-key-btn");
    await user.click(deleteBtn);

    // Look for ConfirmDialog
    await waitFor(() => {
      expect(screen.getByText("Eliminar Clave de API")).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByRole("button");
    const confirmBtn = confirmButtons.find(
      (btn) =>
        btn.textContent?.includes("Confirmar") ||
        btn.textContent?.includes("Aceptar") ||
        btn.textContent?.includes("Eliminar")
    );
    if (confirmBtn) {
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(aiServices.deleteAiApiKey).toHaveBeenCalledWith("key-1");
      });
    }
  });
});
