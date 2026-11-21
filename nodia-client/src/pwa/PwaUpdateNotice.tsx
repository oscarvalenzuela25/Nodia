import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { usePwaUpdate } from "./usePwaUpdate";

export default function PwaUpdateNotice() {
  const { t } = useTranslation();
  const { available, state, postpone, apply } = usePwaUpdate();

  if (!available) return null;

  return (
    <Alert severity={state === "error" ? "warning" : "info"} role="status" sx={{
      mx: { xs: 2, sm: 3, md: 4 }, mt: 2, flexShrink: 0,
      "& .MuiAlert-message": { width: "100%", minWidth: 0 },
    }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
        <span>{t(state === "error" ? "core:pwa_update_error" : state === "keep-tab" ? "core:pwa_update_keep_tab" : "core:pwa_update_available")}</span>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexShrink: 0 }}>
          {state === "keep-tab" ? (
            <Button component="a" href={window.location.href} target="_blank" rel="noopener" variant="contained" sx={{ minHeight: 44 }}>
              {t("core:pwa_update_new_tab")}
            </Button>
          ) : (
            <Button variant="contained" onClick={apply} loading={state === "applying"} sx={{ minHeight: 44 }}>
              {t("core:pwa_update_apply")}
            </Button>
          )}
          <Button variant="outlined" onClick={postpone} disabled={state === "applying"} sx={{ minHeight: 44 }}>
            {t("core:pwa_update_later")}
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
