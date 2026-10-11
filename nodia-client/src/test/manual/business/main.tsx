import type { ProviderContact } from "../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts/types";
import { notifyHttpError } from "../../../config/httpFeedback";
// Isolated synthetic fixture: intercept every HTTP call; no real account or database is used.
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  BusinessEntity,
  ProviderEntity,
  ProductEntity,
  InvoiceEntity,
} from "../../../modules/business/infrastructure/types";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "light" ? "light" : "dark",
});
const actorId = "business-qa";
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
      modules: [{ key: "business", link: "/tools/business", translates: [] }],
    },
  ],
};
settings.getState().setContext(context);
let business: BusinessEntity = {
  id: "9007199254740993",
  owner_id: actorId,
  name: "Negocio de prueba con un nombre largo para verificar móvil",
  user_role: "owner",
  is_active: true,
  has_description: true,
  created_at: "2026-10-01",
  updated_at: "2026-10-09",
  translates: [
    {
      key: "description",
      es: "Una descripción única del negocio de prueba.",
      en: "Una descripción única del negocio de prueba.",
    },
  ],
  products_count: 27,
  total_providers_count: 52,
  collaborators_count: 2,
  collaborators: [
    {
      id: "201",
      user_id: "301",
      position: "Encargada de inventario y operaciones",
      action_ids: ["1"],
      is_active: true,
      user: {
        id: "301",
        name: "Colaboradora activa de prueba",
        email: "nombre-muy-largo.para-revisar-el-ajuste@example.test",
      },
    },
    {
      id: "202",
      user_id: "302",
      position: "Compras",
      action_ids: ["1"],
      is_active: false,
      user: {
        id: "302",
        name: "Colaboradora inactiva de prueba",
        email: "inactive@example.test",
      },
    },
  ],
};
const providers: ProviderEntity[] = Array.from({ length: 53 }, (_, i) => ({
  id: String(101 + i),
  business_id: business.id,
  name:
    i === 0
      ? "Proveedor de prueba con un nombre largo que debe ajustarse"
      : i === 52
        ? "Proveedor inactivo"
        : "Proveedor QA " + (i + 1),
  tax: 19,
  is_active: i !== 52,
  created_at: "2026-10-09",
  fields: {
    code: {
      value: "CODIGO_PROVEEDOR",
      instructions: "Conservar el código sin perder sus ceros iniciales.",
    },
    cost_price: "PRECIO_NETO",
    cost_price_tax: "PRECIO_CON_IVA",
    packages: "BULTOS",
    units_per_package: "UNIDADES_POR_BULTO",
  },
}));
const products: ProductEntity[] = Array.from({ length: 28 }, (_, i) => ({
  id: String(401 + i),
  business_id: business.id,
  provider_id: "101",
  provider: providers[0],
  code: "QA-PRODUCTO-" + (i + 1),
  name:
    i === 0
      ? "Producto de prueba con un nombre largo para validar la tarjeta"
      : "Producto QA " + (i + 1),
  cost_price: 1000,
  cost_price_tax: 1190,
  profit_percentage: 20,
  sale_price: 1500,
  stock: i === 0 ? 0 : 5,
  is_active: i !== 27,
  created_at: "2026-10-09",
  updated_at: "2026-10-09",
}));
const invoices: InvoiceEntity[] = Array.from({ length: 28 }, (_, i) => ({
  id: String(501 + i),
  business_id: business.id,
  provider_id: "101",
  provider: providers[0],
  code:
    i === 0
      ? "QA-FACTURA-ACTIVA-001"
      : i === 27
        ? "QA-FACTURA-INACTIVA"
        : "QA-FACTURA-" + (i + 1),
  total_amount: 1500,
  path_storage:
    "https://example.test/archivo-de-factura-con-nombre-largo-" +
    (i + 1) +
    ".pdf",
  data: { issue_date: "2026-10-09" },
  is_active: i !== 27,
  created_at: "2026-10-09",
}));
let failed = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  const url = request.url ?? "",
    q = request.params?.q ?? {};
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
  console.info(
    "QA request",
    request.method,
    url,
    JSON.stringify(request.params ?? {}),
  );
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
  if (request.method === "put" && url.includes("/business/")) {
    if (params.get("failSave") === "1" && !failed) {
      failed = true;
      fail();
    }
    business = { ...business, ...JSON.parse(String(request.data)) };
    return response(business);
  }
  if (
    url.endsWith("/product-logs") ||
    (request.method === "post" && url.endsWith("/product-logs/query"))
  )
    return response({
      data: [
        {
          id: "601",
          product_id: "401",
          code: "QA-PRODUCTO-1",
          name: products[0].name,
          cost_price: 800,
          cost_price_tax: 952,
          profit_percentage: 20,
          sale_price: 1200,
          stock: 10,
          created_at: "2026-10-01",
          updated_at: "2026-10-01",
        },
      ],
      meta: { page: 1, limit: 100, total_items: 1, total_pages: 1 },
    });
  if (url.endsWith("/invoices/verify-ia-providers")) return response([]);
  if (request.method !== "get")
    throw new Error("Unexpected synthetic mutation " + url);
  if (
    params.get("error") &&
    url.endsWith("/" + params.get("error")) &&
    Number(request.params?.limit) !== 1 &&
    !failed
  ) {
    failed = true;
    fail();
  }
  if (url.endsWith("/business/" + business.id)) return response(business);
  const list = <
    T extends { is_active?: boolean; name?: string; code?: string },
  >(
    records: T[],
  ) => {
    let data = params.get("empty") === "1" ? [] : records;
    if (typeof q.is_active_eq === "boolean")
      data = data.filter((r) => r.is_active === q.is_active_eq);
    if (q.name_cont || q.code_cont)
      data = data.filter((r) =>
        (r.name ?? r.code ?? "")
          .toLowerCase()
          .includes(String(q.name_cont || q.code_cont).toLowerCase()),
      );
    const page = Number(request.params?.page ?? 1),
      limit = Number(request.params?.limit ?? 25);
    return response({
      data: request.params?.all
        ? data
        : data.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total_items: data.length,
        total_pages: Math.ceil(data.length / limit),
      },
    });
  };
  if (url.endsWith("/business")) return list([business]);
  if (url.endsWith("/providers")) return list(providers);
  if (url.endsWith("/products")) return list(products);
  if (url.endsWith("/invoices")) return list(invoices);

  if (/providers\/101\/contacts$/.test(url))
    return response({
      data: [
        {
          id: "701",
          provider_id: "101",
          version: 1,
          name: "Contacto de prueba",
          description: "Contacto comercial de prueba",
          phone: [{ number: "+56912345678" }],
          email: "nombre.comercial-largo-para-validar@example.test",
          schedule: {
            monday: [
              {
                from: "09:00",
                to: "17:00",
                description: "Atención de proveedores",
              },
            ],
          },
          is_active: true,
          created_at: "2026-10-09",
          updated_at: "2026-10-09",
        },
      ] satisfies ProviderContact[],
      meta: { page: 1, limit: 25, total_items: 1, total_pages: 1 },
    });
  if (
    url.endsWith("/users") ||
    url.endsWith("/business-actions") ||
    url.endsWith("/ai-providers")
  )
    return list([]);
  throw new Error("Unexpected synthetic URL " + url);
};
const client = new QueryClient({
  queryCache: new QueryCache({ onError: notifyHttpError }),
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context);
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: [
    params.get("list") === "1"
      ? "/tools/business"
      : "/tools/business/" + business.id,
  ],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
