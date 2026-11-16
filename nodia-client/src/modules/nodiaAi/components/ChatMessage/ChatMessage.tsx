import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, IconButton, Tooltip, Typography } from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import { sileo } from "sileo";
import useAuth from "../../../../hooks/useAuth";
import type { NodiaAiMessage } from "../../infrastructure/types";
import AttachmentMessage from "../Attachments/AttachmentMessage";
import { HistoricalObservation } from "../ExecutionObservation";
import MessageMarkdown from "../MessageMarkdown";
import { Avatar, Bubble, Content, Identity, MessageActions, MessageBody, MessageRow, MessageText } from "./styles";

interface ChatMessageProps {
  message: NodiaAiMessage;
  conversationId: string;
  currentRunId?: string;
}

export default function ChatMessage({ message, conversationId, currentRunId }: ChatMessageProps) {
  const { t, i18n } = useTranslation("nodiaAi");
  const { user } = useAuth();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const copyingRef = useRef(false);
  const [copying, setCopying] = useState(false);
  const isOwner = message.role === "user";
  const author = t(isOwner ? "you" : "assistant");
  const createdAt = new Date(message.created_at);
  const hasDate = Number.isFinite(createdAt.getTime());
  const textBlocks: { text: string; markdown: boolean }[] = [];
  if (message.visibility === "visible") {
    let previous: (typeof textBlocks)[number] | undefined;
    for (const part of message.parts) {
      if (part.text === null) { previous = undefined; continue; }
      const markdown = message.role === "assistant" && part.kind === "text";
      if (previous?.markdown === markdown) previous.text += `\n${part.text}`;
      else { previous = { text: part.text, markdown }; textBlocks.push(previous); }
    }
  } else textBlocks.push({ text: t("restricted_message"), markdown: false });
  const hasText = textBlocks.some(block => block.text.length > 0);
  const canCopy = message.role === "assistant" && message.visibility === "visible" && hasText;
  const copyResponse = async () => {
    if (!canCopy || !bodyRef.current || copyingRef.current) return;
    // Copy only the displayed answer, excluding metadata, notices and result controls.
    const text = bodyRef.current.innerText ?? bodyRef.current.textContent ?? "";
    copyingRef.current = true;
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(text);
      sileo.success({ title: t("message_actions.copied") });
    } catch {
      sileo.error({ title: t("message_actions.copy_failed"), description: t("message_actions.copy_manual") });
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };

  return (
    <MessageRow isOwner={isOwner} aria-label={author} data-message-id={message.message_id}>
      <Content>
        <Identity isOwner={isOwner}>
          <Avatar isOwner={isOwner} aria-hidden="true"
            src={isOwner ? user?.image_url ?? undefined : undefined}
            alt={isOwner ? user?.name ?? "" : ""}>
            {isOwner ? (user?.name || user?.email || "?").slice(0, 1).toUpperCase() : "N"}
          </Avatar>
          <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: "inherit" }}>
            {author}
          </Typography>
          {hasDate && (
            <Box component="time" dateTime={message.created_at}
              title={new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(createdAt)}>
              {new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(createdAt)}
            </Box>
          )}
        </Identity>
        <Bubble isOwner={isOwner} isAssistant={message.role === "assistant"}>
          {message.status === "partial" && (
            <Alert severity="info" sx={{ mb: 1 }}>{t("organization.partial_message")}</Alert>
          )}
          <MessageBody ref={bodyRef}>{textBlocks.map((block, index) => block.text && (block.markdown
            ? <MessageMarkdown key={index} text={block.text} />
            : <MessageText key={index}>{block.text}</MessageText>))}</MessageBody>
          {message.visibility === "visible" && message.parts.map(part => part.kind !== "text" && (
            <Box key={part.attachment_id} sx={{ mt: hasText ? 1.5 : 0, minWidth: 0 }}>
              <AttachmentMessage id={part.attachment_id} kind={part.kind} conversationId={conversationId} />
            </Box>
          ))}
          {canCopy && <MessageActions>
            <Tooltip title={t("message_actions.copy")}>
              <span><IconButton aria-label={t("message_actions.copy")} disabled={copying} onClick={() => void copyResponse()}>
                <ContentCopyOutlined fontSize="small" />
              </IconButton></span>
            </Tooltip>
          </MessageActions>}
        </Bubble>
        {message.visibility === "visible" && message.role === "assistant" && message.run_id && message.run_id !== currentRunId && (
          <HistoricalObservation conversationId={conversationId} runId={message.run_id} />
        )}
      </Content>
    </MessageRow>
  );
}
