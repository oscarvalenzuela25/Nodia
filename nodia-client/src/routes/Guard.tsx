import type { FC, PropsWithChildren } from "react";
import { Navigate } from "react-router";
import useAuth from "../hooks/useAuth";

type Props = PropsWithChildren;

const Guard: FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default Guard;
