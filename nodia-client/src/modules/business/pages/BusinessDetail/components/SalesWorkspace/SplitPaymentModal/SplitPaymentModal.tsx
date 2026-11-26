import { useId } from "react";
import { Alert, Box, Button, InputAdornment, LinearProgress, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../components/inputs/TextInput";
import { positivePaymentAmount, splitPaymentDraft } from "../../../../../infrastructure/salePayments";
import { formatClp } from "../../../../../infrastructure/salesPolicies";
import type { PosPaymentMethod, SalePayment } from "../../../../../infrastructure/salesTypes";
import { AmountRow, Balance, DialogActions, PaymentForm } from "./styles";

interface Props {
  open: boolean;
  busy: boolean;
  blockedReason?: "storage" | "catalog";
  total: string;
  methods: readonly PosPaymentMethod[];
  pending: boolean;
  onConfirm: (payments: SalePayment[]) => Promise<void>;
  onClose: () => void;
  onReconcile: () => Promise<void>;
  onRetry: () => Promise<void>;
}

const EMPTY_AMOUNTS: Record<PosPaymentMethod, string> = { cash: "", card: "", bank_transfer: "" };

export default function SplitPaymentModal({ open, busy, blockedReason, total, methods, pending, onConfirm, onClose, onReconcile, onRetry }: Props) {
  const { t, i18n } = useTranslation("business");
  const formId = useId();
  const balanceId = useId();
  const { control, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: EMPTY_AMOUNTS });
  const [cash, card, bankTransfer] = useWatch({ control, name: ["cash", "card", "bank_transfer"] });
  const { remaining, payments } = splitPaymentDraft(methods, { cash, card, bank_transfer: bankTransfer }, total);
  const saving = busy || isSubmitting;
  const disabled = saving || pending || Boolean(blockedReason);
  const balanceLabel = remaining > 0n ? "business:pos.split_payment_remaining"
    : remaining < 0n ? "business:pos.split_payment_excess"
      : payments ? "business:pos.split_payment_complete" : "business:pos.split_payment_positive";
  const balanceValue = remaining === 0n ? (payments ? total : null) : String(remaining < 0n ? -remaining : remaining);

  const submit = handleSubmit(async (values) => {
    if (disabled) return;
    const checked = splitPaymentDraft(methods, values, total).payments;
    if (checked) await onConfirm(checked);
  });

  return <BaseModal open={open} size="sm" title={t("business:pos.split_payment_title")}
    showCloseButton={false} onClose={() => { if (!saving) onClose(); }}
    actions={<DialogActions>
      {pending && !isSubmitting ? <>
        <Button variant="outlined" disabled={saving} onClick={onClose}>{t("business:pos.split_payment_back")}</Button>
        <Button variant="outlined" disabled={saving || Boolean(blockedReason)} onClick={() => void onReconcile()}>{t("business:pos.reconcile")}</Button>
        <Button variant="contained" disabled={saving || Boolean(blockedReason)} onClick={() => void onRetry()}>{t("business:pos.retry_same")}</Button>
      </> : <>
        <Button variant="outlined" disabled={saving} onClick={onClose}>{t("business:pos.split_payment_back")}</Button>
        <Button variant="contained" type="submit" form={formId} disabled={disabled || !payments}>{t("business:pos.complete")}</Button>
      </>}
    </DialogActions>}>
    <PaymentForm as="form" id={formId} aria-busy={saving} onSubmit={(event) => void submit(event)}>
      <AmountRow>
        <Typography>{t("business:pos.checkout_total")}</Typography>
        <Typography variant="h6" sx={{ textAlign: "end", overflowWrap: "anywhere", fontWeight: 700 }}>{formatClp(total, i18n.language)}</Typography>
      </AmountRow>
      {methods.map((method) => {
        const inputId = formId + "-" + method;
        return <Controller key={method} name={method} control={control} render={({ field }) => {
          const invalid = field.value !== "" && positivePaymentAmount(field.value) === null;
          return <AmountRow>
            <Typography component="label" htmlFor={inputId} sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{t(`business:pos.payment_${method}`)}</Typography>
            <TextInput id={inputId} name={field.name} value={field.value} inputMode="numeric"
              onChange={(event) => field.onChange(event.target.value)} onBlur={field.onBlur}
              disabled={disabled} error={invalid} helperText={invalid ? t("business:pos.split_payment_positive") : undefined}
              aria-describedby={invalid ? `${balanceId} ${inputId}-helper-text` : balanceId}
              endAdornment={<InputAdornment position="end">CLP</InputAdornment>} />
          </AmountRow>;
        }} />;
      })}
      <Balance id={balanceId} role="status" sx={{ color: remaining < 0n ? "error.main" : payments ? "success.main" : "text.secondary" }}>
        <Typography variant="body2">{t(balanceLabel)}</Typography>
        {balanceValue !== null && <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{formatClp(balanceValue, i18n.language)}</Typography>}
      </Balance>
      {pending && !isSubmitting && <Alert severity="warning">{t("business:pos.pending")}</Alert>}
      {blockedReason && <Alert severity={blockedReason === "storage" ? "error" : "warning"}>
        {t(blockedReason === "storage" ? "business:pos.workspace_storage_error" : "business:stock_tracking.review_required")}
      </Alert>}
      {saving && <Box aria-hidden="true"><LinearProgress /></Box>}
    </PaymentForm>
  </BaseModal>;
}
