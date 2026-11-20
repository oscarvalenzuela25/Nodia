import { Outlet } from "react-router";
import AuthSessionProvider from "../providers/AuthSessionProvider";

export default function SessionRouteLayout() {
  return (
    <AuthSessionProvider>
      <Outlet />
    </AuthSessionProvider>
  );
}
