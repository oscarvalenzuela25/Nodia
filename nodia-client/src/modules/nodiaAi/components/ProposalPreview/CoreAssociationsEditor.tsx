import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import { validCoreId } from "../../infrastructure/coreReview";
import { ReviewActions } from "./styles";

export default function CoreAssociationsEditor({ label, value, onChange, disabled, error, maximum, options }: {
  label: string; value: string[]; onChange: (value: string[]) => void; disabled: boolean; error: boolean; maximum: string | null; options: { value: string; label: string }[];
}) {
  const { t } = useTranslation("nodiaAi");
  const [newId, setNewId] = useState("");
  const [known, setKnown] = useState(value);
  const atLimit = maximum !== null && BigInt(value.length) >= BigInt(maximum);
  const canAdd = validCoreId(newId) && !value.includes(newId) && !atLimit;
  const add = () => { if (disabled || !canAdd) return; setKnown(items => [...new Set([...items, newId])]); onChange([...value, newId]); setNewId(""); };
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
    <SelectMultipleInput label={label} options={[...new Set([...known, ...value])].map(id => options.find(option => option.value === id) ?? { value: id, label: id })} value={value} onChange={onChange} disabled={disabled} error={error} />
    <Typography variant="caption" component="p">{t("proposal.core_associations_help")}</Typography>
    <TextInput label={t("proposal.core_association_id", { field: label })} value={newId} disabled={disabled || atLimit} onChange={event => setNewId(event.target.value)} />
    <ReviewActions><Button variant="contained" type="button" disabled={disabled || !canAdd} onClick={add}>{t("proposal.core_add_id")}</Button></ReviewActions>
    {error && <Alert severity="error">{t("proposal.core_ids_invalid")}</Alert>}
  </Box>;
}
