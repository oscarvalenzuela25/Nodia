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
import type { Role } from "../../../modules/generalSettings/pages/Roles/types";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "roles-qa";
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
      modules: [{ key: "roles", link: "/settings/roles", translates: [] }],
    },
  ],
};
settings.getState().setContext(context);
const actions = Array.from({ length: 4 }, (_, i) => ({
  id: String(i + 1),
  key: "synthetic.action." + (i + 1),
  description: null,
  is_active: true,
  translates: [
    {
      key: "key",
      es:
        i === 3
          ? "Acción sintética con un nombre largo para comprobar el ajuste de las asignaciones"
          : "Acción sintética " + (i + 1),
      en:
        i === 3
          ? "Synthetic action with a long name to verify assignment wrapping"
          : "Synthetic action " + (i + 1),
    },
  ],
}));
let roles: Role[] = Array.from({ length: 12 }, (_, i) => ({
  id: i === 0 ? "7" : String(9007199254740993n + BigInt(i)),
  key: i === 0 ? "super_admin" : "synthetic.role." + (i + 1),
  is_active: i !== 11,
  actions: i === 2 ? [] : actions,
  translates:
    i === 1
      ? []
      : [
          {
            key: "key",
            es:
              i === 0 ? "Administración reservada" : "Rol sintético " + (i + 1),
            en:
              i === 0 ? "Reserved administration" : "Synthetic role " + (i + 1),
          },
        ],
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
  if (/\/actions$/.test(request.url ?? ""))
    return response({
      data: actions,
      meta: { page: 1, limit: 4, total_items: 4, total_pages: 1 },
    });
  if (!/\/roles?(\/[^/]+)?$/.test(request.url ?? ""))
    throw new Error("Unexpected synthetic URL");
  if (request.method === "delete") {
    if (params.get("failDelete") === "1" && !failed) {
      failed = true;
      throw new AxiosError(
        "Synthetic failure",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        response({ message: "Synthetic delete failure" }, 503),
      );
    }
    const id = request.url?.split("/").at(-1),
      role = roles.find((row) => row.id === id);
    if (role?.key === "super_admin")
      throw new AxiosError(
        "Protected role",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        response({ message: "roles:protected_role" }, 403),
      );
    roles = roles.filter((row) => row.id !== id);
    return response(undefined, 204);
  }
  if (request.method === "put") {
    const id = request.url?.split("/").at(-1),
      payload = JSON.parse(String(request.data));
    roles = roles.map((row) => (row.id === id ? { ...row, ...payload } : row));
    return response(roles.find((row) => row.id === id));
  }
  if (request.method !== "get")
    throw new Error("Unexpected synthetic operation");
  if (params.get("error") === "1")
    throw new AxiosError(
      "Synthetic failure",
      "ERR_BAD_RESPONSE",
      request,
      undefined,
      response({ message: "core:server_error_toast" }, 503),
    );
  let rows = params.get("empty") === "1" ? [] : roles;
  const query = request.params ?? {},
    q = query.q ?? {};
  if (typeof q.is_active_eq === "boolean")
    rows = rows.filter((row) => row.is_active === q.is_active_eq);
  if (q.key_cont)
    rows = rows.filter((row) => row.key.includes(String(q.key_cont)));
  if (Array.isArray(q.key_in))
    rows = rows.filter((row) => q.key_in.includes(row.key));
  if (Array.isArray(q.actions_key_in))
    rows = rows.filter((row) =>
      row.actions?.some((action) =>
        q.actions_key_in.includes(
          typeof action === "string" ? action : action.key,
        ),
      ),
    );
  const page = Number(query.page ?? 1),
    limit = Number(query.size ?? 10);
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
  initialEntries: ["/settings/roles"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
