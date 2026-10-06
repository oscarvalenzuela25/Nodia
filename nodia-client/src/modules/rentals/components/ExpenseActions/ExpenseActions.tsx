import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalAck, RentalExpense, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import { todayInZone } from "../../utils/dates";
import RentalIntentReview from "../RentalIntentReview";
import { rentalCivilDate } from "../PaymentModal/schema";
import { FormContainer } from "./styles";
export type ExpenseActionsProps = {
  open: boolean;
  property: RentalProperty;
  expense: RentalExpense;
  action: "pay" | "void";
  onClose: () => void;
  onSaved?: (ack: RentalAck) => void;
};
function ExpenseCommand({
  open,
  property,
  expense,
  action,
  onClose,
  onSaved,
}: ExpenseActionsProps) {
  const { t } = useTranslation();
  const lock = useRef(false);
  const today = todayInZone(property.timezone);
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const schema = z.object({
    value:
      action === "pay"
        ? rentalCivilDate.refine(
            (value) => value >= expense.incurred_on && value <= today,
            "rental:invalid_date",
          )
        : z
            .string()
            .trim()
            .min(1, "rental:required")
            .max(1000, "rental:invalid_input"),
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { value: action === "pay" ? today : "" },
  });
  const busy = globalBusy || mutation.isPending || isSubmitting;
  const forbidden =
    expense.status === "voided" ||
    (action === "pay" && expense.status !== "pending");
  const completed = (ack: RentalAck) => {
    onSaved?.(ack);
    onClose();
  };
  const submit = async ({ value }: { value: string }) => {
    if (busy || mutation.isUncertain || forbidden || lock.current) return;
    lock.current = true;
    try {
      const ack =
        action === "pay"
          ? await mutation.execute({
              operation: "expense.pay",
              id: expense.id,
              data: { paid_on: value },
            })
          : await mutation.execute({
              operation: "expense.void",
              id: expense.id,
              data: { reason: value },
            });
      if (ack) completed(ack);
    } catch {
      /* Shared mutation owns feedback. */
    } finally {
      lock.current = false;
    }
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        if (!busy && !mutation.isUncertain) onClose();
      }}
      title={t(action === "pay" ? "rental:pay_expense" : "rental:void_expense")}
      message={t(
        action === "pay"
          ? "rental:expense_pay_hint"
          : "rental:expense_void_hint",
      )}
      onConfirm={() => void handleSubmit(submit)()}
      isLoading={busy || mutation.isUncertain}
      confirmDisabled={forbidden}
    >
      <RentalIntentReview mutation={mutation} onResolved={completed} />
      <FormContainer onSubmit={(event) => void handleSubmit(submit)(event)}>
        <Controller
          name="value"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t(
                action === "pay" ? "rental:paid_on" : "rental:void_reason",
              )}
              type={action === "pay" ? "date" : "text"}
              multiline={action === "void"}
              required
              disabled={busy || mutation.isUncertain}
              error={Boolean(errors.value)}
              helperText={
                errors.value?.message ? t(errors.value.message) : undefined
              }
            />
          )}
        />
      </FormContainer>
    </ConfirmDialog>
  );
}
export default function ExpenseActions(props: ExpenseActionsProps) {
  return props.open ? (
    <ExpenseCommand
      key={`${props.property.id}:${props.expense.id}:${props.action}`}
      {...props}
    />
  ) : null;
}
