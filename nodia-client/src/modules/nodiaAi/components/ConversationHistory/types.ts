import type { Ref } from "react";
import type { NodiaAiConversation } from "../../infrastructure/types";

export type ConversationAction = "rename" | "pin" | "archive";
export type ConversationFilters = { search: string; archive: "active" | "archived" | "all"; pinned: boolean; view: "own" | "all" };
export const DEFAULT_CONVERSATION_FILTERS: Readonly<ConversationFilters> = Object.freeze({
  search: "", archive: "active", pinned: false, view: "own",
});
export interface ConversationHistoryProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  toggleRef?: Ref<HTMLButtonElement>;
  items: NodiaAiConversation[];
  selectedId: string | null;
  filters: ConversationFilters;
  filtersExpanded: boolean;
  onToggleFilters: () => void;
  canViewAll: boolean;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  disabled: boolean;
  hasMore: boolean;
  onFilters: (filters: ConversationFilters) => void;
  onSelect: (id: string) => void;
  onAction: (chat: NodiaAiConversation, action: ConversationAction, anchor: HTMLElement) => void;
  onPreferences?: (chatId: string) => void;
  onRetry: () => void;
  onMore: () => void;
}
