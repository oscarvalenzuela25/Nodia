import { Box, Typography } from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import CreditScoreOutlined from "@mui/icons-material/CreditScoreOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentMethod } from "../../../../../infrastructure/salesTypes";
import { MethodButton, MethodGrid } from "./styles";

const methods = [
  { value: "cash", Icon: PaymentsOutlined },
  { value: "debit_card", Icon: CreditCardOutlined },
  { value: "credit_card", Icon: CreditScoreOutlined },
  { value: "bank_transfer", Icon: AccountBalanceOutlined },
] as const;

export default function PaymentMethodButtons({ value, onChange, disabled }: { value: PaymentMethod; onChange: (value: PaymentMethod) => void; disabled: boolean }) {
  const { t } = useTranslation("business");
  const labelId = useId();
  return <Box>
    <Typography id={labelId} sx={{ fontWeight: 600, mb: 1 }}>{t("business:pos.payment_method")}</Typography>
    <MethodGrid role="group" aria-labelledby={labelId}>
      {methods.map(({ value: method, Icon }) => <MethodButton key={method} type="button" variant={method === value ? "contained" : "outlined"} aria-pressed={method === value} disabled={disabled} onClick={() => onChange(method)}>
        <Icon sx={{ fontSize: 28 }} />
        <span>{t(`business:pos.payment_${method}`)}</span>
        {method === value && <CheckCircleOutlined sx={{ position: "absolute", top: 5, right: 5, fontSize: 16 }} />}
      </MethodButton>)}
    </MethodGrid>
  </Box>;
}
