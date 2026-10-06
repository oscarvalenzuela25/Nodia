import { useId } from "react";
import { Button } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { FinanceCategory } from "../../types";
import {
  useFinanceBusy,
  useFinanceMutation,
} from "../../infrastructure/useServices";
import FinanceActiveSwitch from "../FinanceActiveSwitch";
import { catalogSchema, type CatalogForm } from "./schema";
import { useFinanceSubmit } from "./hooks/useFinanceSubmit";
import FinanceWriteReview from "../FinanceWriteReview";
import { FormContainer, ModalActions } from "./styles";

export type FinanceCatalogModalProps = {
  open: boolean;
  onClose: () => void;
  initialData?: FinanceCategory;
  onSaved?: () => void;
};

function CatalogFormModal({
  open,
  onClose,
  initialData,
  onSaved,
}: FinanceCatalogModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useFinanceMutation("categories");
  const globalBusy = useFinanceBusy();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CatalogForm>({
    resolver: zodResolver(catalogSchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      key: initialData?.key ?? "",
      is_active: initialData?.is_active ?? true,
    },
  });
  const busy =
    globalBusy || mutation.isPending || mutation.isReviewing || isSubmitting;
  const submit = useFinanceSubmit<CatalogForm>(
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
      title={t(
        initialData ? "finance:edit_category" : "finance:create_category",
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
            disabled={busy || mutation.isUncertain || !isValid}
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
          if (!busy && !mutation.isUncertain) return submit(data);
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
      </FormContainer>
    </BaseModal>
  );
}

export default function FinanceCatalogModal(props: FinanceCatalogModalProps) {
  return props.open ? (
    <CatalogFormModal
      key={props.initialData?.id ?? "new-category"}
      {...props}
    />
  ) : null;
}
