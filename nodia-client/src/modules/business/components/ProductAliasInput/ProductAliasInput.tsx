import { useState, type ReactNode } from "react";
import { Checkbox, FormControlLabel } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { LabelTypography, RequiredStar } from "../../../../components/inputs/TextInput/styles";
import { AliasFields, AliasHeader } from "./styles";

type Props = {
  name: string;
  value: string | null | undefined;
  useName: boolean;
  onChange: (value: string) => void;
  onUseNameChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  required?: boolean;
  id?: string;
};

export default function ProductAliasInput({ name, value, useName, onChange, onUseNameChange, disabled, error, helperText, required, id = "product-alias" }: Props) {
  const { t } = useTranslation("business");
  const [editing, setEditing] = useState(false);
  return <AliasFields>
    <AliasHeader>
      <LabelTypography htmlFor={id}>{t("product_alias")}{required && <RequiredStar>*</RequiredStar>}</LabelTypography>
      <FormControlLabel label={t("product_alias_use_name")} control={<Checkbox checked={useName} disabled={disabled}
        onChange={(_, checked) => { setEditing(false); onUseNameChange(checked); }} />} />
    </AliasHeader>
    <TextInput id={id} name="alias" value={editing ? value ?? "" : useName ? name : value ?? ""}
      disabled={disabled} error={error} required={required} helperText={helperText ?? t("product_alias_help")}
      data-testid="product-alias-input" onChange={event => {
        const next = event.target.value;
        setEditing(true);
        onChange(next);
        onUseNameChange(!next.trim());
      }} onBlur={() => setEditing(false)} />
  </AliasFields>;
}
