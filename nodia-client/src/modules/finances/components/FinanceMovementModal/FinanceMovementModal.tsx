import { useId, useState } from "react";
import { Button, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { FinanceMovement, FinanceObligation } from "../../types";
import {
  useFinanceBusy,
  useFinanceMutation,
  useFinanceRecord,
} from "../../infrastructure/useServices";
import FinanceActiveSwitch from "../FinanceActiveSwitch";
import FinanceRemoteSelect, {
  type FinanceSelectionState,
} from "../FinanceRemoteSelect";
import { useFinanceSubmit } from "../FinanceCatalogModal/hooks/useFinanceSubmit";
import FinanceWriteReview from "../FinanceWriteReview";
import { movementSchema, normalizedStatus, type MovementForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type FinanceMovementModalProps = {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceMovement;
  obligation?: FinanceObligation;
  onSaved?: () => void;
};

function MovementFormModal({
  open,
  onClose,
  initialData,
  obligation,
  onSaved,
}: FinanceMovementModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useFinanceMutation("movements");
  const globalBusy = useFinanceBusy();
  const [categorySelection, setCategorySelection] =
    useState<FinanceSelectionState>({ busy: true, invalid: false });
  const [obligationSelection, setObligationSelection] =
    useState<FinanceSelectionState>({ busy: true, invalid: false });
  const defaultType =
    initialData?.type ?? (obligation?.type === "loan" ? "income" : "expense");
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      amount: initialData?.amount ?? "",
      type: defaultType,
      status: initialData?.status ?? normalizedStatus(defaultType, "paid"),
      category_id: initialData?.category_id ?? "",
      obligation_id: initialData?.obligation_id ?? obligation?.id ?? null,
      is_active: initialData?.is_active ?? true,
    },
  });
  const values = useWatch({ control });
  const obligationId = values.obligation_id;
  const obligationQuery = useFinanceRecord(
    "obligations",
    obligationId ?? undefined,
    Boolean(obligationId) && obligation?.id !== obligationId,
  );
  const selectedObligation =
    obligation?.id === obligationId ? obligation : obligationQuery.data;
  const linked = Boolean(obligationId);
  const initialMovement = Boolean(
    initialData && selectedObligation?.initial_movement.id === initialData.id,
  );
  const effectiveType =
    !initialData && selectedObligation
      ? selectedObligation.type === "loan"
        ? "income"
        : "expense"
      : (values.type ?? defaultType);
  const effectiveStatus = normalizedStatus(
    effectiveType,
    values.status ?? "pending",
  );
  const busy =
    globalBusy ||
    mutation.isPending ||
    mutation.isReviewing ||
    isSubmitting ||
    obligationQuery.isFetching;
  const relationsBlocked =
    categorySelection.busy ||
    categorySelection.invalid ||
    obligationSelection.busy ||
    obligationSelection.invalid ||
    Boolean(obligationId && !selectedObligation);
  const submit = useFinanceSubmit<MovementForm>(
    (data) => {
      const common = {
        name: data.name,
        category_id: data.category_id,
        is_active: data.is_active,
        status: normalizedStatus(effectiveType, data.status),
      };
      return mutation.mutateAsync(
        initialData
          ? {
              id: initialData.id,
              data: {
                ...common,
                ...(initialMovement ? {} : { amount: data.amount }),
                ...(linked ? {} : { type: effectiveType }),
              },
            }
          : {
              data: {
                ...common,
                amount: data.amount,
                type: effectiveType,
                obligation_id: data.obligation_id,
              },
            },
      );
    },
    onClose,
    onSaved,
  );
  const close = () => {
    if (!busy) onClose();
  };
  const confirmed = effectiveType === "income" ? "received" : "paid";
  const statuses =
    initialData?.status === "cancelled"
      ? ["cancelled"]
      : initialData && initialData.status !== "pending"
        ? [confirmed, "cancelled"]
        : ["pending", confirmed, "cancelled"];
  return (
    <BaseModal
      open={open}
      onClose={close}
      title={t(
        initialData ? "finance:edit_movement" : "finance:create_movement",
      )}
      actions={
        <ModalActions>
          <Button
            disabled={busy}
            onClick={close}
            color="error"
            variant="contained"
          >
            {t("core:cancel")}
          </Button>
          <Button
            disabled={
              busy || mutation.isUncertain || relationsBlocked || !isValid
            }
            type="submit"
            form={formId}
            variant="contained"
          >
            {t("finance:save")}
          </Button>
        </ModalActions>
      }
    >
      <FinanceWriteReview
        uncertain={mutation.isUncertain}
        busy={busy}
        onReview={mutation.reviewResult}
      />
      <FormContainer
        id={formId}
        onSubmit={handleSubmit((data) => {
          if (!busy && !mutation.isUncertain && !relationsBlocked)
            return submit(data);
        })}
      >
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <FinanceActiveSwitch
              value={field.value}
              onChange={field.onChange}
              disabled={busy}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("finance:name")}
              required
              disabled={busy}
              error={Boolean(errors.name)}
              helperText={
                errors.name?.message ? t(errors.name.message) : undefined
              }
            />
          )}
        />
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("finance:amount")}
              required
              disabled={busy || initialMovement}
              error={Boolean(errors.amount)}
              helperText={
                initialMovement
                  ? t("finance:edit_principal_on_obligation")
                  : errors.amount?.message
                    ? t(errors.amount.message)
                    : t("finance:amount_hint")
              }
            />
          )}
        />
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("finance:type")}
              value={effectiveType}
              options={["income", "expense"].map((value) => ({
                value,
                label: t(`finance:${value}`),
              }))}
              disabled={busy || linked}
              clearable={false}
              onChange={(type) => {
                if (type !== "income" && type !== "expense") return;
                field.onChange(type);
                setValue(
                  "status",
                  normalizedStatus(type, getValues("status")),
                  { shouldValidate: true },
                );
              }}
            />
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("finance:status")}
              value={effectiveStatus}
              options={statuses.map((value) => ({
                value,
                label: t(`finance:${value}`),
              }))}
              disabled={busy || initialData?.status === "cancelled"}
              clearable={false}
              onChange={(value) => {
                if (!value) return;
                // Store a valid pair even when the linked obligation changes the displayed direction.
                field.onChange(
                  normalizedStatus(
                    getValues("type"),
                    value as MovementForm["status"],
                  ),
                );
              }}
            />
          )}
        />
        <Controller
          name="category_id"
          control={control}
          render={({ field }) => (
            <FinanceRemoteSelect
              resource="categories"
              label={t("finance:category")}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              selectedOption={initialData?.category}
              onSelectionStateChange={setCategorySelection}
              required
              disabled={busy}
              error={Boolean(errors.category_id)}
              helperText={
                errors.category_id?.message
                  ? t(errors.category_id.message)
                  : undefined
              }
            />
          )}
        />
        <Controller
          name="obligation_id"
          control={control}
          render={({ field }) => (
            <FinanceRemoteSelect
              resource="obligations"
              label={t("finance:obligation")}
              value={field.value}
              onChange={field.onChange}
              selectedOption={
                obligation ?? initialData?.obligation ?? undefined
              }
              onSelectionStateChange={setObligationSelection}
              disabled={busy || Boolean(initialData) || Boolean(obligation)}
            />
          )}
        />
        {selectedObligation && (
          <Typography variant="body2" color="text.secondary">
            {t(
              initialMovement
                ? "finance:initial_movement_hint"
                : "finance:repayment_hint",
            )}
          </Typography>
        )}
      </FormContainer>
    </BaseModal>
  );
}

export default function FinanceMovementModal(props: FinanceMovementModalProps) {
  return props.open ? (
    <MovementFormModal
      key={props.initialData?.id ?? props.obligation?.id ?? "new-movement"}
      {...props}
    />
  ) : null;
}
