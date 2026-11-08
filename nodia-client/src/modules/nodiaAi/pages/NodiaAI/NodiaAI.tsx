import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { Skeleton } from "boneyard-js/react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import useGeneralSettingsStore from "../../../../store/generalSettings/generalSettingsStore";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { nodiaAiEligibilityReasonKey, nodiaAiRunErrorKey } from "../../infrastructure/eligibilityPresentation";
import { useConversationDraft } from "../../infrastructure/useConversationDraft";
import { useNodiaAiStatusRefresh } from "../../infrastructure/useNodiaAiStatusRefresh";
import { NODIA_AI_MESSAGE_TEXT_BYTES } from "../../infrastructure/schemas";
import Preferences from "../../components/Preferences";
import ConversationHistory from "../../components/ConversationHistory";
import ConversationManagement, {
  type ConversationOperation,
} from "../../components/ConversationManagement/ConversationManagement";
import type { ConversationFilters } from "../../components/ConversationHistory/types";
import ChatComposer from "../../components/ChatComposer";
import ChatMessage from "../../components/ChatMessage";
import ConversationTitle from "../../components/ConversationTitle";
import ComposerSelection from "../../components/ComposerSelection";
import { useAttachmentDrafts } from "../../components/Attachments/hooks/useAttachmentDrafts";
import ExecutionObservation from "../../components/ExecutionObservation";
import RunCancellation from "../../components/RunCancellation";
import type { NodiaAiConfigurationChange } from "../../components/ConfigurationDrawer/types";
import type {
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
  Header,
  History,
  Messages,
  Page,
  PageTitle,
  Workspace,
} from "./styles";

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
    kind: "history" | "preferences";
    chatId: string | null;
  } | null>(null);
  const overlay = overlayState?.chatId === chatId ? overlayState.kind : null;
  const setOverlay = (
    kind: "history" | "preferences" | null,
  ) => setOverlayState(kind ? { kind, chatId } : null);
  const [filters, setFilters] = useState<ConversationFilters>({
    search: "",
    archive: "active",
    pinned: false,
    view: "own",
  });
  const [search, setSearch] = useState("");
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);
  const canViewAll = useGeneralSettingsStore(
    (state) => state.isLoaded && state.roles.includes("super_admin"),
  );
  const [operationState, setOperation] = useState<{
    operation: ConversationOperation;
    contextId: string | null;
    anchor: HTMLElement;
  } | null>(null);
  const operation =
    operationState?.contextId === chatId ? operationState.operation : null;
  const [operationError, setOperationError] = useState<string | null>(null);
  const operationLock = useRef(false);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const value = filters.search.trim();
    if (new TextEncoder().encode(value).length > 256) return;
    const timer = setTimeout(() => setSearch(value), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const [configurationError, setConfigurationError] = useState<string | null>(
    null,
  );
  const [inlineState, setInlineState] = useState<{ chatId: string | null; selection: NodiaAiSelection | null; dirty: boolean } | null>(null);
  const inlineDraft = inlineState?.chatId === chatId ? inlineState.selection : null;
  const inlineDirty = inlineState?.chatId === chatId && inlineState.dirty;
  const setInlineDraft = useCallback((selection: NodiaAiSelection | null) => {
    setInlineState(previous => ({ chatId, selection, dirty: previous?.chatId === chatId && previous.dirty }));
  }, [chatId]);
  const setInlineDirty = useCallback((dirty: boolean) => {
    setInlineState(previous => ({ chatId, dirty, selection: previous?.chatId === chatId ? previous.selection : null }));
  }, [chatId]);
  const [saving, setSaving] = useState(false);
  const createKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const currentChat = useRef(chatId);
  useLayoutEffect(() => {
    currentChat.current = chatId;
  }, [chatId]);
  const chats = useNodiaAiConversations({
    view: canViewAll ? filters.view : "own",
    search: search || undefined,
    is_archived:
      filters.archive === "all" ? undefined : filters.archive === "archived",
    is_pinned: filters.pinned ? true : undefined,
  });
  const detail = useNodiaAiConversation(chatId);
  const history = useNodiaAiMessages(
    chatId,
    isNodiaAiRunActive(detail.data?.current_run?.state),
  );
  const accessRejected = detail.accessRejected || history.accessRejected;
  const chat = accessRejected ? undefined : detail.data?.conversation;
  const run = accessRejected ? undefined : detail.data?.current_run;
  const runErrorKey = nodiaAiRunErrorKey(run?.error?.code);
  const active =
    isNodiaAiRunActive(run?.state) ||
    run?.state === "unknown" ||
    isNodiaAiExecutionActive(detail.data?.active_execution?.state);
  const operationDetail = useNodiaAiConversation(
    operation?.chat.conversation_id ?? null,
  );
  const updateConversation = useUpdateNodiaAiConversation(
    operation?.chat.conversation_id ?? null,
  );
  const renameConversation = useUpdateNodiaAiConversation(chatId);
  const titleLock = useRef(false);
  const [titleErrorState, setTitleErrorState] = useState<{ chatId: string; message: string } | null>(null);
  const titleError = titleErrorState?.chatId === chatId ? titleErrorState.message : null;
  const catalog = useNodiaAiCatalog(!!chat && !chat.read_only);
  const eligibility = useNodiaAiEligibility(
    inlineDirty ? inlineDraft : (chat?.selection ?? null),
    { conversationId: chatId, active },
  );
  const statusRefresh = useNodiaAiStatusRefresh({
    conversationId: chatId,
    runId: run?.run_id,
    detail: detail.refetch,
    history: history.refetch,
    eligibility: eligibility.refetch,
  });
  const create = useCreateNodiaAiConversation();
  const admit = useAdmitNodiaAiMessage(chatId);
  const select = useSetNodiaAiSelection(chatId);
  const routing = useSetNodiaAiRouting(chatId);
  const connections = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const chatItems = chats.data?.pages.flatMap((page) => page.items) ?? [];
  const messages = accessRejected
    ? []
    : (history.data?.pages
        .slice()
        .reverse()
        .flatMap((page) => page.items) ?? []);
  const messageScroll = useRef<HTMLDivElement | null>(null);
  const followMessages = useRef(true);
  const followActivity = useCallback(() => {
    const node = messageScroll.current;
    if (node && followMessages.current) node.scrollTop = node.scrollHeight;
  }, []);
  const lastWindow = useRef<string | null>(null);
  const lastMessageId = messages.at(-1)?.message_id;
  const firstMessageId = messages[0]?.message_id;
  const pendingScroll = useRef<{
    id: string;
    top: number;
    height: number;
    firstId: string | null;
  } | null>(null);
  useLayoutEffect(() => {
    const pending = pendingScroll.current,
      node = messageScroll.current;
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
  }, [chatId, lastMessageId, run?.run_id]);
  const composerDraft = useConversationDraft(
    chat,
    accessRejected ? chatId : null,
    detail.draftAuthorized,
  );
  const selectionMatches =
    !!chat?.selection &&
    !!eligibility.data &&
    sameSelection(chat.selection, eligibility.data.selection);
  const usable =
    selectionMatches &&
    !eligibility.isError &&
    eligibility.data?.available === true;
  const attachments = useAttachmentDrafts(
    chatId,
    chat?.revision,
    usable && !eligibility.isFetching ? eligibility.data?.invoice_ocr : null,
    { autoUpload: !!chat && !chat.read_only && detail.draftAuthorized && usable && !active && !inlineDirty && !detail.isError && !history.isError },
  );
  const draft = attachments.admission?.text ?? composerDraft.text;
  const uncertain =
    attachments.admission?.status === "uncertain" ? chatId : null;
  const [recording, setRecording] = useState(false);
  const messageTextBytes =
    new TextEncoder().encode(draft).length + attachments.reviewedTextBytes;
  const busy =
    create.isPending ||
    admit.isPending ||
    saving ||
    updateConversation.isPending ||
    renameConversation.isPending ||
    attachments.admissionInFlight;
  const readBusy = detail.isFetching || history.isFetching;
  const sendDisabled =
    !chat ||
    !detail.draftAuthorized ||
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
    setInlineDirty(false);
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
    if (
      !operation ||
      operationLock.current ||
      operationDetail.accessRejected ||
      operation.chat.read_only ||
      operationDetail.data?.conversation.read_only
    )
      return;
    operationLock.current = true;
    setOperationError(null);
    try {
      await updateConversation.mutateAsync(input);
      operationLock.current = false;
      if (operationState?.contextId === currentChat.current) closeOperation();
    } catch (error) {
      if (operationState?.contextId === currentChat.current)
        setOperationError(getHttpErrorMessage(error));
      throw error;
    } finally {
      operationLock.current = false;
    }
  };
  const reviewOperation = async () => {
    const result = await operationDetail.refetch();
    if (!result.data || result.isError || !operation) return;
    const latest = result.data.conversation;
    setOperation((previous) =>
      previous?.operation.chat.conversation_id === latest.conversation_id
        ? { ...previous, operation: { ...previous.operation, chat: latest } }
        : previous,
    );
    setOperationError(null);
  };
  const recoverContent = () =>
    Promise.all([detail.refetch(), history.refetch()]);
  const saveTitle = async (title: string | null, revision: number) => {
    if (!chatId || !chat || chat.read_only || titleLock.current || busy || readBusy || active
      || !detail.draftAuthorized || detail.isError || history.isError || currentChat.current !== chatId)
      throw new Error(t("detail_error"));
    const boundId = chatId;
    titleLock.current = true;
    setTitleErrorState(null);
    try {
      await renameConversation.mutateAsync({ expected_conversation_revision: revision, title });
    } catch (error) {
      if (currentChat.current === boundId) setTitleErrorState({ chatId: boundId, message: getHttpErrorMessage(error) });
      throw error;
    } finally {
      titleLock.current = false;
    }
  };
  const refreshTitle = async () => {
    const boundId = chatId;
    const result = await detail.refetch();
    if (currentChat.current !== boundId || result.isError || !result.data || result.data.conversation.read_only) return null;
    setTitleErrorState(null);
    return result.data.conversation;
  };
  const loadOlderMessages = async () => {
    const node = messageScroll.current;
    if (!chatId || !node || history.isFetching || recording) return;
    const previous = {
      id: chatId,
      top: node.scrollTop,
      height: node.scrollHeight,
      firstId: firstMessageId ?? null,
    };
    pendingScroll.current = previous;
    followMessages.current = false;
    try {
      const result = await history.fetchNextPage();
      const first = result.data?.pages.at(-1)?.items[0]?.message_id ?? null;
      // Query completion can precede React's notification/commit. Only the layout
      // effect may consume a successful prepend after its DOM exists.
      if (
        pendingScroll.current === previous &&
        (result.isError || first === previous.firstId)
      )
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
        setInlineDirty(false);
      }
    } catch {
      /* Hook owns HTTP feedback; the request key is retained for an explicit retry. */
    } finally {
      inFlight.current = false;
    }
  };
  const send = async () => {
    const recovering =
      !!chatId &&
      uncertain === chatId &&
      attachments.admission?.status === "uncertain";
    if (
      inFlight.current ||
      !chatId ||
      !chat ||
      chat.read_only ||
      busy ||
      readBusy ||
      (sendDisabled && !recovering) ||
      (inlineDirty && !recovering) ||
      (!recovering &&
        ((!draft.trim() && !attachments.parts.length) ||
          attachments.busy ||
          recording ||
          !attachments.ready ||
          messageTextBytes > NODIA_AI_MESSAGE_TEXT_BYTES))
    )
      return;
    const id = chatId;
    const input = (recovering ? attachments.admission?.input : null) ?? {
      client_message_id: crypto.randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [
        ...(draft.trim() ? [{ kind: "text" as const, text: draft }] : []),
        ...attachments.parts,
      ],
    };
    const admission = attachments.reserveAdmission(input, draft);
    if (!admission) return;
    composerDraft.beginSubmission();
    inFlight.current = true;
    try {
      await admit.mutateAsync(admission.input);
      attachments.settleAdmission(id, admission, "accepted");
      composerDraft.finishSubmission(id, "accepted", chat.expires_at);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const rejected =
        status !== undefined && status >= 400 && status < 500 && status !== 408;
      const outcome = [401, 403, 404, 410].includes(status ?? 0)
        ? "accepted"
        : rejected
          ? "rejected"
          : "uncertain";
      attachments.settleAdmission(id, admission, outcome);
      composerDraft.finishSubmission(id, outcome, chat.expires_at);
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
      if (current.routing.enabled || current.routing.target !== null) {
        await routing.mutateAsync({
          expected_conversation_revision: current.revision,
          expected_routing_revision: current.routing.revision,
          enabled: false,
          target: null,
        });
      }
      if (currentChat.current === sourceChat) { setOverlay(null); setInlineDirty(false); }
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
  const historyContent = (
    <ConversationHistory
      items={chats.accessRejected ? [] : chatItems}
      selectedId={chatId}
      filters={{ ...filters, view: canViewAll ? filters.view : "own" }}
      canViewAll={canViewAll}
      filtersExpanded={historyFiltersExpanded}
      onToggleFilters={() => setHistoryFiltersExpanded(value => !value)}
      loading={chats.isLoading}
      fetching={chats.isFetching}
      error={chats.isError}
      disabled={busy || recording}
      hasMore={!!chats.hasNextPage}
      onFilters={setFilters}
      onSelect={openChat}
      onPreferences={id => {
        if (id !== chatId) openChat(id);
        setOverlayState({ kind: "preferences", chatId: id });
      }}
      onRetry={() => void chats.refetch()}
      onMore={() => void chats.fetchNextPage()}
      onAction={(target, action, anchor) => {
        setOverlay(null);
        setOperationError(null);
        setOperation({
          operation: { chat: target, action },
          contextId: chatId,
          anchor,
        });
      }}
    />
  );
  return (
    <Page aria-labelledby="nodia-ai-title">
      <Header>
        <Box>
          <PageTitle id="nodia-ai-title">
            Nodia AI
          </PageTitle>
        </Box>
        <Actions>
          {!desktop && (
            <Button
              variant="text"
              startIcon={<ForumOutlined />}
            aria-label={t("conversations")}
            title={t("conversations")}
              ref={historyTrigger}
              disabled={busy || recording}
              onClick={() => setOverlay("history")}
            >
              <span className="header-action-label">{t("conversations")}</span>
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            aria-label={t("new_chat")}
            title={t("new_chat")}
            disabled={busy || chats.isFetching || recording}
            onClick={() => void createChat()}
          >
            <span className="header-action-label">{t("new_chat")}</span>
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
            {chat ? <ConversationTitle key={chat.conversation_id}
              conversation={chat} readOnly={chat.read_only}
              disabled={!detail.draftAuthorized || busy || readBusy || active || !!operation || recording || attachments.busy || uncertain === chatId || detail.isError || history.isError}
              busy={renameConversation.isPending} error={titleError}
              onSave={saveTitle} onRefresh={refreshTitle}
            /> : <Typography
              component="h2"
              variant="h6"
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              {t(chatId ? "untitled" : "welcome")}
            </Typography>}
            {chat && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  sx={{ display: { xs: "none", sm: "inline-flex" } }}
                  label={
                    chat.selection
                      ? `${t(`modes.${chat.selection.mode}`)} · ${chat.selection.model_id}`
                      : t("no_selection")
                  }
                />
                {chat.read_only && <Chip size="small" label={t("read_only")} />}
              </Box>
            )}
            {readBusy && !detail.isLoading && !active && (
              <LinearProgress aria-label={t("refreshing")} sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2 }} />
            )}
            {requestedId && !chatId && (
              <Alert severity="error">{t("invalid_chat")}</Alert>
            )}
            {detail.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    variant="contained"
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
            {accessRejected && (
              <Alert severity="warning">
                {t("organization.access_rejected")}
              </Alert>
            )}
            {chat && !chat.read_only && !usable && !eligibility.isError && (
              <Alert
                severity="info"
                slotProps={{
                  message: { sx: { minWidth: 0, overflowWrap: "anywhere" } },
                  action: { sx: { alignSelf: "flex-start", flexShrink: 0, pt: 0, pl: 1 } },
                }}
                action={chat.selection && !active ? (
                  <Tooltip title={t("configuration.check_again")}>
                    <span>
                      <IconButton
                        color="inherit"
                        aria-label={t("configuration.check_again")}
                        disabled={busy || readBusy || eligibility.isFetching}
                        onClick={() => void eligibility.refetch()}
                        sx={{ width: 44, height: 44 }}
                      >
                        <RefreshOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : undefined}
              >
                {eligibility.isFetching
                  ? t("checking_selection")
                  : t(
                      nodiaAiEligibilityReasonKey(
                        selectionMatches ? eligibility.data?.reason : null,
                      ),
                    )}
              </Alert>
            )}
            {eligibility.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    variant="contained"
                    disabled={
                      active || busy || readBusy || eligibility.isFetching
                    }
                    onClick={() => void eligibility.refetch()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {t("eligibility_error")}
              </Alert>
            )}
            {usable && eligibility.data?.supports_image_generation === false && (
              <Typography variant="caption" color="text.secondary">{t("image_generation.unverified")}</Typography>
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
              if (
                pendingScroll.current?.id === chatId &&
                pendingScroll.current.height === node.scrollHeight
              )
                pendingScroll.current.top = node.scrollTop;
            }}
          >
            {history.hasNextPage && (
              <Button
                variant="contained"
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
              {chatId &&
                !accessRejected &&
                !messages.length &&
                !history.isLoading &&
                !history.isError && (
                  <Typography color="text.secondary">
                    {t("empty_messages")}
                  </Typography>
                )}
              {messages.map((message) => (
                <ChatMessage key={message.message_id} message={message}
                  conversationId={chatId!} currentRunId={run?.run_id} />
              ))}
            </Skeleton>
            {history.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    variant="contained"
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
            {run && (run.state === "failed" || run.state === "unknown" || run.state === "cancelled") && (
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
                      variant="contained"
                      disabled={detail.isFetching || statusRefresh.isRefreshing}
                      onClick={() => void statusRefresh.refresh()}
                    >
                      {t("refresh_status")}
                    </Button>
                  ) : undefined
                }
              >
                {t(`states.${run.state}`)}
                {run.error?.code === "nodia_ai:preferences_changed" && (
                  <Typography variant="body2">
                    {t("preferences.changed")}
                  </Typography>
                )}
                {runErrorKey && (
                  <Typography variant="body2">
                    {t(runErrorKey)}
                  </Typography>
                )}
                {run.state === "unknown" && (
                  <Typography variant="body2">{t("unknown_detail")}</Typography>
                )}
              </Alert>
            )}
            {!accessRejected && detail.data?.active_execution && (
              <Alert
                severity="info"
                role="status"
                action={
                  <Button
                    variant="contained"
                    disabled={detail.isFetching}
                    onClick={() => void detail.refetch()}
                  >
                    {t("refresh_status")}
                  </Button>
                }
              >
                {t("proposal.execution_status", {
                  state: t(
                    `proposal.execution_states.${detail.data.active_execution.state}`,
                  ),
                })}
              </Alert>
            )}
            {chatId && run && (
              <ExecutionObservation
                key={run.run_id}
                conversationId={chatId}
                run={run}
                onProgress={followActivity}
                activityControls={<RunCancellation
                  conversationId={chatId}
                  run={run}
                  authorized={detail.draftAuthorized && !detail.isFetching && !detail.isError}
                  readOnly={chat?.read_only ?? true}
                />}
              />
            )}
          </Messages>
          {chat && !chat.read_only && (
            <ChatComposer key={chatId!}
              conversationId={chatId!} conversationRevision={chat.revision}
              text={draft} onTextChange={text => { composerDraft.setText(text); attachments.dismissRejectedAdmission(); }}
              draft={attachments} disabled={sendDisabled || uncertain === chatId || inlineDirty}
              recovering={uncertain === chatId}
              textTooLarge={messageTextBytes > NODIA_AI_MESSAGE_TEXT_BYTES}
              onSend={() => void send()} onRecordingChange={setRecording}
              sendDisabled={uncertain === chatId
                ? busy || readBusy || detail.isError
                : sendDisabled || inlineDirty || (!draft.trim() && !attachments.parts.length)
                  || !attachments.ready || attachments.busy || recording || messageTextBytes > NODIA_AI_MESSAGE_TEXT_BYTES}
              footer={<Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, flexWrap: "wrap", minWidth: 0 }}>
                <ComposerSelection key={chatId!} connections={connections} selection={chat.selection}
                  onSelectionChange={setInlineDraft} onDirtyChange={setInlineDirty}
                  eligibility={eligibility.data ?? null}
                  eligibilityBusy={eligibility.isFetching} eligibilityError={eligibility.isError ? t("eligibility_error") : null}
                  onRetryEligibility={() => void eligibility.refetch()}
                  isLoading={catalog.isLoading} isFetching={catalog.isFetching || readBusy}
                  isSaving={saving} readOnly={active || busy || recording || attachments.busy || uncertain === chatId || detail.isError}
                  error={configurationError ?? (catalog.isError ? t("catalog_error") : null)}
                  onRetry={() => { setConfigurationError(null); void catalog.refetch(); void detail.refetch(); }}
                  hasMore={!!catalog.hasNextPage} onLoadMore={() => void catalog.fetchNextPage()}
                  onApply={applyConfiguration} />
              </Box>} />
          )}
        </Chat>
      </Workspace>
      {operation && !operationDetail.accessRejected && (
        <ConversationManagement
          key={`${operation.chat.conversation_id}:${operation.action}`}
          operation={operation}
          busy={updateConversation.isPending || operationDetail.isFetching}
          error={
            operationError ??
            (operationDetail.isError ? t("detail_error") : null)
          }
          onApply={saveOperation}
          onClose={closeOperation}
          onRefresh={() => void reviewOperation()}
        />
      )}
      {operation && operationDetail.accessRejected && (
        <Alert
          severity="warning"
          action={
            <Button variant="contained" onClick={closeOperation}>
              {t("close")}
            </Button>
          }
        >
          {t("organization.access_rejected")}
        </Alert>
      )}
      <Drawer
        anchor="left"
        open={overlay === "history" && !desktop}
        onClose={() => setOverlay(null)}
        slotProps={{ paper: { sx: { width: "min(100%, 320px)", p: 2 } } }}
      >
        <Button
          variant="contained"
          onClick={() => setOverlay(null)}
          sx={{ minHeight: 44 }}
        >
          {t("close")}
        </Button>
        {!desktop && historyContent}
      </Drawer>
      <Preferences
        key={`preferences:${chatId ?? "new"}`}
        open={overlay === "preferences"}
        conversationId={chatId}
        disabled={
          !chat ||
          chat.read_only ||
          busy ||
          readBusy ||
          active ||
          uncertain === chatId
        }
        onClose={() => setOverlay(null)}
      />
    </Page>
  );
}

export default function NodiaAI() {
  const { user, sessionVersion } = useAuth();
  return <ChatPage key={`${user?.id ?? "anonymous"}:${sessionVersion}`} />;
}
