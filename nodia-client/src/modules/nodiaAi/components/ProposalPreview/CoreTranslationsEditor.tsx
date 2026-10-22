import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TranslationInput from "../../../../components/inputs/TranslationInput";
import type { CoreTranslationDraft } from "../../infrastructure/coreReview";
import { ReviewActions } from "./styles";

export default function CoreTranslationsEditor({ label, value, onChange, disabled, error, maximum }: {
  label: string; value: CoreTranslationDraft[]; onChange: (value: CoreTranslationDraft[]) => void; disabled: boolean; error: boolean; maximum: string | null;
}) {
  const { t } = useTranslation("nodiaAi");
  const change = (id: string, patch: Partial<CoreTranslationDraft>) => onChange(value.map(row => row.row_id === id ? { ...row, ...patch } : row));
  return <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <Typography component="legend" variant="subtitle2">{label}</Typography>
    {value.length === 0 && <Typography variant="body2">{t("proposal.core_empty_translations")}</Typography>}
    {value.map((row, index) => <Box key={row.row_id} sx={{ minWidth: 0 }}>
      <TranslationInput label={t("proposal.core_translation", { position: index + 1 })} value={row.key} translations={{ es: row.es, en: row.en }} defaultExpanded required disabled={disabled} error={error}
        onChangeKey={key => change(row.row_id, { key })} onChangeTranslations={translations => change(row.row_id, { es: translations.es, en: translations.en })} />
      <ReviewActions><Button type="button" disabled={disabled} onClick={() => onChange(value.filter(item => item.row_id !== row.row_id))}>{t("proposal.core_remove_translation", { position: index + 1 })}</Button></ReviewActions>
    </Box>)}
    {error && <Alert severity="error">{t("proposal.core_translations_invalid")}</Alert>}
    <ReviewActions><Button type="button" disabled={disabled || maximum !== null && BigInt(value.length) >= BigInt(maximum)} onClick={() => onChange([...value, { row_id: crypto.randomUUID(), key: "", es: "", en: "" }])}>{t("proposal.core_add_translation")}</Button></ReviewActions>
  </Box>;
}
