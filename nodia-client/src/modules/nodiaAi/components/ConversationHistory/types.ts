import type { NodiaAiConversation } from "../../infrastructure/types";

export type ConversationAction = "rename" | "pin" | "archive";
export type ConversationFilters = { search: string; archive: "active" | "archived" | "all"; pinned: boolean; view: "own" | "all" };
export interface ConversationHistoryProps {
  items: NodiaAiConversation[];
  selectedId: string | null;
  filters: ConversationFilters;
  canViewAll: boolean;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  disabled: boolean;
  hasMore: boolean;
  onFilters: (filters: ConversationFilters) => void;
  onSelect: (id: string) => void;
  onAction: (chat: NodiaAiConversation, action: ConversationAction, anchor: HTMLElement) => void;
  onRetry: () => void;
  onMore: () => void;
}
