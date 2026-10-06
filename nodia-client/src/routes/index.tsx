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

// Lazy-loaded route pages (Code Splitting per route)
const Home = lazyWithRetry(() => import("../modules/home/pages/Home"));
const RentalReservations=lazyWithRetry(()=>import("../modules/rentals/pages/RentalReservations"));
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
  <RouteContent variant="fullscreen">
    {children}
  </RouteContent>
);

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteError />,
    children: [
      {
        path: RENTAL_RESERVATIONS_ROUTE,
        element: <GuardStrict modulePath={RENTAL_RESERVATIONS_ROUTE}><BaseLayout>{renderLazyPage(<RentalReservations/>)}</BaseLayout></GuardStrict>,
      },
      {
        path: PERSONAL_FINANCE_ROUTE,
        element: (
          <GuardStrict modulePath={PERSONAL_FINANCE_ROUTE}>
            <BaseLayout>{renderLazyPage(<PersonalFinance />)}</BaseLayout>
          </GuardStrict>
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
        path: "business",
        element: (
          <GuardStrict modulePath="/business">
            <BaseLayout>{renderLazyPage(<Business />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "business/:id",
        element: (
          <GuardStrict modulePath="/business">
            <BaseLayout>{renderLazyPage(<BusinessDetail />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/users",
        element: (
          <GuardStrict modulePath="/settings/users">
            <BaseLayout>{renderLazyPage(<Users />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/roles",
        element: (
          <GuardStrict modulePath="/settings/roles">
            <BaseLayout>{renderLazyPage(<Roles />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/actions",
        element: (
          <GuardStrict modulePath="/settings/actions">
            <BaseLayout>{renderLazyPage(<Actions />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/modules",
        element: (
          <GuardStrict modulePath="/settings/modules">
            <BaseLayout>{renderLazyPage(<Modules />)}</BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/ai-providers",
        element: (
          <GuardStrict modulePath="/settings/ai-providers">
            <BaseLayout>{renderLazyPage(<AiProviders />)}</BaseLayout>
          </GuardStrict>
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
