// Synthetic finance QA only. Every HTTP call is intercepted; no real account/DB.
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
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
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import productionRouter from "../../../routes";
import type {
  FinanceCategory,
  FinanceCategoryGroup,
  FinanceMovement,
  FinanceObligation,
  FinanceResource,
} from "../../../modules/finances/types";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "light" ? "light" : "dark",
});
const actorId = "9007199254740993";
useAuthStore
  .getState()
  .login({
    token: "synthetic-never-sent",
    expiresAt: Date.now() + 900000,
    user: { id: actorId, name: "QA" },
  });
const context = {
  roles: ["super_admin"],
  actions: [],
  modules: [
    {
      module_group_key: "tools",
      translates: [],
      modules: [
        {
          key: "personal_finance",
          link: "/tools/finances-personal",
          translates: [],
        },
      ],
    },
  ],
};
settings.getState().setContext(context);
const base = {
  user_id: actorId,
  is_active: true,
  created_at: "2026-10-09T12:00:00Z",
  updated_at: "2026-10-09T12:00:00Z",
};
let categories: FinanceCategory[] = Array.from({ length: 12 }, (_, i) => ({
  ...base,
  id: String(9007199254741000n + BigInt(i)),
  key: "categoria_" + i,
  name:
    i === 0
      ? "Categoría libre para eliminar"
      : i === 1
        ? "Categoría vinculada a movimientos"
        : "Categoría con nombre extenso para revisar el contenido en móvil " +
          i,
}));
let groups: FinanceCategoryGroup[] = Array.from({ length: 12 }, (_, i) => ({
  ...base,
  id: String(9007199254741100n + BigInt(i)),
  key: "grupo_" + i,
  name: "Grupo de categorías de prueba " + i,
  category_count: 2,
  categories: [categories[0], categories[1]],
}));
let obligations: FinanceObligation[] = Array.from({ length: 12 }, (_, i) => ({
  ...base,
  id: String(9007199254741200n + BigInt(i)),
  key: "prestamo_" + i,
  name:
    i === 0
      ? "Préstamo sin pagos"
      : i === 1
        ? "Préstamo con pagos"
        : "Préstamo con descripción extensa " + i,
  type: i % 2 === 0 ? "loan" : "debt",
  amount: "100000",
  description:
    "Descripción de prueba que debe mantenerse legible y completa al abrir el formulario.",
  paid_amount: i === 1 ? "20000" : "0",
  remaining_amount: i === 1 ? "80000" : "100000",
  initial_movement: {
    id: String(9007199254741300n + BigInt(i)),
    type: i % 2 === 0 ? "expense" : "income",
    status: i % 2 === 0 ? "paid" : "received",
    amount: "100000",
    category_id: categories[1].id,
  },
}));
let movements: FinanceMovement[] = Array.from({ length: 12 }, (_, i) => ({
  ...base,
  id: String(9007199254741400n + BigInt(i)),
  name: "Movimiento personal de prueba " + i,
  amount: i === 0 ? "9007199254740993" : "15000",
  type: i % 2 === 0 ? "income" : "expense",
  status: i % 2 === 0 ? "received" : "paid",
  category_id: categories[1].id,
  category: categories[1],
  obligation_id: null,
  obligation: null,
}));
movements.push(
  ...obligations.map((o) => ({
    ...base,
    ...o.initial_movement,
    name: o.name,
    category: categories[1],
    obligation_id: o.id,
    obligation: { id: o.id, name: o.name, type: o.type },
  })),
);
movements.push({
  ...base,
  id: "9007199254741500",
  name: "Pago de deuda",
  amount: "20000",
  type: "expense",
  status: "paid",
  category_id: categories[1].id,
  category: categories[1],
  obligation_id: obligations[1].id,
  obligation: obligations[1],
});
const records = (resource: FinanceResource) =>
  resource === "categories"
    ? categories
    : resource === "category-groups"
      ? groups
      : resource === "obligations"
        ? obligations
        : movements;
