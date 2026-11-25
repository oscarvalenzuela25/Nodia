import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import { retryConnection, useConnectionStatus } from "./useConnectionStatus";

type Props = {
  inDialog?: boolean;
  inRecovery?: boolean;
  allowRetry?: boolean;
};

export default function ConnectionNotice({ inDialog = false, inRecovery = false, allowRetry = true }: Props) {
  const { t } = useTranslation("core");
  const { status, checking } = useConnectionStatus();
  const offline = status === "offline";
  const title = t(offline ? "connection_offline_title" : "connection_server_title");
  const description = t(offline ? "connection_offline_description" : "connection_server_description");

  return (
    <>
      <Box component="span" aria-live="polite" aria-atomic="true" sx={visuallyHidden}>
        {status !== "available" ? `${title}. ${description}` : ""}
      </Box>
      {status !== "available" && (
        <Alert data-connection-notice severity={offline ? "warning" : "error"} role="none" sx={{
          ...(inDialog || inRecovery ? { mb: 2 } : { mx: { xs: 2, sm: 3, md: 4 }, mt: 2 }),
          flexShrink: 0,
          minWidth: 0,
          "& .MuiAlert-icon": { flexShrink: 0 },
          "& .MuiAlert-message": { width: "100%", minWidth: 0 },
        }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{
            gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between",
          }}>
            <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{title}</strong><div>{description}</div></Box>
            {allowRetry && (
              <Button variant="outlined" loading={checking} sx={{ minHeight: 44, flexShrink: 0 }}
                onClick={() => { void retryConnection(); }}>
                {t("connection_retry")}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
    </>
  );
}
