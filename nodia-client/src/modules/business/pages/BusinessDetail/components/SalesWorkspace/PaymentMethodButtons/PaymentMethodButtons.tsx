import { Box, Switch } from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { manualPaymentMethod } from "../../../../../infrastructure/salePayments";
import type { PaymentMethod, PosPaymentMethod } from "../../../../../infrastructure/salesTypes";
import { MethodButton, MethodGrid, MethodHeader, MethodHint, MethodLabel, MethodName, MethodSelectionMark, PaymentSwitch } from "./styles";

const methods = [
  { value: "cash", Icon: PaymentsOutlined, tone: "success" },
  { value: "card", Icon: CreditCardOutlined, tone: "primary" },
  { value: "bank_transfer", Icon: AccountBalanceOutlined, tone: "info" },
] as const;

interface PaymentMethodButtonsProps {
  value: PaymentMethod;
  combined?: readonly PosPaymentMethod[];
  onCombineChange?: (enabled: boolean) => void;
  onChange: (value: PosPaymentMethod) => void;
  disabled: boolean;
}

export default function PaymentMethodButtons({ value, combined, onCombineChange, onChange, disabled }: PaymentMethodButtonsProps) {
  const { t } = useTranslation("business");
  const labelId = useId();
  const hintId = useId();
  const selected = combined ?? [manualPaymentMethod(value)];
  return <Box>
    <MethodHeader>
      <MethodLabel id={labelId}>{t("business:pos.payment_method")}</MethodLabel>
      {onCombineChange && <PaymentSwitch label={t("business:pos.combine_payments")} control={<Switch
        color="success" checked={combined !== undefined} disabled={disabled}
        onChange={(_, enabled) => onCombineChange(enabled)} slotProps={{ input: { role: "switch" } }}
      />} />}
    </MethodHeader>
    <MethodGrid role="group" aria-labelledby={labelId} aria-describedby={combined ? hintId : undefined}>
      {methods.map(({ value: method, Icon, tone }) => <MethodButton
        key={method} type="button" variant="outlined" tone={tone} aria-pressed={selected.includes(method)}
        disabled={disabled} onClick={() => onChange(method)}
      >
        <Icon className="payment-method-icon" />
        <MethodName>{t(`business:pos.payment_${method}`)}</MethodName>
        {selected.includes(method) && <MethodSelectionMark aria-hidden="true">
          <CheckCircleOutlined />
          {t("business:pos.payment_selected")}
        </MethodSelectionMark>}
      </MethodButton>)}
    </MethodGrid>
    {combined && <MethodHint id={hintId} aria-live="polite">
      {combined.length < 2
        ? t("business:pos.combine_payments_hint")
        : t("business:pos.combine_payments_selected", { count: combined.length })}
    </MethodHint>}
  </Box>;
}
