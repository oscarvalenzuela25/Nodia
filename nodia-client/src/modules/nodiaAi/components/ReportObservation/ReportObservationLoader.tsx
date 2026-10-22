import { useEffect, useState, type ComponentType } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { notifyHttpError } from "../../../../config/httpFeedback";
import type { NodiaAiToolResultRef } from "../../infrastructure/types";
import { loadReportObservation } from "./loadReportObservation";

/** Load the analytical panel only after opening a report. Chunk failures recover locally. */
export default function ReportObservationLoader({ resultRef }: { resultRef: NodiaAiToolResultRef }) {
  const { t } = useTranslation("nodiaAi");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ Panel?: ComponentType<{ resultRef: NodiaAiToolResultRef }>; failed: boolean }>({ failed: false });
  useEffect(() => {
    let current = true;
    void loadReportObservation().then(module => {
      if (current) setState({ Panel: module.default, failed: false });
    }).catch((error: unknown) => {
      if (current) { setState({ failed: true }); notifyHttpError(error); }
    });
    return () => { current = false; };
  }, [attempt]);
  if (state.Panel) return <state.Panel resultRef={resultRef} />;
  if (state.failed) return <Alert severity="error" action={<Button onClick={() => { setState({ failed: false }); setAttempt(value => value + 1); }}>{t("retry")}</Button>}>{t("reports.load_error")}</Alert>;
  return <Skeleton loading><Typography variant="body2">{t("reports.loading")}</Typography></Skeleton>;
}
