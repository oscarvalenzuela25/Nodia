// Isolated synthetic QA, never imported by the application or sent to a provider.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/inter/400.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import Topbar from "../../../layouts/components/Topbar";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type { AiProvidersHealthResponse } from "../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import i18n from "../../../translate";

const params = new URLSearchParams(location.search);
const businessOnly = params.get("access") === "business";
const root = document.getElementById("root")!;
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
useAuthStore.getState().login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "topbar-qa", name: "QA" } });
settings.getState().setContext({
  roles: businessOnly ? [] : ["super_admin"],
  actions: [],
  modules: [{ module_group_key: "qa", translates: [], modules: [businessOnly
    ? { key: "business", link: "/business", translates: [] }
    : { key: "ai-providers", link: "/ai-providers", translates: [] }] }],
});
const health: AiProvidersHealthResponse = {
  timestamp: "2026-10-09T12:00:00Z", overallStatus: "degraded", alerts: [],
  engines: { active_engine: "agentic", agentic: { engine: "agentic", available: false, authenticated: false }, },
  providers: [{ id: "900", key: "gemini", name: "QA connection", is_default: true, isActive: true,
    use_api_key: true, apiKeysCount: 1, use_agentic: true, mode: "api_key", status: "degraded",
    statusBadge: "", serviceState: "", lastCheck: null, latencyMs: null, hasConnection: true }],
  summary: { totalProviders: 1, activeProviders: 1, healthyProviders: 0, incidentsCount: 0 },
};
const businessStatus = {
  provider: { name: "QA connection", key: "gemini", isActive: true,
    use_api_key: true, use_agentic: true, hasApiKey: true,
    agentic: { available: false, authenticated: false } },
};
const endpoint = apiPath(businessOnly ? "/ai-providers/topbar-status" : "/ai-providers/health");
const requests: string[] = [];
mainInstance.defaults.adapter = async request => {
  requests.push(`${request.method} ${request.url}`);
  root.dataset.qaRequests = JSON.stringify(requests);
  if (request.method !== "get" || request.url !== endpoint) throw new Error("Unexpected QA HTTP call");
  return { config: request, data: businessOnly ? businessStatus : health, status: 200, statusText: "OK", headers: {} };
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(root).render(<QueryClientProvider client={client}><MUIProvider><BrowserRouter>
  <Topbar onDrawerToggle={() => undefined} />
</BrowserRouter></MUIProvider></QueryClientProvider>);
