import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ConfigureProviderModalProps {
  open: boolean;
  provider: AiProviderHealthItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}
