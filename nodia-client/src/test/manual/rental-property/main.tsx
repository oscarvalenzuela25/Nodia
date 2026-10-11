// Isolated manual QA. Synthetic data only, with no requests to real services.
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/700.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import BaseLayout from "../../../layouts/BaseLayout";
import RentalReservations from "../../../modules/rentals/pages/RentalReservations";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";
import fixture from "../mobile-navigation/fixtures.json";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "rental-property-qa";
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
        { key: "reservations", link: "/tools/reservations", translates: [] },
      ],
    },
  ],
};
settings.getState().setContext(context);
mainInstance.defaults.adapter = async (request) => {
  if (request.method !== "get" || !request.url?.endsWith("/rental/properties"))
    throw new Error("Unexpected QA request");
  const data =
    params.get("empty") === "1"
      ? []
      : [{ ...fixture.property, check_in_time: null, check_out_time: null }];
  return {
    config: request,
    data: {
      data,
      meta: {
        page: 1,
        limit: request.params?.limit ?? 1,
        total_items: data.length,
        total_pages: data.length ? 1 : 0,
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
client.setQueryData(["authorization", "context", actorId], context);
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <BaseLayout>
        <RentalReservations />
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
