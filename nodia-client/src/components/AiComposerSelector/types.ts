import type { NodiaAiConnection, NodiaAiMode, NodiaAiSelection } from "../../modules/nodiaAi/infrastructure/types";

export interface AiComposerSelectorLabels {
  title: string;
  trigger: string;
  choose: string;
  unsaved: string;
  scope: string;
  noConnections: string;
  selectionMissing: string;
  unavailableReason: (reason: string | null) => string;
}

export interface AiComposerSelectorProps<Connection extends NodiaAiConnection = NodiaAiConnection> {
  connections: Connection[];
  selection: NodiaAiSelection | null;
  onSelectionChange: (draft: NodiaAiSelection | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  onApply: (selection: NodiaAiSelection) => void | Promise<void>;
  eligibility: { selection: NodiaAiSelection; available: boolean; reason: string | null } | null;
  eligibilityBusy: boolean;
  eligibilityError: string | null;
  onRetryEligibility: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isSaving: boolean;
  readOnly: boolean;
  error: string | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  labels: AiComposerSelectorLabels;
  unavailableMode?: (connection: Connection, mode: NodiaAiMode) => { label: string; message: string } | null;
}
