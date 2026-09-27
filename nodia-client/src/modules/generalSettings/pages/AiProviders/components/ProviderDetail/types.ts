import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ProviderDetailProps {
  providerKey: string;
  onBack: () => void;
  onRenewSession?: () => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
}
