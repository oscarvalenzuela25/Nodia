import { Outlet } from "react-router";
import AuthSessionProvider from "../providers/AuthSessionProvider";
import ConnectionNotice from "../pwa/ConnectionNotice";

export default function SessionRouteLayout() {
  return (
    <AuthSessionProvider recoveryNotice={<ConnectionNotice inRecovery />}>
      <Outlet />
    </AuthSessionProvider>
  );
}
