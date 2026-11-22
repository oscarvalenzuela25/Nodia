import TimeInput from "../../../../components/inputs/TimeInput";
import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import DateInput from "../../../../components/inputs/DateInput";
import PhoneInput from "../../../../components/inputs/PhoneInput";
import {
  isPhoneContact,
  normalizedPhone,
  phoneContactParts,
} from "../../../../utils/phoneNumbers";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
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
  isRentalMoney,
  suggestedDeposit,
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
import ReservationReview from "./ReservationReview";
import {
  FieldGrid,
  FormContainer,
  QuoteSummary,
  WizardActions,
  WizardProgress,
} from "./styles";

const steps = ["stay", "guest", "agreement"] as const;
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
const numericFields: ReadonlyArray<keyof ReservationForm> = [
  "guests_count",
  "nightly_rate",
  "cleaning_fee",
  "discount_amount",
  "commission_amount",
  "deposit_amount",
];

function fieldStep(name: keyof ReservationForm) {
  if (stayFields.some((field) => field === name)) return 0;
  if (guestFields.some((field) => field === name)) return 1;
  return 2;
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const activeStepRef = useRef<HTMLLIElement>(null);
  const [step, setStep] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{
    field?: keyof ReservationForm;
  } | null>(null);
  const lastFocusRequest = useRef<typeof focusRequest>(null);
  const focusRecovery = useCallback((target: HTMLDivElement | null) => {
    target?.focus();
  }, []);
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
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<ReservationForm>({
    resolver: zodResolver(formSchema),
    shouldFocusError: false,
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
  const submitDisabled = disabled || (!initialData && !property.is_active);
  const creating = !initialData;
  const agreementStep = step === steps.length - 1;
  const agreementVisible = !creating || agreementStep;
  const direct = values.channel !== "airbnb";
  const hasSuggestions =
    property.default_nightly_rate !== null ||
    (direct &&
      (property.default_cancellation_policy_id !== null ||
        property.default_deposit_percent !== null));
  const moveToStep = (next: number, field?: keyof ReservationForm) => {
    setFocusRequest({ field });
    setStep(next);
  };
  useLayoutEffect(() => {
    if (!focusRequest || busy || lastFocusRequest.current === focusRequest)
      return;
    lastFocusRequest.current = focusRequest;
    const invalid = focusRequest.field
      ? formRef.current?.elements.namedItem(focusRequest.field)
      : undefined;
    if (invalid instanceof HTMLElement && !invalid.matches(":disabled")) {
      invalid.focus();
    } else {
      activeStepRef.current?.focus();
    }
  }, [busy, focusRequest]);
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
      "cancellation_policy_id" | "is_active"
    >;
    type?: string;
    personal?: boolean;
  }> = [
    { name: "check_in_on", type: "date" },
    { name: "check_out_on", type: "date" },
    { name: "check_in_time", type: "time" },
    { name: "check_out_time", type: "time" },
    { name: "guests_count" },
    { name: "guest_name", personal: true },
    { name: "guest_contact", personal: true },
    { name: "channel" },
    { name: "external_reference" },
    { name: "nightly_rate" },
    { name: "cleaning_fee" },
    { name: "discount_amount" },
    { name: "commission_amount" },
    { name: "deposit_amount" },
    { name: "deposit_due_at" },
    { name: "balance_due_at" },
    { name: "notes", personal: true },
  ];
  const advance = async () => {
    const currentFields = step === 0 ? [...stayFields] : [...guestFields];
    if (await trigger(currentFields)) {
      moveToStep(step + 1);
    } else {
      setFocusRequest({
        field: currentFields.find((name) => getFieldState(name).invalid),
      });
    }
  };
  const applyHouseSuggestions = () => {
    const {
      default_nightly_rate: rate,
      default_cancellation_policy_id: policy,
      default_deposit_percent: deposit,
    } = property;
    if (rate !== null) setValue("nightly_rate", rate, { shouldValidate: true });
    if (!direct) return;
    if (policy !== null) setValue("cancellation_policy_id", policy);
    if (deposit === null || nights === undefined) return;
    try {
      const proposedTotal = estimateRentalTotal(
        rate ?? values.nightly_rate ?? "",
        nights,
        values.cleaning_fee ?? "0",
        values.discount_amount ?? "0",
      );
      setValue("deposit_amount", suggestedDeposit(proposedTotal, deposit), {
        shouldValidate: true,
      });
    } catch {
      /* An incomplete quote cannot suggest a deposit. */
    }
  };
  const savedAgreement = editable ? undefined : initialData;
  const displayTotal = savedAgreement?.total_amount ?? total;
  const commission = values.commission_amount;
  const expectedTotal =
    displayTotal &&
    isRentalMoney(commission, true) &&
    BigInt(commission) < BigInt(displayTotal)
      ? (savedAgreement?.expected_amount ??
        (BigInt(displayTotal) - BigInt(commission)).toString())
      : undefined;
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
        <WizardActions>
          <Button
            disabled={busy}
            onClick={creating && step > 0 ? () => moveToStep(step - 1) : onClose}
            variant="outlined"
            color="inherit"
          >
            {t(creating && step > 0 ? "rental:wizard_back" : "rental:close")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            disabled={submitDisabled}
            loading={mutation.isPending || isSubmitting}
          >
            {t(
              creating
                ? agreementStep
                  ? "rental:wizard_draft"
                  : "rental:wizard_continue"
                : "rental:save",
            )}
          </Button>
        </WizardActions>
      }
    >
      <FormContainer
        id={formId}
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (submitDisabled) return;
          if (creating && !agreementStep) {
            void advance();
            return;
          }
          void handleSubmit(
            (value) => {
              if (!disabled) return submit(value);
            },
            (issues) => {
              const first = Object.keys(issues)[0] as keyof ReservationForm;
              if (first) moveToStep(creating ? fieldStep(first) : step, first);
            },
          )(event);
        }}
      >
        {creating && (
          <Stepper
            component={WizardProgress}
            role="list"
            aria-label={t("rental:wizard_progress")}
            activeStep={step}
            alternativeLabel
          >
            {steps.map((key, index) => (
              <Step
                component="li"
                key={key}
                aria-current={index === step ? "step" : undefined}
                tabIndex={index === step ? -1 : undefined}
                ref={index === step ? activeStepRef : undefined}
              >
                <StepLabel>{t(`rental:wizard_${key}`)}</StepLabel>
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
        {mutation.isUncertain && (
          <Box ref={focusRecovery} tabIndex={-1}>
            <RentalIntentReview
              mutation={mutation}
              onResolved={(ack) => {
                onSaved?.(ack.resource_id);
                onClose();
              }}
            />
          </Box>
        )}
        {creating && step === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("rental:quote_explanation", { timezone: property.timezone })}
          </Typography>
        )}
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
        {creating && agreementStep && (
          <ReservationReview
            values={values}
            nights={nights}
            disabled={disabled}
            onEditStay={() => moveToStep(0)}
            onEditGuest={() => moveToStep(1)}
          />
        )}
        {creating && agreementStep && hasSuggestions && (
          <Button
            disabled={submitDisabled}
            onClick={applyHouseSuggestions}
            variant="outlined"
          >
            {t("rental:apply_house_suggestions")}
          </Button>
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
                  if (name === "channel")
                    return (
                      <Box sx={{ minWidth: 0, gridColumn: "1 / -1" }}>
                        <SelectSingleInput
                          label={t("rental:channel")}
                          value={field.value}
                          options={["whatsapp", "airbnb", "facebook", "other"].map(
                            (value) => ({
                              value,
                              label: t(`rental:channel_${value}`),
                            }),
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
                      </Box>
                    );
                  if (name === "guest_contact")
                    return (
                      <Box sx={{ minWidth: 0, gridColumn: "1 / -1" }}>
                        <PhoneInput
                          {...field}
                          label={t("rental:guest_contact")}
                          required
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
                      </Box>
                    );
                  const Input =
                    type === "date"
                      ? DateInput
                      : type === "time"
                        ? TimeInput
                        : name.endsWith("_at")
                          ? DateTimeInput
                          : TextInput;
                  const label = t(`rental:${name}`);
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
                        label={label}
                        displayLabel={type ? label : undefined}
                        required={Boolean(type && editable)}
                        value={field.value}
                        inputMode={
                          numericFields.includes(name) ? "numeric" : undefined
                        }
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
        {agreementVisible && (
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
        {agreementVisible && (
          <QuoteSummary>
            <Typography variant="body2" color="text.secondary">
              {t(savedAgreement ? "rental:total_amount" : "rental:wizard_total")}
            </Typography>
            {displayTotal !== undefined ? (
              <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                {formatRentalAmount(displayTotal, i18n.language)}
              </Typography>
            ) : (
              <Typography variant="body2">
                {t("rental:wizard_estimate_unavailable")}
              </Typography>
            )}
            {expectedTotal !== undefined && (
              <Typography variant="body2">
                {t("rental:expected_amount")} ·{" "}
                {formatRentalAmount(expectedTotal, i18n.language)}
              </Typography>
            )}
          </QuoteSummary>
        )}
        {agreementVisible && (
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
        {initialData && (
          <Typography variant="body2" color="text.secondary">
            {t("rental:archive_occupancy_explanation")}
          </Typography>
        )}
        {creating && agreementStep && (
          <Typography variant="body2" color="text.secondary">
            {t("rental:wizard_draft_hint")}
          </Typography>
        )}
      </FormContainer>
    </BaseModal>
  );
}
