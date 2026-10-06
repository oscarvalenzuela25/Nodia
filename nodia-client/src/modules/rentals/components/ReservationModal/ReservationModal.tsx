import { useId } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { RentalProperty, RentalReservation } from "../../types";
import {
  useRentalList,
  useRentalMutation,
  useRentalBusy,
} from "../../infrastructure/useServices";
import { countNights } from "../../utils/dates";
import {
  estimateRentalTotal,
  formatRentalAmount,
  percentBasisPoints,
} from "../../utils/money";
import RentalActiveSwitch from "../RentalActiveSwitch";
import RentalRemoteSelect from "../RentalRemoteSelect";
import RentalIntentReview from "../RentalIntentReview";
import { useBookingSubmit } from "./hooks/useBookingSubmit";
import {
  agreementEditable,
  reservationPayload,
  reservationSchema,
  type ReservationForm,
} from "./schema";
import { FormContainer, ModalActions } from "./styles";
export type ReservationModalProps = {
  property: RentalProperty;
  open: boolean;
  onClose: () => void;
  initialData?: RentalReservation;
  onSaved?: (id: string) => void;
};
export default function ReservationModal({
  property,
  open,
  onClose,
  initialData,
  onSaved,
}: ReservationModalProps) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const history = useRentalList(
    "payments",
    property.id,
    { limit: 1, reservation_id: initialData?.id },
    !!initialData,
  );
  const editable = !initialData
    ? property.is_active
    : agreementEditable(
        initialData.status,
        history.data?.meta.total_items,
        property.is_active,
      );
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReservationForm>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      guest_name: initialData?.guest_name ?? "",
      guest_contact: initialData?.guest_contact ?? "",
      guests_count: String(initialData?.guests_count ?? 1),
      channel: initialData?.channel ?? "whatsapp",
      external_reference: initialData?.external_reference ?? "",
      check_in_on: initialData?.check_in_on ?? "",
      check_out_on: initialData?.check_out_on ?? "",
      check_in_time: initialData?.check_in_time ?? property.check_in_time,
      check_out_time: initialData?.check_out_time ?? property.check_out_time,
      nightly_rate: initialData?.nightly_rate ?? "",
      cleaning_fee: initialData?.cleaning_fee ?? "0",
      discount_amount: initialData?.discount_amount ?? "0",
      commission_amount: initialData?.commission_amount ?? "0",
      deposit_amount: initialData?.deposit_amount ?? "",
      deposit_due_at: initialData?.deposit_due_at ?? "",
      balance_due_at: initialData?.balance_due_at ?? "",
      cancellation_policy_id: initialData?.cancellation_policy_id ?? null,
      notes: initialData?.notes ?? "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const values = useWatch({ control });
  const busy =
    useRentalBusy(property.id) ||
    mutation.isPending ||
    mutation.isUncertain ||
    isSubmitting ||
    history.isFetching;
  const submit = useBookingSubmit(
    async (value: ReservationForm) =>
      initialData
        ? mutation.execute({
            operation: "reservation.update",
            id: initialData.id,
            data: reservationPayload(value, editable),
          })
        : mutation.execute({
            operation: "reservation.create",
            data: {
              ...value,
              ...reservationPayload(value, true),
              guests_count: Number(value.guests_count),
              notes: value.notes.trim() || null,
              external_reference: value.external_reference.trim() || null,
              deposit_due_at: value.deposit_due_at || null,
              balance_due_at: value.balance_due_at || null,
            },
          }),
    (ack) => {
      onSaved?.(ack.resource_id);
      onClose();
    },
  );
  let total: string | undefined;
  let nights: number | undefined;
  try {
    nights = countNights(values.check_in_on ?? "", values.check_out_on ?? "");
    total = estimateRentalTotal(
      values.nightly_rate ?? "",
      nights,
      values.cleaning_fee ?? "0",
      values.discount_amount ?? "0",
    );
  } catch {
    /* Incomplete quote remains editable. */
  }
  const fields: Array<{
    name: Exclude<
      keyof ReservationForm,
      "channel" | "cancellation_policy_id" | "is_active"
    >;
    type?: string;
    personal?: boolean;
  }> = [
    { name: "guest_name", personal: true },
    { name: "guest_contact", personal: true },
    { name: "guests_count" },
    { name: "external_reference" },
    { name: "check_in_on", type: "date" },
    { name: "check_out_on", type: "date" },
    { name: "check_in_time", type: "time" },
    { name: "check_out_time", type: "time" },
    { name: "nightly_rate" },
    { name: "cleaning_fee" },
    { name: "discount_amount" },
    { name: "commission_amount" },
    { name: "deposit_amount" },
    { name: "deposit_due_at" },
    { name: "balance_due_at" },
    { name: "notes", personal: true },
  ];
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t(
        initialData ? "rental:edit_reservation" : "rental:new_reservation",
      )}
      size="lg"
      disableEscapeKeyDown={busy}
      actions={
        <ModalActions>
          <Button disabled={busy} onClick={onClose}>
            {t("rental:close")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            disabled={busy || (!initialData && !property.is_active)}
          >
            {t("rental:save")}
          </Button>
        </ModalActions>
      }
    >
      <FormContainer id={formId} onSubmit={handleSubmit(submit)}>
        <Alert severity="info">
          {t("rental:quote_explanation", { timezone: property.timezone })}
        </Alert>
        {initialData && !editable && (
          <Alert severity={history.isError ? "error" : "info"}>
            {t(
              history.isError
                ? "rental:history_unavailable"
                : "rental:agreement_locked",
            )}{" "}
            {history.isError && (
              <Button disabled={busy} onClick={() => history.refetch()}>
                {t("rental:retry")}
              </Button>
            )}
          </Alert>
        )}
        {!initialData && (
          <Button
            disabled={busy || !property.is_active}
            onClick={() => {
              if (property.default_nightly_rate !== null)
                setValue("nightly_rate", property.default_nightly_rate);
              setValue(
                "cancellation_policy_id",
                property.default_cancellation_policy_id,
              );
              if (property.default_deposit_percent !== null) {
                try {
                  const proposedTotal = estimateRentalTotal(
                    property.default_nightly_rate ?? values.nightly_rate ?? "",
                    countNights(
                      values.check_in_on ?? "",
                      values.check_out_on ?? "",
                    ),
                    values.cleaning_fee ?? "0",
                    values.discount_amount ?? "0",
                  );
                  const basis = percentBasisPoints(
                    property.default_deposit_percent,
                  );
                  setValue(
                    "deposit_amount",
                    ((BigInt(proposedTotal) * basis) / 10000n).toString(),
                  );
                } catch {
                  /* An incomplete quote cannot suggest a deposit. */
                }
              }
            }}
          >
            {t("rental:apply_house_suggestions")}
          </Button>
        )}
        <Controller
          name="channel"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("rental:channel")}
              value={field.value}
              options={["whatsapp", "airbnb", "facebook", "other"].map(
                (value) => ({ value, label: t(`rental:channel_${value}`) }),
              )}
              disabled={busy || !editable}
              clearable={false}
              onChange={(value) => {
                if (value) {
                  field.onChange(value);
                  if (value === "airbnb") {
                    setValue("deposit_amount", "0");
                    setValue("cancellation_policy_id", null);
                  }
                }
              }}
            />
          )}
        />
        {fields.map(({ name, type, personal }) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label={t(`rental:${name}`)}
                value={field.value}
                type={type}
                disabled={
                  busy ||
                  (!personal && !editable) ||
                  (name === "deposit_amount" && values.channel === "airbnb")
                }
                multiline={name === "notes"}
                error={!!errors[name]}
                helperText={
                  errors[name]?.message
                    ? t(errors[name].message)
                    : name.endsWith("_at")
                      ? t("rental:instant_with_offset")
                      : undefined
                }
              />
            )}
          />
        ))}
        <Controller
          name="cancellation_policy_id"
          control={control}
          render={({ field }) => (
            <RentalRemoteSelect
              resource="cancellation-policies"
              propertyId={property.id}
              label={t("rental:cancellation_policy")}
              value={field.value}
              onChange={field.onChange}
              disabled={busy || !editable || values.channel === "airbnb"}
              query={{ active: "active" }}
            />
          )}
        />
        <Typography>
          {t("rental:quote_total", {
            nights: nights ?? "—",
            amount: total ? formatRentalAmount(total, i18n.language) : "—",
          })}
        </Typography>
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <RentalActiveSwitch
              confirmChanges={Boolean(initialData)}
              confirmationMessage={t("rental:archive_occupancy_explanation")}
              checked={field.value}
              onChange={field.onChange}
              disabled={busy}
            />
          )}
        />
        <Alert severity="info">
          {t("rental:archive_occupancy_explanation")}
        </Alert>
        <RentalIntentReview
          mutation={mutation}
          onResolved={(ack) => {
            onSaved?.(ack.resource_id);
            onClose();
          }}
        />
      </FormContainer>
    </BaseModal>
  );
}
