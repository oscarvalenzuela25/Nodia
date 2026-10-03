import type { AiProviderEntity } from "../../../../infrastructure/types";

export interface SyncModelsModalProps {
  open: boolean;
  provider: AiProviderEntity | null;
  isOperational?: boolean;
  mode?: string;
  onClose: () => void;
  onSuccess?: () => void;
}
