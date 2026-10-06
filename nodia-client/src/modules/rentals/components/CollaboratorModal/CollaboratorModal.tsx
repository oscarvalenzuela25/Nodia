import { useId } from "react";
import { Alert, Button } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import type {
  RentalAck,
  RentalProperty,
  RentalCollaborator,
} from "../../types";
import RentalActiveSwitch from "../RentalActiveSwitch";
import RentalIntentReview from "../RentalIntentReview";
import RentalRemoteSelect from "../RentalRemoteSelect";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import {
  collaboratorSchema,
  type CollaboratorForm,
  type CollaboratorFormOutput,
} from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type CollaboratorModalProps = {
  property: RentalProperty;
  open: boolean;
  onClose: () => void;
  initialData?: RentalCollaborator;
  onSaved?: (ack: RentalAck) => void;
};
function CollaboratorFormModal({
  property,
  open,
  onClose,
  initialData,
  onSaved,
}: CollaboratorModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const owner = property.membership.can_manage_collaborators;
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CollaboratorForm, unknown, CollaboratorFormOutput>({
    resolver: zodResolver(collaboratorSchema),
    mode: "onChange",
    defaultValues: {
      user_id: initialData?.user_id ?? "",
      position: initialData?.position ?? "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const busy = globalBusy || mutation.isPending || isSubmitting;
  const disabled = busy || mutation.isUncertain || !owner;
  const submit = useAdministrationSubmit(
    async (data: CollaboratorFormOutput) => {
      if (
        !owner ||
        mutation.isUncertain ||
        (!property.is_active && data.is_active)
      )
        return undefined;
      return initialData
        ? mutation.execute({
            operation: "collaborator.update",
            id: initialData.id,
            data: { position: data.position, is_active: data.is_active },
          })
        : mutation.execute({ operation: "collaborator.create", data });
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
        initialData ? "rental:edit_collaborator" : "rental:create_collaborator",
      )}
      actions={
        <ModalActions>
          <Button
            variant="contained"
            color="error"
            disabled={busy || mutation.isUncertain}
            onClick={onClose}
          >
            {t("core:cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              disabled || !isValid || (!property.is_active && !initialData)
            }
            type="submit"
            form={formId}
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
      {!owner && <Alert severity="info">{t("rental:owner_only")}</Alert>}
      {!property.is_active && (
        <Alert severity="info">{t("rental:archived_property")}</Alert>
      )}
      <FormContainer
        id={formId}
        onSubmit={handleSubmit((data) => {
          if (!disabled) return submit(data);
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
              disabled={
                disabled || (!property.is_active && !initialData?.is_active)
              }
            />
          )}
        />
        <Controller
          name="user_id"
          control={control}
          render={({ field }) => (
            <RentalRemoteSelect
              resource="collaborator-candidates"
              enabled={owner && property.is_active && !initialData}
              propertyId={property.id}
              label={t("rental:collaborator_user")}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              selectedLabel={initialData?.user.name ?? undefined}
              disabled={disabled || Boolean(initialData) || !property.is_active}
              query={{ limit: 20 }}
            />
          )}
        />
        {errors.user_id?.message && (
          <Alert severity="error">{t(errors.user_id.message)}</Alert>
        )}
        {!initialData && (
          <Alert severity="info">{t("rental:candidate_search_help")}</Alert>
        )}
        <Controller
          name="position"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("rental:position")}
              disabled={disabled}
              error={Boolean(errors.position)}
              helperText={
                errors.position?.message
                  ? t(errors.position.message)
                  : undefined
              }
            />
          )}
        />
      </FormContainer>
    </BaseModal>
  );
}
export default function CollaboratorModal(props: CollaboratorModalProps) {
  return props.open ? (
    <CollaboratorFormModal
      key={`${props.property.id}:${props.initialData?.id ?? "new"}`}
      {...props}
    />
  ) : null;
}
