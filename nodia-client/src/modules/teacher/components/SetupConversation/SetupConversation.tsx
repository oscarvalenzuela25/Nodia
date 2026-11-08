import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, IconButton, Pagination, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import TeacherLoading from "../TeacherLoading";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import MessageComposer from "../../../../components/MessageComposer";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import type { useSetupDraft } from "../../hooks/useSetupDraft";
import type { useTeacherMessages } from "../../infrastructure/useServices";
import { Bubble, ConversationHeader, History, MessageAvatar, MessageRow } from "./styles";

type Props = {
  messages: Pick<ReturnType<typeof useTeacherMessages>, "data" | "isLoading" | "isFetching" | "isError"> & { refetch: () => unknown };
  draft: Pick<ReturnType<typeof useSetupDraft>, "text" | "saving" | "dirty" | "valid" | "status" | "conflict" | "remoteText" | "change" | "save">;
  scopeKey: string;
  contextKey: string;
  footer?: ReactNode;
  jobStatus?: ReactNode;
  showConversation?: boolean;
  page: number;
  busy: boolean;
  generating?: boolean;
  hasSelection: boolean;
  canPropose: boolean;
  onPage: (page: number) => void;
  onSend: () => void;
  onPropose: () => Promise<boolean>;
  onRecordingChange?: (recording: boolean) => void;
};

