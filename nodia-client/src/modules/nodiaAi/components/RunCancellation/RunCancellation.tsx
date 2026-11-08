import { Alert, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRunCancellation } from "../../infrastructure/useRunCancellation";
import type { NodiaAiRun } from "../../infrastructure/types";
import { RunControl } from "./styles";

export default function RunCancellation({ conversationId, run, authorized, readOnly }: { conversationId: string; run: NodiaAiRun; authorized: boolean; readOnly: boolean }) {
  const { t } = useTranslation("nodiaAi");
  const control = useRunCancellation(conversationId, run, authorized, readOnly);
  if (!["queued", "running", "cancel_requested"].includes(run.state) || readOnly) return null;
  if (control.phase === "finished") return <Typography role="status" variant="body2">{t("run_control.already_terminal")}</Typography>;
  const waiting = run.state === "cancel_requested" || control.phase === "accepted";
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
