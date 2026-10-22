import { useEffect, useState, type ComponentType } from "react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { AttachmentPanel } from "./styles";
import { loadAttachments } from "./loadAttachments";
import type { AttachmentPanelProps } from "./types";

export default function AttachmentsLoader(props: AttachmentPanelProps) {
  const { t } = useTranslation("nodiaAi");
  const [intent, setIntent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ Panel?: ComponentType<AttachmentPanelProps>; failed: boolean }>({ failed: false });
  useEffect(() => {
    if (!intent) return;
    let current = true;
    void loadAttachments().then(module => { if (current) setState({ Panel: module.default, failed: false }); }).catch((error: unknown) => { if (current) { setState({ failed: true }); notifyHttpError(error); } });
    return () => { current = false; };
  }, [attempt, intent]);
  if (state.Panel) return <state.Panel {...props} />;
  return <AttachmentPanel>
    {state.failed && <Alert severity="error">{t("attachments.load_error")}</Alert>}
    <Button disabled={props.disabled || (intent && !state.failed)} onClick={() => { setState({ failed: false }); setIntent(true); setAttempt(value => value + 1); }}>{t(state.failed ? "retry" : intent ? "attachments.loading" : "attachments.open")}</Button>
  </AttachmentPanel>;
}
