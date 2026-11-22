import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import { useId } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Skeleton } from "boneyard-js/react";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { RentalProperty, RentalTurnoverDetail } from "../../types";
import {
  useRentalBusy,
  useRentalRecord,
  useRentalMutation,
} from "../../infrastructure/useServices";
import RentalIntentReview from "../RentalIntentReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import { turnoverSchema, turnoverPayload, type TurnoverForm } from "./schema";
import { FormContainer, ModalActions, PreparationSection } from "./styles";
export type TurnoverModalProps = {
  property: RentalProperty;
  id: string;
  open: boolean;
  onClose: () => void;
};
function TurnoverFormView({
  property,
  row,
  unavailable,
  onClose,
}: {
  property: RentalProperty;
  row: RentalTurnoverDetail;
  unavailable: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const approvalHint = useId();
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TurnoverForm>({
    resolver: zodResolver(turnoverSchema),
    defaultValues: {
      linen_ready:
        row.linen_ready === null ? "unknown" : row.linen_ready ? "yes" : "no",
      cleaning_status: row.cleaning_status,
      planned_ready_at: row.planned_ready_at ?? "",
      ready_at: row.ready_at ?? "",
      notes: row.notes ?? "",
    },
  });
  const busy =
    commonBusy || mutation.isPending || mutation.isUncertain || isSubmitting;
  const disabled = busy || unavailable;
  const submit = useBookingSubmit(
    (value: TurnoverForm) =>
      mutation.execute({
        operation: "turnover.update",
        id: row.id,
        data: turnoverPayload(value),
      }),
    () => onClose(),
  );
  const approve = useBookingSubmit(
    () =>
      mutation.execute({
        operation: "turnover.approve_same_day",
        id: row.id,
        data: {},
      }),
    () => onClose(),
  );
  return (
    <FormContainer
      onSubmit={handleSubmit((value) => {
        if (!disabled) return submit(value);
      })}
    >
      <Typography variant="body2" color="text.secondary">
        {t("rental:previous_transition", {
          id: row.current_previous_reservation_id ?? t("rental:none"),
        })}
      </Typography>
      {row.same_day_required && (
        <Alert severity={row.plan_valid ? "info" : "warning"}>
          {t(
            row.needs_approval
              ? "rental:approval_required"
              : "rental:approval_not_required",
          )}
        </Alert>
      )}
      <PreparationSection>
        <legend>{t("rental:preparation_plan")}</legend>
        <Typography variant="body2" color="text.secondary">
          {t("rental:preparation_explanation", { timezone: property.timezone })}
        </Typography>
        <Controller
          name="linen_ready"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("rental:linen_ready")}
              value={field.value}
              clearable={false}
              options={[
                { value: "unknown", label: t("rental:unknown") },
                { value: "yes", label: t("rental:yes") },
                { value: "no", label: t("rental:no") },
              ]}
              onChange={(value) => field.onChange(value ?? "unknown")}
              disabled={disabled}
            />
          )}
        />
        <Controller
          name="planned_ready_at"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <DateTimeInput
              {...field}
              timezone={property.timezone}
              label={t("rental:planned_ready_at")}
              disabled={disabled}
              error={Boolean(error)}
              helperText={error?.message ? t(error.message) : undefined}
            />
          )}
        />
        {row.same_day_required && (
          <Typography variant="body2" color="text.secondary">
            {t("rental:preparation_changes_warning")}
          </Typography>
        )}
      </PreparationSection>
      <PreparationSection>
        <legend>{t("rental:preparation_actual")}</legend>
        <Controller
          name="cleaning_status"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("rental:cleaning_status")}
              value={field.value}
              clearable={false}
              options={["pending", "in_progress", "completed"].map((value) => ({
                value,
                label: t(`rental:cleaning_${value}`),
              }))}
              onChange={(value) => field.onChange(value ?? "pending")}
              disabled={disabled}
            />
          )}
        />
        <Controller
          name="ready_at"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <DateTimeInput
              {...field}
              timezone={property.timezone}
              label={t("rental:ready_at")}
              disabled={disabled}
              error={Boolean(error)}
              helperText={error?.message ? t(error.message) : undefined}
            />
          )}
        />
      </PreparationSection>
      <Controller
        name="notes"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label={t("rental:notes")}
            multiline
            disabled={disabled}
            error={Boolean(errors.notes)}
            helperText={
              errors.notes?.message ? t(errors.notes.message) : undefined
            }
          />
        )}
      />
      <RentalIntentReview mutation={mutation} onResolved={onClose} />
      {row.same_day_required && row.needs_approval && isDirty && (
        <Typography
          id={approvalHint}
          variant="body2"
          color="text.secondary"
          role="status"
        >
          {t("rental:preparation_save_before_approval")}
        </Typography>
      )}
      <ModalActions>
        <Button variant="outlined" disabled={busy} onClick={onClose}>
          {t("rental:close")}
        </Button>
        {row.same_day_required && row.needs_approval && (
          <Button
            variant="outlined"
            aria-describedby={isDirty ? approvalHint : undefined}
            disabled={disabled || isDirty || !row.plan_valid}
            onClick={() => {
              if (!disabled && !isDirty && row.plan_valid) {
                void approve(undefined);
              }
            }}
          >
            {t("rental:approve_saved_plan")}
          </Button>
        )}
        <Button
          disabled={disabled}
          loading={isSubmitting}
          type="submit"
          variant="contained"
        >
          {t("rental:save")}
        </Button>
      </ModalActions>
    </FormContainer>
  );
}
export default function TurnoverModal({
  property,
  id,
  open,
  onClose,
}: TurnoverModalProps) {
  const { t } = useTranslation();
  const query = useRentalRecord("turnovers", property.id, id, open);
  const busy = useRentalBusy(property.id);
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("rental:review_preparation")}
      subtitle={
        query.data &&
        t("rental:incoming_transition", {
          id: query.data.incoming_reservation_id,
        })
      }
      disableEscapeKeyDown={busy}
    >
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={query.isFetching} onClick={() => query.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      {query.isLoading && !query.data && (
        <Skeleton loading>
          <Typography>{t("rental:preparation")}</Typography>
        </Skeleton>
      )}
      {query.data && (
        <TurnoverFormView
          key={`${property.id}:${id}`}
          property={property}
          row={query.data}
          unavailable={query.isError || query.isFetching}
          onClose={onClose}
        />
      )}
    </BaseModal>
  );
}
