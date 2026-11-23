import { Alert, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { FlashcardProposalPart } from "../../infrastructure/flashcardLibraryProposal";
import type { Selection } from "../../infrastructure/schemas";
import type { useFlashcardProposalSelection } from "../../infrastructure/useFlashcardProposalSelection";

export function FlashcardProposalSelection({ kind, state, choice, disabled, onChange }: {
  kind: FlashcardProposalPart;
  state: ReturnType<typeof useFlashcardProposalSelection>;
  choice: Selection | null;
  disabled: boolean;
  onChange: (choice: Selection | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const { options, connection, model, eligibility, result } = state;
  const reasonKey = result?.reason_code
    ? [`teacher:${result.reason_code}`, `teacher:reasons.${result.reason_code}`].find(key => i18n.exists(key))
    : undefined;
  return <Stack component="fieldset" spacing={1.5} sx={{
    m: 0, minWidth: 0, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5,
  }}>
    <Typography component="legend" variant="subtitle2" sx={{ px: 0.5 }}>{t(`teacher:flashcard_proposal.parts.${kind}`)}</Typography>
    <SelectSingleInput label={t("teacher:connection")} disabled={disabled} value={connection?.id ?? null}
      options={options.map(option => ({ value: option.id, label: option.label }))}
      onChange={value => {
        onChange(value ? { connection_id: value, mode: "api_key", model_id: "", effort_id: null } : null);
      }} />
    <SelectSingleInput label={t("teacher:model")} disabled={disabled || !connection} value={model?.model_id ?? null}
      options={(connection?.models ?? []).map(option => ({ value: option.model_id, label: option.label }))}
      onChange={value => { if (choice) onChange({ ...choice, model_id: value ?? "", effort_id: null }); }} />
    {model && model.efforts.length > 0 && <SelectSingleInput label={t("teacher:effort")} disabled={disabled}
      value={choice?.effort_id ?? null} placeholder={t("teacher:flashcard_proposal.no_effort")}
      options={model.efforts.map(option => ({ value: option.effort_id, label: option.label }))}
      onChange={value => { if (choice) onChange({ ...choice, effort_id: value }); }} />}
    {eligibility.isFetching && <Typography role="status" variant="caption">{t("teacher:checking_selection")}</Typography>}
    {!eligibility.isFetching && !eligibility.isError && result && !result.eligible && <Alert severity="warning">
      {t(reasonKey ?? "teacher:flashcard_proposal.unavailable_selection")}
    </Alert>}
    <QueryErrorAlert retryVariant="outlined" isError={eligibility.isError} isFetching={eligibility.isFetching}
      onRetry={eligibility.refetch} />
  </Stack>;
}
