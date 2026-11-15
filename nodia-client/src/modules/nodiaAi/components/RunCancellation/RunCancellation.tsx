import { Alert, Box, Button, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import StopRounded from "@mui/icons-material/StopRounded";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import { useRunCancellation } from "../../infrastructure/useRunCancellation";
import type { NodiaAiRun } from "../../infrastructure/types";
import { RunControl } from "./styles";

export default function RunCancellation({ conversationId, run, authorized, readOnly, compact = false }: { conversationId: string; run: NodiaAiRun; authorized: boolean; readOnly: boolean; compact?: boolean }) {
  const { t } = useTranslation("nodiaAi");
  const control = useRunCancellation(conversationId, run, authorized, readOnly);
  if (!["queued", "running", "cancel_requested"].includes(run.state) || readOnly) return null;
  const waiting = run.state === "cancel_requested" || control.phase === "accepted";
  if (compact) {
    const checking = control.phase === "uncertain" || control.phase === "checking";
    const finished = control.phase === "finished";
    const label = t(finished ? "run_control.already_terminal" : waiting ? "run_control.requested"
      : checking ? "run_control.check" : control.phase === "retry_ready" ? "run_control.retry" : "run_control.stop");
    const notice = control.error ?? (waiting ? t("run_control.waiting") : checking ? t("run_control.uncertain") : null);
    return <Tooltip title={notice ? `${label}. ${notice}` : label}><span>
      <IconButton type="button" aria-label={label} disabled={!control.enabled || control.busy || waiting || finished}
        onClick={() => void (checking ? control.recover() : control.phase === "retry_ready" ? control.retry() : control.request())}
        sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}>
        {control.busy ? <CircularProgress size={20} color="inherit" /> : checking ? <RefreshOutlined /> : <StopRounded />}
      </IconButton>
      {notice && <Box component="span" role="status" aria-live="polite" sx={visuallyHidden}>{notice}</Box>}
    </span></Tooltip>;
  }
  if (control.phase === "finished") return <Typography role="status" variant="body2">{t("run_control.already_terminal")}</Typography>;
  return <RunControl aria-label={t("run_control.title")}>
    {control.error && <Alert severity="error">{control.error}</Alert>}
    {waiting ? <><Typography role="status" variant="body2">{t("run_control.waiting")}</Typography><Button variant="contained" disabled>{t("run_control.requested")}</Button></>
      : control.phase === "uncertain" || control.phase === "checking" ? <>
        <Alert severity="warning">{t("run_control.uncertain")}</Alert>
        <Button variant="contained" loading={control.busy} disabled={!control.enabled || control.busy} onClick={() => void control.recover()}>{t("run_control.check")}</Button>
      </> : <>
        {control.phase === "retry_ready" && <Typography variant="body2">{t("run_control.retry_note")}</Typography>}
        <Button variant="contained" loading={control.busy} disabled={!control.enabled || control.busy} onClick={() => void (control.phase === "retry_ready" ? control.retry() : control.request())}>{t(control.phase === "retry_ready" ? "run_control.retry" : "run_control.stop")}</Button>
      </>}
  </RunControl>;
}
