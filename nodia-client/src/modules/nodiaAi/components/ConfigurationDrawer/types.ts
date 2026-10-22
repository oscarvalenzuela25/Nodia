import type {
  NodiaAiConnection,
  NodiaAiEligibility,
  NodiaAiSelection,
} from "../../infrastructure/types";

export interface NodiaAiConfigurationChange {
  selection: NodiaAiSelection;
  routingEnabled: boolean;
}

export interface ConfigurationDrawerProps {
  open: boolean;
  onClose: () => void;
  connections: NodiaAiConnection[];
  selection: NodiaAiSelection | null;
  routingEnabled: boolean;
  onSelectionChange: (selection: NodiaAiSelection | null) => void;
  eligibility: NodiaAiEligibility | null;
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
  onApply: (change: NodiaAiConfigurationChange) => Promise<void>;
}
