import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import BaseLayout from "../layouts/BaseLayout";
import PublicLayout from "../layouts/PublicLayout";
import NoGuard from "./NoGuard";
import Guard from "./Guard";
import GuardStrict from "./GuardStrict";
import RouteError from "../modules/core/pages/RouteError";
import RouteContent from "./RouteContent";
import { lazyWithRetry } from "./lazyRoute";
import { PERSONAL_FINANCE_ROUTE } from "../modules/finances/constants/routes";
import { RENTAL_RESERVATIONS_ROUTE } from "../modules/rentals/constants/routes";
import { BUSINESS_ROUTE } from "../modules/business/constants/routes";

// Lazy-loaded route pages (Code Splitting per route)
const Home = lazyWithRetry(() => import("../modules/home/pages/Home"));
const RentalReservations = lazyWithRetry(
  () => import("../modules/rentals/pages/RentalReservations"),
);
const PersonalFinance = lazyWithRetry(
  () => import("../modules/finances/pages/PersonalFinance"),
);
const Business = lazyWithRetry(
  () => import("../modules/business/pages/Business"),
);
const BusinessDetail = lazyWithRetry(
  () => import("../modules/business/pages/BusinessDetail"),
);
const Users = lazyWithRetry(
  () => import("../modules/generalSettings/pages/Users"),
);
const Roles = lazyWithRetry(
  () => import("../modules/generalSettings/pages/Roles"),
);
const Actions = lazyWithRetry(
  () => import("../modules/generalSettings/pages/Actions"),
);
const Modules = lazyWithRetry(
  () => import("../modules/generalSettings/pages/Modules"),
);
const AiProviders = lazyWithRetry(
  () => import("../modules/generalSettings/pages/AiProviders"),
);
const Login = lazyWithRetry(() => import("../modules/auth/pages/Login"));
const Maintenance = lazyWithRetry(
  () => import("../modules/core/pages/Maintenance"),
);
const NotFound = lazyWithRetry(() => import("../modules/core/pages/NotFound"));

const renderLazyPage = (children: ReactNode) => (
  <RouteContent>{children}</RouteContent>
);

const renderLazyPublic = (children: ReactNode) => (
  <RouteContent variant="fullscreen">{children}</RouteContent>
);

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteError />,
    children: [
      {
        path: RENTAL_RESERVATIONS_ROUTE,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={RENTAL_RESERVATIONS_ROUTE}>
              {renderLazyPage(<RentalReservations />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: PERSONAL_FINANCE_ROUTE,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={PERSONAL_FINANCE_ROUTE}>
              {renderLazyPage(<PersonalFinance />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        index: true,
        element: (
          <BaseLayout>
            <Guard>{renderLazyPage(<Home />)}</Guard>
          </BaseLayout>
        ),
      },
      {
        path: BUSINESS_ROUTE,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={BUSINESS_ROUTE}>
              {renderLazyPage(<Business />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: `${BUSINESS_ROUTE}/:id`,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={BUSINESS_ROUTE}>
              {renderLazyPage(<BusinessDetail />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "settings/users",
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/settings/users">
              {renderLazyPage(<Users />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "settings/roles",
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/settings/roles">
              {renderLazyPage(<Roles />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "settings/actions",
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/settings/actions">
              {renderLazyPage(<Actions />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "settings/modules",
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/settings/modules">
              {renderLazyPage(<Modules />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "settings/ai-providers",
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/settings/ai-providers">
              {renderLazyPage(<AiProviders />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: "login",
        element: (
          <NoGuard>
            <PublicLayout>{renderLazyPublic(<Login />)}</PublicLayout>
          </NoGuard>
        ),
      },
      {
        path: "maintenance",
        element: (
          <PublicLayout>{renderLazyPublic(<Maintenance />)}</PublicLayout>
        ),
      },
      {
        path: "404",
        element: <PublicLayout>{renderLazyPublic(<NotFound />)}</PublicLayout>,
      },
      {
        path: "*",
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);

export default router;
