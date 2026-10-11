// Isolated synthetic fixture: intercept every HTTP call; no real AI account or database is used.
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";
import productionRouter from "../../../routes";
import type {
  AiProviderEntity,
  AiProvidersHealthResponse,
  AiApiKeyEntity,
} from "../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "ai-mobile-qa";
useAuthStore
  .getState()
  .login({
    token: "synthetic-never-sent",
    expiresAt: Date.now() + 900_000,
    user: { id: actorId, name: "QA" },
  });
const context = {
  roles: ["super_admin"],
  actions: [],
  modules: [
    {
      module_group_key: "general_settings",
      translates: [],
      modules: [
        { key: "ai-providers", link: "/settings/ai-providers", translates: [] },
      ],
    },
  ],
};
settings.getState().setContext(context);
const catalog = [
  {
    id: "1",
    key: "gemini",
    name: "Google Gemini",
    can_use_api_key: true,
    can_use_token_plan_web: true,
    can_use_token_plan_agentic: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    key: "openai",
    name: "OpenAI",
    can_use_api_key: true,
    can_use_token_plan_web: false,
    can_use_token_plan_agentic: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];
const modelId =
  "synthetic/model-with-a-very-long-identifier-for-mobile-layout-validation";
let keys: AiApiKeyEntity[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  provider_id: "901",
  label: i === 0 ? "Clave sintética principal" : "QA API " + (i + 1),
  display_hint: "...QA" + (i + 1),
  is_selected: i === 0,
  is_active: i !== 1,
  sort_order: i,
  health_state: "untested",
  created_at: "",
  updated_at: "",
}));
const modeFields = {
  selected_model: modelId,
  ocr_model: modelId,
  thinking_level: "low",
  available_models: [
    {
      id: modelId,
      name: "Modelo sintético con nombre largo para comprobar la vista móvil",
      description: "",
      capabilities: [],
    },
  ],
};
let providers: AiProviderEntity[] = catalog.map((item, i) => ({
  id: String(901 + i),
  catalog_id: item.id,
  catalog: item,
  key: item.key,
  name: i === 0 ? "Gemini · conexión de prueba" : "OpenAI · prueba",
  is_default: i === 0,
  is_active: true,
  mode: "api_key",
  default_mode: "api_key",
  use_api_key: true,
  use_token_plan_web: i === 0,
  use_token_plan_agentic: true,
  fields: {
    api_key: modeFields,
    token_plan_web: { ...modeFields, thinking_level: undefined },
    token_plan_agentic: modeFields,
  },
  auto_rotate_api_keys: false,
  api_keys: keys,
  created_at: "",
  updated_at: "",
}));
const empty = params.get("empty") === "1";
const health = (): AiProvidersHealthResponse => ({
  timestamp: "2026-10-09T12:00:00Z",
  overallStatus: "degraded",
  alerts: [],
  engines:
    params.get("unknown") === "1"
      ? null
      : {
          active_engine: "web",
          web: { engine: "web", available: true, authenticated: true },
          agentic: {
            engine: "agentic",
            available: false,
            authenticated: false,
          },
        },
  providers: empty
    ? []
    : providers.map((p) => ({
        id: p.id,
        key: p.key!,
        name: p.name!,
        catalog_id: p.catalog_id!,
        catalog: p.catalog,
        isActive: p.is_active,
        is_default: p.is_default,
        use_api_key: p.use_api_key,
        use_token_plan_web: p.use_token_plan_web,
        use_token_plan_agentic: p.use_token_plan_agentic,
        default_mode: p.default_mode!,
        mode: "api_key",
        fields: p.fields,
        auto_rotate_api_keys: p.auto_rotate_api_keys,
        status: "unverified",
        statusBadge: i18n.language === "es" ? "Sin verificar" : "Unverified",
        serviceState:
          i18n.language === "es"
            ? "API configurada; inferencia sin verificar"
            : "API configured; inference unverified",
        lastCheck: null,
        latencyMs: null,
        hasConnection: true,
        apiKeysCount: keys.length,
        selectedApiKey: keys.find((k) => k.is_selected) ?? null,
      })),
  summary: {
    totalProviders: empty ? 0 : 2,
    activeProviders: empty ? 0 : 2,
    healthyProviders: 0,
    incidentsCount: 0,
  },
});
let rejected = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  const response = (data: unknown, status = 200) => ({
    config: request,
    data,
    status,
    statusText: "Synthetic QA",
    headers: {},
  });
  const fail = () => {
    throw new AxiosError(
      "Synthetic failure",
      "ERR_BAD_RESPONSE",
      request,
      undefined,
      response({ message: "core:server_error_toast" }, 503),
    );
  };
  if (request.url?.endsWith("/authorization/context")) return response(context);
  if (params.get("error") === "1") fail();
  if (request.method === "delete" && /ai-api-key/.test(request.url ?? "")) {
    if (params.get("failDelete") === "1" && !rejected) {
      rejected = true;
      fail();
    }
    keys = keys.filter((k) => k.id !== request.url?.split("/").at(-1));
    return response(undefined, 204);
  }
  if (request.method === "put" && /ai-provider\//.test(request.url ?? "")) {
    if (params.get("failSave") === "1" && !rejected) {
      rejected = true;
      fail();
    }
    const id = request.url?.split("/").at(-1),
      payload = JSON.parse(String(request.data));
    providers = providers.map((p) => (p.id === id ? { ...p, ...payload } : p));
    return response(providers.find((p) => p.id === id));
  }
  if (request.method === "put" && /ai-api-key/.test(request.url ?? "")) {
    const id = request.url?.split("/").at(-1),
      payload = JSON.parse(String(request.data));
    keys = keys.map((k) => ({
      ...k,
      is_selected: payload.is_selected && k.id === id,
    }));
    return response(keys.find((k) => k.id === id));
  }
  if (request.method === "post" && request.url?.includes("/sync-models"))
    return response({
      models: modeFields.available_models,
      providerId: "901",
      providerName: "Gemini · conexión de prueba",
      currentSelectedModel: modelId,
      isSelectedModelAvailable: true,
    });
  if (request.method !== "get")
    throw new Error("Unexpected synthetic mutation: " + request.url);
  if (request.url?.endsWith("/ai-providers/health")) return response(health());
  if (request.url?.endsWith("/ai-providers/catalog")) return response(catalog);
  if (request.url?.endsWith("/ai-providers/models")) return response([]);
  if (request.url?.endsWith("/ai-providers"))
    return response({
      data: empty ? [] : providers.map((p) => ({ ...p, api_keys: keys })),
      meta: { page: 1, limit: 2, total_items: empty ? 0 : 2, total_pages: 1 },
    });
  if (request.url?.endsWith("/ai-api-keys")) {
    const page = Number(request.params?.page ?? 1),
      limit = 10,
      data = empty ? [] : keys;
    return response({
      data: data.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total_items: data.length,
        total_pages: Math.ceil(data.length / limit),
      },
    });
  }
  throw new Error("Unexpected synthetic URL: " + request.url);
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context);
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: [
    "/settings/ai-providers" +
      (params.get("detail")
        ? "?provider=" +
          params.get("detail") +
          (params.get("mode") ? "&mode=" + params.get("mode") : "")
        : ""),
  ],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
