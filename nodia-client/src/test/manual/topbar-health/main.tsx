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
import type { AiProvidersHealthResponse } from "../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import i18n from "../../../translate";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
useAuthStore.getState().login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "topbar-qa", name: "QA" } });
settings.getState().setContext({ roles: ["super_admin"], actions: [], modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "ai-providers", link: "/settings/ai-providers", translates: [] }] }] });
const health: AiProvidersHealthResponse = {
  timestamp: "2026-10-09T12:00:00Z", overallStatus: "degraded", alerts: [],
  engines: { active_engine: "web", web: { engine: "web", available: true, authenticated: true }, agentic: { engine: "agentic", available: false, authenticated: false } },
  providers: [{ id: "900", key: "gemini", name: "QA connection", is_default: true, isActive: true,
    use_api_key: false, use_token_plan_web: true, use_token_plan_agentic: true, mode: "web_session", status: "degraded",
    statusBadge: "", serviceState: "", lastCheck: null, latencyMs: null, hasConnection: true }],
  summary: { totalProviders: 1, activeProviders: 1, healthyProviders: 0, incidentsCount: 0 },
};
mainInstance.defaults.adapter = async request => {
  if (!request.url?.endsWith("/ai-providers/health")) throw new Error("Unexpected QA HTTP call");
  return { config: request, data: health, status: 200, statusText: "OK", headers: {} };
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(["ai-providers-health"], health);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MUIProvider><BrowserRouter>
  <Topbar onDrawerToggle={() => undefined} />
</BrowserRouter></MUIProvider></QueryClientProvider>);
