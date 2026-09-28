import type { AiProviderEntity } from "../../../../infrastructure/types";

export interface SyncModelsModalProps {
  open: boolean;
  provider: AiProviderEntity | null;
  onClose: () => void;
  onSuccess?: () => void;
}