export default function SetupConversation({ messages, draft, scopeKey, contextKey, footer, jobStatus, showConversation = true, page, busy, generating = false, hasSelection, canPropose, onPage, onSend, onPropose, onRecordingChange }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [recording, setRecording] = useState(false);
  const proposalFlight = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const reportRecording = useCallback((value: boolean) => { setRecording(value); onRecordingChange?.(value); }, [onRecordingChange]);
  const disabled = busy || messages.isFetching || draft.saving || proposing;
  const unsent = Boolean(draft.text.trim());
  const sendDisabled = disabled || draft.conflict || !draft.valid || !unsent || !hasSelection || generating || recording || messages.isError;
  const proposeDisabled = disabled || draft.conflict || !draft.valid || !canPropose || !hasSelection || unsent || generating || recording || messages.isError || messages.isLoading;
  const snapshot = JSON.stringify([scopeKey, contextKey, page, draft.text, messages.data?.data.map(item => item.id)]);
  const staleConfirmation = confirmation !== null && confirmation !== snapshot;
  useEffect(() => {
    const element = history.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [messages.data, page]);
  const confirm = async () => {
    if (proposalFlight.current || proposeDisabled || staleConfirmation || confirmation === null) return;
    proposalFlight.current = true; setProposing(true);
    try { if (await onPropose()) setConfirmation(null); }
    finally { proposalFlight.current = false; setProposing(false); }
  };
  const help = <Stack sx={{ gap: 1 }}>{["setup_autosave_help", "setup_send_help", "setup_propose_help"].map(key => <span key={key}>{t(`teacher:${key}`)}</span>)}</Stack>;
  return <Stack sx={{ minWidth: 0 }}>
    {showConversation && <ConversationHeader>
      <Typography variant="h6" component="h2" sx={{ fontSize: 22, fontWeight: 700 }}>{t("teacher:define_plan")}</Typography>
      <Tooltip title={help} describeChild><span tabIndex={proposeDisabled ? 0 : undefined}><Button variant="contained" endIcon={<InfoOutlined />} disabled={proposeDisabled} onClick={() => setConfirmation(snapshot)}>{t("teacher:propose_plan")}</Button></span></Tooltip>
    </ConversationHeader>}
    {jobStatus && <Box sx={{ px: showConversation ? { xs: 2, sm: 3 } : 0, pb: showConversation ? 2 : 0 }}>{jobStatus}</Box>}
    {showConversation && <>
    <Box sx={{ px: { xs: 2, sm: 3 } }}><QueryErrorAlert retryVariant="outlined" isError={messages.isError} isFetching={messages.isFetching} onRetry={messages.refetch} /></Box>
    <History ref={history} role="log" aria-label={t("teacher:planning_conversation")} aria-live="polite" aria-relevant="additions text" onScroll={event => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }}>
      <TeacherLoading loading={messages.isLoading && !messages.data}>
        {!messages.isError && !messages.isLoading && !messages.data?.data.length && <Typography color="text.secondary">{t("teacher:chat_empty")}</Typography>}
        {messages.data?.data.map(item => {
          const owner = item.role === "user";
          const author = t(owner ? "teacher:you" : "teacher:product");
          return <MessageRow key={item.id} isOwner={owner} aria-label={author}>
            <MessageAvatar isOwner={owner} aria-hidden="true" src={owner ? user?.image_url ?? undefined : undefined}>{owner ? (user?.name || user?.email || "?").slice(0, 1).toUpperCase() : <SchoolOutlined fontSize="small" />}</MessageAvatar>
            <Bubble isOwner={owner}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: .75 }}>
                <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>{author}</Typography>
                {owner && <Tooltip title={t("teacher:message_saved")}><Box component="span" role="img" aria-label={t("teacher:message_saved")} tabIndex={0} sx={{ display: "inline-flex", color: "success.main", flexShrink: 0, ml: "auto", borderRadius: "50%", "&:focus-visible": { outline: "2px solid", outlineColor: "success.main", outlineOffset: 2 } }}><CheckCircleRounded fontSize="small" /></Box></Tooltip>}
              </Stack>
              <Typography>{item.text}</Typography>
            </Bubble>
          </MessageRow>;
        })}
      </TeacherLoading>
    </History>
    {messages.data && messages.data.meta.total_pages > 1 && <Pagination variant="outlined" sx={{ px: 2, mb: 2 }} page={page} count={messages.data.meta.total_pages} disabled={disabled || confirmation !== null} onChange={(_, value) => { follow.current = true; onPage(value); }} />}
    <MessageComposer scopeKey={scopeKey} text={draft.text} onTextChange={draft.change} onSend={() => { if (!sendDisabled && confirmation === null) onSend(); }}
      maxLength={4000} maxBytes={8192} label={t("teacher:message")} placeholder={t("teacher:message_placeholder")} sendLabel={t("teacher:send_message")} ariaLabel={t("teacher:message")}
      disabled={disabled || confirmation !== null} sendDisabled={sendDisabled} voiceDisabled={disabled || confirmation !== null || generating || draft.conflict}
      onRecordingChange={reportRecording} footer={footer} sx={{ m: { xs: 1, sm: 2 }, mt: 0 }} />
    {(draft.status !== "saved" || !draft.valid || draft.conflict) && <Stack sx={{ px: 2, pb: 1.5, gap: 1 }}>
      {draft.status !== "saved" && <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><Typography role="status" variant="caption" color="text.secondary">{t(`teacher:setup_draft_${draft.status}`)}</Typography>
        {draft.status === "failed" && <Tooltip title={t("teacher:retry_draft_save")}><span><IconButton aria-label={t("teacher:retry_draft_save")} disabled={disabled || recording || !draft.valid || draft.conflict} onClick={() => { void draft.save(); }}><RefreshOutlined fontSize="small" /></IconButton></span></Tooltip>}
      </Stack>}
      {!draft.valid && <Alert severity="error">{t("teacher:invalid_field")}</Alert>}
      {draft.conflict && <Alert severity="warning"><Typography>{t("teacher:setup_draft_conflict")}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{draft.remoteText}</Typography></Alert>}
    </Stack>}
    <ConfirmDialog open={confirmation !== null} onClose={() => setConfirmation(null)} onConfirm={confirm} title={t("teacher:confirm_proposal_title")} message={t("teacher:confirm_proposal_message")} confirmText={t("teacher:propose_plan")} cancelText={t("teacher:keep_planning")} isLoading={proposing} confirmDisabled={proposeDisabled || staleConfirmation}>
      {staleConfirmation && <Alert severity="warning">{t("teacher:proposal_context_changed")}</Alert>}
    </ConfirmDialog>
    </>}
  </Stack>;
}
