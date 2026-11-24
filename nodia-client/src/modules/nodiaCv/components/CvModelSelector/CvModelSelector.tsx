import { useTranslation } from "react-i18next";
import AiComposerSelector, { type AiComposerSelectorProps } from "../../../../components/AiComposerSelector";
import type { NodiaAiConnection, NodiaAiSelection } from "../../../nodiaAi/infrastructure/types";

export type CvModelConnection = Omit<NodiaAiConnection, "modes"> & {
  modes: (NodiaAiConnection["modes"][number] & { cv_transport: "available" | "unsupported" })[];
};

export interface CvModelEligibility {
  selection: NodiaAiSelection;
  eligible: boolean;
  reason_code: "agentic_transport_unavailable" | "configuration_unavailable" | "qualification_required" | "qualified";
}

export type CvModelSelectorProps = Omit<AiComposerSelectorProps<CvModelConnection>, "labels" | "unavailableMode" | "eligibility"> & {
  eligibility: CvModelEligibility | null;
};

export default function CvModelSelector({ eligibility, ...props }: CvModelSelectorProps) {
  const { t } = useTranslation("nodiaCv");
  return (
    <AiComposerSelector {...props}
      eligibility={eligibility && { selection: eligibility.selection, available: eligibility.eligible, reason: eligibility.reason_code }}
      unavailableMode={(connection, mode) => {
        const configuration = connection.modes.find(item => item.mode === mode);
        if (!configuration || configuration.cv_transport === "available") return null;
        return {
          label: t("model_selector.unsupported"),
          message: t(mode === "agentic" ? "model_selector.agentic_transport_unavailable" : "model_selector.selection_unavailable"),
        };
      }}
      labels={{
        title: t("model_selector.title"),
        trigger: t("model_selector.title"),
        choose: t("model_selector.choose"),
        unsaved: t("model_selector.unsaved"),
        scope: t("model_selector.scope"),
        noConnections: t("model_selector.no_connections"),
        selectionMissing: t("model_selector.selection_missing"),
        unavailableReason: reason => {
          switch (reason) {
            case "agentic_transport_unavailable": return t("model_selector.agentic_transport_unavailable");
            case "configuration_unavailable": return t("model_selector.configuration_unavailable");
            case "qualification_required": return t("model_selector.qualification_required");
            default: return t("model_selector.selection_unavailable");
          }
        },
      }} />
  );
}
