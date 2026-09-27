import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import AiProviders from "../../../../../modules/generalSettings/pages/AiProviders/AiProviders";
import * as aiServices from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock(
  "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    getAiProvidersHealth: vi.fn(),
    getAiProviderEvents: vi.fn(),
    getSelectableModels: vi.fn(),
    getEnabledWebAiProviders: vi.fn(),
    getSupportedAiProviders: vi.fn(),
    createAiApiKey: vi.fn(),
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
  { id: "1", key: "gemini", is_active: true, created_at: "2026-09-20", updated_at: "2026-09-20" },
  { id: "2", key: "mistral", is_active: true, created_at: "2026-09-20", updated_at: "2026-09-20" },
];

const mockHealthData = {
  timestamp: "2026-09-26T12:00:00Z",
  overallStatus: "incident" as const,
  alerts: [
    {
      id: "alert-1",
      provider: "gemini",
      type: "incident" as const,
      severity: "warning" as const,
      title: "INCIDENTE ACTIVO: GOOGLE GEMINI",
      message: "Sesión web remota caducada (401 Unauthorized).",
      timeAgo: "42 min atrás",
      actionType: "renew_session" as const,
      actionLabel: "Renovar Sesión Ahora",
    },
    {
      id: "alert-2",
      provider: "mistral",
      type: "failover" as const,
      severity: "info" as const,
      title: "FAILOVER OPERATIVO: MISTRAL AI",
      message: "Key de contingencia activada automáticamente.",
      actionType: "manage_quotas" as const,
      actionLabel: "Gestionar Cuotas",
    },
  ],
  providers: [
    {
      id: "1",
      key: "gemini",
      name: "Google Gemini",
      isActive: true,
      mode: "web_session" as const,
      status: "expired" as const,
      statusBadge: "REQUIERE INICIAR SESIÓN",
      serviceState: "Caducado (401)",
      lastCheck: "Hoy, 10:24 AM",
      latencyMs: 420,
      containerStatus: "Cluster-04:IDLE",
      autoFailover: "INACTIVO PARA MODO WEB",
      remoteBrowserProfile: {
        location: "/var/vault/gemini-session-v2.enc",
        engine: "Puppeteer Node",
      },
      hasConnection: true,
    },
    {
      id: "2",
      key: "mistral",
      name: "Mistral AI",
      isActive: true,
      mode: "api_key" as const,
      status: "healthy" as const,
      statusBadge: "DISPONIBLE",
      serviceState: "2/3 Keys Válidas",
      lastCheck: "Hace 4 min",
      latencyMs: 185,
      monthlyQuotaUsed: "68.4% consumida",
      failoverSwitch: "Activo (Failover a mistral-prod-sec)",
      assignedModels: {
        ocr: "mistral-ocr-v1",
        infer: "mistral-large-2411",
      },
      apiKeysCount: 3,
      hasConnection: true,
    },
  ],
  summary: {
    totalProviders: 2,
    activeProviders: 2,
    healthyProviders: 1,
    incidentsCount: 2,
  },
};

const mockEvents = [
  {
    id: "evt-1",
    provider_id: "1",
    event_type: "session_expired",
    reason_code: "401 Invalidated",
    message: "Cookie SID_AUTH reportada inválida por Google Cloud Endpoint",
    created_at: "2026-09-26T10:24:00Z",
    provider: { id: "1", key: "gemini", is_active: true, created_at: "", updated_at: "" },
    actor_user: null,
  },
  {
    id: "evt-2",
    provider_id: "2",
    event_type: "key_rotation",
    reason_code: "Failover OK (429)",
    message: "Rotación automática de API Key por cuota excedida",
    created_at: "2026-09-26T09:15:00Z",
    provider: { id: "2", key: "mistral", is_active: true, created_at: "", updated_at: "" },
    actor_user: null,
  },
];

