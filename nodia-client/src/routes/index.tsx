import { createBrowserRouter, Navigate } from "react-router";
import Home from "../modules/home/pages/Home/index";
import BaseLayout from "../layouts/BaseLayout";
import PublicLayout from "../layouts/PublicLayout";
import NoGuard from "./NoGuard";
import Guard from "./Guard";
import GuardStrict from "./GuardStrict";
import Login from "../modules/auth/pages/Login";
// import Register from "../modules/auth/pages/Register";
import NotFound from "../modules/core/pages/NotFound";
import Maintenance from "../modules/core/pages/Maintenance";
import RouteError from "../modules/core/pages/RouteError";
import Users from "../modules/generalSettings/pages/Users";
import Roles from "../modules/generalSettings/pages/Roles";
import Actions from "../modules/generalSettings/pages/Actions";
import Modules from "../modules/generalSettings/pages/Modules";

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <BaseLayout>
            <Guard>
              <Home />
            </Guard>
          </BaseLayout>
        ),
      },
      {
        path: "settings/users",
        element: (
          <GuardStrict modulePath="/settings/users">
            <BaseLayout>
              <Users />
            </BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/roles",
        element: (
          <GuardStrict modulePath="/settings/roles">
            <BaseLayout>
              <Roles />
            </BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/actions",
        element: (
          <GuardStrict modulePath="/settings/actions">
            <BaseLayout>
              <Actions />
            </BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "settings/modules",
        element: (
          <GuardStrict modulePath="/settings/modules">
            <BaseLayout>
              <Modules />
            </BaseLayout>
          </GuardStrict>
        ),
      },
      {
        path: "login",
        element: (
          <NoGuard>
            <PublicLayout>
              <Login />
            </PublicLayout>
          </NoGuard>
        ),
      },
      // {
      //   path: "register",
      //   element: (
      //     // <NoGuard>
      //     //   <PublicLayout>
      //     //     <Register />
      //     //   </PublicLayout>
      //     // </NoGuard>
      //     <PublicLayout>
      //       <Register />
      //     </PublicLayout>
      //   ),
      // },
      {
        path: "maintenance",
        element: (
          <PublicLayout>
            <Maintenance />
          </PublicLayout>
        ),
      },
      {
        path: "404",
        element: (
          <PublicLayout>
            <NotFound />
          </PublicLayout>
        ),
      },
      {
        path: "*",
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);

export default router;
