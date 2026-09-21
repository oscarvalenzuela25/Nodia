import type { FC } from "react";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Divider,
  Typography,
} from "@mui/material";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import type { ProviderEntity } from "../../../../../../infrastructure/types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const providerSchema = z.object({
  name: z.string().trim().min(2, "business:provider_name_min"),
  code: z.string().optional(),
  cost_price: z.string().optional(),
  cost_price_tax: z.string().optional(),
  is_active: z.boolean(),
});

export type ProviderFormValues = z.infer<typeof providerSchema>;

export interface ProviderFormData {
  name: string;
  fields: Record<string, unknown>;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  initialData?: ProviderEntity | null;
  isSubmitting?: boolean;
}

export const ProviderModal: FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["business", "core"]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: "",
      code: "",
      cost_price: "",
      cost_price_tax: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      const rawFields = (initialData.fields as Record<string, unknown>) || {};
      reset({
        name: initialData.name,
        code: typeof rawFields.code === "string" ? rawFields.code : "",
        cost_price:
          typeof rawFields.cost_price === "string" ? rawFields.cost_price : "",
        cost_price_tax:
          typeof rawFields.cost_price_tax === "string"
            ? rawFields.cost_price_tax
            : "",
        is_active: initialData.is_active,
      });
    } else {
      reset({
        name: "",
        code: "",
        cost_price: "",
        cost_price_tax: "",
        is_active: true,
      });
    }
  }, [initialData, reset]);

  const onFormSubmit = async (data: ProviderFormValues) => {
    const fieldsRecord: Record<string, unknown> = {};
    if (data.code?.trim()) {
      fieldsRecord.code = data.code.trim();
    }
    if (data.cost_price?.trim()) {
      fieldsRecord.cost_price = data.cost_price.trim();
    }
    if (data.cost_price_tax?.trim()) {
      fieldsRecord.cost_price_tax = data.cost_price_tax.trim();
    }

    await onSubmit({
      name: data.name.trim(),
      fields: fieldsRecord,
      is_active: data.is_active,
    });
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isSubmitting}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("core:cancel")}
      </Button>
      <Button
        variant="contained"
        color="primary"
        type="submit"
        form="provider-form"
        disabled={isSubmitting}
        data-testid="save-provider-btn"
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("core:save")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={
        initialData
          ? t("business:edit_provider_modal_title")
          : t("business:new_provider_modal_title")
      }
      size="sm"
      actions={modalActions}
    >
      <FormContainer
        id="provider-form"
        onSubmit={handleSubmit(onFormSubmit)}
      >
        {/* is_active Switch at top, matching Core pattern */}
        <SwitchWrapper>
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <StyledFormControlLabel
                control={
                  <StyledSwitch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    name="is_active"
                    disabled={isSubmitting}
                    data-testid="provider-active-switch"
                  />
                }
                label={t("business:active_label")}
                labelPlacement="start"
              />
            )}
          />
        </SwitchWrapper>

        {/* Name input */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              id="provider-name"
              name={field.name}
              label={t("business:provider_name")}
              placeholder="Ej: Distribuidora Los Andes"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={!!errors.name}
              helperText={
                errors.name?.message ? t(errors.name.message) : undefined
              }
              required
              disabled={isSubmitting}
              data-testid="provider-name-input"
            />
          )}
        />

        <Divider sx={{ my: 0.5 }} />

        {/* Invoice Columns Mapping Section */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t("business:invoice_columns_mapping_title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("business:invoice_columns_mapping_desc")}
            </Typography>
          </Box>

          {/* Code column input */}
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <TextInput
                id="provider-field-code"
                name={field.name}
                label={t("business:mapping_field_code_label")}
                placeholder={t("business:mapping_field_code_placeholder")}
                helperText={t("business:mapping_field_code_helper")}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                data-testid="provider-field-code-input"
              />
            )}
          />

          {/* Cost price column input */}
          <Controller
            name="cost_price"
            control={control}
            render={({ field }) => (
              <TextInput
                id="provider-field-cost-price"
                name={field.name}
                label={t("business:mapping_field_cost_price_label")}
                placeholder={t("business:mapping_field_cost_price_placeholder")}
                helperText={t("business:mapping_field_cost_price_helper")}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                data-testid="provider-field-cost-price-input"
              />
            )}
          />

          {/* Cost price tax column input */}
          <Controller
            name="cost_price_tax"
            control={control}
            render={({ field }) => (
              <TextInput
                id="provider-field-cost-price-tax"
                name={field.name}
                label={t("business:mapping_field_cost_price_tax_label")}
                placeholder={t(
                  "business:mapping_field_cost_price_tax_placeholder"
                )}
                helperText={t("business:mapping_field_cost_price_tax_helper")}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                data-testid="provider-field-cost-price-tax-input"
              />
            )}
          />
        </Box>
      </FormContainer>
    </BaseModal>
  );
};

export default ProviderModal;
