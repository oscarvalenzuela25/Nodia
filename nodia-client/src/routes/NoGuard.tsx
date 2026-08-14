import type { FC, PropsWithChildren } from "react";
import { Navigate } from "react-router";
import useAuth from "../hooks/useAuth";

type Props = PropsWithChildren;

const NoGuard: FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default NoGuard;
