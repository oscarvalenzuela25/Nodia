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
  Action,
  BusinessAction,
} from "../../../modules/generalSettings/pages/Actions/types";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "actions-qa";
useAuthStore.getState().login({
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
      modules: [{ key: "actions", link: "/settings/actions", translates: [] }],
    },
  ],
};
settings.getState().setContext(context);

const makeActions = (business: boolean): (Action & BusinessAction)[] =>
  Array.from({ length: 12 }, (_, index) => ({
    id: String(BigInt(index) + (business ? 100n : 9007199254740993n)),
    key:
      (business ? "synthetic.business." : "synthetic.general.") + (index + 1),
    is_active: index !== 11,
    description:
      index === 1
        ? null
        : "Descripción de una acción sintética para comprobar lectura y ajuste móvil.",
    has_description: index !== 1,
    translates:
      index === 1
        ? []
        : [
            {
              key: "key",
              es: business
                ? "Acción sintética de negocio " + (index + 1)
                : "Acción general sintética " + (index + 1),
              en: business
                ? "Synthetic business action " + (index + 1)
                : "Synthetic general action " + (index + 1),
            },
            {
              key: business ? "description" : "comment",
              es: "Descripción sintética con texto extenso para comprobar el ajuste de las tarjetas.",
              en: "Synthetic description with extended text to verify wrapping in mobile cards.",
            },
          ],
  }));
let general = makeActions(false),
  business = makeActions(true),
  failed = false;
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
  if (!/\/(business-action|action)(\/[^/]+)?$/.test(request.url ?? ""))
    throw new Error("Unexpected synthetic URL");
  const isBusiness = request.url?.includes("/business-action");
  let rows = isBusiness ? business : general;
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
    const id = request.url?.split("/").at(-1);
    rows = rows.filter((row) => row.id !== id);
    if (isBusiness) business = rows;
    else general = rows;
    return response(undefined, 204);
  }
  if (request.method === "put") {
    const id = request.url?.split("/").at(-1),
      payload = JSON.parse(String(request.data));
    rows = rows.map((row) => (row.id === id ? { ...row, ...payload } : row));
    if (isBusiness) business = rows;
    else general = rows;
    return response(rows.find((row) => row.id === id));
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
  if (params.get("empty") === "1") rows = [];
  const query = request.params ?? {},
    q = query.q ?? {};
  if (typeof q.is_active_eq === "boolean")
    rows = rows.filter((row) => row.is_active === q.is_active_eq);
  if (q.key_cont)
    rows = rows.filter((row) => row.key.includes(String(q.key_cont)));
  if (Array.isArray(q.key_in))
    rows = rows.filter((row) => q.key_in.includes(row.key));
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
  initialEntries: ["/settings/actions"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
