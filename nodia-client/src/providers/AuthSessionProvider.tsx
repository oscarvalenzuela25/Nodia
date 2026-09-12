import type { PropsWithChildren } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { restoreSession } from "../config/api";
import { useSignOut } from "../modules/auth/infrastructure/useServices";
import useSessionLifecycle from "./hooks/useSessionLifecycle";

export default function AuthSessionProvider({ children }: PropsWithChildren) {
  const { sessionStatus } = useSessionLifecycle();
  const { t } = useTranslation("auth");
  const signOut = useSignOut();

  if (sessionStatus === "restoring" || sessionStatus === "unavailable") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", p: 3, mt: 8 }}>
        {sessionStatus === "restoring" ? (
          <Stack spacing={2} role="status">
            <Typography>{t("auth:session_restoring")}</Typography>
            <LinearProgress aria-label={t("auth:session_restoring")} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="error">{t("auth:session_unavailable")}</Alert>
            <Button variant="contained" disabled={signOut.isPending}
              onClick={() => { void restoreSession().catch(() => undefined); }}>
              {t("auth:session_retry")}
            </Button>
            <Button loading={signOut.isPending} onClick={() => signOut.mutate()}>
              {t("auth:logout")}
            </Button>
          </Stack>
        )}
      </Box>
    );
  }

  return children;
}
