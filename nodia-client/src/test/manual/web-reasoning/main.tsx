// Isolated fixture: all HTTP goes to this offline adapter, no auth store changes.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import ProviderDetail from "../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail";
import { mainInstance } from "../../../config/api";
import config from "../../../store/configStore";
import i18n from "../../../translate";

const parameters = new URLSearchParams(location.search);
await i18n.changeLanguage(parameters.get("lang") === "en" ? "en" : "es");
config.setState({ themeType: parameters.get("theme") === "light" ? "light" : "dark" });
mainInstance.defaults.skipAuth = true;
const model = { id: "fixture-model", name: "Modelo sintético", description: "QA · Sin proveedor real", capabilities: [], contextWindow: null };
let provider = { id: "991", key: "gemini", name: "QA Web", is_active: true,
  use_token_plan_web: true, use_token_plan_agentic: false, use_api_key: false, default_mode: "token_plan_web",
  fields: { token_plan_web: { selected_model: model.id, available_models: [model], enable_extended_thinking: true } } };
const engines = { active_engine: "web", web: { engine: "web", available: true, authenticated: true,
  supported_options: { extended_thinking: true, thinking_level: true,
    thinking_levels_by_model: { "fixture-model": ["low", "medium", "high"] } } },
  agentic: { engine: "agentic", available: false, authenticated: false } };
const page = (data: unknown[]) => ({ data, meta: { total_items: data.length, total_pages: 1, page: 1, limit: 100 } });
mainInstance.defaults.adapter = async request => {
  const path = (request.url ?? "").split("?")[0];
  let data: unknown;
  if (request.method === "put" && path.endsWith("/ai-provider/991")) {
    if (parameters.get("fail") === "1") throw new AxiosError("Synthetic failure", "ERR_BAD_RESPONSE", request,
      undefined, { config: request, data: { message: "Error sintético de guardado" }, status: 503, statusText: "Error", headers: {} });
    const payload = JSON.parse(request.data);
    provider = { ...provider, fields: payload.fields };
    const output = document.getElementById("qa-operation");
    if (output) output.textContent = JSON.stringify(payload.fields.token_plan_web);
    data = provider;
  } else if (request.method !== "get") throw new Error("Unexpected QA mutation");
  else if (path.endsWith("/ai-providers")) data = page([provider]);
  else if (path.endsWith("/ai-providers/catalog")) data = [{ id: "fake-catalog", key: "gemini", name: "Gemini QA", is_active: true, can_use_api_key: true, can_use_token_plan_web: true, can_use_token_plan_agentic: true }];
  else if (path.endsWith("/ai-providers/health")) data = { timestamp: new Date().toISOString(), overallStatus: "healthy", engines,
    providers: [{ ...provider, isActive: true, status: "healthy", mode: "web_session" }], alerts: [], summary: { totalProviders: 1, activeProviders: 1, healthyProviders: 1, incidentsCount: 0 } };
  else if (path.endsWith("/ai-providers/gemini-engines")) data = engines;
  else if (path.endsWith("/ai-providers/models")) data = [{ providerId: provider.id, provider: "gemini", mode: "token_plan_web", planType: "token_plan", selectedModel: model.id, isActive: true, isSelected: true, models_source: "provider", models: [model] }];
  else if (path.endsWith("/ai-provider-events")) data = page([]);
  else throw new Error(`Unexpected offline QA query: ${path}`);
  return { config: request, data, status: 200, statusText: "OK", headers: {} };
};
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MUIProvider><BrowserRouter><Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1280, mx: "auto" }}>
    <Typography variant="caption">QA SINTÉTICO · Sin sesión, credenciales ni conexión al proveedor</Typography>
    <ProviderDetail providerId={provider.id} onBack={() => undefined} />
    <output id="qa-operation" aria-label="Escritura simulada" style={{ display: "block", overflowWrap: "anywhere" }} />
  </Box></BrowserRouter></MUIProvider>
</QueryClientProvider>);
