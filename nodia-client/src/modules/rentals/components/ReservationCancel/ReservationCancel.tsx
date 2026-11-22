import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import { useCallback, useId, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
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
import {
  FormContainer,
  ModalActions,
  PreviewAction,
  PreviewAmounts,
  PreviewPanel,
} from "./styles";
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
  const previewId = useId();
  const focusPreview = useCallback((heading: HTMLHeadingElement | null) => {
    heading?.focus();
  }, []);
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
  const status = latest.data?.status;
  const canCancel = status === "draft" || status === "confirmed";
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
    canCancel &&
    !latest.isError &&
    !!input &&
    !!current &&
    JSON.stringify(input) === JSON.stringify(current) &&
    !!calculation &&
    !preview.isPending &&
    !preview.error &&
    ledgerAtPreview === ledger;
  const reviewed = fresh && accepted === calculation?.as_of;
  const canPreview = !!current && canCancel && !latest.isError;
  const busy =
    commonBusy ||
    mutation.isPending ||
    mutation.isUncertain ||
    isSubmitting ||
    latest.isFetching ||
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
      if (
        commonBusy ||
        mutation.isPending ||
        mutation.isUncertain ||
        latest.isFetching ||
        !reviewed ||
        !calculation ||
        calculation.refund_amount === null
      )
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
      subtitle={t("rental:reservation_action_context", {
        guest: reservation.guest_name,
        property: property.name,
      })}
      actions={
        <ModalActions>
          <Button
            autoFocus
            variant="outlined"
            color="inherit"
            disabled={busy}
            onClick={onClose}
          >
            {t("rental:keep_reservation")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            color="error"
            loading={mutation.isPending || isSubmitting}
            disabled={busy || !reviewed}
          >
            {t("rental:cancel_reservation")}
          </Button>
        </ModalActions>
      }
    >
      <FormContainer id={formId} onSubmit={handleSubmit(submit)}>
        <Typography variant="body2" color="text.secondary">
          {t("rental:cancel_explanation")}
        </Typography>
        {latest.isFetching && (
          <LinearProgress aria-label={t("rental:reservation_detail")} />
        )}
        {latest.isError && (
          <Alert
            severity="error"
            action={
              <Button disabled={latest.isFetching} onClick={() => void latest.refetch()}>
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:cancellation_read_error")}
          </Alert>
        )}
        {status && !canCancel && !latest.isError && (
          <Alert severity="warning">{t("rental:invalid_transition")}</Alert>
        )}
        <Controller
          name="cancelled_at"
          control={control}
          render={({ field }) => (
            <DateTimeInput
              {...field}
              timezone={property.timezone}
              label={t("rental:cancelled_at")}
              disabled={busy}
              error={!!errors.cancelled_at}
              helperText={
                errors.cancelled_at?.message
                  ? t(errors.cancelled_at.message)
                  : undefined
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
                  required
                  inputMode="numeric"
                  disabled={busy}
                  error={!!errors.refund_amount}
                  helperText={errors.refund_amount && t("rental:invalid_refund")}
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
                  required
                  disabled={busy}
                  error={!!errors.resolution_note}
                  helperText={errors.resolution_note && t("rental:invalid_refund")}
                  multiline
                />
              )}
            />
          </>
        )}
        <PreviewAction
          type="button"
          variant={fresh ? "outlined" : "contained"}
          disabled={busy || !canPreview}
          loading={preview.isPending}
          onClick={() => {
            if (canPreview && current && !busy) void calculate(current);
          }}
        >
          {t(preview.isPending ? "rental:cancellation_preview_checking" : "rental:preview_cancellation")}
        </PreviewAction>
        {!!preview.error && (
          <Alert severity="error">{t("rental:load_error")}</Alert>
        )}
        {fresh && calculation && (
          <PreviewPanel>
            <Typography
              component="h3"
              variant="subtitle1"
              sx={{ fontWeight: 700 }}
              ref={focusPreview}
              tabIndex={-1}
              aria-describedby={previewId}
            >
              {t("rental:cancellation_preview_heading")}
            </Typography>
            <PreviewAmounts id={previewId}>
              <div>
                <dt>{t("rental:calculated_refund")}</dt>
                <dd>
                  {calculation.refund_amount === null
                    ? t("rental:not_recorded")
                    : formatRentalAmount(calculation.refund_amount, i18n.language)}
                </dd>
              </div>
              <div>
                <dt>{t("rental:refund_due_after_cancellation")}</dt>
                <dd>
                  {formatRentalAmount(
                    calculation.refund_due_after_cancellation,
                    i18n.language,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("rental:days_before")}</dt>
                <dd>{calculation.cancellation_snapshot.days_before}</dd>
              </div>
            </PreviewAmounts>
            <FormControlLabel
              sx={{ minHeight: 44 }}
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
          </PreviewPanel>
        )}
        {input && !fresh && !preview.isPending && !preview.error && !latest.isError && canCancel && (
          <Alert severity="warning">{t("rental:preview_needs_refresh")}</Alert>
        )}
        <RentalIntentReview mutation={mutation} onResolved={onClose} />
      </FormContainer>
    </BaseModal>
  );
}
