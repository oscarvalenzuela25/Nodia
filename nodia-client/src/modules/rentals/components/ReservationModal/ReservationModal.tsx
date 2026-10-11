import TimeInput from "../../../../components/inputs/TimeInput";
import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import DateInput from "../../../../components/inputs/DateInput";
import PhoneInput from "../../../../components/inputs/PhoneInput";
import {
  isPhoneContact,
  normalizedPhone,
  phoneContactParts,
} from "../../../../utils/phoneNumbers";
import { useId, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
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
import { countNights, addCivilDays } from "../../utils/dates";
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
import { FormContainer, ModalActions, FieldGrid, QuoteSummary } from "./styles";
export type ReservationModalProps = {
  property: RentalProperty;
  open: boolean;
  onClose: () => void;
  initialData?: RentalReservation;
  initialStay?: { check_in_on: string; check_out_on: string };
  onSaved?: (id: string) => void;
  readError?: boolean;
  onRetryRead?: () => void;
};
export default function ReservationModal({
  property,
  open,
  onClose,
  initialData,
  initialStay,
  onSaved,
  readError = false,
  onRetryRead,
}: ReservationModalProps) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const [step, setStep] = useState(0);
  const initialContact = phoneContactParts(initialData?.guest_contact ?? "");
  const [contactCountry, setContactCountry] = useState(initialContact.country);
  const [contactEdited, setContactEdited] = useState(false);
  const formSchema = reservationSchema.superRefine((value, ctx) => {
    if (
      contactEdited &&
      isPhoneContact(value.guest_contact) &&
      !normalizedPhone(contactCountry, value.guest_contact)
    )
      ctx.addIssue({
        code: "custom",
        path: ["guest_contact"],
        message: "rental:invalid_guest_phone",
      });
  });
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
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReservationForm>({
    resolver: zodResolver(formSchema),
    shouldFocusError: Boolean(initialData),
    defaultValues: {
      guest_name: initialData?.guest_name ?? "",
      guest_contact: initialContact.number,
      guests_count: String(initialData?.guests_count ?? 1),
      channel: initialData?.channel ?? "whatsapp",
      external_reference: initialData?.external_reference ?? "",
      check_in_on: initialData?.check_in_on ?? initialStay?.check_in_on ?? "",
      check_out_on:
        initialData?.check_out_on ?? initialStay?.check_out_on ?? "",
      check_in_time: initialData?.check_in_time ?? "",
      check_out_time: initialData?.check_out_time ?? "",
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
  const disabled = busy || readError;
  const submit = useBookingSubmit(
    async (form: ReservationForm) => {
      const value = {
        ...form,
        guest_contact: contactEdited
          ? (normalizedPhone(contactCountry, form.guest_contact) ??
            form.guest_contact)
          : (initialData?.guest_contact ?? form.guest_contact),
      };
      return initialData
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
          });
    },
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
    { name: "external_reference" },
    { name: "check_in_on", type: "date" },
    { name: "check_out_on", type: "date" },
    { name: "check_in_time", type: "time" },
    { name: "check_out_time", type: "time" },
    { name: "guests_count" },
    { name: "nightly_rate" },
    { name: "cleaning_fee" },
    { name: "discount_amount" },
    { name: "commission_amount" },
    { name: "deposit_amount" },
    { name: "deposit_due_at" },
    { name: "balance_due_at" },
    { name: "notes", personal: true },
  ];
  const stayFields = [
    "check_in_on",
    "check_out_on",
    "check_in_time",
    "check_out_time",
    "guests_count",
  ] as const;
  const guestFields = [
    "guest_name",
    "guest_contact",
    "channel",
    "external_reference",
  ] as const;
  const fieldStep = (name: keyof ReservationForm) =>
    (stayFields as readonly string[]).includes(name)
      ? 0
      : (guestFields as readonly string[]).includes(name)
        ? 1
        : 2;
  const advance = async () => {
    if (
      !disabled &&
      (await trigger(step === 0 ? [...stayFields] : [...guestFields], {
        shouldFocus: true,
      }))
    )
      setStep(step + 1);
  };
  let minCheckout: string | undefined;
  let maxCheckout: string | undefined;
  try {
    minCheckout = addCivilDays(values.check_in_on ?? "", 1);
    maxCheckout = addCivilDays(values.check_in_on ?? "", 366);
  } catch {
    /* Incomplete arrival drafts do not constrain the picker. */
  }
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
          {!initialData && step > 0 && (
            <Button disabled={busy} onClick={() => setStep(step - 1)}>
              {t("rental:wizard_back")}
            </Button>
          )}
          <Button
            onClick={
              !initialData && step < 2 ? () => void advance() : undefined
            }
            type={!initialData && step < 2 ? "button" : "submit"}
            form={formId}
            variant="contained"
            disabled={disabled || (!initialData && !property.is_active)}
          >
            {t(
              initialData
                ? "rental:save"
                : step < 2
                  ? "rental:wizard_continue"
                  : "rental:wizard_draft",
            )}
          </Button>
        </ModalActions>
      }
    >
      <FormContainer
        id={formId}
        onSubmit={(event) => {
          if (!initialData && step < 2) {
            event.preventDefault();
            void advance();
            return;
          }
          void handleSubmit(
            (value) => {
              if (!disabled) return submit(value);
            },
            (issues) => {
              if (!initialData) {
                const first = Object.keys(issues)[0] as keyof ReservationForm;
                setStep(fieldStep(first));
              }
            },
          )(event);
        }}
      >
        {!initialData && (
          <Stepper activeStep={step} alternativeLabel>
            {["stay", "guest", "agreement"].map((key) => (
              <Step key={key}>
                <StepLabel>{t("rental:wizard_" + key)}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}
        {readError && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy} onClick={onRetryRead}>
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:load_error")}
          </Alert>
        )}
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
        {!initialData && step === 2 && (
          <Button
            disabled={disabled || !property.is_active}
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
        {(initialData || step === 1) && (
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
                disabled={disabled || !editable}
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
        )}
        <FieldGrid>
          {fields
            .filter(({ name }) => initialData || fieldStep(name) === step)
            .map(({ name, type, personal }) => (
              <Controller
                key={name}
                name={name}
                control={control}
                render={({ field }) => {
                  if (name === "guest_contact")
                    return (
                      <PhoneInput
                        {...field}
                        label={t("rental:guest_contact")}
                        country={contactCountry}
                        disabled={disabled}
                        error={!!errors.guest_contact}
                        helperText={
                          errors.guest_contact?.message
                            ? t(errors.guest_contact.message)
                            : t("rental:guest_phone_help")
                        }
                        onCountryChange={(country) => {
                          setContactCountry(country);
                          setContactEdited(true);
                        }}
                        onChange={(event) => {
                          setContactEdited(true);
                          const parts = phoneContactParts(event.target.value);
                          if (parts.number !== event.target.value)
                            setContactCountry(parts.country);
                          field.onChange(parts.number);
                        }}
                      />
                    );
                  const Input =
                    type === "date"
                      ? DateInput
                      : type === "time"
                        ? TimeInput
                        : name.endsWith("_at")
                          ? DateTimeInput
                          : TextInput;
                  return (
                    <Box
                      sx={{
                        minWidth: 0,
                        gridColumn:
                          [
                            "guest_name",
                            "external_reference",
                            "guests_count",
                            "deposit_amount",
                            "notes",
                          ].includes(name) || name.endsWith("_at")
                            ? "1 / -1"
                            : undefined,
                      }}
                    >
                      <Input
                        {...field}
                        label={t(`rental:${name}`)}
                        value={field.value}
                        timezone={property.timezone}
                        minDate={
                          name === "check_out_on" ? minCheckout : undefined
                        }
                        maxDate={
                          name === "check_out_on" ? maxCheckout : undefined
                        }
                        disabled={
                          disabled ||
                          (!personal && !editable) ||
                          (name === "deposit_amount" &&
                            values.channel === "airbnb")
                        }
                        multiline={name === "notes"}
                        error={!!errors[name]}
                        helperText={
                          errors[name]?.message
                            ? t(errors[name].message)
                            : undefined
                        }
                      />
                    </Box>
                  );
                }}
              />
            ))}
        </FieldGrid>
        {(initialData || step === 2) && (
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
                disabled={disabled || !editable || values.channel === "airbnb"}
                query={{ active: "active" }}
              />
            )}
          />
        )}
        <QuoteSummary>
          <Typography>
            {t("rental:quote_total", {
              nights: nights ?? "—",
              amount: total ? formatRentalAmount(total, i18n.language) : "—",
            })}
          </Typography>
        </QuoteSummary>
        {(initialData || step === 2) && (
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <RentalActiveSwitch
                confirmChanges={Boolean(initialData)}
                confirmationMessage={t("rental:archive_occupancy_explanation")}
                checked={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        )}
        {(initialData || step === 2) && (
          <Alert severity="info">
            {t("rental:archive_occupancy_explanation")}
          </Alert>
        )}
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
