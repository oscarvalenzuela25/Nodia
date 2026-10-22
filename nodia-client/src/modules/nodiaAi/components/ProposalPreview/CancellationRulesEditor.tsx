import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { NodiaAiCancellationRuleDraft } from "../../infrastructure/cancellationRulesReview";
import { ReviewActions } from "./styles";

export default function CancellationRulesEditor({ label, value, onChange, disabled, error }: {
  label: string; value: NodiaAiCancellationRuleDraft[]; onChange: (value: NodiaAiCancellationRuleDraft[]) => void; disabled: boolean; error: boolean;
}) {
  const { t } = useTranslation("nodiaAi");
  const change = (id: string, key: "min_days_before" | "refund_percent", text: string) => onChange(value.map(row => row.row_id === id ? { ...row, [key]: text } : row));
  return <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <Typography component="legend" variant="subtitle2">{label}</Typography>
    <Typography variant="body2">{t("proposal.rental_rules_help")}</Typography>
    {value.map((row, index) => <Box key={row.row_id} component="fieldset" sx={{ m: 0, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
      <Typography component="legend" variant="body2">{t("proposal.rental_rule", { position: index + 1 })}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
        <TextInput label={t("proposal.rental_fields.min_days_before")} required value={row.min_days_before} disabled={disabled} onChange={event => change(row.row_id, "min_days_before", event.target.value)} />
        <TextInput label={t("proposal.rental_fields.refund_percent")} required value={row.refund_percent} disabled={disabled} onChange={event => change(row.row_id, "refund_percent", event.target.value)} />
      </Box>
      <ReviewActions><Button type="button" disabled={disabled || value.length <= 1} aria-label={t("proposal.remove_rental_rule", { position: index + 1 })} onClick={() => onChange(value.filter(item => item.row_id !== row.row_id))}>{t("proposal.remove_rental_rule", { position: index + 1 })}</Button></ReviewActions>
    </Box>)}
    {error && <Alert severity="error">{t("proposal.rental_rules_invalid")}</Alert>}
    <ReviewActions><Button type="button" disabled={disabled || value.length >= 100} onClick={() => onChange([...value, { row_id: crypto.randomUUID(), min_days_before: "", refund_percent: "" }])}>{t("proposal.add_rental_rule")}</Button></ReviewActions>
  </Box>;
}
