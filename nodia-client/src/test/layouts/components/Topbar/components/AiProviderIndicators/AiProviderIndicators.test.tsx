import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import useAuthStore from "../../../../../../store/authStore";

vi.mock("../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services");
vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));

// Synthetic observations; these never contact an account or an inference endpoint.
const fixture = (): AiProvidersHealthResponse => ({
  timestamp: "2026-10-27T12:00:00Z", overallStatus: "healthy", alerts: [],
  engines: { active_engine: "agentic", agentic: { engine: "agentic", available: true, authenticated: true } },
  providers: [{ id: "900", key: "gemini", name: "Synthetic connection", is_default: true, isActive: true,
    use_api_key: true, use_agentic: true, mode: "api_key", status: "unverified",
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
const button = (mode: string) => screen.getByRole("button", { name: new RegExp(`${mode}:`) });
const expectColor = (mode: string, color: string) => expect(button(mode).querySelector(".MuiBadge-badge")).toHaveClass(`MuiBadge-color${color}`);
beforeEach(async () => {
  vi.resetAllMocks();
  useAuthStore.setState({ token: "synthetic-test-token", user: { id: "42", name: "Fixture" },
    expiresAt: Date.now() + 3_600_000, sessionStatus: "authenticated", isRefreshing: false });
  await i18n.changeLanguage("es");
  vi.mocked(getAiProvidersHealth).mockResolvedValue(fixture());
});

describe("AiProviderIndicators with two modes", () => {
  it("shares the two-minute check and permits an immediate manual refresh", async () => {
    vi.useFakeTimers(); const client = setup(true);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(getAiProvidersHealth).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(119_000); });
      expect(getAiProvidersHealth).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
      expect(getAiProvidersHealth).toHaveBeenCalledTimes(2);
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Actualizar estado de IA" })); });
      expect(getAiProvidersHealth).toHaveBeenCalledTimes(3);
      expect(sileo.success).toHaveBeenCalledOnce();
    } finally { client.clear(); vi.useRealTimers(); }
  });
  it("offers only API key and Agentic with their independent observations", async () => {
    setup(true); await screen.findByRole("group");
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expectColor("API key", "Error"); expectColor("Agentic", "Success");
    expect(screen.queryByRole("button", { name: /Web/ })).not.toBeInTheDocument();
    expect(getAiProvidersHealth).toHaveBeenCalledOnce();
  });
  it.each([["API key", "api_key"], ["Agentic", "agentic"]])("navigates %s to the exact connection and mode", async (label, mode) => {
    setup(); await screen.findByRole("group"); await userEvent.click(button(label));
    expect(screen.getByRole("status")).toHaveTextContent(`/ai-providers?provider=900&mode=${mode}`);
  });
  it.each(["api_key", "agentic"] as const)("reports a stored key independently of the %s default and model", async mode => {
    const data = fixture(); data.providers[0] = { ...data.providers[0], mode, default_mode: mode, apiKeysCount: 1, validKeysCount: 0, selectedApiKey: null, selectedModel: undefined, status: "degraded" };
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup(); await screen.findByRole("group");
    expectColor("API key", "Success");
    expect(button("API key")).toHaveAccessibleName(new RegExp(i18n.t("layout:ai_indicators.configured")));
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...data.providers[0], apiKeysCount: 0 }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expectColor("API key", "Error"));
  });
  it("uses this instance's Codex session and honors a real usage denial", async () => {
    const data = fixture(); data.providers[0] = { ...data.providers[0], key: "openai", mode: "agentic", codexSession: { available: true, authenticated: true, planType: null, checkedAt: null, reason: null, quotas: null, lastInferenceAt: null, usageAllowed: false } };
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup(); await screen.findByRole("group"); expectColor("Agentic", "Error");
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...data.providers[0], codexSession: { ...data.providers[0].codexSession!, usageAllowed: true } }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expectColor("Agentic", "Success"));
  });
  it("keeps missing or malformed observations unverified", async () => {
    const data = fixture(); data.engines = null;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup(); await screen.findByRole("group");
    expectColor("Agentic", "Error"); expect(button("Agentic")).toHaveAccessibleName(new RegExp(i18n.t("layout:ai_indicators.unverified")));
    const malformed = { ...fixture(), engines: { agentic: { authenticated: "true", available: true } } } as unknown as AiProvidersHealthResponse;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(malformed); await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    expectColor("Agentic", "Error");
  });
  it("preserves content, disables actions during refetch, and reports failed health once", async () => {
    const data = fixture(); data.providers[0].apiKeysCount = 1;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup(); await screen.findByRole("group");
    let reject: ((reason: Error) => void) | undefined;
    vi.mocked(getAiProvidersHealth).mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado de IA" }));
    await waitFor(() => expect(button("Agentic")).toBeDisabled()); expectColor("API key", "Success");
    expect(screen.getByRole("button", { name: "Actualizar estado de IA" })).toBeDisabled();
    expect(sileo.success).not.toHaveBeenCalled();
    await act(async () => reject?.(new Error("Synthetic unavailable service")));
    await waitFor(() => expect(button("Agentic")).toBeEnabled());
    expectColor("Agentic", "Error"); expectColor("API key", "Success"); expect(sileo.error).toHaveBeenCalledOnce();
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado de IA" }));
    await waitFor(() => expectColor("Agentic", "Success"));
    expect(sileo.error).toHaveBeenCalledOnce();
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith({ title: "Estado de IA actualizado" });
    client.clear();
  });
  it("coalesces rapid manual clicks into one shared read and one success notification", async () => {
    setup(true); await screen.findByRole("group");
    let resolve: ((data: AiProvidersHealthResponse) => void) | undefined;
    vi.mocked(getAiProvidersHealth).mockImplementation(() => new Promise(resolvePromise => { resolve = resolvePromise; }));
    const refresh = screen.getByRole("button", { name: "Actualizar estado de IA" });
    act(() => { fireEvent.click(refresh); fireEvent.click(refresh); });
    expect(getAiProvidersHealth).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(refresh).toBeDisabled());
    expect(button("Agentic")).toBeDisabled();
    expectColor("Agentic", "Success");
    await act(async () => resolve?.(fixture()));
    await waitFor(() => expect(refresh).toBeEnabled());
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("honors disabled flags, new default identity, and omission without a default", async () => {
    const data = fixture(); data.providers[0].use_api_key = false;
    vi.mocked(getAiProvidersHealth).mockResolvedValue(data); const client = setup(); await screen.findByRole("group");
    expect(screen.getAllByRole("button")).toHaveLength(2); expect(button("Agentic")).toBeEnabled();
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [{ ...data.providers[0], id: "901", mode: "api_key", use_api_key: true, use_agentic: false }] });
    await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Agentic/ })).not.toBeInTheDocument());
    await userEvent.click(button("API key")); expect(screen.getByRole("status")).toHaveTextContent("provider=901&mode=api_key");
    vi.mocked(getAiProvidersHealth).mockResolvedValue({ ...data, providers: [] }); await act(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    await waitFor(() => expect(screen.queryByRole("group")).not.toBeInTheDocument());
  });
  it("renders translated status and accessible action in English", async () => {
    const data = fixture(); data.providers[0].apiKeysCount = 1; vi.mocked(getAiProvidersHealth).mockResolvedValue(data);
    await i18n.changeLanguage("en"); setup(); await screen.findByRole("group");
    expect(button("API key")).toHaveAccessibleName(/API key configured. Open settings/);
    await userEvent.click(screen.getByRole("button", { name: "Refresh AI status" }));
    await waitFor(() => expect(sileo.success).toHaveBeenCalledExactlyOnceWith({ title: "AI status updated" }));
  });
});
