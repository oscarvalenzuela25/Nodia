import EnrichmentPaging from "./EnrichmentPaging";
import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { threadSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import LessonMarkdown from "../LessonMarkdown";
import JobPanel from "../JobPanel";
import PanelState from "./PanelState";
import { useEnrichment } from "./useEnrichment";
import type { AdaptivePanelProps } from "./types";

export type ClarificationAnchor = { content_version_id: string; block_id: string; selection: string };
export default function ClarificationPanel(props: AdaptivePanelProps & { anchor?: ClarificationAnchor }) {
  const { t } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const message = threadId ? drafts[threadId] ?? "" : "";
  const setMessage = (text: string) => { if (threadId) setDrafts(current => ({ ...current, [threadId]: text })); };
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobPending, setJobPending] = useState(false);
  const thread = useTeacherQuery(`sessions/${props.session.id}/enrichment/threads/${threadId}`, threadSchema, undefined, props.visible && Boolean(threadId));
  const finalActive = props.session.active_attempts.some(attempt => attempt.scope === "section_final" && attempt.state === "in_progress");
  const locked = disabled || finalActive || thread.isFetching || jobPending;
  return <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    {finalActive && <Alert severity="info">{t("teacher:adaptive.helper_final_blocked")}</Alert>}
    <Alert severity="info">{t("teacher:adaptive.helper_notice")}</Alert>
    {query.data && <Stack sx={{ gap: 2 }}>
      {props.anchor && <><Typography component="blockquote" sx={{ m: 0, borderLeft: 2, borderColor: "divider", pl: 2 }}>{props.anchor.selection}</Typography><Button variant="outlined" disabled={locked} onClick={async () => { const result = await execute("thread_create", props.anchor!); if (result?.resource_id) setThreadId(result.resource_id); }}>{t("teacher:adaptive.open_clarification")}</Button></>}
      {!query.data.threads.length && <Typography color="text.secondary">{t("teacher:adaptive.no_clarifications")}</Typography>}
      {query.data.threads.map(item => <Button key={item.id} variant={threadId === item.id ? "contained" : "outlined"} disabled={readDisabled || thread.isFetching} onClick={() => { setThreadId(item.id); setJobId(null); setJobPending(false); }}>{item.selection}</Button>)}
      {threadId && <PanelState loading={thread.isLoading && !thread.data} fetching={thread.isFetching} error={thread.isError} retry={thread.refetch}>{thread.data && <Stack sx={{ gap: 2 }}>
        <Typography component="blockquote" sx={{ m: 0, borderLeft: 2, borderColor: "divider", pl: 2 }}>{thread.data.thread.selection}</Typography>
        {thread.data.messages.map(item => <Stack key={item.id}><Typography variant="caption">{t(item.role === "user" ? "teacher:adaptive.you" : "teacher:product")}</Typography><LessonMarkdown text={item.text} /></Stack>)}
        <TextInput label={t("teacher:adaptive.clarification_question")} value={message} multiline disabled={locked} onChange={event => setMessage(event.target.value)} />
        <Button variant="contained" disabled={locked || !message.trim() || message.length > 2000} onClick={async () => { const result = await execute("thread_message", { thread_id: threadId, text: message }); if (result) { setMessage(""); if (result.job_id) { setJobId(result.job_id); setJobPending(true); } } }}>{t("teacher:send_message")}</Button>
      </Stack>}</PanelState>}
      {jobId && <JobPanel allowNew={false} jobId={jobId} paused={props.session.state === "paused"} busy={props.busy} onReady={() => { setJobPending(false); void thread.refetch(); }} onTerminal={() => { setJobPending(false); void thread.refetch(); }} onContinue={async job => { const result = await props.command.execute(`jobs/${job.job_id}/continue-before-dispatch`, { expected_session_revision: props.session.revision, expected_job_fence: job.fence }); if (result) props.onResult(result); }} onNew={async () => { /* Unknown is preserved; a new question is an explicit new intent. */ }} />}
    </Stack>}
    {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />}
  </PanelState>;
}
