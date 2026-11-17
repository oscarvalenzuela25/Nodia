import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, LinearProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { learningSchema } from "../../infrastructure/learningSchemas";
import { enabled } from "../../infrastructure/presentation";
import type { Session } from "../../infrastructure/schemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import TeacherLoading from "../TeacherLoading";
import { Content, DiagnosticButton } from "./styles";

type Props = {
  session: Session;
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onStart: () => Promise<boolean>;
  recovery?: ReactNode;
};

export default function DiagnosticEntry({ session, open, onClose, busy, onStart, recovery }: Props) {
  const { t } = useTranslation();
  const query = useTeacherQuery(`sessions/${session.id}/learning`, learningSchema, undefined, open);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const activeAttempt = session.active_attempts.some(attempt => attempt.scope === "diagnostic");
  const bank = query.data?.diagnostic_blueprint;
  const allowed = enabled(session.allowed_actions, "start_diagnostic")
    && (activeAttempt || (!query.isError && bank?.reviewed === true));
  const disabled = busy || submitting || query.isLoading || query.isFetching;
  const close = () => { if (!busy && !inFlight.current) onClose(); };
  const start = async () => {
    if (!open || disabled || !allowed || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      if (await onStart()) onClose();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return <BaseModal open={open} title={t("teacher:diagnostic")} onClose={close} actions={<>
    <DiagnosticButton variant="outlined" disabled={busy || submitting} onClick={close}>{t("core:close")}</DiagnosticButton>
    <DiagnosticButton variant="contained" disabled={disabled || !allowed} onClick={() => void start()}>{t(activeAttempt ? "teacher:resume_diagnostic" : "teacher:diagnostic")}</DiagnosticButton>
  </>}>
    <Content>
      {recovery}
      <Alert severity="info">{t("teacher:diagnostic_optional_notice")}</Alert>
      <QueryErrorAlert retryVariant="outlined" isError={query.isError} isFetching={query.isFetching} onRetry={query.refetch} />
      {query.isFetching && query.data && <LinearProgress />}
      <TeacherLoading loading={query.isLoading && !query.data}>
        {bank ? <Content><Typography sx={{ fontWeight: 600 }}>{bank.title}</Typography><Typography color="text.secondary">{t(bank.reviewed ? "teacher:adaptive.bank_reviewed" : "teacher:adaptive.bank_candidate")}</Typography></Content>
          : query.data && <Typography color="text.secondary">{t("teacher:adaptive.no_bank")}</Typography>}
      </TeacherLoading>
    </Content>
  </BaseModal>;
}
