import type { FC, PropsWithChildren } from "react";
import { Box, LinearProgress } from "@mui/material";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../hooks/useAuth";

type Props = PropsWithChildren<{ requireSession?: boolean }>;

const Guard: FC<Props> = ({ children, requireSession = false }) => {
  const { isSessionValid, isDemo } = useAuth();
  const { t } = useTranslation("auth");

  if (requireSession && isDemo) return <Navigate to="/login" replace />;

  if (!isDemo && !isSessionValid) {
    return <LinearProgress aria-label={t("auth:session_restoring")} />;
  }

  return <Box>{children}</Box>;
};

export default Guard;
