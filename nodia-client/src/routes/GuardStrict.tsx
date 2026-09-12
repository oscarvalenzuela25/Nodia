import type { PropsWithChildren } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../hooks/useAuth";
import { useAuthorizationContext } from "../services/authorizationService";
import { hasModuleAccess } from "../store/generalSettings/helpers";

type Props = PropsWithChildren<{ modulePath: string }>;

export default function GuardStrict({ children, modulePath }: Props) {
  const { isDemo, isSessionValid, isSessionActive, isRefreshing } = useAuth();
  const { t } = useTranslation(["auth", "core"]);
  const context = useAuthorizationContext({ enabled: isSessionActive });
  const isBusy = !isSessionActive || context.isFetching;

  if (isDemo) return <Navigate to="/login" replace />;
  if (!isSessionValid) return <LinearProgress aria-label={t("auth:session_restoring")} />;

  const error = context.isError && (
    <Alert severity="error" sx={{ m: 3 }} action={
      <Button color="inherit" disabled={isBusy} onClick={() => { void context.refetch(); }}>
        {t("core:retry")}
      </Button>
    }>
      {t("core:auth_context_error_message")}
    </Alert>
  );

  if (!context.data) {
    if (context.isError) return error;
    return (
      <Box sx={{ p: 3 }} role="status" aria-label={t("auth:checking_module")}>
        <Typography sx={{ mb: 2 }}>{t("auth:checking_module")}</Typography>
        <Skeleton loading={context.isLoading}>
          <Box sx={{ height: 96, bgcolor: "action.hover", borderRadius: 1 }} />
        </Skeleton>
      </Box>
    );
  }

  if (!hasModuleAccess(context.data.modules, modulePath)) return <Navigate to="/404" replace />;

  // Keep the authorized view mounted during refresh, with its controls disabled.
  return (
    <Box aria-busy={isBusy}>
      {(context.isFetching || isRefreshing) && <LinearProgress sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: "tooltip" }} />}
      {error}
      <Box inert={isBusy || context.isError}>{children}</Box>
    </Box>
  );
}
