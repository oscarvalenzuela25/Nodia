import { useId, useState } from "react";
import { Alert, Button } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { FinanceCategoryGroup } from "../../types";
import {
  useFinanceBusy,
  useFinanceMutation,
  useFinanceRecord,
} from "../../infrastructure/useServices";
import FinanceActiveSwitch from "../FinanceActiveSwitch";
import {
  FinanceRemoteMultiSelect,
  type FinanceSelectionState,
} from "../FinanceRemoteSelect";
import { useFinanceSubmit } from "../FinanceCatalogModal/hooks/useFinanceSubmit";
import FinanceWriteReview from "../FinanceWriteReview";
import { groupSchema, type GroupForm } from "./schema";
import { FormContainer, ModalActions } from "./styles";

export type FinanceGroupModalProps = {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceCategoryGroup;
  onSaved?: () => void;
};

function GroupFormModal({
  open,
  onClose,
  initialData,
  onSaved,
}: FinanceGroupModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useFinanceMutation("category-groups");
  const globalBusy = useFinanceBusy();
  const [selection, setSelection] = useState<FinanceSelectionState>({
    busy: true,
    invalid: false,
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      key: initialData?.key ?? "",
      is_active: initialData?.is_active ?? true,
      category_ids:
        initialData?.categories?.map((category) => category.id) ?? [],
    },
  });
  const busy =
    globalBusy || mutation.isPending || mutation.isReviewing || isSubmitting;
  const submit = useFinanceSubmit<GroupForm>(
    (data) =>
      mutation.mutateAsync(
        initialData ? { id: initialData.id, data } : { data },
      ),
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
      title={t(initialData ? "finance:edit_group" : "finance:create_group")}
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
              busy ||
              mutation.isUncertain ||
              selection.busy ||
              selection.invalid ||
              !isValid
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
          if (
            !busy &&
            !mutation.isUncertain &&
            !selection.busy &&
            !selection.invalid
          )
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
        {(["name", "key"] as const).map((name) => (
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
                  errors[name]?.message ? t(errors[name].message) : undefined
                }
              />
            )}
          />
        ))}
        <Controller
          name="category_ids"
          control={control}
          render={({ field }) => (
            <FinanceRemoteMultiSelect
              resource="categories"
              label={t("finance:categories")}
              value={field.value}
              onChange={field.onChange}
              disabled={busy}
              selectedOptions={initialData?.categories}
              onSelectionStateChange={setSelection}
              error={Boolean(errors.category_ids)}
              helperText={
                errors.category_ids?.message
                  ? t(errors.category_ids.message)
                  : undefined
              }
            />
          )}
        />
      </FormContainer>
    </BaseModal>
  );
}

export default function FinanceGroupModal(props: FinanceGroupModalProps) {
  const { t } = useTranslation();
  const hydrate = Boolean(
    props.open && props.initialData && !props.initialData.categories,
  );
  const detail = useFinanceRecord(
    "category-groups",
    props.initialData?.id,
    hydrate,
  );
  if (!props.open) return null;
  if (hydrate && !detail.data)
    return (
      <BaseModal open onClose={props.onClose} title={t("finance:edit_group")}>
        <Alert
          severity={detail.isError ? "error" : "info"}
          action={
            detail.isError ? (
              <Button
                onClick={() => void detail.refetch()}
                disabled={detail.isFetching}
              >
                {t("core:retry")}
              </Button>
            ) : undefined
          }
        >
          {t(
            detail.isError
              ? "core:server_error_alert"
              : "finance:loading_record",
          )}
        </Alert>
      </BaseModal>
    );
  return (
    <GroupFormModal
      key={props.initialData?.id ?? "new-group"}
      {...props}
      initialData={hydrate ? detail.data : props.initialData}
    />
  );
}
