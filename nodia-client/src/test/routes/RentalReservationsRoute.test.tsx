import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import router from "../../routes";
import useAuthStore from "../../store/authStore";
import { mainInstance } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import { RENTAL_RESERVATIONS_ROUTE } from "../../modules/rentals/constants/routes";
import { APP_AVAILABLE_ROUTES } from "../../modules/generalSettings/pages/Modules/constants/routes";
import { useRentalList } from "../../modules/rentals/infrastructure/useServices";
import i18n from "../../translate";

vi.mock("../../layouts/BaseLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../../modules/rentals/pages/RentalReservations", () => ({
  default: function FinanceRouteProbe() {
    useRentalList("properties", undefined, {});
    return <p>Private rental page</p>;
  },
}));
const originalAdapter = mainInstance.defaults.adapter;
const financeRoute = router.routes[0].children?.find(
  (route) => route.path === RENTAL_RESERVATIONS_ROUTE,
);
function openRoute() {
  if (!financeRoute) throw new Error("Missing finance route");
  const testRouter = createMemoryRouter(
    [
      financeRoute,
      { path: "/login", element: <p>Sign in</p> },
      { path: "/404", element: <p>Access denied</p> },
    ],
    { initialEntries: [RENTAL_RESERVATIONS_ROUTE] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>,
  );
}
function setAdapter(hasModule: boolean) {
  const adapter = vi.fn(async (config) => ({
    config,
    data: config.url?.endsWith("/authorization/context")
      ? {
          roles: [],
          actions: [],
          modules: hasModule
            ? [
                {
                  module_group_key: "tools",
                  translates: [],
                  modules: [
                    {
                      key: "rental_reservations",
                      link: RENTAL_RESERVATIONS_ROUTE,
                      translates: [],
                    },
                  ],
                },
              ]
            : [],
        }
      : {
          data: [],
          meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
        },
    status: 200,
    statusText: "OK",
    headers: {},
  }));
  mainInstance.defaults.adapter = adapter;
  return adapter;
}
beforeEach(() => {
  queryClient.clear();
  useAuthStore.getState().logout();
});
afterEach(() => {
  queryClient.clear();
  useAuthStore.getState().logout();
  mainInstance.defaults.adapter = originalAdapter;
});
describe("rental reservations route", () => {
  it("uses the same translated route constant in the module catalog", async () => {
    const option = APP_AVAILABLE_ROUTES.find(
      (route) => route.value === RENTAL_RESERVATIONS_ROUTE,
    );
    expect(option?.labelKey).toBe("modules:routes.rental_reservations");
    expect(i18n.t(option!.labelKey)).toBe("Reservas");
    await i18n.changeLanguage("en");
    expect(i18n.t(option!.labelKey)).toBe("Reservations");
  });
  it("redirects anonymous visitors without financial or authorization requests", async () => {
    const adapter = setAdapter(true);
    openRoute();
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(adapter).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "honors module assignment before fetching finance data: %s",
    async (hasModule) => {
      useAuthStore.getState().login({
        token: "fixture",
        expiresAt: Date.now() + 900000,
        user: { id: "1", name: "Fixture" },
      });
      const adapter = setAdapter(hasModule);
      openRoute();
      expect(
        await screen.findByText(
          hasModule ? "Private rental page" : "Access denied",
        ),
      ).toBeInTheDocument();
      if (hasModule) await screen.findByText("Private rental page");
      const urls = adapter.mock.calls.map(([config]) => config.url);
      expect(urls[0]).toContain("/authorization/context");
      expect(urls.some((url) => url?.includes("/rental/properties"))).toBe(
        hasModule,
      );
    },
  );
});
