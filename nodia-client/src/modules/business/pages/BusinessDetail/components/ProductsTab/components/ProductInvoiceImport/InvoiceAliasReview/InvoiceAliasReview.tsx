import { useState } from "react";
import { Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../../../../components/BaseModal";
import ProductAliasInput from "../../../../../../../components/ProductAliasInput";
import { productAliasFits, resolveProductAlias } from "../../../../../../../infrastructure/productAliases";
import { Actions, Content } from "./styles";

interface Props {
  name: string;
  alias: string | null | undefined;
  disabled: boolean;
  onApply: (alias: string) => boolean;
  onClose: () => void;
}

/** A local human review; applying never changes the extracted name or writes HTTP. */
export default function InvoiceAliasReview({ name, alias, disabled, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(alias ?? "");
  const [useName, setUseName] = useState(Boolean(alias?.trim()) && alias?.trim() === name.trim());
  const resolved = resolveProductAlias(name, value, useName) ?? "";
  const tooLong = !productAliasFits(resolved);
  const invalid = !resolved || tooLong;
  const apply = () => { if (!disabled && !invalid && onApply(resolved)) onClose(); };
  return <BaseModal open title={t("business:invoice_alias_review_title")} subtitle={t("business:invoice_alias_review_description")}
    size="sm" onClose={() => { if (!disabled) onClose(); }} showCloseButton={!disabled}
    actions={<Actions><Button variant="outlined" disabled={disabled} onClick={onClose}>{t("core:cancel")}</Button>
      <Button variant="contained" data-testid="save-invoice-alias" disabled={disabled || invalid} onClick={apply}>{t("business:invoice_alias_save")}</Button></Actions>}>
    <Content onSubmit={event => { event.preventDefault(); apply(); }}>
      <Typography variant="caption" color="text.secondary">{t("business:invoice_alias_original_name")}</Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere", fontWeight: 600 }}>{name}</Typography>
      <ProductAliasInput id="invoice-alias" name={name} value={value} useName={useName} onChange={setValue} onUseNameChange={setUseName}
        disabled={disabled} required error={tooLong} helperText={t(tooLong ? "business:product_alias_invalid" : "business:invoice_alias_required")} />
    </Content>
  </BaseModal>;
}
