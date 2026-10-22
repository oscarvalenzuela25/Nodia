import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import AiProviderIndicators from "../../../../../../layouts/components/Topbar/components/AiProviderIndicators";
import { useAiProvidersHealth } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices";
import { getAiProvidersHealth } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import type { AiProvidersHealthResponse } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import i18n from "../../../../../../translate";

vi.mock("../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services");
vi.mock("sileo", () => ({ sileo: { error: vi.fn() } }));

// Synthetic health observations, no credentials or real providers are contacted.
const fixture = (): AiProvidersHealthResponse => ({
  timestamp: "2026-10-08T12:00:00Z", overallStatus: "healthy", alerts: [],
  engines: { active_engine: "web", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: false, authenticated: false } },
  providers: [{ id: "900", key: "gemini", name: "Synthetic connection", is_default: true, isActive: true,
    use_api_key: true, use_token_plan_web: true, use_token_plan_agentic: true, mode: "api_key", status: "unverified",
    statusBadge: "", serviceState: "", lastCheck: null, latencyMs: null, hasConnection: true }],
  summary: { totalProviders: 1, activeProviders: 1, healthyProviders: 0, incidentsCount: 0 },
});
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
function SharedObserver() { useAiProvidersHealth(); return null; }
function setup(shared = false) {
  const client = new QueryClient({ queryCache: new QueryCache({ onError: notifyHttpError }), defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><AiProviderIndicators />{shared && <SharedObserver />}<Location /></MemoryRouter></QueryClientProvider>);
  return client;
}
const button = (mode: string) => screen.getByRole("button", { name: new RegExp(`· ${mode}:`) });
const expectColor = (mode: string, color: string) => expect(button(mode).querySelector(".MuiBadge-badge")).toHaveClass(`MuiBadge-color${color}`);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getAiProvidersHealth).mockResolvedValue(fixture()); });

