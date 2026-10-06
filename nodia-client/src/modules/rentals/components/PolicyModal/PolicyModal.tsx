import { useId } from "react";
import { Alert, Button, Box, IconButton, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import {
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import type { RentalAck, RentalProperty, RentalPolicy } from "../../types";
import RentalActiveSwitch from "../RentalActiveSwitch";
import RentalIntentReview from "../RentalIntentReview";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import { policySchema, policyPayload, type PolicyForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type PolicyModalProps = {
  property: RentalProperty;
  open: boolean;
  onClose: () => void;
  initialData?: RentalPolicy;
  onSaved?: (ack: RentalAck) => void;
};
function PolicyFormModal({
  property,
  open,
  onClose,
  initialData,
  onSaved,
}: PolicyModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const owner = property.membership.can_manage_configuration;
  const isDefault = Boolean(
    initialData && property.default_cancellation_policy_id === initialData.id,
  );
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      is_active: initialData?.is_active ?? true,
      rules: initialData?.rules.map((rule) => ({
        min_days_before: String(rule.min_days_before),
        refund_percent: rule.refund_percent,
      })) ?? [{ min_days_before: "0", refund_percent: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "rules" });
  const busy = globalBusy || mutation.isPending || isSubmitting;
  const disabled = busy || mutation.isUncertain || !owner;
  const submit = useAdministrationSubmit(
    async (data: PolicyForm) => {
      if (!owner || mutation.isUncertain || (isDefault && !data.is_active))
        return undefined;
      return initialData
        ? mutation.execute({
            operation: "policy.update",
            id: initialData.id,
            data: policyPayload(data),
          })
        : mutation.execute({
            operation: "policy.create",
            data: policyPayload(data),
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
      title={t(initialData ? "rental:edit_policy" : "rental:create_policy")}
      size="md"
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
            disabled={disabled || !isValid}
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
      <Alert severity="info">{t("rental:policy_snapshot_info")}</Alert>
      {isDefault && (
        <Alert severity="warning">{t("rental:default_policy_active")}</Alert>
      )}
      {!owner && <Alert severity="info">{t("rental:owner_only")}</Alert>}
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
              disabled={disabled || isDefault}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("rental:name")}
              required
              disabled={disabled}
              error={Boolean(errors.name)}
              helperText={
                errors.name?.message ? t(errors.name.message) : undefined
              }
            />
          )}
        />
        <Typography variant="body2">{t("rental:policy_rules_help")}</Typography>
        {fields.map((row, index) => (
          <Box
            key={row.id}
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "start",
              flexWrap: { xs: "wrap", sm: "nowrap" },
            }}
          >
            <Controller
              name={`rules.${index}.min_days_before`}
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t("rental:min_days_before")}
                  required
                  disabled={disabled}
                  error={Boolean(errors.rules?.[index]?.min_days_before)}
                  helperText={
                    errors.rules?.[index]?.min_days_before?.message
                      ? t(errors.rules[index]!.min_days_before!.message!)
                      : undefined
                  }
                />
              )}
            />
            <Controller
              name={`rules.${index}.refund_percent`}
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label={t("rental:refund_percent")}
                  required
                  disabled={disabled}
                  error={Boolean(errors.rules?.[index]?.refund_percent)}
                  helperText={
                    errors.rules?.[index]?.refund_percent?.message
                      ? t(errors.rules[index]!.refund_percent!.message!)
                      : undefined
                  }
                />
              )}
            />
            <IconButton
              aria-label={t("rental:remove_rule", { index: index + 1 })}
              disabled={disabled || fields.length <= 1}
              onClick={() => remove(index)}
            >
              <DeleteOutlinedIcon />
            </IconButton>
          </Box>
        ))}
        {errors.rules?.message && (
          <Alert severity="error">{t(errors.rules.message)}</Alert>
        )}
        {errors.rules?.root?.message && (
          <Alert severity="error">{t(errors.rules.root.message)}</Alert>
        )}
        <Button
          disabled={disabled || fields.length >= 100}
          onClick={() => append({ min_days_before: "", refund_percent: "" })}
        >
          {t("rental:add_rule")}
        </Button>
      </FormContainer>
    </BaseModal>
  );
}
export default function PolicyModal(props: PolicyModalProps) {
  return props.open ? (
    <PolicyFormModal
      key={`${props.property.id}:${props.initialData?.id ?? "new"}`}
      {...props}
    />
  ) : null;
}