describe("AiProviders Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 2, total_pages: 1, page: 1, limit: 100 },
    });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(mockHealthData);
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({
      data: mockEvents,
      meta: { total_items: 2, total_pages: 1, page: 1, limit: 10 },
    });
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({
      enabled_providers: ["gemini"],
    });
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue([
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
            description: "Google Flagship",
            capabilities: ["text", "vision"],
            isRecommended: true,
          },
        ],
      },
      {
        key: "mistral",
        name: "Mistral AI",
        description: "Mistral models",
        defaultMode: "api_key" as any,
        supportedModes: ["api_key" as any],
        defaultSelectedModel: "mistral-large-latest",
        availableModels: [
          {
            id: "mistral-large-latest",
            name: "Mistral Large",
            description: "Mistral Flagship",
            capabilities: ["text"],
            isRecommended: true,
          },
        ],
      },
    ]);
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue({
      id: "2",
      key: "mistral",
      mode: "api_key" as any,
      is_active: true,
      created_at: "2026-09-20",
      updated_at: "2026-09-26",
    });
    vi.mocked(aiServices.createAiApiKey).mockResolvedValue({
      id: "key-123",
      provider_id: "2",
      label: "Primary Key",
      display_hint: "...4567",
      sort_order: 1,
      is_selected: true,
      health_state: "valid" as any,
      is_active: true,
      created_at: "2026-09-26",
      updated_at: "2026-09-26",
    });
  });

  it("renders page header with title, subtitle, buttons, and view selector", async () => {
    renderWithClient(<AiProviders />);

    expect(screen.getByText("Proveedores de IA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Añadir Proveedor/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Verificar todos/i })).toBeInTheDocument();
      expect(screen.getByText(/General \(Todos los proveedores\)/i)).toBeInTheDocument();
    });
  });

  it("renders alert banners when incidents or failovers exist", async () => {
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(screen.getByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeInTheDocument();
      expect(screen.getByText("FAILOVER OPERATIVO: MISTRAL AI")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Renovar Sesión Ahora/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Gestionar Cuotas/i })).toBeInTheDocument();
    });
  });

  it("renders provider cards with their specific metrics and action buttons", async () => {
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      // Gemini Card
      expect(screen.getAllByText("Google Gemini").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("REQUIERE INICIAR SESIÓN")).toBeInTheDocument();
      expect(screen.getByText("Caducado (401)")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Renovar Sesión \(Navegador Remoto\)/i })).toBeInTheDocument();

      // Mistral Card
      expect(screen.getAllByText("Mistral AI").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("DISPONIBLE")).toBeInTheDocument();
      expect(screen.getByText("2/3 Keys Válidas")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Administrar API Keys \(3\)/i })).toBeInTheDocument();
    });
  });

  it("renders the audit log table with events, impact badges, and ver traza button", async () => {
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(
        screen.getByText("Historial de Incidentes, Rotaciones y Auditoría")
      ).toBeInTheDocument();
      expect(screen.getByText(/Cookie SID_AUTH reportada inválida/i)).toBeInTheDocument();
      expect(screen.getByText(/Rotación automática de API Key/i)).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Ver Traza/i })).toHaveLength(2);
    });
  });

  it("opens TraceModal when clicking Ver Traza", async () => {
    const user = userEvent.setup();
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Ver Traza/i })).toHaveLength(2);
    });

    const firstTraceBtn = screen.getAllByRole("button", { name: /Ver Traza/i })[0];
    await user.click(firstTraceBtn);

    await waitFor(() => {
      expect(screen.getByText("Detalle de Traza de Auditoría")).toBeInTheDocument();
      expect(screen.getByText("session_expired")).toBeInTheDocument();
    });
  });

  it("opens AddProviderModal when clicking Añadir Proveedor and submits a new provider", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.createAiProvider).mockResolvedValue({
      id: "3",
      key: "openai",
      is_active: true,
      created_at: "2026-09-26",
      updated_at: "2026-09-26",
    });

    renderWithClient(<AiProviders />);

    const addBtn = screen.getByRole("button", { name: /Añadir Proveedor/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Añadir Proveedor de IA" })).toBeInTheDocument();
    });

    const keyInput = screen.getByPlaceholderText(/gemini, mistral, openai, anthropic/i);
    await user.type(keyInput, "openai");

    const submitBtn = screen.getByRole("button", { name: "Crear Proveedor" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.createAiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "openai",
          mode: "api_key",
          auto_rotate_api_keys: true,
          is_active: true,
          translates: [
            {
              key: "key",
              es: "openai",
              en: "openai",
            },
          ],
        })
      );
    });
  });

  it("submits a new provider with custom translations in AddProviderModal", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.createAiProvider).mockResolvedValue({
      id: "4",
      key: "anthropic",
      is_active: true,
      created_at: "2026-09-26",
      updated_at: "2026-09-26",
    });

    renderWithClient(<AiProviders />);

    const addBtn = screen.getByRole("button", { name: /Añadir Proveedor/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Añadir Proveedor de IA" })).toBeInTheDocument();
    });

    const keyInput = screen.getByPlaceholderText(/gemini, mistral, openai, anthropic/i);
    await user.type(keyInput, "anthropic");

    // Translations are expanded once key is typed
    const esInput = await screen.findByRole("textbox", { name: /Español/i });
    const enInput = await screen.findByRole("textbox", { name: /English/i });

    await user.type(esInput, "Antrópico");
    await user.type(enInput, "Anthropic AI");

    const submitBtn = screen.getByRole("button", { name: "Crear Proveedor" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.createAiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "anthropic",
          mode: "api_key",
          auto_rotate_api_keys: true,
          is_active: true,
          translates: [
            {
              key: "key",
              es: "Antrópico",
              en: "Anthropic AI",
            },
          ],
        })
      );
    });
  });

  it("changes view to specific provider when clicking Ir al detalle on a provider card", async () => {
    const user = userEvent.setup();
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Ir al detalle/i }).length).toBeGreaterThanOrEqual(1);
    });

    const detailButtons = screen.getAllByRole("button", { name: /Ir al detalle/i });
    await user.click(detailButtons[0]);

    // Selector should now reflect specific provider
    await waitFor(() => {
      expect(screen.getByText(/Google Gemini \(gemini\)/i)).toBeInTheDocument();
    });
  });

  it("opens ConfigureProviderModal when clicking Configurar and saves connection and api key", async () => {
    const user = userEvent.setup();
    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Configurar/i }).length).toBeGreaterThanOrEqual(1);
    });

    const configButtons = screen.getAllByRole("button", { name: /Configurar/i });
    await user.click(configButtons[1]); // Click config for mistral

    await waitFor(() => {
      expect(screen.getByText("Configurar Conexión de Proveedor")).toBeInTheDocument();
    });

    // Enter API key
    const apiKeyInput = screen.getByPlaceholderText("sk-...");
    await user.type(apiKeyInput, "sk-mistral-secret-key-1234");

    // Click submit
    const saveBtn = screen.getByRole("button", { name: /Guardar Configuración/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "2",
        expect.objectContaining({
          mode: "api_key",
          is_active: true,
        })
      );
      expect(aiServices.createAiApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_id: "2",
          label: "Primary Key",
          secret: "sk-mistral-secret-key-1234",
          is_selected: true,
          is_active: true,
        })
      );
    });
  });

  it("disables web session mode in ConfigureProviderModal for providers not in enabled_web_providers", async () => {
    const user = userEvent.setup();
    // Only gemini is enabled for web
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({
      enabled_providers: ["gemini"],
    });

    renderWithClient(<AiProviders />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Configurar/i }).length).toBeGreaterThanOrEqual(1);
    });

    // Configure Mistral (which is not in enabled_providers)
    const configButtons = screen.getAllByRole("button", { name: /Configurar/i });
    await user.click(configButtons[1]);

    await waitFor(() => {
      expect(screen.getByText("Configurar Conexión de Proveedor")).toBeInTheDocument();
      expect(
        screen.getByText(/No habilitado para este proveedor \(requiere microservicio dedicado\)/i)
      ).toBeInTheDocument();
    });
  });

  it("selects provider from catalog in AddProviderModal and auto-fills key and translations", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.createAiProvider).mockResolvedValue({
      id: "5",
      key: "gemini",
      is_active: true,
      created_at: "2026-09-26",
      updated_at: "2026-09-26",
    });

    renderWithClient(<AiProviders />);

    const addBtn = screen.getByRole("button", { name: /Añadir Proveedor/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Añadir Proveedor de IA" })).toBeInTheDocument();
      expect(screen.getByText("Proveedor del Catálogo")).toBeInTheDocument();
    });

    // Open catalog dropdown
    const selectTrigger = screen.getByText("Seleccionar proveedor soportado...");
    await user.click(selectTrigger);

    // Pick Google Gemini option from listbox
    const geminiOption = await screen.findByRole("option", { name: /Google Gemini/i });
    await user.click(geminiOption);

    // Verify key input now has gemini
    const keyInput = screen.getByPlaceholderText(/gemini, mistral, openai, anthropic/i);
    expect(keyInput).toHaveValue("gemini");

    // Click submit
    const submitBtn = screen.getByRole("button", { name: "Crear Proveedor" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.createAiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "gemini",
          mode: "web_session",
          auto_rotate_api_keys: true,
          is_active: true,
          fields: expect.objectContaining({
            selected_model: "gemini-flash",
            profile: "puppeteer_headless_v2",
          }),
          translates: [
            {
              key: "key",
              es: "Google Gemini",
              en: "Google Gemini",
            },
          ],
        })
      );
    });
  });

  it("creates a provider with an initial API key and model selection in AddProviderModal", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.createAiProvider).mockResolvedValue({
      id: "prov-99",
      key: "mistral",
      mode: "api_key" as any,
      is_active: true,
      created_at: "2026-09-26",
      updated_at: "2026-09-26",
    });

    renderWithClient(<AiProviders />);

    const addBtn = screen.getByRole("button", { name: /Añadir Proveedor/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Añadir Proveedor de IA" })).toBeInTheDocument();
    });

    // Pick Mistral AI from catalog
    const selectTrigger = screen.getByText("Seleccionar proveedor soportado...");
    await user.click(selectTrigger);

    const mistralOption = await screen.findByRole("option", { name: /Mistral AI/i });
    await user.click(mistralOption);

    // Enter initial API key
    const apiKeyInput = screen.getByPlaceholderText("sk-...");
    await user.type(apiKeyInput, "sk-mistral-init-secret");

    // Click submit
    const submitBtn = screen.getByRole("button", { name: "Crear Proveedor" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.createAiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "mistral",
          mode: "api_key",
          auto_rotate_api_keys: true,
          is_active: true,
          fields: expect.objectContaining({
            selected_model: "mistral-large-latest",
          }),
        })
      );
      expect(aiServices.createAiApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_id: "prov-99",
          label: "Primary Key",
          secret: "sk-mistral-init-secret",
          is_selected: true,
          is_active: true,
        })
      );
    });
  });
});



