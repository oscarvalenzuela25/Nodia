import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import type { GeminiDualEngineStatus } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import i18n from "../../../../../translate";
import AiProviders from "../../../../../modules/generalSettings/pages/AiProviders/AiProviders";
import * as aiServices from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import { sileo } from "sileo";

vi.mock(
  "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    getAiProviderCatalog: vi.fn(),
    getGeminiEngines: vi.fn(),
    getCurrentGeminiAgenticLogin: vi.fn(), startGeminiAgenticLogin: vi.fn(),
    getGeminiAgenticLoginStatus: vi.fn(), submitGeminiAgenticCode: vi.fn(), cancelGeminiAgenticLogin: vi.fn(),
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

const renderWithClient = (ui: ReactElement, entry = "/settings/ai-providers") => {
  const queryClient = createTestQueryClient();
  return { queryClient, ...render(
    <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter></QueryClientProvider>
  ) };
};

const mockProviders = [
  { id: "1", key: "gemini", is_active: true, created_at: "2026-09-20", updated_at: "2026-09-20" },
  { id: "2", key: "mistral", is_active: true, created_at: "2026-09-20", updated_at: "2026-09-20" },
];

const mockHealthData = {
  engines: { active_engine: 'web', web: { engine: 'web', available: true, authenticated: true },
    agentic: { engine: 'agentic', available: true, authenticated: true } } as GeminiDualEngineStatus,
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
  it.each(["overview", "detail"])("shows visible loading while health is pending in %s, without empty or operational states", async (view) => {
    let resolveHealth!: (value: typeof mockHealthData) => void;
    vi.mocked(aiServices.getAiProvidersHealth).mockReturnValue(new Promise((resolve) => { resolveHealth = resolve; }));
    renderWithClient(<AiProviders />, view === "overview" ? "/settings/ai-providers" : "/settings/ai-providers?provider=1&mode=token_plan_agentic");
    await waitFor(() => expect(aiServices.getAiProviders).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("ai_providers:loading.title"));
    expect(document.querySelectorAll("[data-boneyard-bone]").length).toBeGreaterThan(0);
    expect(screen.queryByText(i18n.t("ai_providers:connection.empty"))).not.toBeInTheDocument();
    expect(screen.queryByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Añadir Proveedor/ })).toBeDisabled();
    expect(within(screen.getByTestId("provider-view-select")).getByRole("button")).toHaveAttribute("aria-disabled", "true");
    resolveHealth(mockHealthData);
    await waitFor(() => expect(screen.queryByText(i18n.t("ai_providers:loading.title"))).not.toBeInTheDocument());
    if (view === "overview") expect(screen.getByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeVisible();
    else expect(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/ })).toHaveAttribute("aria-selected", "true");
  });
  it("keeps loading visible when health arrives before the connections", async () => {
    let resolveProviders!: (value: Awaited<ReturnType<typeof aiServices.getAiProviders>>) => void;
    vi.mocked(aiServices.getAiProviders).mockReturnValue(new Promise((resolve) => { resolveProviders = resolve; }));
    renderWithClient(<AiProviders />);
    await waitFor(() => expect(aiServices.getAiProvidersHealth).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("ai_providers:loading.title"));
    resolveProviders({ data: mockProviders, meta: { total_items: 2, total_pages: 1, page: 1, limit: 100 } });
    expect(await screen.findByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeVisible();
  });
  it("keeps cached content during a refetch and a refetch failure, with a retry instead of initial loading", async () => {
    const user = userEvent.setup();
    renderWithClient(<AiProviders />);
    await screen.findByText("INCIDENTE ACTIVO: GOOGLE GEMINI");
    let rejectHealth!: (error: unknown) => void;
    vi.mocked(aiServices.getAiProvidersHealth).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectHealth = reject; }));
    const verify = screen.getByRole("button", { name: /Verificar todos/ });
    await waitFor(() => expect(verify).toBeEnabled());
    await user.click(verify);
    expect(screen.getByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeVisible();
    expect(screen.getByRole("progressbar")).toBeVisible();
    expect(screen.queryByText(i18n.t("ai_providers:loading.title"))).not.toBeInTheDocument();
    rejectHealth(new Error("Synthetic health failure"));
    const retry = await screen.findByRole("button", { name: i18n.t("core:retry") });
    expect(screen.getByText("INCIDENTE ACTIVO: GOOGLE GEMINI")).toBeVisible();
    expect(screen.queryByText(i18n.t("ai_providers:loading.title"))).not.toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalled();
    await user.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: i18n.t("core:retry") })).not.toBeInTheDocument());
  });
  it("shows an error and retry after initial health failure, without claiming there are no connections", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockRejectedValue(new Error("Synthetic unavailable service"));
    renderWithClient(<AiProviders />);
    expect(await screen.findByRole("button", { name: i18n.t("core:retry") })).toBeVisible();
    await waitFor(() => expect(screen.queryByText(i18n.t("ai_providers:loading.title"))).not.toBeInTheDocument());
    expect(screen.queryByText(i18n.t("ai_providers:connection.empty"))).not.toBeInTheDocument();
  });
  it("opens the exact provider and mode from a topbar link and returns to the overview", async () => {
    vi.mocked(aiServices.getSelectableModels).mockResolvedValue([]);
    renderWithClient(<AiProviders />, "/settings/ai-providers?provider=1&mode=token_plan_agentic");
    expect(await screen.findByRole("tab", { name: /Token Plan \(Agentic\)/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(aiServices.getSelectableModels).toHaveBeenCalledWith({ provider_id: "1", mode: "token_plan_agentic" }));
    await userEvent.click(screen.getByRole("button", { name: /Volver/ }));
    expect(await screen.findByRole("button", { name: /General \(Todos los proveedores\)/ })).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(aiServices.getAiProviders).mockResolvedValue({ data: mockProviders, meta: { total_items: 2, total_pages: 1, page: 1, limit: 100 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue(mockHealthData);
    vi.mocked(aiServices.getAiProviderCatalog).mockResolvedValue([]);
    vi.mocked(aiServices.getSupportedAiProviders).mockResolvedValue([]);
    vi.mocked(aiServices.getEnabledWebAiProviders).mockResolvedValue({ enabled_providers: ["gemini"] });
    vi.mocked(aiServices.getAiProviderEvents).mockResolvedValue({ data: mockEvents, meta: { total_items: 2, total_pages: 1, page: 1, limit: 10 } });
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({ ...mockHealthData, engines: { active_engine: "web", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: true, authenticated: true } } });
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue(mockProviders[0]);
    vi.mocked(aiServices.getCurrentGeminiAgenticLogin).mockResolvedValue(null);
  });
  it("renders page header, view selector and subscription connection action", async () => {
    renderWithClient(<AiProviders />);
    expect(await screen.findByRole("button", { name: /Añadir Proveedor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /General \(Todos los proveedores\)/i })).toBeInTheDocument();
    expect(aiServices.getAiProvidersHealth).toHaveBeenCalledOnce();
    expect(aiServices.getGeminiEngines).not.toHaveBeenCalled();
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
  it("opens Agentic authentication from a session alert without editing the provider or starting OAuth automatically", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({ ...mockHealthData, alerts: [{
      id: 'agentic-session', provider: 'gemini', providerName: 'Mi Gemini', reason: 'agentic_session_required',
      type: 'warning', severity: 'warning', title: 'synthetic', message: 'synthetic',
      actionType: 'authenticate_agentic', actionLabel: 'synthetic',
    }] });
    const user = userEvent.setup(); renderWithClient(<AiProviders />);
    await user.click(await screen.findByRole('button', { name: 'Autenticar sesión Agentic' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión Gemini Agentic' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Configurar conexión de IA' })).not.toBeInTheDocument();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
    expect(aiServices.startGeminiAgenticLogin).not.toHaveBeenCalled();
  });
  it("rechecks an unavailable adapter from the alert without opening provider configuration", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValue({ ...mockHealthData, alerts: [{
      id: 'agentic-down', provider: 'gemini', type: 'incident', severity: 'error',
      title: 'Synthetic adapter unavailable', message: 'Synthetic outage', actionType: 'check_status', actionLabel: 'synthetic',
    }] });
    const user = userEvent.setup(); renderWithClient(<AiProviders />);
    const button = await screen.findByRole('button', { name: 'Volver a comprobar' });
    await waitFor(() => expect(button).toBeEnabled());
    const previous = vi.mocked(aiServices.getAiProvidersHealth).mock.calls.length;
    await user.click(button);
    await waitFor(() => expect(vi.mocked(aiServices.getAiProvidersHealth).mock.calls.length).toBeGreaterThan(previous));
    expect(screen.queryByRole('heading', { name: 'Configurar conexión de IA' })).not.toBeInTheDocument();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
  });
  it("reports a failed recheck without announcing successful verification", async () => {
    vi.mocked(aiServices.getAiProvidersHealth).mockResolvedValueOnce({ ...mockHealthData, alerts: [{
      id: 'agentic-down', provider: 'gemini', type: 'incident', severity: 'error',
      title: 'Synthetic adapter unavailable', message: 'Synthetic outage', actionType: 'check_status', actionLabel: 'synthetic',
    }] }).mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Servicio temporalmente no disponible' } } });
    const user = userEvent.setup(); renderWithClient(<AiProviders />);
    const button = await screen.findByRole('button', { name: 'Volver a comprobar' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Servicio temporalmente no disponible' })));
    expect(sileo.success).not.toHaveBeenCalled();
    expect(aiServices.updateAiProvider).not.toHaveBeenCalled();
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
