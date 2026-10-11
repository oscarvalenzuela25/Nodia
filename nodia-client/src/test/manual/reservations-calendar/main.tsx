// Isolated browser QA: real components and validated server fixtures, no real API.
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert, Stack } from "@mui/material";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import BaseLayout from "../../../layouts/BaseLayout";
import RentalReservations from "../../../modules/rentals/pages/RentalReservations";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";
import fixture from "./fixtures.json";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "calendar-synthetic-qa";
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
      module_group_key: "tools",
      translates: [],
      modules: [
        {
          key: "reservations",
          link: "/tools/reservations",
          icon: "HolidayVillageOutlined",
          translates: [{ key: "key", es: "Reservas", en: "Reservations" }],
        },
      ],
    },
  ],
};
settings.getState().setContext(context);
const requests: string[] = [];
const syntheticPropertyChanges: Record<string, unknown> = {};
Object.assign(window, { calendarQaRequests: requests });
mainInstance.defaults.adapter = async (request) => {
  const url = request.url ?? "";
  const route =
    "/api/v1" +
    url
      .replace(/^\/api\/v1/, "")
      .replace(/\/rental\/properties\/\d+/, "/rental/properties/{propertyId}")
      .replace(
        /\/(reservations|turnovers|blocks|payments|expenses|cancellation-policies)\/\d+/,
        "/$1/{id}",
      );
  const row = fixture.find(
    (entry) => entry.route === request.method?.toUpperCase() + " " + route,
  );
  requests.push(request.method + " " + url);
  if (!row)
    throw new Error(
      "Unexpected synthetic QA request: " + request.method + " " + route,
    );
  const response = {
    config: request,
    data: structuredClone(row.response),
    status: 200,
    statusText: "OK",
    headers: {},
  };
  if (
    request.method === "get" &&
    params.get("owner") === "1" &&
    /\/rental\/properties\/\d+$/.test(url)
  ) {
    const data = response.data as { membership: Record<string, unknown> };
    Object.assign(data.membership, {
      type: "owner",
      can_manage_configuration: true,
      can_manage_collaborators: true,
    });
  }
  if (request.method === "get" && /\/rental\/properties\/\d+$/.test(url)) {
    Object.assign(response.data, syntheticPropertyChanges);
    if (params.get("long") === "1")
      Object.assign(response.data, {
        name: "Synthetic".repeat(12),
        location: "SyntheticLocation".repeat(25),
        notes: "SyntheticNotes".repeat(60),
        default_nightly_rate: "9223372036854775807",
        default_deposit_percent: "0.00",
        minimum_turnover_minutes: 0,
      });
  }
  const target = params.get("resource");
  if (
    params.get("blocks") === "1" &&
    url.endsWith("/blocks") &&
    request.method === "get"
  ) {
    const block = fixture.find(
      (entry) =>
        entry.route ===
        "GET /api/v1/rental/properties/{propertyId}/blocks/{id}",
    )?.response;
    if (block)
      Object.assign(response, {
        data: {
          data: [structuredClone(block)],
          meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
        },
      });
  }
  if (target && url.endsWith("/" + target) && request.method === "get") {
    if (params.get("error") === "1")
      throw new AxiosError(
        "Synthetic list failure",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        {
          ...response,
          status: 503,
          data: { message: "Synthetic QA unavailable" },
        },
      );
    if (params.get("invalid") === "1")
      Object.assign(response, { data: { data: [{ id: null }], meta: {} } });
    if (params.get("empty") === "1")
      Object.assign(response, {
        data: {
          data: [],
          meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
        },
      });
  }
  // Server examples were captured at different points of the integration run.
  // Reconcile display fixtures by identity inside this isolated QA adapter only.
  if (/\/reservations\/\d+$/.test(url) && request.method === "get") {
    const id = url.split("/").at(-1);
    const list = fixture.find(
      (entry) =>
        entry.route ===
        "GET /api/v1/rental/properties/{propertyId}/reservations",
    )?.response as { data: Record<string, unknown>[] };
    const calendar = fixture.find((entry) => entry.route.endsWith("/calendar"))
      ?.response as {
      reservations: Record<string, unknown>[];
      turnovers: Record<string, unknown>[];
    };
    const selected = calendar.reservations.find((item) => item.id === id);
    if (selected)
      response.data = {
        ...structuredClone(
          list.data.find((item) => item.id === id) ?? list.data[0],
        ),
        ...selected,
        turnover_id:
          calendar.turnovers.find((item) => item.incoming_reservation_id === id)
            ?.id ?? null,
      } as typeof response.data;
  }
  if (url.endsWith("/calendar")) {
    if (params.get("loading") === "1")
      await new Promise((resolve) => setTimeout(resolve, 1200));
    if (params.get("error") === "1")
      throw new AxiosError(
        "Synthetic outage",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        { ...response, status: 503, data: { message: "Synthetic QA outage" } },
      );
    const data = response.data as {
      scope: { from_on: string; to_on: string };
      reservations: unknown[];
      blocks: unknown[];
      turnovers: unknown[];
    };
    data.scope.from_on = request.params.from_on;
    data.scope.to_on = request.params.to_on;
    data.reservations = data.reservations.filter((item) => {
      const row = item as { check_in_on: string; check_out_on: string };
      return (
        row.check_in_on < data.scope.to_on &&
        row.check_out_on > data.scope.from_on
      );
    });
    const ids = new Set(
      data.reservations.map((item) => (item as { id: string }).id),
    );
    data.turnovers = data.turnovers.filter((item) =>
      ids.has(
        (item as { incoming_reservation_id: string }).incoming_reservation_id,
      ),
    );
    if (params.get("empty") === "1") {
      data.reservations = [];
      data.blocks = [];
      data.turnovers = [];
    }
    if (params.get("invalid") === "1")
      Object.assign(data, {
        reservations: [{ guest_name: "Invalid synthetic data" }],
      });
  }
  if (request.method !== "get" && params.get("reject") === "1")
    throw new AxiosError(
      "Synthetic rejection",
      "ERR_BAD_REQUEST",
      request,
      undefined,
      { ...response, status: 409, data: { message: "Synthetic QA rejection" } },
    );
  if (request.method === "put" && /\/rental\/properties\/\d+$/.test(url)) {
    const body: unknown =
      typeof request.data === "string"
        ? JSON.parse(request.data)
        : request.data;
    if (body && typeof body === "object")
      Object.assign(syntheticPropertyChanges, body);
  }
  return response;
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context);
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <BaseLayout>
        <Stack spacing={3}>
          <Alert severity="info">
            QA · datos sintéticos · sin conexión al backend
          </Alert>
          <RentalReservations />
        </Stack>
      </BaseLayout>
    ),
  },
]);
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
