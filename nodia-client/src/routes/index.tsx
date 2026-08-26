import { createBrowserRouter, Navigate } from "react-router";
import Home from "../modules/home/pages/Home/index";
import BaseLayout from "../layouts/BaseLayout";
// import NoGuard from "./NoGuard";
import Login from "../modules/auth/pages/Login";
// import Register from "../modules/auth/pages/Register";
import NotFound from "../modules/core/pages/NotFound";
import Maintenance from "../modules/core/pages/Maintenance";
import RouteError from "../modules/core/pages/RouteError";
import Users from "../modules/generalSettings/pages/Users";
import Roles from "../modules/generalSettings/pages/Roles";
import Modules from "../modules/generalSettings/pages/Modules";
import Resources from "../modules/generalSettings/pages/Resources";

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <BaseLayout>
            <Home />
          </BaseLayout>
        ),
      },
      {
        path: "settings/users",
        element: (
          <BaseLayout>
            <Users />
          </BaseLayout>
        ),
      },
      {
        path: "settings/roles",
        element: (
          <BaseLayout>
            <Roles />
          </BaseLayout>
        ),
      },
      {
        path: "settings/modules",
        element: (
          <BaseLayout>
            <Modules />
          </BaseLayout>
        ),
      },
      {
        path: "settings/resources",
        element: (
          <BaseLayout>
            <Resources />
          </BaseLayout>
        ),
      },
      {
        path: "login",
        element: (
          // <NoGuard>
          //   <Login />
          // </NoGuard>
          <Login />
        ),
      },
      // {
      //   path: "register",
      //   element: (
      //     <NoGuard>
      //       <Register />
      //     </NoGuard>
      //   ),
      // },
      {
        path: "maintenance",
        element: <Maintenance />,
      },
      {
        path: "404",
        element: <NotFound />,
      },
      {
        path: "*",
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);

export default router;
