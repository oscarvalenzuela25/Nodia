import type { FC, ChangeEvent } from "react";
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

const fieldMappingSchema = z.object({
  value: z.string(),
  instructions: z.string(),
});

const providerSchema = z.object({
  name: z.string().trim().min(2, "business:provider_name_min"),
  tax: z
    .number({ message: "business:provider_tax_required" })
    .int("business:provider_tax_integer")
    .min(0, "business:provider_tax_min")
    .max(100, "business:provider_tax_max"),
  code: fieldMappingSchema,
  cost_price: fieldMappingSchema,
  cost_price_tax: fieldMappingSchema,
  packages: fieldMappingSchema,
  units_per_package: fieldMappingSchema,
  is_active: z.boolean(),
});

export type ProviderFormValues = z.infer<typeof providerSchema>;

export interface ProviderFormData {
  name: string;
  tax: number;
  fields: Record<string, { value: string; instructions: string }>;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  initialData?: ProviderEntity | null;
  isSubmitting?: boolean;
}

const defaultFieldMapping = { value: "", instructions: "" };

const extractField = (
  raw: unknown
): { value: string; instructions: string } => {
  if (!raw) return { value: "", instructions: "" };
  if (typeof raw === "string") return { value: raw, instructions: "" };
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      value: typeof obj.value === "string" ? obj.value : "",
      instructions:
        typeof obj.instructions === "string" ? obj.instructions : "",
    };
  }
  return { value: "", instructions: "" };
};

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
    watch,
    formState: { errors },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: "",
      tax: 19,
      code: defaultFieldMapping,
      cost_price: defaultFieldMapping,
      cost_price_tax: defaultFieldMapping,
      packages: defaultFieldMapping,
      units_per_package: defaultFieldMapping,
      is_active: true,
    },
  });

  // Watch field values to conditionally display instructions inputs
  const codeValue = watch("code.value");
  const costPriceValue = watch("cost_price.value");
  const costPriceTaxValue = watch("cost_price_tax.value");
  const packagesValue = watch("packages.value");
  const unitsPerPackageValue = watch("units_per_package.value");

  useEffect(() => {
    if (initialData) {
      const rawFields = (initialData.fields as Record<string, unknown>) || {};
      reset({
        name: initialData.name,
        tax:
          initialData.tax !== undefined && initialData.tax !== null
            ? Number(initialData.tax)
            : 19,
        code: extractField(rawFields.code),
        cost_price: extractField(rawFields.cost_price),
        cost_price_tax: extractField(rawFields.cost_price_tax),
        packages: extractField(rawFields.packages),
        units_per_package: extractField(rawFields.units_per_package),
        is_active: initialData.is_active,
      });
    } else {
      reset({
        name: "",
        tax: 19,
        code: defaultFieldMapping,
        cost_price: defaultFieldMapping,
        cost_price_tax: defaultFieldMapping,
        packages: defaultFieldMapping,
        units_per_package: defaultFieldMapping,
        is_active: true,
      });
    }
  }, [initialData, reset]);

  const onFormSubmit = async (data: ProviderFormValues) => {
    const fieldsRecord: Record<string, { value: string; instructions: string }> =
      {};
    const mappingKeys = [
      "code",
      "cost_price",
      "cost_price_tax",
      "packages",
      "units_per_package",
    ] as const;

    for (const key of mappingKeys) {
      const item = data[key];
      const val = item?.value?.trim();
      if (val) {
        fieldsRecord[key] = {
          value: val,
          instructions: item?.instructions?.trim() || "",
        };
      }
    }

    await onSubmit({
      name: data.name.trim(),
      tax: Number(data.tax),
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

        {/* Tax input */}
        <Controller
          name="tax"
          control={control}
          render={({ field }) => (
            <TextInput
              id="provider-tax"
              name={field.name}
              type="number"
              label={t("business:provider_tax")}
              placeholder="19"
              value={field.value !== undefined ? String(field.value) : ""}
              onChange={(e: ChangeEvent<HTMLInputElement> | string) => {
                const val =
                  typeof e === "object" && e && "target" in e
                    ? (e.target as HTMLInputElement).value
                    : e;
                field.onChange(val === "" ? "" : Number(val));
              }}
              onBlur={field.onBlur}
              error={!!errors.tax}
              helperText={
                errors.tax?.message
                  ? t(errors.tax.message)
                  : t("business:provider_tax_helper")
              }
              required
              disabled={isSubmitting}
              data-testid="provider-tax-input"
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

          {/* 1. Code Column */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Controller
              name="code.value"
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
            {Boolean(codeValue?.trim()) && (
              <Box sx={{ pl: 2 }}>
                <Controller
                  name="code.instructions"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="provider-field-code-instructions"
                      name={field.name}
                      label={t("business:mapping_field_instructions_label")}
                      placeholder={t(
                        "business:mapping_field_code_instructions_placeholder"
                      )}
                      helperText={t("business:mapping_field_instructions_helper")}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      multiline
                      rows={2}
                      data-testid="provider-field-code-instructions-input"
                    />
                  )}
                />
              </Box>
            )}
          </Box>

          {/* 2. Cost Price Column (sin IVA) */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Controller
              name="cost_price.value"
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
            {Boolean(costPriceValue?.trim()) && (
              <Box sx={{ pl: 2 }}>
                <Controller
                  name="cost_price.instructions"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="provider-field-cost-price-instructions"
                      name={field.name}
                      label={t("business:mapping_field_instructions_label")}
                      placeholder={t(
                        "business:mapping_field_cost_price_instructions_placeholder"
                      )}
                      helperText={t("business:mapping_field_instructions_helper")}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      multiline
                      rows={2}
                      data-testid="provider-field-cost-price-instructions-input"
                    />
                  )}
                />
              </Box>
            )}
          </Box>

          {/* 3. Cost Price Tax Column (con IVA) */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Controller
              name="cost_price_tax.value"
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
            {Boolean(costPriceTaxValue?.trim()) && (
              <Box sx={{ pl: 2 }}>
                <Controller
                  name="cost_price_tax.instructions"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="provider-field-cost-price-tax-instructions"
                      name={field.name}
                      label={t("business:mapping_field_instructions_label")}
                      placeholder={t(
                        "business:mapping_field_cost_price_tax_instructions_placeholder"
                      )}
                      helperText={t("business:mapping_field_instructions_helper")}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      multiline
                      rows={2}
                      data-testid="provider-field-cost-price-tax-instructions-input"
                    />
                  )}
                />
              </Box>
            )}
          </Box>

          {/* 4. Packages Column (cajas / embalaje) */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Controller
              name="packages.value"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="provider-field-packages"
                  name={field.name}
                  label={t("business:mapping_field_packages_label")}
                  placeholder={t("business:mapping_field_packages_placeholder")}
                  helperText={t("business:mapping_field_packages_helper")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  data-testid="provider-field-packages-input"
                />
              )}
            />
            {Boolean(packagesValue?.trim()) && (
              <Box sx={{ pl: 2 }}>
                <Controller
                  name="packages.instructions"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="provider-field-packages-instructions"
                      name={field.name}
                      label={t("business:mapping_field_instructions_label")}
                      placeholder={t(
                        "business:mapping_field_packages_instructions_placeholder"
                      )}
                      helperText={t("business:mapping_field_instructions_helper")}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      multiline
                      rows={2}
                      data-testid="provider-field-packages-instructions-input"
                    />
                  )}
                />
              </Box>
            )}
          </Box>

          {/* 5. Units Per Package Column (unidades por caja) */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Controller
              name="units_per_package.value"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="provider-field-units-per-package"
                  name={field.name}
                  label={t("business:mapping_field_units_per_package_label")}
                  placeholder={t(
                    "business:mapping_field_units_per_package_placeholder"
                  )}
                  helperText={t(
                    "business:mapping_field_units_per_package_helper"
                  )}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  data-testid="provider-field-units-per-package-input"
                />
              )}
            />
            {Boolean(unitsPerPackageValue?.trim()) && (
              <Box sx={{ pl: 2 }}>
                <Controller
                  name="units_per_package.instructions"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="provider-field-units-per-package-instructions"
                      name={field.name}
                      label={t("business:mapping_field_instructions_label")}
                      placeholder={t(
                        "business:mapping_field_units_per_package_instructions_placeholder"
                      )}
                      helperText={t("business:mapping_field_instructions_helper")}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      multiline
                      rows={2}
                      data-testid="provider-field-units-per-package-instructions-input"
                    />
                  )}
                />
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        {/* is_active Switch at bottom, matching Core pattern */}
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
      </FormContainer>
    </BaseModal>
  );
};

export default ProviderModal;
