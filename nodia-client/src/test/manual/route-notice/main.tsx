// Isolated manual QA of production routes. No requests reach real services.
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

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "route-notice-qa";
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
      module_group_key: "tools",
      translates: [],
      modules: [
        {
          key: "rental_reservations",
          link: "/tools/reservations",
          translates: [],
        },
      ],
    },
  ],
};
// Reset persisted assignments; seeded data is explicitly synthetic.
settings
  .getState()
  .setContext(
    params.get("cached") === "1"
      ? context
      : { roles: [], actions: [], modules: [] },
  );
let attempts = 0;
mainInstance.defaults.adapter = async (request) => {
  if (request.method !== "get") throw new Error("Unexpected QA mutation");
  if (request.url?.endsWith("/authorization/context")) {
    attempts += 1;
    if (attempts > 1)
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
    if (params.get("recover") !== "1" || attempts < 3) {
      throw new AxiosError(
        "Synthetic context outage",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        {
          config: request,
          data: { message: "core:server_error_alert" },
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
        },
      );
    }
    return {
      config: request,
      data: context,
      status: 200,
      statusText: "OK",
      headers: {},
    };
  }
  if (!request.url?.endsWith("/rental/properties"))
    throw new Error("Unexpected QA request");
  return {
    config: request,
    data: {
      data: [],
      meta: {
        page: 1,
        limit: request.params?.limit ?? 1,
        total_items: 0,
        total_pages: 0,
      },
    },
    status: 200,
    statusText: "OK",
    headers: {},
  };
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
if (params.get("cached") === "1") {
  const key = ["authorization", "context", actorId];
  client.setQueryData(key, context);
  await client
    .fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: async () =>
        (await mainInstance.get("/authorization/context")).data,
    })
    .catch(() => undefined);
}
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: ["/tools/reservations"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
