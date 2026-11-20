import type { PropsWithChildren } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { restoreSession } from "../config/api";
import { useSignOut } from "../modules/auth/infrastructure/useServices";
import useSessionLifecycle from "./hooks/useSessionLifecycle";
import useRetainedSessionView from "./hooks/useRetainedSessionView";

export default function AuthSessionProvider({ children }: PropsWithChildren) {
  useSessionLifecycle();
  const { sessionStatus, isDemo, isSessionActive, isSessionValid, canMount, actorScope } = useRetainedSessionView();
  const { t } = useTranslation("auth");
  const signOut = useSignOut();

  const needsRecovery = !isDemo && (!isSessionValid || !actorScope);
  return <>
    {needsRecovery && (
      <Box sx={{ maxWidth: 480, mx: "auto", p: 3, mt: 8 }}>
        {sessionStatus !== "unavailable" ? (
          <Stack spacing={2} role="status">
            <Typography>{t("auth:session_restoring")}</Typography>
            <LinearProgress aria-label={t("auth:session_restoring")} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="error">{t("auth:session_unavailable")}</Alert>
            <Button variant="contained" disabled={signOut.isPending}
              onClick={() => {
                void restoreSession()
                  .then(() => { sileo.success({ title: t("auth:session_restored") }); })
                  .catch(() => undefined);
              }}>
              {t("auth:session_retry")}
            </Button>
            <Button loading={signOut.isPending} onClick={() => signOut.mutate()}>
              {t("auth:logout")}
            </Button>
          </Stack>
        )}
      </Box>
    )}
    {(isDemo || canMount) && <Box key={actorScope ?? "public"} inert={!isDemo && !isSessionActive} sx={{ display: "contents" }}>{children}</Box>}
  </>;
}
