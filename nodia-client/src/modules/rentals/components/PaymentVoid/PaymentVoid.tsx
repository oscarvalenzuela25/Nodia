import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalAck, RentalPayment, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import RentalIntentReview from "../RentalIntentReview";
import { FormContainer } from "./styles";
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "rental:required")
    .max(1000, "rental:invalid_input"),
});
export type PaymentVoidProps = {
  open: boolean;
  property: RentalProperty;
  payment: RentalPayment;
  onClose: () => void;
  onSaved?: (ack: RentalAck) => void;
};
function VoidForm({
  open,
  property,
  payment,
  onClose,
  onSaved,
}: PaymentVoidProps) {
  const { t } = useTranslation();
  const lock = useRef(false);
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });
  const busy = globalBusy || mutation.isPending || isSubmitting;
  const completed = (ack: RentalAck) => {
    onSaved?.(ack);
    onClose();
  };
  const submit = async (data: z.infer<typeof schema>) => {
    if (
      busy ||
      mutation.isUncertain ||
      lock.current ||
      payment.status !== "confirmed"
    )
      return;
    lock.current = true;
    try {
      const ack = await mutation.execute({
        operation: "payment.void",
        id: payment.id,
        data,
      });
      if (ack) completed(ack);
    } catch {
      /* Shared feedback preserves this form. */
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
      title={t("rental:void_payment")}
      message={t("rental:void_money_hint")}
      onConfirm={() => void handleSubmit(submit)()}
      isLoading={busy || mutation.isUncertain}
      confirmDisabled={payment.status !== "confirmed"}
    >
      <RentalIntentReview mutation={mutation} onResolved={completed} />
      <FormContainer onSubmit={(event) => void handleSubmit(submit)(event)}>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("rental:void_reason")}
              required
              multiline
              disabled={busy || mutation.isUncertain}
              error={Boolean(errors.reason)}
              helperText={
                errors.reason?.message ? t(errors.reason.message) : undefined
              }
            />
          )}
        />
      </FormContainer>
    </ConfirmDialog>
  );
}
export default function PaymentVoid(props: PaymentVoidProps) {
  return props.open ? (
    <VoidForm key={`${props.property.id}:${props.payment.id}`} {...props} />
  ) : null;
}
