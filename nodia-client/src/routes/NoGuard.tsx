import type { FC, PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router";
import useAuth from "../hooks/useAuth";
import { businessReturnPath } from "./businessReturnPath";

type Props = PropsWithChildren;

const NoGuard: FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { state } = useLocation();

  if (isAuthenticated) {
    return <Navigate to={businessReturnPath(state) ?? "/"} replace />;
  }

  return <>{children}</>;
};

export default NoGuard;
