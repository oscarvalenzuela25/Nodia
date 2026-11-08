import type { PropsWithChildren } from "react";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import useRetainedSessionView from "../providers/hooks/useRetainedSessionView";
import { useAuthorizationContext } from "../services/authorizationService";
import { canAccessModule } from "../store/generalSettings/helpers";
import { GuardNotice } from "./styles";

type Props = PropsWithChildren<{ modulePath: string }>;

export default function GuardStrict({ children, modulePath }: Props) {
  const { isDemo, canMount, actorScope, isSessionActive, isRefreshing } = useRetainedSessionView();
  const { t } = useTranslation(["auth", "core"]);
  const context = useAuthorizationContext({ enabled: isSessionActive && Boolean(actorScope) });
  const isBusy = !isSessionActive || context.isFetching;
  // A retry without cached data resets query status to pending; retain its notice.
  const hasContextError =
    context.isError ||
    (!context.data && context.isFetching && context.errorUpdatedAt > 0);

  if (isDemo) return <Navigate to="/login" replace />;
  if (!canMount)
    return <LinearProgress aria-label={t("auth:session_restoring")} />;

  const error = hasContextError && (
    <GuardNotice
      severity="error"
      action={
        <Button
          color="inherit"
          disabled={isBusy}
          onClick={() => {
            void context.refetch();
          }}
        >
          {t("core:retry")}
        </Button>
      }
    >
      {t("core:auth_context_error_message")}
    </GuardNotice>
  );

  if (!context.data) {
    if (hasContextError) return error;
    return (
      <Box role="status" aria-label={t("auth:checking_module")}>
        <Typography sx={{ mb: 2 }}>{t("auth:checking_module")}</Typography>
        <Skeleton loading={context.isLoading}>
          <Box sx={{ height: 96, bgcolor: "action.hover", borderRadius: 1 }} />
        </Skeleton>
      </Box>
    );
  }

  if (!canAccessModule(context.data, modulePath))
    return <Navigate to="/" replace />;

  // Keep the authorized view mounted during refresh, with its controls disabled.
  return (
    <Box aria-busy={isBusy}>
      {(context.isFetching || isRefreshing) && <LinearProgress />}
      {error}
      <Box key={actorScope} inert={isBusy || context.isError}>{children}</Box>
    </Box>
  );
}
