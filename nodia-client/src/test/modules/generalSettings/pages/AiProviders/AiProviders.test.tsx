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
    getAiProviderCatalog: vi.fn(),
    getGeminiEngines: vi.fn(),
    startGeminiLogin: vi.fn(),
    getGeminiLoginStatus: vi.fn(),
    cancelGeminiLogin: vi.fn(),
    getAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    getAiProvidersHealth: vi.fn(),
    getAiProviderEvents: vi.fn(),
    getSelectableModels: vi.fn(),
    getEnabledWebAiProviders: vi.fn(),
    getSupportedAiProviders: vi.fn(),
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
      use_token_plan_web: true, use_token_plan_agentic: true,
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
    vi.resetAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: mockProviders, meta: { total_items: 2, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(mockHealthData);
    vi.mocked(aiServices.getAiProviderCatalog).mockResolvedValue([]);
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue([]);
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({ enabled_providers: ["gemini"] });
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({ data: mockEvents, meta: { total_items: 2, total_pages: 1, page: 1, limit: 10 } });
    vi.mocked(aiServices.getGeminiEngines).mockResolvedValue({ active_engine: "web", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: true, authenticated: true } });
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue(mockProviders[0]);
  });
  it("renders page header, view selector and subscription connection action", async () => {
    renderWithClient(<AiProviders />);
    expect(await screen.findByRole("button", { name: /Añadir Proveedor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /General \(Todos los proveedores\)/i })).toBeInTheDocument();
  });
  it("shows incidents while omitting removed API key controls and the audit table", async () => {
    renderWithClient(<AiProviders />);
    expect(await screen.findByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Administrar API Keys/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Historial de Incidentes, Rotaciones y Auditoría")).not.toBeInTheDocument();
  });
  it("opens the subscription connection form", async () => {
    const user = userEvent.setup(); renderWithClient(<AiProviders />);
    await user.click(await screen.findByRole("button", { name: /Añadir Proveedor/i }));
    expect(await screen.findByRole("heading", { name: "Añadir conexión de IA" })).toBeInTheDocument();
  });
  it("opens configuration for the selected connection", async () => {
    const user = userEvent.setup(); renderWithClient(<AiProviders />);
    const configure = await screen.findAllByRole("button", { name: /Configurar/i });
    await user.click(configure[0]);
    expect(await screen.findByRole("heading", { name: "Configurar conexión de IA" })).toBeInTheDocument();
  });
  it("uses instance IDs for two connections of the same catalog", async () => {
    const user = userEvent.setup();
    const connections = [
      { ...mockProviders[0], id: "primary", key: "gemini", name: "Primary", use_token_plan_web: true, default_mode: "token_plan_web" as const, fields: { selected_model: "primary-model", available_models: [{ id: "primary-model", name: "Primary model" }] } },
      { ...mockProviders[0], id: "secondary", key: "gemini", name: "Secondary", use_token_plan_web: true, default_mode: "token_plan_web" as const, fields: { selected_model: "secondary-model", available_models: [{ id: "secondary-model", name: "Secondary model" }] } },
    ];
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: connections, meta: { total_items: 2, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({ ...mockHealthData, alerts: [], providers: connections.map((p) => ({ ...mockHealthData.providers[0], id: p.id, name: p.name, key: p.key, status: "healthy" as const })) });
    renderWithClient(<AiProviders />);
    await user.click(await screen.findByRole("button", { name: /General \(Todos los proveedores\)/i }));
    await user.click(screen.getByText(/Secondary \(gemini\)/i));
    expect(await screen.findByText("Secondary model")).toBeInTheDocument();
    expect(screen.queryByText("Primary model")).not.toBeInTheDocument();
  });
  it("offers local login through Server and refreshes data after success", async () => {
    const user = userEvent.setup();
    const job = { id: "b".repeat(32), state: "running" as const };
    vi.mocked(aiServices.startGeminiLogin).mockResolvedValue(job);
    vi.mocked(aiServices.getGeminiLoginStatus).mockResolvedValue({ ...job, state: "succeeded" });
    renderWithClient(<AiProviders />);
    await user.click(await screen.findByRole("button", { name: /Renovar Sesión \(Navegador Remoto\)/i }));
    await user.click(await screen.findByRole("button", { name: /Iniciar navegador local/i }));
    await waitFor(() => expect(vi.mocked(aiServices.getAiProvidersHealth).mock.calls.length).toBeGreaterThan(1));
  });
});
