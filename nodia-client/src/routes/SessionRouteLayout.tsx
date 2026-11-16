import { Outlet, useLocation } from "react-router";
import AuthSessionProvider from "../providers/AuthSessionProvider";
import { NEWS_ROUTE } from "../modules/news/constants/routes";

/** Session lifecycle remains singular; only News admits public recovery. */
export default function SessionRouteLayout() {
  const { pathname } = useLocation();
  return <AuthSessionProvider allowPublic={pathname.replace(/\/+$/, "") === NEWS_ROUTE}>
    <Outlet />
  </AuthSessionProvider>;
}
