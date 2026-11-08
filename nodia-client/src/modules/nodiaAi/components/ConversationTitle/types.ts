import type { NodiaAiConversation } from "../../infrastructure/types";

export type ConversationTitleSnapshot = Pick<NodiaAiConversation, "conversation_id" | "title" | "revision">;

export interface ConversationTitleProps {
  conversation: ConversationTitleSnapshot;
  disabled: boolean;
  readOnly: boolean;
  busy: boolean;
  error: string | null;
  onSave: (title: string | null, expectedRevision: number) => Promise<void>;
  onRefresh: () => Promise<ConversationTitleSnapshot | null>;
}
