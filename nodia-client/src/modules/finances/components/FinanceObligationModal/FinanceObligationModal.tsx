import { useId, useState } from "react";
import { Button, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { FinanceObligation } from "../../types";
import {
  useFinanceBusy,
  useFinanceMutation,
} from "../../infrastructure/useServices";
import FinanceActiveSwitch from "../FinanceActiveSwitch";
import FinanceRemoteSelect, {
  type FinanceSelectionState,
} from "../FinanceRemoteSelect";
import { useFinanceSubmit } from "../FinanceCatalogModal/hooks/useFinanceSubmit";
import FinanceWriteReview from "../FinanceWriteReview";
import {
  obligationSchema,
  createObligationSchema,
  type ObligationForm,
} from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type FinanceObligationModalProps = {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceObligation;
  onSaved?: () => void;
};

function ObligationFormModal({
  open,
  onClose,
  initialData,
  onSaved,
}: FinanceObligationModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useFinanceMutation("obligations");
  const globalBusy = useFinanceBusy();
  const [selection, setSelection] = useState<FinanceSelectionState>({
    busy: true,
    invalid: false,
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ObligationForm>({
    resolver: zodResolver(
      initialData ? obligationSchema : createObligationSchema,
    ),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      key: initialData?.key ?? "",
      amount: initialData?.amount ?? "",
      description: initialData?.description ?? "",
      type: initialData?.type ?? "loan",
      category_id: "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const busy =
    globalBusy || mutation.isPending || mutation.isReviewing || isSubmitting;
  const relationsBlocked =
    !initialData && (selection.busy || selection.invalid);
  const submit = useFinanceSubmit<ObligationForm>(
    (data) => {
      const { category_id, type, description, ...common } = data;
      return mutation.mutateAsync(
        initialData
          ? {
              id: initialData.id,
              data: { ...common, description: description.trim() || null },
            }
          : {
              data: {
                ...common,
                description: description.trim() || null,
                type,
                category_id,
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
  return (
    <BaseModal
      open={open}
      onClose={close}
      title={t(
        initialData ? "finance:edit_obligation" : "finance:create_obligation",
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
        {(["name", "key", "amount"] as const).map((name) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label={t(`finance:${name}`)}
                required
                disabled={busy}
                error={Boolean(errors[name])}
                helperText={
                  errors[name]?.message
                    ? t(errors[name].message)
                    : name === "amount"
                      ? t("finance:principal_hint")
                      : undefined
                }
              />
            )}
          />
        ))}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SelectSingleInput
              label={t("finance:type")}
              value={field.value}
              options={["loan", "debt"].map((value) => ({
                value,
                label: t(`finance:${value}`),
              }))}
              disabled={busy || Boolean(initialData)}
              clearable={false}
              onChange={(value) => {
                if (value) field.onChange(value);
              }}
            />
          )}
        />
        {!initialData && (
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <FinanceRemoteSelect
                resource="categories"
                label={t("finance:initial_category")}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                onSelectionStateChange={setSelection}
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
        )}
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              label={t("finance:description")}
              multiline
              minRows={3}
              disabled={busy}
              error={Boolean(errors.description)}
              helperText={
                errors.description?.message
                  ? t(errors.description.message)
                  : undefined
              }
            />
          )}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            initialData
              ? "finance:principal_update_hint"
              : "finance:obligation_create_hint",
          )}
        </Typography>
      </FormContainer>
    </BaseModal>
  );
}

export default function FinanceObligationModal(
  props: FinanceObligationModalProps,
) {
  return props.open ? (
    <ObligationFormModal
      key={props.initialData?.id ?? "new-obligation"}
      {...props}
    />
  ) : null;
}