describe("AiProviderIndicators", () => {
  it("shares the two-minute automatic check while allowing an immediate manual refresh", async () => {
    vi.useFakeTimers();
    const client = setup(true);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(getAiProvidersHealth).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(119_000); });
      expect(getAiProvidersHealth).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
      expect(getAiProvidersHealth).toHaveBeenCalledTimes(2);
      await act(async () => { await client.invalidateQueries({ queryKey: ["ai-providers-health"] }); });
      expect(getAiProvidersHealth).toHaveBeenCalledTimes(3);
    } finally {
      client.clear();
      vi.useRealTimers();
    }
  });
  it("omits API when disabled and keeps the enabled subscription modes", async () => {
    const data = fixture(); data.providers[0].use_api_key = false;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    setup(); await screen.findByRole("group");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", {name:/· API:/})).not.toBeInTheDocument();
    expect(button("Web")).toBeEnabled(); expect(button("Agéntico")).toBeEnabled();
  });
  it("omits the group without a default, including an empty response", async () => {
    const data = fixture(); data.providers[0].is_default = false;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    const client = setup();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
  it("uses independent observations for all three modes and shares the health request", async () => {
    setup(true); await screen.findByRole("group");
    expectColor("API", "Error"); expectColor("Web", "Success"); expectColor("Agéntico", "Error");
    expect(button("API")).toHaveAccessibleName(/Necesita revisión/);
    expect(getAiProvidersHealth).toHaveBeenCalledOnce();
  });
  it.each(["API", "Web", "Agéntico"])("navigates %s to the exact connection and mode", async (label) => {
    const modes: Record<string, string> = { "API": "api_key", "Web": "token_plan_web", "Agéntico": "token_plan_agentic" };
    setup(); await screen.findByRole("group");
    await userEvent.click(button(label));
    expect(screen.getByRole("status")).toHaveTextContent(`/settings/ai-providers?provider=900&mode=${modes[label]}`);
  });
  it.each(["api_key", "token_plan_web", "token_plan_agentic"] as const)("shows stored API keys green independently of the %s default and model", async (mode) => {
    const data = fixture();
    data.providers[0] = { ...data.providers[0], mode: mode === "token_plan_web" ? "web_session" : mode, default_mode: mode, apiKeysCount: 1, validKeysCount: 0, selectedApiKey: null, selectedModel: undefined, status: "degraded" };
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    const client = setup();
    await screen.findByRole("group");
    expectColor("API", "Success");
    expect(button("API")).toHaveAccessibleName(/API key configurada/);
    expect(button("API")).not.toHaveAccessibleName(/saludable/);
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...data.providers[0], apiKeysCount: 0 }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expectColor("API", "Error"));
  });
  it("uses Codex session of this instance, keeps zero/denied usage and ignores Gemini sessions", async () => {
    const data = fixture(); const provider = data.providers[0]; provider.key = "openai"; provider.use_token_plan_web = false;
    provider.codexSession = { available: true, authenticated: true, usageAllowed: false, planType: null, reason: null, checkedAt: null, lastInferenceAt: null, quotas: null };
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup();
    await screen.findByRole("group"); expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", {name:/· Web:/})).not.toBeInTheDocument();
    expectColor("Agéntico", "Error");
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...provider, codexSession: { ...provider.codexSession, usageAllowed: true } }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expectColor("Agéntico", "Success"));
  });
  it("treats missing/malformed observations as unverified and disabled providers as needing review", async () => {
    const data = fixture(); data.engines = null;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup();
    await screen.findByRole("group"); expectColor("Web", "Error"); expect(button("Web")).toHaveAccessibleName(/Sin verificar/);
    const malformed = { ...fixture(), engines: { web: { authenticated: "true", available: true } } } as unknown as AiProvidersHealthResponse;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(malformed);
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    expectColor("Web", "Error");
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...fixture(), providers: [{ ...data.providers[0], isActive: false }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expect(button("Web")).toHaveAccessibleName(/Necesita revisión/));
  });
  it("preserves indicators during refetch, disables actions, then marks stale health unverified with one toast", async () => {
    const data = fixture(); data.providers[0].apiKeysCount = 1;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    const client = setup(); await screen.findByRole("group");
    let reject!: (reason: Error) => void;
    vi.mocked(getAiProvidersHealth).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    let refresh!: Promise<void>;
    act(() => { refresh = client.invalidateQueries({ queryKey: ["ai-providers-health"] }); });
    await waitFor(() => expect(button("Web")).toBeDisabled());
    expectColor("Web", "Success");
    await act(async () => { reject(new Error("offline")); await refresh; });
    await waitFor(() => expectColor("Web", "Error")); expect(button("Web")).toBeEnabled();
    expect(button("Web")).toHaveAccessibleName(/Sin verificar/); expect(sileo.error).toHaveBeenCalledOnce();
    expectColor("API", "Success");
    expect(button("API")).toHaveAccessibleName(/API key configurada/);
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expectColor("Web", "Success"));
  });
  it("honors historical modes and explicit disabled flags, and changes the default without crossing identities", async () => {
    const data = fixture(); data.providers[0] = { ...data.providers[0], use_api_key: false, use_token_plan_web: undefined, use_token_plan_agentic: false, mode: "web_session" };
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup();
    await screen.findByRole("group"); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(button("Web")).toBeEnabled();
    expect(screen.queryByRole("button", {name:/· API:|· Agéntico:/})).not.toBeInTheDocument();
    const other = { ...fixture().providers[0], id: "901", key: "openai", use_token_plan_web: false, use_token_plan_agentic: false };
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...data.providers[0], is_default: false }, other] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expect(screen.queryByRole("button", {name:/· Web:/})).not.toBeInTheDocument());
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(button("API")); expect(screen.getByRole("status")).toHaveTextContent("provider=901&mode=api_key");
  });
  it("updates visible modes from connection flags even when the enabled API has no key", async () => {
    const data = fixture();
    data.providers[0] = {...data.providers[0],use_api_key:true,use_token_plan_web:false,use_token_plan_agentic:false,apiKeysCount:0};
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    const client = setup(); await screen.findByRole("group");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expectColor("API","Error");
    vi.mocked(getAiProvidersHealth).mockResolvedValue({...data,providers:[{...data.providers[0],use_api_key:false,use_token_plan_agentic:true}]});
    await act(() => client.invalidateQueries({queryKey:["ai-providers-health"]}));
    await waitFor(() => expect(screen.queryByRole("button",{name:/· API:/})).not.toBeInTheDocument());
    expect(button("Agéntico")).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    vi.mocked(getAiProvidersHealth).mockResolvedValue({...data,providers:[{...data.providers[0],use_api_key:false}]});
    await act(() => client.invalidateQueries({queryKey:["ai-providers-health"]}));
    await waitFor(() => expect(screen.queryByRole("group")).not.toBeInTheDocument());
  });
  it("translates the mode status and accessible action into English", async () => {
    const data = fixture(); data.providers[0].apiKeysCount = 1;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    await i18n.changeLanguage("en"); setup(); await screen.findByRole("group");
    expect(button("API")).toHaveAccessibleName(/API key configured. Open settings/);
    await i18n.changeLanguage("es");
  });
});
