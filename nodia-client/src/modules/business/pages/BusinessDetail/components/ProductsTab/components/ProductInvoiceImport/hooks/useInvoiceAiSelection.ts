import { useState } from "react";
import { useInvoiceSelectableModels } from "../../../../../../../infrastructure/useServices";
import type { VerifyIaProviderItem } from "../../../../../../../infrastructure/types";
import { getInvoiceAiModes, getInvoiceAiSelectionOptions, type InvoiceAiMode, type InvoiceAiOverride } from "../aiSelection";

/** Local overrides are scoped to this import, provider instance and connection mode. */
export const useInvoiceAiSelection = (
  provider: VerifyIaProviderItem | null,
  mode: InvoiceAiMode | null,
  importScope: string,
) => {
  const scope = JSON.stringify([importScope, provider?.id, mode]);
  const [selection, setSelection] = useState<{ scope: string; override: InvoiceAiOverride } | null>(null);
  const override = selection?.scope === scope ? selection.override : {};
  const modelsQuery = useInvoiceSelectableModels(
    provider?.id && mode && getInvoiceAiModes(provider).includes(mode)
      ? { provider_id: provider.id, mode }
      : null,
  );
  const observations = Array.isArray(modelsQuery.data) ? modelsQuery.data : [];
  const observation = observations.find(item => item && typeof item === "object" && item.providerId === provider?.id && item.mode === mode);
  // Only provider observations supply live capabilities; configuration is not availability.
  const observedModels = modelsQuery.isSuccess
    ? observation?.models_source === "provider" && Array.isArray(observation.models) ? observation.models : []
    : undefined;
  const configuration = getInvoiceAiSelectionOptions(provider, mode, override, observedModels);
  return {
    ...configuration,
    canAnalyze: configuration.canAnalyze && modelsQuery.isSuccess && !modelsQuery.isFetching,
    isFetching: modelsQuery.isFetching,
    isError: modelsQuery.isError,
    refetch: modelsQuery.refetch,
    selectModel: (model: string | null) => {
      if (model && configuration.modelOptions.some(item => item.value === model)) {
        setSelection({ scope, override: { model } });
      }
    },
    selectThinkingLevel: (thinkingLevel: string | null) => {
      if (thinkingLevel && configuration.thinkingOptions.some(item => item.value === thinkingLevel)) {
        setSelection({ scope, override: { model: configuration.model, thinkingLevel } });
      }
    },
  };
};
