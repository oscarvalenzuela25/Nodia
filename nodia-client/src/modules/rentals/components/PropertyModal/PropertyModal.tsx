import { useId } from "react";
import { Alert, Button } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalAck, RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import RentalActiveSwitch from "../RentalActiveSwitch";
import RentalIntentReview from "../RentalIntentReview";
import {
  propertySchema,
  propertyPayload,
  type PropertyForm,
  type PropertyFormOutput,
} from "./schema";
import { useAdministrationSubmit } from "./hooks/useAdministrationSubmit";
import { FormContainer, ModalActions } from "./styles";

export type PropertyModalProps = {
  open: boolean;
  onClose: () => void;
  initialData?: RentalProperty;
  onSaved?: (ack: RentalAck) => void;
};
function PropertyFormModal({
  open,
  onClose,
  initialData,
  onSaved,
}: PropertyModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(initialData?.id);
  const globalBusy = useRentalBusy(initialData?.id);
  const authorized =
    !initialData || initialData.membership.can_manage_configuration;
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PropertyForm, unknown, PropertyFormOutput>({
    resolver: zodResolver(propertySchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      location: initialData?.location ?? "",
      timezone: initialData?.timezone ?? "",
      max_guests: initialData ? String(initialData.max_guests) : "",
      check_in_time: initialData?.check_in_time ?? "",
      check_out_time: initialData?.check_out_time ?? "",
      default_nightly_rate: initialData?.default_nightly_rate ?? "",
      default_deposit_percent: initialData?.default_deposit_percent ?? "",
      minimum_turnover_minutes: String(
        initialData?.minimum_turnover_minutes ?? 0,
      ),
      notes: initialData?.notes ?? "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const busy = globalBusy || mutation.isPending || isSubmitting;
  const disabled = busy || mutation.isUncertain || !authorized;
  const submit = useAdministrationSubmit(
    async (values: PropertyFormOutput) => {
      if (!authorized || mutation.isUncertain) return undefined;
      const payload = propertyPayload(values);
      if (!initialData)
        return mutation.execute({
          operation: "property.create",
          data: payload,
        });
      const changes = Object.fromEntries(
        Object.entries(payload).filter(
          ([key, value]) => initialData[key as keyof typeof payload] !== value,
        ),
      ) as Partial<typeof payload>;
      if (!Object.keys(changes).length) {
        onClose();
        return undefined;
      }
      return mutation.execute({
        operation: "property.update",
        id: initialData.id,
        data: changes,
      });
    },
    (ack) => {
      onSaved?.(ack);
      onClose();
    },
  );
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy && !mutation.isUncertain) onClose();
      }}
      title={t(initialData ? "rental:edit_property" : "rental:create_property")}
      size="md"
      actions={
        <ModalActions>
          <Button
            color="error"
            variant="contained"
            disabled={busy || mutation.isUncertain}
            onClick={onClose}
          >
            {t("core:cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={disabled || !isValid}
            form={formId}
            type="submit"
          >
            {t("rental:save")}
          </Button>
        </ModalActions>
      }
    >
      <RentalIntentReview
        mutation={mutation}
        onResolved={(ack) => {
          onSaved?.(ack);
          onClose();
        }}
      />
      {!authorized && <Alert severity="info">{t("rental:owner_only")}</Alert>}
      {initialData && (
        <Alert severity="info">{t("rental:timezone_history")}</Alert>
      )}
      <FormContainer
        id={formId}
        onSubmit={handleSubmit((values) => {
          if (!disabled) return submit(values);
        })}
      >
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <RentalActiveSwitch
              confirmChanges={Boolean(initialData)}
              checked={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
        {(
          [
            "name",
            "location",
            "timezone",
            "max_guests",
            "check_in_time",
            "check_out_time",
            "default_nightly_rate",
            "default_deposit_percent",
            "minimum_turnover_minutes",
            "notes",
          ] as const
        ).map((name) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label={t(`rental:${name}`)}
                required={[
                  "name",
                  "timezone",
                  "max_guests",
                  "check_in_time",
                  "check_out_time",
                ].includes(name)}
                type={name.endsWith("time") ? "time" : "text"}
                multiline={name === "notes"}
                disabled={disabled}
                error={Boolean(errors[name])}
                helperText={
                  errors[name]?.message ? t(errors[name].message) : undefined
                }
              />
            )}
          />
        ))}
      </FormContainer>
    </BaseModal>
  );
}
export default function PropertyModal(props: PropertyModalProps) {
  return props.open ? (
    <PropertyFormModal key={props.initialData?.id ?? "new"} {...props} />
  ) : null;
}
