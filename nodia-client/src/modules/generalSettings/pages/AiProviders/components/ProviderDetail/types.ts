import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ProviderDetailProps {
  providerId: string;
  onBack: () => void;
  onRenewSession?: () => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
}
