import { useId, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
} from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type {
  RentalPreviewInput,
  RentalCancellationPreview,
  RentalProperty,
  RentalReservation,
} from "../../types";
import {
  useRentalCancellationPreview,
  useRentalBusy,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";
import RentalIntentReview from "../RentalIntentReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import {
  cancellationSchema,
  cancellationPayload,
  type CancellationForm,
} from "./schema";
import { FormContainer, ModalActions } from "./styles";
export type ReservationCancelProps = {
  property: RentalProperty;
  reservation: RentalReservation;
  open: boolean;
  onClose: () => void;
};
export default function ReservationCancel({
  property,
  reservation,
  open,
  onClose,
}: ReservationCancelProps) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const platform = reservation.channel === "airbnb";
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CancellationForm>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: {
      cancelled_at: new Date().toISOString(),
      refund_amount: platform ? "0" : "",
      resolution_note: "",
    },
  });
  const values = useWatch({ control });
  const [input, setInput] = useState<RentalPreviewInput>();
  const [accepted, setAccepted] = useState<string>();
  const [calculation, setCalculation] = useState<RentalCancellationPreview>();
  const [ledgerAtPreview, setLedgerAtPreview] = useState<string>();
  const preview = useRentalCancellationPreview(property.id, reservation.id);
  const latest = useRentalRecord(
    "reservations",
    property.id,
    reservation.id,
    open,
  );
  const ledger = latest.data
    ? `${latest.data.received_amount}:${latest.data.refunded_amount}:${latest.data.status}`
    : undefined;
  let current: RentalPreviewInput | undefined;
  try {
    current = cancellationPayload(cancellationSchema.parse(values), platform);
  } catch {
    /* Incomplete manual resolution cannot be previewed. */
  }
  const fresh =
    !latest.isError &&
    !!input &&
    !!current &&
    JSON.stringify(input) === JSON.stringify(current) &&
    !!calculation &&
    !preview.isPending &&
    !preview.error &&
    ledgerAtPreview === ledger;
  const reviewed = fresh && accepted === calculation?.as_of;
  const busy =
    commonBusy ||
    mutation.isPending ||
    mutation.isUncertain ||
    isSubmitting ||
    preview.isPending;
  const calculate = useBookingSubmit(async (value: RentalPreviewInput) => {
    setAccepted(undefined);
    setCalculation(undefined);
    setInput(value);
    const result = await preview.execute(value);
    setLedgerAtPreview(ledger);
    return result;
  }, setCalculation);
  const submit = useBookingSubmit(
    async (value: CancellationForm) => {
      if (!reviewed || !calculation || calculation.refund_amount === null)
        return undefined;
      const ack = await mutation.execute({
        operation: "reservation.cancel",
        id: reservation.id,
        data: {
          ...cancellationPayload(value, platform),
          expected_refund_amount: calculation.refund_amount,
        },
      });
      if (!ack) {
        setAccepted(undefined);
        setCalculation(undefined);
      }
      return ack;
    },
    () => onClose(),
  );
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      disableEscapeKeyDown={busy}
      title={t("rental:cancel_reservation")}
      actions={
        <ModalActions>
          <Button disabled={busy} onClick={onClose}>
            {t("rental:close")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            color="warning"
            disabled={busy || !reviewed}
          >
            {t("rental:cancel_reservation")}
          </Button>
        </ModalActions>
      }
    >
      <FormContainer id={formId} onSubmit={handleSubmit(submit)}>
        <Alert severity="info">{t("rental:cancel_explanation")}</Alert>
        <Controller
          name="cancelled_at"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("rental:cancelled_at")}
              disabled={busy}
              error={!!errors.cancelled_at}
              helperText={
                errors.cancelled_at?.message
                  ? t(errors.cancelled_at.message)
                  : t("rental:instant_with_offset")
              }
            />
          )}
        />
        {platform && (
          <>
            <Controller
              name="refund_amount"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t("rental:refund_amount")}
                  disabled={busy}
                  error={!!errors.refund_amount}
                />
              )}
            />
            <Controller
              name="resolution_note"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t("rental:resolution_note")}
                  disabled={busy}
                  multiline
                />
              )}
            />
          </>
        )}
        <Button
          disabled={busy || !current || latest.isError}
          onClick={() => {
            if (current) void calculate(current);
          }}
        >
          {t("rental:preview_cancellation")}
        </Button>
        {!!preview.error && (
          <Alert severity="error">{t("rental:load_error")}</Alert>
        )}
        {fresh && calculation && (
          <>
            <Typography>
              {t("rental:approved_refund")}:{" "}
              {calculation.refund_amount === null
                ? t("rental:not_recorded")
                : formatRentalAmount(calculation.refund_amount, i18n.language)}
            </Typography>
            <Typography>
              {t("rental:days_before")}:{" "}
              {calculation.cancellation_snapshot.days_before}
            </Typography>
            <Typography>
              {t("rental:refund_due_after_cancellation")}:{" "}
              {formatRentalAmount(
                calculation.refund_due_after_cancellation,
                i18n.language,
              )}
            </Typography>
            <FormControlLabel
              label={t("rental:review_cancel_amount")}
              control={
                <Checkbox
                  disabled={busy || calculation.refund_amount === null}
                  checked={reviewed}
                  onChange={(_, checked) =>
                    setAccepted(checked ? calculation.as_of : undefined)
                  }
                />
              }
            />
          </>
        )}
        {input && !fresh && !preview.isPending && (
          <Alert severity="warning">{t("rental:preview_needs_refresh")}</Alert>
        )}
        <RentalIntentReview mutation={mutation} onResolved={onClose} />
      </FormContainer>
    </BaseModal>
  );
}
