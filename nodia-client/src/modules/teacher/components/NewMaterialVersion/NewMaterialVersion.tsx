import { useEffect, useRef, useState } from "react";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import RequestRecovery from "../RequestRecovery";
import type { CommandResult } from "../../infrastructure/schemas";
import type { useTeacherCommand } from "../../infrastructure/useServices";
import { GenerateButton } from "./styles";

type Props = {
  sessionId: string;
  planRevisionId: string;
  unitId: string;
  contentVersionId: string;
  sessionRevision: number;
  busy: boolean;
  command: ReturnType<typeof useTeacherCommand>;
  onQueued: (result: CommandResult) => void;
};
type Intent = { path: string; body: { plan_revision_id: string; expected_session_revision: number; variant: "new" } };

function VersionConfirmation({ sessionId, planRevisionId, unitId, sessionRevision, busy, command, onQueued }: Props) {
  const { t } = useTranslation();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pending = submitting || command.isPending;
  const stale = Boolean(intent && intent.body.expected_session_revision !== sessionRevision);
  const blocked = busy || command.blocked || pending;
  const queued = (result: CommandResult) => {
    if (!mounted.current) return;
    onQueued(result);
    setIntent(null);
  };
  const confirm = async () => {
    if (!intent || blocked || stale || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await command.execute(intent.path, intent.body);
      if (result) queued(result);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };
  return <>
    <GenerateButton variant="outlined" disabled={blocked} onClick={() => setIntent({ path: `sessions/${sessionId}/units/${unitId}/material`, body: { plan_revision_id: planRevisionId, expected_session_revision: sessionRevision, variant: "new" } })}>{t("teacher:new_material_version")}</GenerateButton>
    <ConfirmDialog open={Boolean(intent)} onClose={() => { if (!busy && !pending) setIntent(null); }} title={t("teacher:new_material_version")} message={t("teacher:new_material_version_confirm")} confirmText={t("teacher:new_material_version")} isLoading={busy || pending} confirmDisabled={command.blocked || stale} onConfirm={confirm}>
      {stale && !command.uncertain && <Alert severity="warning">{t("teacher:material_version_context_changed")}</Alert>}
      <RequestRecovery command={command} onRecovered={queued} />
    </ConfirmDialog>
  </>;
}

export default function NewMaterialVersion(props: Props) {
  return <VersionConfirmation key={`${props.sessionId}:${props.planRevisionId}:${props.unitId}:${props.contentVersionId}`} {...props} />;
}
