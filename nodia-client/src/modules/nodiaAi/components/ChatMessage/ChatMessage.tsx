import { useTranslation } from "react-i18next";
import { Alert, Box, Typography } from "@mui/material";
import useAuth from "../../../../hooks/useAuth";
import type { NodiaAiMessage } from "../../infrastructure/types";
import AttachmentMessage from "../Attachments/AttachmentMessage";
import { HistoricalObservation } from "../ExecutionObservation";
import MessageMarkdown from "../MessageMarkdown";
import { Avatar, Bubble, Content, Identity, MessageRow, MessageText } from "./styles";

interface ChatMessageProps {
  message: NodiaAiMessage;
  conversationId: string;
  currentRunId?: string;
}

export default function ChatMessage({ message, conversationId, currentRunId }: ChatMessageProps) {
  const { t, i18n } = useTranslation("nodiaAi");
  const { user } = useAuth();
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

  return (
    <MessageRow isOwner={isOwner} aria-label={author}>
      <Avatar isOwner={isOwner} aria-hidden="true"
        src={isOwner ? user?.image_url ?? undefined : undefined}
        alt={isOwner ? user?.name ?? "" : ""}>
        {isOwner ? (user?.name || user?.email || "?").slice(0, 1).toUpperCase() : "N"}
      </Avatar>
      <Content>
        <Bubble isOwner={isOwner}>
          <Identity>
            <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: "inherit" }}>
              {author}
            </Typography>
            {hasDate && (
              <Box component="time" dateTime={message.created_at}
                title={new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(createdAt)}>
                {new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(createdAt)}
              </Box>
            )}
          </Identity>
          {message.status === "partial" && (
            <Alert severity="info" sx={{ mb: 1 }}>{t("organization.partial_message")}</Alert>
          )}
          {textBlocks.map((block, index) => block.text && (block.markdown
            ? <MessageMarkdown key={index} text={block.text} />
            : <MessageText key={index}>{block.text}</MessageText>))}
          {message.visibility === "visible" && message.parts.map(part => part.kind !== "text" && (
            <Box key={part.attachment_id} sx={{ mt: hasText ? 1.5 : 0, minWidth: 0 }}>
              <AttachmentMessage id={part.attachment_id} kind={part.kind} conversationId={conversationId} />
            </Box>
          ))}
        </Bubble>
        {message.visibility === "visible" && message.role === "assistant" && message.run_id && message.run_id !== currentRunId && (
          <HistoricalObservation conversationId={conversationId} runId={message.run_id} />
        )}
      </Content>
    </MessageRow>
  );
}
