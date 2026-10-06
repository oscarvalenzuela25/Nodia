import { useId, useRef } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalAck, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";
import { todayInZone, toLocalDateTime } from "../../utils/dates";
import RentalRemoteSelect from "../RentalRemoteSelect";
import RentalIntentReview from "../RentalIntentReview";
import { buildPaymentPayload, paymentSchema, type PaymentForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type PaymentModalProps = {
  open: boolean;
  property: RentalProperty;
  onClose: () => void;
  reservationId?: string;
  initialType?: "payment" | "refund";
  onSaved?: (ack: RentalAck) => void;
};
function CaptureForm({
  open,
  property,
  onClose,
  reservationId,
  initialType = "payment",
  onSaved,
}: PaymentModalProps) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const locked = useRef(false);
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: {
      reservation_id: reservationId ?? "",
      type: initialType,
      amount: "",
      occurred_on: todayInZone(property.timezone),
      method: "",
      reference: "",
      notes: "",
      platform_reference: "",
      platform_description: "",
    },
  });
  const values = useWatch({ control });
  const reservation = useRentalRecord(
    "reservations",
    property.id,
    values.reservation_id || undefined,
    Boolean(values.reservation_id),
  );
  const row = reservation.data;
  const needsPlatformPolicy = Boolean(
    initialType === "payment" &&
    row?.channel === "airbnb" &&
    row.status === "draft" &&
    row.policy_snapshot === null,
  );
  const today = todayInZone(property.timezone);
  const limit = row
    ? initialType === "refund"
      ? row.refund_due_amount
      : row.balance_due_amount
    : null;
  const directBlocked = Boolean(
    initialType === "payment" &&
    row &&
    row.channel !== "airbnb" &&
    ((!row.cancellation_policy_id && !row.policy_snapshot) ||
      BigInt(row.deposit_amount) === 0n),
  );
  const stateBlocked = Boolean(
    row &&
    (initialType === "refund"
      ? row.status !== "cancelled" || row.refund_amount === null
      : row.status === "cancelled"),
  );
  const dateBlocked = Boolean(
    values.occurred_on &&
    (values.occurred_on > today ||
      (initialType === "refund" &&
        row?.cancelled_at &&
        values.occurred_on <
          toLocalDateTime(row.cancelled_at, property.timezone).slice(0, 10))),
  );
  const amountBlocked = Boolean(
    limit &&
    values.amount &&
    /^\d+$/.test(values.amount) &&
    BigInt(values.amount) > BigInt(limit),
  );
  const platformBlocked =
    needsPlatformPolicy &&
    (!values.platform_reference?.trim() ||
      !values.platform_description?.trim());
  const busy =
    globalBusy || mutation.isPending || isSubmitting || reservation.isFetching;
  const blocked =
    (row?.channel === "airbnb" && !row.external_reference?.trim()) ||
    !row ||
    reservation.isError ||
    directBlocked ||
    stateBlocked ||
    dateBlocked ||
    amountBlocked ||
    platformBlocked;
  const close = () => {
    if (!busy && !mutation.isUncertain) onClose();
  };
  const completed = (ack: RentalAck) => {
    onSaved?.(ack);
    onClose();
  };
  const submit = async (data: PaymentForm) => {
    if (busy || blocked || mutation.isUncertain || locked.current) return;
    locked.current = true;
    try {
      const ack = await mutation.execute({
        operation: "payment.create",
        data: buildPaymentPayload(data, needsPlatformPolicy),
      });
      if (ack) completed(ack);
    } catch {
      /* The shared mutation owns feedback and keeps this draft intact. */
    } finally {
      locked.current = false;
    }
  };
  const fields = [
    "amount",
    "occurred_on",
    "method",
    "reference",
    "notes",
    ...(needsPlatformPolicy
      ? ["platform_reference", "platform_description"]
      : []),
  ] as const;
  return (
    <BaseModal
      open={open}
      onClose={close}
      title={t(
        initialType === "refund"
          ? "rental:create_refund"
          : "rental:create_payment",
      )}
      actions={
        <ModalActions>
          <Button disabled={busy || mutation.isUncertain} onClick={close}>
            {t("core:cancel")}
          </Button>
          <Button
            variant="contained"
            form={formId}
            type="submit"
            disabled={busy || blocked || mutation.isUncertain || !isValid}
          >
            {t("rental:save")}
          </Button>
        </ModalActions>
      }
    >
      <RentalIntentReview mutation={mutation} onResolved={completed} />
      {row?.channel === "airbnb" && !row.external_reference?.trim() && (
        <Alert severity="warning">
          {t("rental:airbnb_reference_required")}
        </Alert>
      )}
      <FormContainer
        id={formId}
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        <Alert severity="info">{t("rental:payment_effective_hint")}</Alert>
        <Controller
          name="reservation_id"
          control={control}
          render={({ field }) => (
            <RentalRemoteSelect
              resource="reservations"
              propertyId={property.id}
              label={t("rental:reservation")}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              disabled={busy || mutation.isUncertain || Boolean(reservationId)}
              selectedLabel={row?.guest_name}
              query={{ active: "all" }}
            />
          )}
        />
        {limit !== null && (
          <Typography>
            {t("rental:payment_limit", {
              amount: formatRentalAmount(limit, i18n.language),
            })}
          </Typography>
        )}
        {directBlocked && (
          <Alert severity="warning">{t("rental:direct_policy_required")}</Alert>
        )}
        {stateBlocked && (
          <Alert severity="warning">{t("rental:payment_unavailable")}</Alert>
        )}
        {needsPlatformPolicy && (
          <Alert severity="info">{t("rental:platform_policy_hint")}</Alert>
        )}
        {fields.map((name) => (
          <Controller
            key={name}
            name={name as keyof PaymentForm}
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                value={String(field.value)}
                label={t(`rental:${name}`)}
                type={name === "occurred_on" ? "date" : "text"}
                required={[
                  "amount",
                  "occurred_on",
                  "platform_reference",
                  "platform_description",
                ].includes(name)}
                multiline={name === "notes" || name === "platform_description"}
                disabled={busy || mutation.isUncertain}
                error={
                  Boolean(errors[name as keyof PaymentForm]) ||
                  (name === "occurred_on" && dateBlocked) ||
                  (name === "amount" && amountBlocked)
                }
                helperText={
                  errors[name as keyof PaymentForm]?.message
                    ? t(errors[name as keyof PaymentForm]!.message!)
                    : name === "occurred_on" && dateBlocked
                      ? t("rental:invalid_date")
                      : name === "amount" && amountBlocked
                        ? t("rental:overpayment")
                        : undefined
                }
              />
            )}
          />
        ))}
      </FormContainer>
    </BaseModal>
  );
}
export default function PaymentModal(props: PaymentModalProps) {
  return props.open ? (
    <CaptureForm
      key={`${props.property.id}:${props.reservationId ?? "new"}:${props.initialType ?? "payment"}`}
      {...props}
    />
  ) : null;
}
