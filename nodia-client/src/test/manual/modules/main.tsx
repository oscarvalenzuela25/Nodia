// Isolated QA: production components; synthetic data; no real HTTP requests.
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
  ModuleEntity,
  ModuleGroupEntity,
} from "../../../modules/generalSettings/pages/Modules/types";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "module-catalog-qa";
useAuthStore
  .getState()
  .login({
    token: "synthetic-never-sent",
    expiresAt: Date.now() + 900_000,
    user: { id: actorId, name: "QA" },
  });
const context = {
  roles: [],
  actions: [],
  modules: [
    {
      module_group_key: "general_settings",
      translates: [],
      modules: [{ key: "modules", link: "/settings/modules", translates: [] }],
    },
  ],
};
settings.getState().setContext(context);
let groups: ModuleGroupEntity[] = [
  {
    id: "1",
    key: "administration",
    icon: "SettingsOutlined",
    is_active: true,
    translates: [{ key: "key", es: "Administración", en: "Administration" }],
  },
  {
    id: "2",
    key: "tools",
    icon: "BuildOutlined",
    is_active: true,
    translates: [{ key: "key", es: "Herramientas", en: "Tools" }],
  },
  {
    id: "3",
    key: "archived",
    is_active: false,
    translates: [{ key: "key", es: "Archivo", en: "Archive" }],
  },
  {
    id: "4",
    key: "empty",
    is_active: true,
    translates: [{ key: "key", es: "Grupo vacío", en: "Empty group" }],
  },
];
let modules: ModuleEntity[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  key: index === 0 ? "users" : `synthetic_module_${index + 1}_long_identifier`,
  link:
    index === 0
      ? "/settings/users"
      : `/tools/synthetic-long-route-${index + 1}`,
  module_group_id: index === 11 ? "3" : "1",
  is_active: index !== 11,
  translates: [
    {
      key: "key",
      es: index === 0 ? "Usuarios" : `Módulo sintético ${index + 1}`,
      en: index === 0 ? "Users" : `Synthetic module ${index + 1}`,
    },
  ],
}));
let failedDelete = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  const response = (data: unknown, status = 200) => ({
    config: request,
    data,
    status,
    statusText: "QA",
    headers: {},
  });
  const fail = (status: number, message: string): never => {
    throw new AxiosError(
      message,
      "ERR_BAD_RESPONSE",
      request,
      undefined,
      response({ message }, status),
    );
  };
  if (
    request.method === "get" &&
    request.url?.endsWith("/authorization/context")
  )
    return response(context);
  const isGroup = /module-group/.test(request.url ?? "");
  if (request.method === "delete") {
    const id = request.url?.split("/").at(-1);
    if (isGroup && modules.some((item) => item.module_group_id === id))
      fail(409, "modules:groups.delete_has_modules");
    if (!isGroup && params.get("failDelete") === "1" && !failedDelete) {
      failedDelete = true;
      fail(503, "core:server_error_toast");
    }
    if (isGroup) groups = groups.filter((item) => item.id !== id);
    else modules = modules.filter((item) => item.id !== id);
    return response(undefined, 204);
  }
  if (request.method !== "get" || !/modules?/.test(request.url ?? ""))
    throw new Error("Unexpected QA request");
  const query = request.params ?? {};
  const filter = query.q ?? {};
  let rows: (ModuleEntity | ModuleGroupEntity)[] = isGroup
    ? groups
    : modules.map((item) => ({
        ...item,
        module_group:
          query.includes === false
            ? undefined
            : groups.find((group) => group.id === item.module_group_id),
      }));
  if (typeof filter.is_active_eq === "boolean")
    rows = rows.filter((item) => item.is_active === filter.is_active_eq);
  if (typeof filter.key_cont === "string")
    rows = rows.filter((item) => item.key.includes(filter.key_cont));
  if (Array.isArray(filter.module_group_id_in))
    rows = rows.filter(
      (item) =>
        "module_group_id" in item &&
        filter.module_group_id_in.includes(item.module_group_id),
    );
  if (Array.isArray(filter.key_in))
    rows = rows.filter((item) => filter.key_in.includes(item.key));
  const page = Number(query.page ?? 1),
    limit = Number(query.size ?? query.limit ?? 10);
  return response({
    data: query.all ? rows : rows.slice((page - 1) * limit, page * limit),
    meta: {
      page,
      limit,
      total_items: rows.length,
      total_pages: Math.ceil(rows.length / limit),
    },
  });
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context);
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: ["/settings/modules"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
