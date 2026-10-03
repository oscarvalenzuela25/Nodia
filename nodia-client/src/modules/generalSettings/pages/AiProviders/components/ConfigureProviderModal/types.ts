import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ConfigureProviderModalProps {
  open: boolean;
  provider: AiProviderHealthItem | null;
  totalProviders?: number;
  onClose: () => void;
  onSuccess?: () => void;
}