let failedDelete = false,
  failedSave = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 120));
  const url = request.url ?? "",
    q = request.params?.q ?? {};
  const response = (data: unknown, status = 200) => ({
    config: request,
    data,
    status,
    statusText: "Synthetic QA",
    headers: {},
  });
  const fail = (message: string, status = 409): never => {
    throw new AxiosError(
      "Synthetic rejection",
      "ERR_BAD_RESPONSE",
      request,
      undefined,
      response({ message }, status),
    );
  };
  if (url.endsWith("/authorization/context")) return response(context);
  if (url.endsWith("/ai-providers/health"))
    return response({
      timestamp: "2026-10-09T12:00:00Z",
      overallStatus: "unknown",
      alerts: [],
      engines: null,
      providers: [],
      summary: {
        totalProviders: 0,
        activeProviders: 0,
        readyProviders: 0,
        warningProviders: 0,
        criticalProviders: 0,
        operationalModes: 0,
        incidentsCount: 0,
      },
    });
  if (url.endsWith("/users/me/mobile-navigation"))
    return response({ shortcuts: [], is_locked: false });
  const scope = {
    active: "active",
    movement_filters: {
      q: {},
      category_ids: [],
      category_group_ids: [],
      obligation_id: null,
    },
    obligation_balances: {
      active: "active",
      repayments: "all_confirmed_history",
      includes_inactive_repayments: true,
      ignores_movement_filters: true,
    },
  };
  if (url.endsWith("/finance/overview"))
    return response({
      scope,
      totals: {
        income_amount: "9007199254740993",
        expense_amount: "195000",
        net_amount: "9007199254545993",
        movement_count: movements.length,
        pending_count: 0,
        cancelled_count: 0,
      },
      counts: {
        categories: categories.length,
        category_groups: groups.length,
        loans: 6,
        debts: 6,
      },
      obligations: {
        loan_remaining_amount: "600000",
        debt_remaining_amount: "580000",
      },
    });
  const resource = url.includes("/overview/")
    ? url.endsWith("categories")
      ? "categories"
      : "category-groups"
    : (url.split("/finance/")[1]?.split("/")[0] as FinanceResource);
  if (
    !["categories", "category-groups", "movements", "obligations"].includes(
      resource,
    )
  )
    throw new Error("Unexpected synthetic URL " + url);
  const id = url.split("/finance/")[1]?.split("/")[1];
  let data: Array<
    FinanceCategory | FinanceCategoryGroup | FinanceObligation | FinanceMovement
  > = records(resource);
  if (!url.includes("/overview/") && id) {
    const row = data.find((r) => r.id === id);
    if (!row) fail("finance:not_found", 404);
    if (request.method === "delete") {
      if (params.has("failDelete") && !failedDelete) {
        failedDelete = true;
        fail("core:server_error_toast", 503);
      }
      if (
        resource === "categories" &&
        movements.some((m) => m.category_id === id)
      )
        fail("finance:category_has_movements");
      if (
        resource === "obligations" &&
        movements.some(
          (m) =>
            m.obligation_id === id &&
            m.type ===
              (obligations.find((o) => o.id === id)?.type === "loan"
                ? "income"
                : "expense"),
        )
      )
        fail("finance:obligation_has_payments");
      if (
        resource === "movements" &&
        obligations.some((o) => o.initial_movement.id === id)
      )
        fail("finance:delete_initial_on_obligation");
      if (resource === "categories") {
        categories = categories.filter((r) => r.id !== id);
        groups = groups.map((g) => ({
          ...g,
          categories: g.categories?.filter((c) => c.id !== id),
          category_count: (g.categories ?? []).filter((c) => c.id !== id)
            .length,
        }));
      }
      if (resource === "category-groups")
        groups = groups.filter((r) => r.id !== id);
      if (resource === "obligations") {
        obligations = obligations.filter((r) => r.id !== id);
        movements = movements.filter((m) => m.obligation_id !== id);
      }
      if (resource === "movements")
        movements = movements.filter((r) => r.id !== id);
      return response("", 204);
    }
    if (request.method === "put") {
      if (params.has("failSave") && !failedSave) {
        failedSave = true;
        fail("core:server_error_toast", 503);
      }
      Object.assign(row!, JSON.parse(String(request.data)));
      return response(row);
    }
    return response(row);
  }
  if (request.method === "post") {
    if (params.has("failSave") && !failedSave) {
      failedSave = true;
      fail("core:server_error_toast", 503);
    }
    const body = JSON.parse(String(request.data));
    const row = { ...base, ...body, id: "9007199254741999" };
    if (resource === "categories") categories.push(row);
    else if (resource === "category-groups") {
      row.categories = categories.filter((c) =>
        body.category_ids.includes(c.id),
      );
      row.category_count = row.categories.length;
      groups.push(row);
    } else fail("core:server_error_toast", 503);
    return response(row, 201);
  }
  if (params.has("error") && resource === params.get("error"))
    fail("core:server_error_toast", 503);
  if (params.has("empty")) data = [];
  data = data.filter(
    (r) =>
      (request.params?.active === "all" ||
        r.is_active !== (request.params?.active === "inactive")) &&
      (!q.name_cont ||
        r.name.toLowerCase().includes(q.name_cont.toLowerCase())),
  );
  const page = Number(request.params?.page ?? 1),
    limit = Number(request.params?.limit ?? 10);
  const summary = url.includes("/overview/");
  return response({
    data: data
      .slice((page - 1) * limit, page * limit)
      .map((r) =>
        summary
          ? {
              id: r.id,
              name: r.name,
              key: "key" in r ? r.key : "",
              is_active: r.is_active,
              movement_count: 0,
              income_amount: "0",
              expense_amount: "0",
              net_amount: "0",
            }
          : r,
      ),
    meta: {
      page,
      limit,
      total_items: data.length,
      total_pages: Math.ceil(data.length / limit),
    },
    ...(summary
      ? {
          scope,
          ...(resource === "category-groups"
            ? { overlapping_groups: true }
            : {}),
        }
      : {}),
  });
};
const client = new QueryClient({
  queryCache: new QueryCache({ onError: notifyHttpError }),
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context);
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: [
    "/tools/finances-personal" +
      (params.get("tab") ? "?tab=" + params.get("tab") : ""),
  ],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
