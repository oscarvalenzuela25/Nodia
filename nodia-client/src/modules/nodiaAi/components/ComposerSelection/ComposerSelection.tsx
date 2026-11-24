import { useTranslation } from "react-i18next";
import AiComposerSelector from "../../../../components/AiComposerSelector";
import { nodiaAiEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import type { ComposerSelectionProps } from "./types";

export default function ComposerSelection(props: ComposerSelectionProps) {
  const { t } = useTranslation("nodiaAi");
  return (
    <AiComposerSelector {...props} onApply={selection => props.onApply({ selection, routingEnabled: false })}
      labels={{
        title: t("configuration.title"),
        trigger: t("configuration.selection_panel.title"),
        choose: t("configuration.selection_panel.choose"),
        unsaved: t("configuration.selection_panel.unsaved"),
        scope: t("configuration.scope"),
        noConnections: t("configuration.no_connections"),
        selectionMissing: t("configuration.selection_missing"),
        unavailableReason: reason => t(nodiaAiEligibilityReasonKey(reason)),
      }} />
  );
}
