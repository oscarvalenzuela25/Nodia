import { createBrowserRouter, Navigate } from "react-router";
import Home from "../modules/home/pages/Home/index";
import BaseLayout from "../layouts/BaseLayout";
import Guard from "./Guard";
import NoGuard from "./NoGuard";
import Login from "../modules/auth/pages/Login";
import Register from "../modules/auth/pages/Register";
import NotFound from "../modules/core/pages/NotFound";
import Maintenance from "../modules/core/pages/Maintenance";
import RouteError from "../modules/core/pages/RouteError";

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Guard>
            <BaseLayout>
              <Home />
            </BaseLayout>
          </Guard>
        ),
      },
      {
        path: "login",
        element: (
          <NoGuard>
            <Login />
          </NoGuard>
        ),
      },
      {
        path: "register",
        element: (
          <NoGuard>
            <Register />
          </NoGuard>
        ),
      },
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
