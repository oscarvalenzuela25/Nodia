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
import { FormContainer, ModalActions } from "./styles";
export type TurnoverModalProps = {
  property: RentalProperty;
  id: string;
  open: boolean;
  onClose: () => void;
};
function TurnoverFormView({
  property,
  row,
  onClose,
}: {
  property: RentalProperty;
  row: RentalTurnoverDetail;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
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
    <FormContainer id={formId} onSubmit={handleSubmit(submit)}>
      <Typography>
        {t("rental:incoming_transition", { id: row.incoming_reservation_id })}
      </Typography>
      <Typography>
        {t("rental:previous_transition", {
          id: row.current_previous_reservation_id ?? t("rental:none"),
        })}
      </Typography>
      <Alert severity="info">
        {t("rental:preparation_explanation", { timezone: property.timezone })}
      </Alert>
      {row.same_day_required && (
        <Alert severity={row.plan_valid ? "info" : "warning"}>
          {t(
            row.needs_approval
              ? "rental:approval_required"
              : "rental:approval_not_required",
          )}
        </Alert>
      )}
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
            disabled={busy}
          />
        )}
      />
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
            disabled={busy}
          />
        )}
      />
      {(["planned_ready_at", "ready_at", "notes"] as const).map((name) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t(`rental:${name}`)}
              multiline={name === "notes"}
              disabled={busy}
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
      <Alert severity="warning">
        {t("rental:preparation_changes_warning")}
      </Alert>
      <RentalIntentReview mutation={mutation} onResolved={onClose} />
      <ModalActions>
        <Button disabled={busy} onClick={onClose}>
          {t("rental:close")}
        </Button>
        {row.same_day_required && row.needs_approval && (
          <Button
            disabled={busy || !row.plan_valid}
            onClick={() => approve(undefined)}
          >
            {t("rental:approve_saved_plan")}
          </Button>
        )}
        <Button disabled={busy} type="submit" variant="contained">
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
      <Skeleton loading={query.isLoading}>
        <Typography>{t("rental:preparation")}</Typography>
      </Skeleton>
      {query.data && (
        <TurnoverFormView
          key={`${property.id}:${id}`}
          property={property}
          row={query.data}
          onClose={onClose}
        />
      )}
    </BaseModal>
  );
}
