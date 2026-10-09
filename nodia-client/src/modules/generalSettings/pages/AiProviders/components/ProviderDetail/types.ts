import type { AiProviderHealthItem } from "../../infrastructure/types";

export interface ProviderDetailProps {
  providerId: string;
  initialMode?: "api_key" | "token_plan_web" | "token_plan_agentic";
  onBack: () => void;
  onRenewSession?: () => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
}
