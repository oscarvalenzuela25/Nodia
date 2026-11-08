import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ProviderDetailProps {
  providerId: string;
  initialMode?: "api_key" | "agentic";
  onBack: () => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
}
