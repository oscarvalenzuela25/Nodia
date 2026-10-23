import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  LinearProgress,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import BookmarkOutlined from "@mui/icons-material/BookmarkOutlined";
import { Skeleton } from "boneyard-js/react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import useGeneralSettingsStore from "../../../../store/generalSettings/generalSettingsStore";
import { hasModuleAccess } from "../../../../store/generalSettings/helpers";
import TextInput from "../../../../components/inputs/TextInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { nodiaAiEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import ConfigurationDrawer from "../../components/ConfigurationDrawer";
import Preferences from "../../components/Preferences";
import ConversationHistory from "../../components/ConversationHistory";
import ConversationManagement, { type ConversationOperation } from "../../components/ConversationManagement/ConversationManagement";
import type { ConversationFilters } from "../../components/ConversationHistory/types";
import Attachments from "../../components/Attachments";
import AttachmentMessage from "../../components/Attachments/AttachmentMessage";
import { useAttachmentDrafts } from "../../components/Attachments/hooks/useAttachmentDrafts";
import ExecutionObservation, { HistoricalObservation } from "../../components/ExecutionObservation";
import type { NodiaAiConfigurationChange } from "../../components/ConfigurationDrawer/types";
import type {
  NodiaAiAdmitInput,
  NodiaAiSelection,
  NodiaAiConversationUpdateInput,
} from "../../infrastructure/types";
import {
  isNodiaAiRunActive,
  isNodiaAiExecutionActive,
  useAdmitNodiaAiMessage,
  useCreateNodiaAiConversation,
  useNodiaAiCatalog,
  useNodiaAiConversation,
  useNodiaAiConversations,
  useNodiaAiEligibility,
  useNodiaAiMessages,
  useSetNodiaAiRouting,
  useSetNodiaAiSelection,
  useUpdateNodiaAiConversation,
} from "../../infrastructure/useServices";
import {
  Actions,
  Chat,
  ChatHeading,
  Composer,
  Header,
  History,
  Message,
  Messages,
  Page,
  Workspace,
} from "./styles";

const contextErrorMessages: Readonly<Record<string, string>> = {
  "nodia_ai:compaction_invalid": "context_errors.compaction_invalid",
  "nodia_ai:context_sources_changed": "context_errors.context_sources_changed",
  "nodia_ai:context_snapshot_invalid": "context_errors.context_snapshot_invalid",
  "nodia_ai:context_limit": "context_errors.context_limit",
};

const sameSelection = (
  a: NodiaAiSelection | null,
  b: NodiaAiSelection | null,
) =>
  a?.connection_id === b?.connection_id &&
  a?.mode === b?.mode &&
  a?.model_id === b?.model_id &&
  a?.effort_id === b?.effort_id;

