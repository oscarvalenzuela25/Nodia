import { Box } from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import CreditScoreOutlined from "@mui/icons-material/CreditScoreOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentMethod } from "../../../../../infrastructure/salesTypes";
import { MethodButton, MethodGrid, MethodLabel } from "./styles";

const methods = [
  { value: "cash", Icon: PaymentsOutlined, tone: "success" },
  { value: "debit_card", Icon: CreditCardOutlined, tone: "primary" },
  { value: "credit_card", Icon: CreditScoreOutlined, tone: "warning" },
  { value: "bank_transfer", Icon: AccountBalanceOutlined, tone: "info" },
] as const;

export default function PaymentMethodButtons({ value, onChange, disabled }: { value: PaymentMethod; onChange: (value: PaymentMethod) => void; disabled: boolean }) {
  const { t } = useTranslation("business");
  const labelId = useId();
  return <Box>
    <MethodLabel id={labelId} variant="body2">{t("business:pos.payment_method")}</MethodLabel>
    <MethodGrid role="group" aria-labelledby={labelId}>
      {methods.map(({ value: method, Icon, tone }) => <MethodButton key={method} type="button" variant="outlined" tone={tone} aria-pressed={method === value} disabled={disabled} onClick={() => onChange(method)}>
        {method === value ? <CheckCircleOutlined /> : <Icon />}
        <span>{t(`business:pos.payment_${method}`)}</span>
      </MethodButton>)}
    </MethodGrid>
  </Box>;
}
