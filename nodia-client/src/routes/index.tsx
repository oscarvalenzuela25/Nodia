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
import { NODIA_AI_ROUTE } from "../modules/nodiaAi/constants/routes";
import { NODIA_TEACHER_ROUTE, TEACHER_NEW_ROUTE, TEACHER_SESSION_ROUTE } from "../modules/teacher/constants/routes";
import { ADMIN_ROUTES, LEGACY_MODULE_DESTINATIONS } from "./moduleDestinations";
import LegacyModuleRedirect from "./LegacyModuleRedirect";

// Lazy-loaded route pages (Code Splitting per route)
const Home = lazyWithRetry(() => import("../modules/home/pages/Home"));
const NodiaAI = lazyWithRetry(() => import("../modules/nodiaAi/pages/NodiaAI"));
const Teacher = lazyWithRetry(() => import("../modules/teacher/pages/Teacher"));
const TeacherNew = lazyWithRetry(() => import("../modules/teacher/pages/TeacherNew"));
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
      ...Object.entries(LEGACY_MODULE_DESTINATIONS).map(([path, destination]) => ({
        path,
        element: <LegacyModuleRedirect destination={destination} />,
      })),
      {
        path: "/tools/business/:id",
        element: <LegacyModuleRedirect destination={BUSINESS_ROUTE} />,
      },
      ...[NODIA_TEACHER_ROUTE, TEACHER_SESSION_ROUTE].map(path => ({
        path,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={NODIA_TEACHER_ROUTE}>
              {renderLazyPage(<Teacher />)}
            </GuardStrict>
          </BaseLayout>
        ),
      })),
      {
        path: TEACHER_NEW_ROUTE,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={NODIA_TEACHER_ROUTE}>
              {renderLazyPage(<TeacherNew />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: NODIA_AI_ROUTE,
        element: (
          <BaseLayout>
            <GuardStrict modulePath={NODIA_AI_ROUTE}>
              {renderLazyPage(<NodiaAI />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
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
        path: ADMIN_ROUTES.users,
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/users">
              {renderLazyPage(<Users />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: ADMIN_ROUTES.roles,
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/roles">
              {renderLazyPage(<Roles />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: ADMIN_ROUTES.actions,
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/actions">
              {renderLazyPage(<Actions />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: ADMIN_ROUTES.modules,
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/modules">
              {renderLazyPage(<Modules />)}
            </GuardStrict>
          </BaseLayout>
        ),
      },
      {
        path: ADMIN_ROUTES.aiProviders,
        element: (
          <BaseLayout>
            <GuardStrict modulePath="/ai-providers">
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
