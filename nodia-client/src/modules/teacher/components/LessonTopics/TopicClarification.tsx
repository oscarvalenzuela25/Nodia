import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, Divider, IconButton, Stack, Typography, useMediaQuery } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TextInput from "../../../../components/inputs/TextInput";
import { clarificationThreadSchema, threadSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import type { z } from "zod";
import type { TeacherCommand } from "../../infrastructure/services";
import type { AdaptivePanelProps } from "../AdaptiveWorkspace/types";
import { DrawerHeader } from "../AdaptiveWorkspace/styles";
import EnrichmentPaging from "../AdaptiveWorkspace/EnrichmentPaging";
import PanelState from "../AdaptiveWorkspace/PanelState";
import { useEnrichment } from "../AdaptiveWorkspace/useEnrichment";
import JobPanel from "../JobPanel";
import LessonMarkdown from "../LessonMarkdown";
import RequestRecovery from "../RequestRecovery";
import { ClarificationSheet, ClarificationSurface, FragmentQuote, TopicActions } from "./styles";

export type TopicClarificationProps = Pick<AdaptivePanelProps, "busy" | "command" | "session"> & {
  open: boolean;
  onClose: () => void;
  anchor: string | null;
  contentVersionId: string;
  blockId: string;
};

type Thread = z.infer<typeof clarificationThreadSchema>;
type TrackedJob = { id: string; threadId: string; pending: boolean };
const ignore = () => undefined;
const fragmentDraft = (selection: string | null) => `fragment:${selection ?? ""}`;
const threadDraft = (id: string) => `thread:${id}`;

export default function TopicClarification({ open, onClose, anchor, contentVersionId, blockId, ...props }: TopicClarificationProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(theme => theme.breakpoints.up("lg"));
  const headingId = useId();
  const composerNoteId = useId();
  const historyId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [showHistory, setShowHistory] = useState(false);
  const [choice, setChoice] = useState<{ anchor: string | null; thread: Thread } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Record<string, string>>({});
  const [job, setJob] = useState<TrackedJob | null>(null);
  const [sending, setSending] = useState(false);
  const [handledReceipt, setHandledReceipt] = useState<string | null>(null);
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment({ ...props, onResult: ignore, onPractice: ignore, visible: open });
  const chosen = choice?.anchor === anchor ? choice.thread : null;
  const selectedText = chosen?.selection ?? anchor;
  const threadId = chosen?.id ?? (anchor ? created[fragmentDraft(anchor)] : undefined);
  const draftKey = threadId ? threadDraft(threadId) : fragmentDraft(anchor);
  const draft = drafts[draftKey] ?? "";
  const thread = useTeacherQuery(`sessions/${props.session.id}/enrichment/threads/${threadId}`, threadSchema, undefined, Boolean(threadId && (open || job?.pending)));
  const matchesTopic = (item: Thread) => item.content_version_id === contentVersionId && item.block_id === blockId;
  const threadData = thread.data?.thread.id === threadId && thread.data && matchesTopic(thread.data.thread) ? thread.data : undefined;
  const history = query.data?.threads.filter(matchesTopic) ?? [];
  const finalActive = props.session.active_attempts.some(attempt => attempt.scope === "section_final" && attempt.state === "in_progress");
  const locked = disabled || finalActive || sending || job?.pending || !query.data || query.isError
    || Boolean(threadId && (thread.isFetching || thread.isError || !threadData));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (open && desktop) heading.current?.focus({ preventScroll: true });
  }, [open, desktop, anchor]);

  const topicIntent = (command?: TeacherCommand | null) => {
    if (command?.path !== `sessions/${props.session.id}/enrichment/commands`) return null;
    const { operation, payload } = command.body;
    if (!payload || typeof payload !== "object") return null;
    if (operation === "thread_create" && "selection" in payload && typeof payload.selection === "string"
      && "content_version_id" in payload && payload.content_version_id === contentVersionId
      && "block_id" in payload && payload.block_id === blockId) return { selection: payload.selection };
    if (operation === "thread_message" && threadId && "thread_id" in payload && payload.thread_id === threadId
      && "text" in payload && typeof payload.text === "string") return { threadId, text: payload.text };
    return null;
  };
  const bindThread = (selection: string, id: string) => {
    setCreated(current => ({ ...current, [fragmentDraft(selection)]: id }));
    setDrafts(current => {
      const previous = fragmentDraft(selection);
      const next = threadDraft(id);
      return { ...current, [previous]: "", [next]: current[next] ?? current[previous] ?? "" };
    });
  };
  const reconciled = props.command.lastReconciled;
  const intent = topicIntent(reconciled?.command);
  if (reconciled && intent && reconciled.command.requestKey !== handledReceipt) {
    const { command, result } = reconciled;
    setHandledReceipt(command.requestKey);
    if ("selection" in intent && intent.selection && result.kind === "clarification" && result.resource_id) {
      bindThread(intent.selection, result.resource_id);
    }
    if ("threadId" in intent && intent.threadId && result.thread_id === intent.threadId && result.job_id) {
      if (intent.text === draft) setDrafts({ ...drafts, [draftKey]: "" });
      setJob({ id: result.job_id, threadId: intent.threadId, pending: true });
    }
  }

  const send = async () => {
    if (locked || inFlight.current || !selectedText || !draft.trim() || draft.length > 2000) return;
    inFlight.current = true;
    setSending(true);
    try {
      let id = threadId;
      let revision: number | undefined;
      if (!id) {
        const createdThread = await execute("thread_create", { content_version_id: contentVersionId, block_id: blockId, selection: selectedText });
        if (!mounted.current || createdThread?.kind !== "clarification" || !createdThread.resource_id) return;
        const createdId = createdThread.resource_id;
        id = createdId;
        revision = createdThread.revision;
        bindThread(selectedText, createdId);
        // thread_create advances the CAS. A missing revision must never be replaced with the old snapshot.
        if (revision === undefined) return;
      }
      const result = await execute("thread_message", { thread_id: id, text: draft }, revision);
      if (!mounted.current || !result?.job_id) return;
      const sentDraft = threadDraft(id);
      setDrafts(current => ({ ...current, [sentDraft]: "" }));
      setJob({ id: result.job_id, threadId: id, pending: true });
    } finally {
      inFlight.current = false;
      if (mounted.current) setSending(false);
    }
  };
  const settle = () => {
    setJob(current => current && { ...current, pending: false });
    if (threadId && job?.threadId === threadId) void thread.refetch();
  };

  const contents = <Stack sx={{ gap: 2, minWidth: 0 }}>
    <DrawerHeader>
      <Typography ref={heading} id={headingId} tabIndex={-1} variant="h6" component="h4">{t("teacher:topic.clarify")}</Typography>
      <IconButton aria-label={t("core:close")} onClick={onClose}><CloseOutlined /></IconButton>
    </DrawerHeader>
    {!desktop && open && topicIntent(props.command.uncertain) && <RequestRecovery command={props.command} onRecovered={ignore} />}
    <QueryErrorAlert retryVariant="outlined" isError={query.isError && !showHistory} isFetching={query.isFetching} onRetry={query.refetch} />
    {finalActive && <Alert severity="info">{t("teacher:adaptive.helper_final_blocked")}</Alert>}
    {selectedText ? <FragmentQuote>{selectedText}</FragmentQuote>
      : <Typography color="text.secondary" variant="body2">{t("teacher:topic.select_fragment")}</Typography>}
    {threadId && <PanelState loading={thread.isLoading && !threadData} fetching={thread.isFetching} error={thread.isError} retry={thread.refetch}>
      {threadData?.messages.map(item => <Stack key={item.id}>
        <Typography variant="caption" color="text.secondary">{t(item.role === "user" ? "teacher:adaptive.you" : "teacher:product")}</Typography>
        <LessonMarkdown text={item.text} />
      </Stack>)}
    </PanelState>}
    {selectedText && !finalActive && <Stack component="form" sx={{ gap: 1.5 }} onSubmit={event => { event.preventDefault(); void send(); }}>
      <TextInput label={t("teacher:topic.question")} placeholder={t("teacher:topic.question_example")} rows={3} multiline
        value={draft} aria-describedby={composerNoteId} disabled={Boolean(locked)} onChange={event => {
          const text = event.target.value;
          setDrafts(current => ({ ...current, [draftKey]: text }));
        }} />
      <Typography id={composerNoteId} color="text.secondary" variant="body2">{t("teacher:topic.generation_notice")}</Typography>
      <TopicActions sx={{ justifyContent: "flex-end" }}>
        <Button type="submit" variant="contained" endIcon={<SendOutlined />} loading={sending} disabled={Boolean(locked || !draft.trim() || draft.length > 2000)}>
          {t("teacher:send_message")}
        </Button>
      </TopicActions>
    </Stack>}
    {job && <div hidden={job.threadId !== threadId}>
      <JobPanel key={job.id} allowNew={false} presentation="inline" jobId={job.id} busy={props.busy} paused={props.session.state === "paused"}
        onReady={settle} onTerminal={settle} onContinue={async current => {
          await props.command.execute(`jobs/${job.id}/continue-before-dispatch`, { expected_session_revision: props.session.revision, expected_job_fence: current.fence });
        }} onNew={async () => { /* A new question is a new explicit intent. */ }} />
    </div>}
    <Divider />
    <Button variant="outlined" endIcon={<ExpandMoreOutlined sx={{ rotate: showHistory ? "180deg" : undefined }} />}
      aria-expanded={showHistory} aria-controls={historyId} onClick={() => setShowHistory(value => !value)} sx={{ justifyContent: "space-between" }}>
      {t("teacher:topic.history")}
    </Button>
    <div id={historyId} hidden={!showHistory}>
      {showHistory && <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
        {query.data && !history.length && <Typography color="text.secondary" variant="body2">
          {t(query.data.has_more || page > 1 ? "teacher:topic.history_page_empty" : "teacher:topic.history_empty")}
        </Typography>}
        {history.map(item => <Button key={item.id} aria-pressed={item.id === threadId} variant={item.id === threadId ? "contained" : "outlined"}
          disabled={readDisabled || sending || job?.pending} onClick={() => {
            if (item.id === threadId) return;
            setChoice({ anchor, thread: item });
            heading.current?.focus();
          }}
          sx={{ justifyContent: "flex-start", textAlign: "start", overflowWrap: "anywhere" }}>{item.selection}</Button>)}
        {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled || sending} onPage={setPage} />}
      </PanelState>}
    </div>
  </Stack>;

  if (desktop) return <ClarificationSurface hidden={!open} aria-labelledby={headingId} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
  }}>{contents}</ClarificationSurface>;
  return <ClarificationSheet anchor="bottom" open={open} onClose={onClose} slotProps={{
    root: { keepMounted: true },
    paper: { role: "dialog", "aria-modal": true, "aria-labelledby": headingId },
    transition: { onEntered: () => heading.current?.focus({ preventScroll: true }) },
  }}>{contents}</ClarificationSheet>;
}
