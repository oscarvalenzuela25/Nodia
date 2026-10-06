import { useId, useRef } from "react";
import { Alert, Button } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { RentalAck, RentalExpense, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { todayInZone } from "../../utils/dates";
import RentalRemoteSelect from "../RentalRemoteSelect";
import RentalIntentReview from "../RentalIntentReview";
import { buildExpensePayload, expenseSchema, type ExpenseForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";
export type ExpenseModalProps = {
  open: boolean;
  property: RentalProperty;
  onClose: () => void;
  initialData?: RentalExpense;
  reservationId?: string;
  onSaved?: (ack: RentalAck) => void;
};
function ExpenseFormModal({
  open,
  property,
  onClose,
  initialData,
  reservationId,
  onSaved,
}: ExpenseModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const submitting = useRef(false);
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      amount: initialData?.amount ?? "",
      incurred_on: initialData?.incurred_on ?? todayInZone(property.timezone),
      paid_on: initialData?.paid_on ?? "",
      status: initialData?.status === "paid" ? "paid" : "pending",
      reservation_id: initialData?.reservation_id ?? reservationId ?? null,
      category: initialData?.category ?? "",
      notes: initialData?.notes ?? "",
    },
  });
  const values = useWatch({ control });
  const today = todayInZone(property.timezone);
  const association = useRentalRecord(
    "reservations",
    property.id,
    values.reservation_id ?? undefined,
    Boolean(values.reservation_id),
  );
  const busy =
    globalBusy || mutation.isPending || isSubmitting || association.isFetching;
  const dateBlocked = Boolean(
    (values.incurred_on && values.incurred_on > today) ||
    (values.status === "paid" && values.paid_on && values.paid_on > today),
  );
  const blocked =
    dateBlocked ||
    initialData?.status === "voided" ||
    Boolean(
      values.reservation_id && (!association.data || association.isError),
    );
  const close = () => {
    if (!busy && !mutation.isUncertain) onClose();
  };
  const completed = (ack: RentalAck) => {
    onSaved?.(ack);
    onClose();
  };
  const submit = async (data: ExpenseForm) => {
    if (busy || blocked || mutation.isUncertain || submitting.current) return;
    submitting.current = true;
    try {
      const ack = initialData
        ? await mutation.execute({
            operation: "expense.update",
            id: initialData.id,
            data: buildExpensePayload(data, initialData.status),
          })
        : await mutation.execute({
            operation: "expense.create",
            data: {
              ...buildExpensePayload(data),
              name: data.name,
              amount: data.amount,
              incurred_on: data.incurred_on,
              status: data.status,
              paid_on: data.status === "paid" ? data.paid_on : null,
            },
          });
      if (ack) completed(ack);
    } catch {
      /* Feedback belongs to the shared mutation. */
    } finally {
      submitting.current = false;
    }
  };
  const fields = [
    "name",
    "amount",
    "incurred_on",
    "category",
    "notes",
    ...(values.status === "paid" ? ["paid_on"] : []),
  ];
  return (
    <BaseModal
      open={open}
      onClose={close}
      title={t(initialData ? "rental:edit_expense" : "rental:create_expense")}
      actions={
        <ModalActions>
          <Button disabled={busy || mutation.isUncertain} onClick={close}>
            {t("core:cancel")}
          </Button>
          <Button
            variant="contained"
            type="submit"
            form={formId}
            disabled={busy || mutation.isUncertain || blocked || !isValid}
          >
            {t("rental:save")}
          </Button>
        </ModalActions>
      }
    >
      <RentalIntentReview mutation={mutation} onResolved={completed} />
      <FormContainer
        id={formId}
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        {initialData?.status === "paid" && (
          <Alert severity="info">{t("rental:paid_expense_hint")}</Alert>
        )}
        {fields.map((key) => {
          const name = key as Exclude<
            keyof ExpenseForm,
            "reservation_id" | "status"
          >;
          const immutable = Boolean(
            initialData &&
            (name === "paid_on" ||
              (initialData.status === "paid" &&
                ["amount", "incurred_on"].includes(name))),
          );
          return (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t(`rental:${name}`)}
                  type={name.endsWith("_on") ? "date" : "text"}
                  required={[
                    "name",
                    "amount",
                    "incurred_on",
                    "paid_on",
                  ].includes(name)}
                  disabled={busy || mutation.isUncertain || immutable}
                  multiline={name === "notes"}
                  error={
                    Boolean(errors[name]) ||
                    (name.endsWith("_on") && dateBlocked)
                  }
                  helperText={
                    errors[name]?.message
                      ? t(errors[name]!.message!)
                      : name.endsWith("_on") && dateBlocked
                        ? t("rental:future_date")
                        : undefined
                  }
                />
              )}
            />
          );
        })}
        {!initialData && (
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <SelectSingleInput
                label={t("rental:status")}
                value={field.value}
                options={["pending", "paid"].map((value) => ({
                  value,
                  label: t(`rental:${value}`),
                }))}
                onChange={(value) => {
                  if (value === "pending" || value === "paid")
                    field.onChange(value);
                }}
                clearable={false}
                disabled={busy || mutation.isUncertain}
              />
            )}
          />
        )}
        <Controller
          name="reservation_id"
          control={control}
          render={({ field }) => (
            <RentalRemoteSelect
              resource="reservations"
              propertyId={property.id}
              label={t("rental:reservation")}
              value={field.value}
              onChange={field.onChange}
              disabled={busy || mutation.isUncertain || Boolean(reservationId)}
              selectedLabel={association.data?.guest_name}
              query={{ active: "all" }}
            />
          )}
        />
      </FormContainer>
    </BaseModal>
  );
}
export default function ExpenseModal(props: ExpenseModalProps) {
  return props.open ? (
    <ExpenseFormModal
      key={`${props.property.id}:${props.initialData?.id ?? "new"}`}
      {...props}
    />
  ) : null;
}