function ChatPage() {
  const { t } = useTranslation("nodiaAi");
  const [params, setParams] = useSearchParams();
  const requestedId = params.get("chat");
  const chatId =
    requestedId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedId,
    )
      ? requestedId.toLowerCase()
      : null;
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const [overlayState, setOverlayState] = useState<{
    kind: "history" | "configuration" | "preferences";
    chatId: string | null;
  } | null>(null);
  const overlay = overlayState?.chatId === chatId ? overlayState.kind : null;
  const setOverlay = (kind: "history" | "configuration" | "preferences" | null) =>
    setOverlayState(kind ? { kind, chatId } : null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<ConversationFilters>({ search: "", archive: "active", pinned: false, view: "own" });
  const [search, setSearch] = useState("");
  const canViewAll = useGeneralSettingsStore(state => state.isLoaded && state.roles.includes("super_admin"));
  const canManageConnections = useGeneralSettingsStore(state => state.isLoaded
    && (state.roles.includes("super_admin") || state.actions.some(action => action.key === "ai:manage"))
    && hasModuleAccess(state.modules, "/settings/ai-providers"));
  const [operationState, setOperation] = useState<{ operation: ConversationOperation; contextId: string | null; anchor: HTMLElement } | null>(null);
  const operation = operationState?.contextId === chatId ? operationState.operation : null;
  const [operationError, setOperationError] = useState<string | null>(null);
  const operationLock = useRef(false);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const value = filters.search.trim();
    if (new TextEncoder().encode(value).length > 256) return;
    const timer = setTimeout(() => setSearch(value), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const [configurationDraft, setConfigurationDraft] =
    useState<NodiaAiSelection | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const createKey = useRef<string | null>(null);
  const pendingMessages = useRef(new Map<string, NodiaAiAdmitInput>());
  const [uncertainIds, setUncertainIds] = useState<Set<string>>(new Set());
  const uncertain = chatId && uncertainIds.has(chatId) ? chatId : null;
  const inFlight = useRef(false);
  const currentChat = useRef(chatId);
  useLayoutEffect(() => {
    currentChat.current = chatId;
  }, [chatId]);
  const chats = useNodiaAiConversations({ view: canViewAll ? filters.view : "own", search: search || undefined,
    is_archived: filters.archive === "all" ? undefined : filters.archive === "archived", is_pinned: filters.pinned ? true : undefined });
  const detail = useNodiaAiConversation(chatId);
  const history = useNodiaAiMessages(chatId, isNodiaAiRunActive(detail.data?.current_run?.state));
  const accessRejected = detail.accessRejected || history.accessRejected;
  const chat = accessRejected ? undefined : detail.data?.conversation;
  const run = accessRejected ? undefined : detail.data?.current_run;
  const active =
    isNodiaAiRunActive(run?.state) || run?.state === "unknown" || isNodiaAiExecutionActive(detail.data?.active_execution?.state);
  const operationDetail = useNodiaAiConversation(operation?.chat.conversation_id ?? null);
  const updateConversation = useUpdateNodiaAiConversation(operation?.chat.conversation_id ?? null);
  const catalog = useNodiaAiCatalog(overlay === "configuration");
  const eligibility = useNodiaAiEligibility(
    overlay === "configuration"
      ? configurationDraft
      : (chat?.selection ?? null),
    { conversationId: chatId, active },
  );
  const create = useCreateNodiaAiConversation();
  const admit = useAdmitNodiaAiMessage(chatId);
  const select = useSetNodiaAiSelection(chatId);
  const routing = useSetNodiaAiRouting(chatId);
  const connections = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const chatItems = chats.data?.pages.flatMap((page) => page.items) ?? [];
  const messages = accessRejected ? [] :
    history.data?.pages
      .slice()
      .reverse()
      .flatMap((page) => page.items) ?? [];
  const messageScroll = useRef<HTMLDivElement | null>(null);
  const followMessages = useRef(true);
  const lastWindow = useRef<string | null>(null);
  const lastMessageId = messages.at(-1)?.message_id;
  const firstMessageId = messages[0]?.message_id;
  const pendingScroll = useRef<{ id: string; top: number; height: number; firstId: string | null } | null>(null);
  useLayoutEffect(() => {
    const pending = pendingScroll.current, node = messageScroll.current;
    if (pending && pending.id !== chatId) pendingScroll.current = null;
    else if (pending && node && pending.firstId !== (firstMessageId ?? null)) {
      node.scrollTop = pending.top + node.scrollHeight - pending.height;
      pendingScroll.current = null;
    }
  }, [chatId, firstMessageId, messages.length]);
  useEffect(() => {
    const node = messageScroll.current;
    if (!node || !lastMessageId) return;
    if (lastWindow.current !== chatId || followMessages.current)
      node.scrollTop = node.scrollHeight;
    lastWindow.current = chatId;
  }, [chatId, lastMessageId]);
  const draft = chatId ? (drafts[chatId] ?? "") : "";
  const attachments = useAttachmentDrafts(chatId, chat?.revision);
  const [recording, setRecording] = useState(false);
  const messageTextBytes = new TextEncoder().encode(draft).length + attachments.reviewedTextBytes;
  const busy = create.isPending || admit.isPending || saving || updateConversation.isPending;
  const readBusy = detail.isFetching || history.isFetching;
  const selectionMatches =
    !!chat?.selection &&
    !!eligibility.data &&
    sameSelection(chat.selection, eligibility.data.selection);
  const usable = selectionMatches && !eligibility.isError && eligibility.data?.available === true;
  const sendDisabled =
    !chat ||
    chat.read_only ||
    busy ||
    readBusy ||
    active ||
    !usable ||
    eligibility.isFetching ||
    detail.isError ||
    history.isError;

  const openChat = (id: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("chat", id);
      return next;
    });
    setOverlay(null);
    setConfigurationError(null);
  };
  const closeOperation = () => {
    if (operationLock.current) return;
    const before = operationState;
    if (!before) return;
    setOperation(null);
    setOperationError(null);
    setTimeout(() => {
      if (currentChat.current !== before?.contextId) return;
      if (before.anchor.isConnected) before.anchor.focus();
      else historyTrigger.current?.focus();
    }, 0);
  };
  const saveOperation = async (input: NodiaAiConversationUpdateInput) => {
    if (!operation || operationLock.current || operationDetail.accessRejected || operation.chat.read_only || operationDetail.data?.conversation.read_only) return;
    operationLock.current = true;
    setOperationError(null);
    try {
      await updateConversation.mutateAsync(input);
      operationLock.current = false;
      if (operationState?.contextId === currentChat.current) closeOperation();
    } catch (error) {
      if (operationState?.contextId === currentChat.current) setOperationError(getHttpErrorMessage(error));
      throw error;
    } finally { operationLock.current = false; }
  };
  const reviewOperation = async () => {
    const result = await operationDetail.refetch();
    if (!result.data || result.isError || !operation) return;
    const latest = result.data.conversation;
    setOperation(previous => previous?.operation.chat.conversation_id === latest.conversation_id
      ? { ...previous, operation: { ...previous.operation, chat: latest } } : previous);
    setOperationError(null);
  };
  const recoverContent = () => Promise.all([detail.refetch(), history.refetch()]);
  const loadOlderMessages = async () => {
    const node = messageScroll.current;
    if (!chatId || !node || history.isFetching || recording) return;
    const previous = { id: chatId, top: node.scrollTop, height: node.scrollHeight, firstId: firstMessageId ?? null };
    pendingScroll.current = previous;
    followMessages.current = false;
    try {
      const result = await history.fetchNextPage();
      const first = result.data?.pages.at(-1)?.items[0]?.message_id ?? null;
      // Query completion can precede React's notification/commit. Only the layout
      // effect may consume a successful prepend after its DOM exists.
      if (pendingScroll.current === previous && (result.isError || first === previous.firstId))
        pendingScroll.current = null;
    } catch {
      if (pendingScroll.current === previous) pendingScroll.current = null;
    }
  };
  const createChat = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    createKey.current ??= crypto.randomUUID();
    const sourceChat = currentChat.current;
    try {
      const created = await create.mutateAsync({
        client_request_id: createKey.current,
      });
      createKey.current = null;
      if (currentChat.current === sourceChat) {
        openChat(created.conversation_id);
        setConfigurationDraft(created.selection);
        setOverlayState({
          kind: "configuration",
          chatId: created.conversation_id,
        });
      }
    } catch {
      /* Hook owns HTTP feedback; the request key is retained for an explicit retry. */
    } finally {
      inFlight.current = false;
    }
  };
  const send = async () => {
    const recovering =
      !!chatId && uncertain === chatId && pendingMessages.current.has(chatId);
    if (
      inFlight.current ||
      !chatId ||
      !chat ||
      chat.read_only ||
      busy ||
      readBusy ||
      (sendDisabled && !recovering) ||
      (!recovering && ((!draft.trim() && !attachments.parts.length) || attachments.busy || recording || !attachments.ready || messageTextBytes > 32768))
    )
      return;
    const id = chatId;
    const input = pendingMessages.current.get(id) ?? {
      client_message_id: crypto.randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [...(draft.trim() ? [{ kind: "text" as const, text: draft }] : []), ...attachments.parts],
    };
    pendingMessages.current.set(id, input);
    inFlight.current = true;
    try {
      await admit.mutateAsync(input);
      pendingMessages.current.delete(id);
      setDrafts((previous) => ({ ...previous, [id]: "" }));
      attachments.clear(id);
      setUncertainIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const rejected =
        status !== undefined && status >= 400 && status < 500 && status !== 408;
      if (rejected) pendingMessages.current.delete(id);
      setUncertainIds((previous) => {
        const next = new Set(previous);
        if (rejected) next.delete(id);
        else next.add(id);
        return next;
      });
      void detail.refetch();
    } finally {
      inFlight.current = false;
    }
  };
  const applyConfiguration = async (change: NodiaAiConfigurationChange) => {
    if (!chat || chat.read_only || active || inFlight.current) return;
    const sourceChat = chat.conversation_id;
    inFlight.current = true;
    setSaving(true);
    setConfigurationError(null);
    try {
      let current = chat;
      if (!sameSelection(current.selection, change.selection)) {
        current = await select.mutateAsync({
          expected_conversation_revision: current.revision,
          selection: change.selection,
        });
      }
      if (currentChat.current !== sourceChat) return;
      if (
        change.routingEnabled !== current.routing.enabled ||
        (change.routingEnabled &&
          JSON.stringify(current.routing.target) !==
            JSON.stringify(eligibility.data?.routing_target))
      ) {
        const target = change.routingEnabled
          ? eligibility.data?.routing_target
          : null;
        if (change.routingEnabled && !target)
          throw new Error(t("routing_unavailable"));
        await routing.mutateAsync({
          expected_conversation_revision: current.revision,
          expected_routing_revision: current.routing.revision,
          enabled: change.routingEnabled,
          target: target ?? null,
        });
      }
      if (currentChat.current === sourceChat) setOverlay(null);
    } catch (error) {
      if (currentChat.current === sourceChat)
        setConfigurationError(getHttpErrorMessage(error));
      void detail.refetch();
      throw error;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const historyContent = <ConversationHistory items={chats.accessRejected ? [] : chatItems} selectedId={chatId}
    filters={{ ...filters, view: canViewAll ? filters.view : "own" }} canViewAll={canViewAll}
    loading={chats.isLoading} fetching={chats.isFetching} error={chats.isError} disabled={busy || recording}
    hasMore={!!chats.hasNextPage} onFilters={setFilters} onSelect={openChat}
    onRetry={() => void chats.refetch()} onMore={() => void chats.fetchNextPage()}
    onAction={(target, action, anchor) => {
      setOverlay(null);
      setOperationError(null);
      setOperation({ operation: { chat: target, action }, contextId: chatId, anchor });
    }} />;
  return (
    <Page aria-labelledby="nodia-ai-title">
      <Header>
        <Box>
          <Typography id="nodia-ai-title" component="h1" variant="h4">
            NodiaAI
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t("subtitle")}
          </Typography>
        </Box>
        <Actions>
          <Button startIcon={<BookmarkOutlined />} disabled={busy || readBusy || recording} onClick={() => setOverlay("preferences")}>{t("preferences.title")}</Button>
          {!desktop && (
            <Button
              startIcon={<ForumOutlined />}
              ref={historyTrigger}
              disabled={busy || recording}
              onClick={() => setOverlay("history")}
            >
              {t("conversations")}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            disabled={busy || chats.isFetching || recording}
            onClick={() => void createChat()}
          >
            {t("new_chat")}
          </Button>
          <Button
            startIcon={<TuneOutlined />}
            disabled={
              !chat ||
              chat.read_only ||
              busy ||
              readBusy ||
              recording ||
              uncertain === chatId
            }
            onClick={() => {
              setConfigurationDraft(chat?.selection ?? null);
              setConfigurationError(null);
              setOverlay("configuration");
            }}
          >
            {t("settings")}
          </Button>
        </Actions>
      </Header>
      <Workspace>
        {desktop && (
          <History as="aside" aria-label={t("conversations")}>
            {historyContent}
          </History>
        )}
        <Chat>
          <ChatHeading>
            <Typography
              component="h2"
              variant="h6"
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
            >
              {chat?.title ?? t(chatId ? "untitled" : "welcome")}
            </Typography>
            {chat && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  label={
                    chat.selection
                      ? `${t(`modes.${chat.selection.mode}`)} · ${chat.selection.model_id}`
                      : t("no_selection")
                  }
                />
                {chat.routing.enabled && (
                  <Chip
                    size="small"
                    label={t("routing_enabled")}
                    color="info"
                  />
                )}
                {chat.read_only && <Chip size="small" label={t("read_only")} />}
              </Box>
            )}
            {readBusy && !detail.isLoading && (
              <LinearProgress aria-label={t("refreshing")} />
            )}
            {requestedId && !chatId && (
              <Alert severity="error">{t("invalid_chat")}</Alert>
            )}
            {detail.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    disabled={detail.isFetching}
                    onClick={() => void recoverContent()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {t("detail_error")}
              </Alert>
            )}
            {accessRejected && <Alert severity="warning">{t("organization.access_rejected")}</Alert>}
            {chat && !chat.read_only && !usable && !eligibility.isError && (
              <Alert severity="info">
                {eligibility.isFetching
                  ? t("checking_selection")
                  : t(nodiaAiEligibilityReasonKey(selectionMatches ? eligibility.data?.reason : null))}
                {chat.selection && !active && (
                  <Button color="inherit" disabled={busy || readBusy || eligibility.isFetching}
                    onClick={() => void eligibility.refetch()}
                    sx={{ display: "flex", mt: 1, minHeight: 44, width: { xs: "100%", sm: "auto" } }}>
                    {t("configuration.check_again")}
                  </Button>
                )}
              </Alert>
            )}
            {eligibility.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    disabled={active || busy || readBusy || eligibility.isFetching}
                    onClick={() => void eligibility.refetch()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {t("eligibility_error")}
              </Alert>
            )}
          </ChatHeading>
          <Messages
            ref={messageScroll}
            role="region"
            aria-label={t("messages")}
            tabIndex={0}
              onScroll={(event) => {
              const node = event.currentTarget;
              followMessages.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 80;
                if (pendingScroll.current?.id === chatId && pendingScroll.current.height === node.scrollHeight)
                  pendingScroll.current.top = node.scrollTop;
            }}
          >
            {history.hasNextPage && (
              <Button
                disabled={history.isFetching || busy || recording}
                onClick={() => void loadOlderMessages()}
              >
                {t("more_messages")}
              </Button>
            )}
            {!chatId && (
              <Box
                sx={{
                  my: "auto",
                  mx: "auto",
                  maxWidth: "32rem",
                  textAlign: "center",
                }}
              >
                <ForumOutlined color="primary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6">{t("welcome_message")}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {t("welcome_detail")}
                </Typography>
              </Box>
            )}
            <Skeleton loading={detail.isLoading || history.isLoading}>
              {chatId && !accessRejected && !messages.length && !history.isLoading && !history.isError && (
                <Typography color="text.secondary">
                  {t("empty_messages")}
                </Typography>
              )}
              {messages.map((message) => (
                <Message
                  key={message.message_id}
                  isOwner={message.role === "user"}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    sx={{ mb: 0.5 }}
                  >
                    {t(message.role === "user" ? "you" : "assistant")}
                  </Typography>
                  {message.status === "partial" && <Alert severity="info" sx={{ mb: 1 }}>{t("organization.partial_message")}</Alert>}
                  <Typography
                    component="div"
                    sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {message.visibility === "restricted"
                      ? t("restricted_message")
                      : message.parts.map((part) => part.text).join("\n")}
                  </Typography>
                  {message.visibility === "visible" && message.parts.map(part => part.kind !== "text" && <AttachmentMessage key={part.attachment_id} id={part.attachment_id} kind={part.kind} conversationId={chatId!} />)}
                  {chatId && message.visibility === "visible" && message.role === "assistant" && message.run_id && message.run_id !== run?.run_id && <HistoricalObservation conversationId={chatId} runId={message.run_id} />}
                </Message>
              ))}
            </Skeleton>
            {history.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    disabled={history.isFetching}
                    onClick={() => void recoverContent()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {t("messages_error")}
              </Alert>
            )}
            {run && (
              <Alert
                severity={
                  run.state === "failed" || run.state === "unknown"
                    ? "warning"
                    : "info"
                }
                role="status"
                action={
                  active && !isNodiaAiRunActive(run.state) ? (
                    <Button
                      disabled={detail.isFetching}
                      onClick={() => void detail.refetch()}
                    >
                      {t("refresh_status")}
                    </Button>
                  ) : undefined
                }
              >
                {t(`states.${run.state}`)}
                {run.error?.code === "nodia_ai:preferences_changed" && <Typography variant="body2">{t("preferences.changed")}</Typography>}
                {run.error?.code && contextErrorMessages[run.error.code] && <Typography variant="body2">{t(contextErrorMessages[run.error.code])}</Typography>}
                {run.state === "unknown" && (
                  <Typography variant="body2">{t("unknown_detail")}</Typography>
                )}
              </Alert>
            )}
            {!accessRejected && detail.data?.active_execution && <Alert severity="info" role="status" action={<Button disabled={detail.isFetching} onClick={() => void detail.refetch()}>{t("refresh_status")}</Button>}>
              {t("proposal.execution_status", { state: t(`proposal.execution_states.${detail.data.active_execution.state}`) })}
            </Alert>}
            {chatId && run && <ExecutionObservation key={run.run_id} conversationId={chatId} run={run} />}
          </Messages>
          {chat && !chat.read_only && (
            <Composer
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              {uncertain === chatId && (
                <Alert severity="warning">{t("send_uncertain")}</Alert>
              )}
              <TextInput
                label={t("message")}
                value={draft}
                onChange={(event) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [chatId!]: event.target.value,
                  }))
                }
                multiline
                minRows={2}
                maxRows={5}
                disabled={sendDisabled || uncertain === chatId || attachments.busy || recording}
              />
              <Attachments key={chatId!} conversationId={chatId!} conversationRevision={chat.revision} draft={attachments} disabled={sendDisabled || uncertain === chatId} onRecordingChange={setRecording} />
              {attachments.entries.length > 0 && !attachments.ready && <Alert severity="info">{t("attachments.pending")}</Alert>}
              {messageTextBytes > 32768 && <Alert severity="warning">{t("attachments.text_too_large")}</Alert>}
              <Actions data-composer-actions>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SendOutlined />}
                  disabled={
                    uncertain === chatId
                      ? busy || readBusy || detail.isError
                      : sendDisabled || (!draft.trim() && !attachments.parts.length) || !attachments.ready || attachments.busy || recording || messageTextBytes > 32768
                  }
                >
                  {t(uncertain === chatId ? "recover_send" : "send")}
                </Button>
              </Actions>
              <Typography variant="caption" color="text.secondary">
                {t("attachments.review_help")}
              </Typography>
            </Composer>
          )}
        </Chat>
      </Workspace>
      {operation && !operationDetail.accessRejected && <ConversationManagement key={`${operation.chat.conversation_id}:${operation.action}`}
        operation={operation} busy={updateConversation.isPending || operationDetail.isFetching}
        error={operationError ?? (operationDetail.isError ? t("detail_error") : null)} onApply={saveOperation}
        onClose={closeOperation} onRefresh={() => void reviewOperation()} />}
      {operation && operationDetail.accessRejected && <Alert severity="warning" action={<Button onClick={closeOperation}>{t("close")}</Button>}>{t("organization.access_rejected")}</Alert>}
      <Drawer
        anchor="left"
        open={overlay === "history" && !desktop}
        onClose={() => setOverlay(null)}
        slotProps={{ paper: { sx: { width: "min(100%, 320px)", p: 2 } } }}
      >
        <Button onClick={() => setOverlay(null)} sx={{ minHeight: 44 }}>
          {t("close")}
        </Button>
        {!desktop && historyContent}
      </Drawer>
      <Preferences key={`preferences:${chatId ?? "new"}`} open={overlay === "preferences"} conversationId={chatId} disabled={!chat || chat.read_only || busy || readBusy || active || uncertain === chatId} onClose={() => setOverlay(null)} />
      <ConfigurationDrawer
        key={`configuration:${chatId ?? "new"}`}
        open={overlay === "configuration"}
        onClose={() => {
          if (!saving) setOverlay(null);
        }}
        connections={connections}
        canManageConnection={canManageConnections}
        selection={chat?.selection ?? null}
        routingEnabled={chat?.routing.enabled ?? false}
        onSelectionChange={setConfigurationDraft}
        eligibility={eligibility.data ?? null}
        eligibilityBusy={eligibility.isFetching}
        eligibilityError={eligibility.isError ? t("eligibility_error") : null}
        onRetryEligibility={() => void eligibility.refetch()}
        isLoading={catalog.isLoading}
        isFetching={catalog.isFetching || detail.isFetching}
        isSaving={saving}
        readOnly={!chat || chat.read_only || active || detail.isError}
        error={
          configurationError ?? (catalog.isError ? t("catalog_error") : null)
        }
        onRetry={() => {
          setConfigurationError(null);
          void catalog.refetch();
          void detail.refetch();
        }}
        hasMore={!!catalog.hasNextPage}
        onLoadMore={() => void catalog.fetchNextPage()}
        onApply={applyConfiguration}
      />
    </Page>
  );
}

export default function NodiaAI() {
  const { user, sessionVersion } = useAuth();
  return <ChatPage key={`${user?.id ?? "anonymous"}:${sessionVersion}`} />;
}
