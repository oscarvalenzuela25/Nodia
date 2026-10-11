// Synthetic manual fixture. All HTTP is intercepted; no real accounts are changed.
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
  User,
  UpdateUserPayload,
} from "../../../modules/generalSettings/pages/Users/types";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "users-qa";
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
      modules: [{ key: "users", link: "/settings/users", translates: [] }],
    },
  ],
};
settings.getState().setContext(context);
const roles = [
  {
    id: "1",
    key: "synthetic_administrator_with_long_key",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Administrador de operaciones sintéticas",
        en: "Synthetic operations administrator",
      },
    ],
  },
];
const modules = [
  {
    id: "1",
    key: "users",
    link: "/settings/users",
    module_group_id: "1",
    is_active: true,
    translates: [{ key: "key", es: "Usuarios", en: "Users" }],
  },
];
let users: User[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(BigInt(index) + 9007199254740993n),
  name:
    index === 1
      ? null
      : index === 0
        ? "Usuario sintético con nombre extenso"
        : `Synthetic user ${index + 1}`,
  email:
    index === 0
      ? "synthetic-long-address-for-responsive-check@example.test"
      : `synthetic${index + 1}@example.test`,
  image_url: null,
  is_active: index !== 11,
  roles: index === 1 ? [] : roles,
  modules: index === 1 ? [] : modules,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
}));
let failed = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  const response = (data: unknown, status = 200) => ({
    config: request,
    data,
    status,
    statusText: "QA",
    headers: {},
  });
  if (request.url?.endsWith("/authorization/context")) return response(context);
  if (request.method === "put") {
    if (params.get("failUpdate") === "1" && !failed) {
      failed = true;
      throw new AxiosError(
        "Synthetic outage",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        response({ message: "Synthetic update failure" }, 503),
      );
    }
    const id = request.url?.split("/").at(-1);
    const payload: UpdateUserPayload = JSON.parse(String(request.data));
    users = users.map((user) =>
      user.id === id
        ? {
            ...user,
            ...payload,
            roles: payload.roles
              ? roles.filter((role) => payload.roles?.includes(role.id))
              : user.roles,
            modules: payload.modules
              ? modules.filter((module) => payload.modules?.includes(module.id))
              : user.modules,
          }
        : user,
    );
    return response(users.find((user) => user.id === id));
  }
  if (request.method !== "get")
    throw new Error("Unexpected synthetic operation");
  const query = request.params ?? {},
    q = query.q ?? {};
  let rows: unknown[];
  if (request.url?.endsWith("/roles")) rows = roles;
  else if (request.url?.endsWith("/modules")) rows = modules;
  else if (request.url?.endsWith("/users")) {
    let filtered = params.get("empty") === "1" ? [] : users;
    if (params.get("error") === "1")
      throw new AxiosError(
        "Synthetic outage",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        response({ message: "core:server_error_toast" }, 503),
      );
    if (typeof q.is_active_eq === "boolean")
      filtered = filtered.filter((user) => user.is_active === q.is_active_eq);
    if (q.name_cont)
      filtered = filtered.filter((user) =>
        user.name?.toLowerCase().includes(String(q.name_cont).toLowerCase()),
      );
    if (Array.isArray(q.roles_id_in))
      filtered = filtered.filter((user) =>
        user.roles.some((role) => q.roles_id_in.includes(role.id)),
      );
    if (Array.isArray(q.modules_id_in))
      filtered = filtered.filter((user) =>
        user.modules?.some((module) => q.modules_id_in.includes(module.id)),
      );
    rows = filtered;
  } else throw new Error("Unexpected synthetic GET");
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
  initialEntries: ["/settings/users"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
