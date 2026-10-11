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
  section?: "details" | "defaults";
};
function PropertyFormModal({
  open,
  onClose,
  initialData,
  onSaved,
  section,
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
      max_guests: initialData ? String(initialData.max_guests) : "",
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
      title={t(
        initialData && section
          ? "rental:configuration_view.edit_" + section
          : initialData
            ? "rental:edit_property"
            : "rental:create_property",
      )}
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
      <FormContainer
        id={formId}
        onSubmit={handleSubmit((values) => {
          if (!disabled) return submit(values);
        })}
      >
        {(
          [
            "name",
            "location",
            "max_guests",
            "default_nightly_rate",
            "default_deposit_percent",
            "minimum_turnover_minutes",
            "notes",
          ] as const
        )
          .filter(
            (name) =>
              !initialData ||
              !section ||
              (section === "details"
                ? ["name", "location", "max_guests", "notes"]
                : [
                    "default_nightly_rate",
                    "default_deposit_percent",
                    "minimum_turnover_minutes",
                  ]
              ).includes(name),
          )
          .map((name) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t(`rental:${name}`)}
                  required={["name", "max_guests"].includes(name)}
                  type="text"
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
        {(!initialData || !section) && (
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
        )}
      </FormContainer>
    </BaseModal>
  );
}
export default function PropertyModal(props: PropertyModalProps) {
  return props.open ? (
    <PropertyFormModal key={props.initialData?.id ?? "new"} {...props} />
  ) : null;
}
