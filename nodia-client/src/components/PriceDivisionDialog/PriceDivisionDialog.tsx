import { useRef, useState } from "react";
import { Alert, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import BaseModal from "../BaseModal";
import TextInput from "../inputs/TextInput";
import { dividePrice, parseDivisionInput, type PriceDivisionMode } from "./calculation";
import { ActionButton, Actions, Content, Result } from "./styles";

export type PriceDivisionDialogProps = {
  open: boolean;
  value: number | null;
  mode: PriceDivisionMode;
  label: string;
  disabled?: boolean;
  onClose: () => void;
  onApply: (value: number) => void;
};

export default function PriceDivisionDialog(props: PriceDivisionDialogProps) {
  return props.open ? <DivisionEditor {...props} /> : null;
}

function DivisionEditor({ value, mode, label, disabled = false, onClose, onApply }: PriceDivisionDialogProps) {
  const { t, i18n } = useTranslation();
  const [price, setPrice] = useState(value !== null && Number.isFinite(value) ? String(value) : "");
  const [divisor, setDivisor] = useState("1");
  const applying = useRef(false);
  const result = dividePrice(parseDivisionInput(price), parseDivisionInput(divisor), mode);
  const apply = () => {
    if (disabled || result === null || applying.current) return;
    applying.current = true;
    try {
      onApply(result);
      sileo.success({ title: t("business:price_division.applied") });
      onClose();
    } finally { applying.current = false; }
  };
  return <BaseModal open title={t("business:price_division.title")} subtitle={label} onClose={onClose} actions={<Actions>
    <ActionButton variant="outlined" onClick={onClose}>{t("core:cancel")}</ActionButton>
    <ActionButton variant="contained" disabled={disabled || result === null} onClick={apply}>{t("business:price_division.apply")}</ActionButton>
  </Actions>}>
    <Content onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); } }}>
      <Typography color="text.secondary">{t(mode === "sale" ? "business:price_division.sale_help" : "business:price_division.net_help")}</Typography>
      <TextInput label={t("business:price_division.amount")} inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} disabled={disabled} />
      <TextInput label={t("business:price_division.divisor")} inputMode="decimal" value={divisor} onChange={event => setDivisor(event.target.value)} disabled={disabled} />
      <Result><Typography variant="body2" color="text.secondary">{t("business:price_division.result")}</Typography>
        <Typography variant="h5" component="p" role="status">{result === null ? "—" : new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(result)}</Typography>
      </Result>
      {result === null && <Alert severity="warning">{t("business:price_division.invalid")}</Alert>}
    </Content>
  </BaseModal>;
}
