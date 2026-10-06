import { useId } from "react";
import { Alert, Button } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalBlock, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import RentalActiveSwitch from "../RentalActiveSwitch";
import RentalIntentReview from "../RentalIntentReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import { blockSchema, type BlockForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";
export type BlockModalProps = {
  property: RentalProperty;
  open: boolean;
  onClose: () => void;
  initialData?: RentalBlock;
};
export default function BlockModal({
  property,
  open,
  onClose,
  initialData,
}: BlockModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlockForm>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      starts_at: initialData?.starts_at ?? "",
      ends_at: initialData?.ends_at ?? "",
      reason: initialData?.reason ?? "",
      notes: initialData?.notes ?? "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const busy =
    commonBusy || mutation.isPending || mutation.isUncertain || isSubmitting;
  const active = useWatch({ control, name: "is_active" });
  const submit = useBookingSubmit(
    (value: BlockForm) =>
      mutation.execute({
        operation: initialData ? "block.update" : "block.create",
        id: initialData?.id,
        data: { ...value, notes: value.notes.trim() || null },
      }),
    () => onClose(),
  );
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      disableEscapeKeyDown={busy}
      title={t(initialData ? "rental:edit_block" : "rental:new_block")}
      actions={
        <ModalActions>
          <Button disabled={busy} onClick={onClose}>
            {t("rental:close")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            disabled={busy || (!property.is_active && !initialData)}
          >
            {t("rental:save")}
          </Button>
        </ModalActions>
      }
    >
      <FormContainer id={formId} onSubmit={handleSubmit(submit)}>
        <Alert severity="info">
          {t("rental:block_explanation", { timezone: property.timezone })}
        </Alert>
        {(["starts_at", "ends_at", "reason", "notes"] as const).map((name) => (
          <Controller
            name={name}
            key={name}
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label={t(`rental:${name}`)}
                multiline={name === "notes"}
                disabled={
                  busy ||
                  (!property.is_active && active && name.endsWith("_at"))
                }
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
          name="is_active"
          control={control}
          render={({ field }) => (
            <RentalActiveSwitch
              confirmChanges={Boolean(initialData)}
              checked={field.value}
              onChange={field.onChange}
              disabled={
                busy || (!property.is_active && !initialData?.is_active)
              }
            />
          )}
        />
        <RentalIntentReview mutation={mutation} onResolved={onClose} />
      </FormContainer>
    </BaseModal>
  );
}
